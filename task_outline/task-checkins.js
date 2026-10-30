/* Daily check-ins are journal records, never task completion events. */
const VERSION = 1;
const esc = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const safeName = value => String(value).replace(/[\x00-\x1f<>:"/\\|?*]/g, "_").replace(/[. ]+$/, "").slice(0, 80) || "长期任务";
const quote = value => String(value ?? "").replace(/\r\n/g, "\n").split("\n").map(line => `> ${line}`).join("\n");
const MILESTONES = [
  [1, "迈出第一步"], [3, "渐入状态"], [7, "七次积累"], [14, "稳步前进"],
  [30, "三十次坚持"], [60, "持续精进"], [100, "百次积累"]
];

function growth(entries, now) {
  const end = now.toFormat("yyyy-LL-dd"), weekStart = now.startOf("week").toFormat("yyyy-LL-dd");
  const unique = new Map();
  for (const entry of entries) if (entry.day <= end) unique.set(`${entry.taskId ?? "habit"}:${entry.day}`, entry);
  const all = [...unique.values()];
  const done = all.filter(entry => entry.kind === "done");
  const xp = done.length * 10;
  const calendarStart = now.startOf("week").minus({ weeks: 3 });
  return {
    count: done.length, xp, level: Math.floor(xp / 100) + 1, levelProgress: xp % 100,
    activeDays: new Set(done.map(entry => entry.day)).size,
    minutes: done.reduce((sum, entry) => sum + entry.minutes, 0),
    weekCount: done.filter(entry => entry.day >= weekStart).length,
    milestones: MILESTONES.map(([count, label]) => ({ count, label, unlocked: done.length >= count })),
    calendar: Array.from({ length: 28 }, (_, index) => {
      const day = calendarStart.plus({ days: index }).toFormat("yyyy-LL-dd");
      const records = all.filter(entry => entry.day === day);
      return { day, count: records.filter(entry => entry.kind === "done").length, rest: records.some(entry => entry.kind === "rest"), future: day > end };
    })
  };
}

function renderEntry(entry) {
  const links = entry.noteLinks ?? entry.notePaths ?? (entry.notePath ? [entry.notePath] : []);
  return `<!-- tcc-checkin:${entry.day} -->\n## ${entry.day}\n\n- 类型：${entry.kind === "rest" ? "休息" : "打卡"}\n- 时长：${entry.minutes} 分钟\n\n### 今日内容\n${quote(entry.content)}\n\n### 收获与问题\n${quote(entry.reflection)}\n\n### 下一步\n${quote(entry.next)}${links.length ? `\n\n### 文本记录\n${links.map(link => `> [[${link}]]`).join("\n")}` : ""}\n<!-- /tcc-checkin:${entry.day} -->`;
}

function create({ app, core, DateTime, parseYaml, stringifyYaml, titleOf, folder = "daliy record/打卡记录" }) {
  let cache = new Map(), history = new Map(), loadErrors = [], queue = Promise.resolve();
  const serial = action => { const job = queue.then(action); queue = job.catch(() => {}); return job; };
  const today = () => DateTime.now().startOf("day");
  const noteRoot = "任务清单";
  const noteName = value => safeName(value).replace(/[\[\]#^]/g, "_");
  const allowedNotePath = value => typeof value === "string" && value.startsWith(`${noteRoot}/`) && /\.md$/i.test(value) && !/[\\\r\n\[\]#|:]/.test(value) && !value.split("/").some(part => part === "." || part === ".." || !part);
  function resolveNotePath(reference, sourcePath = `${folder}/index.md`) {
    let link = String(reference ?? "").trim().replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].split("#")[0].trim();
    try { link = decodeURIComponent(link); } catch { /* Keep literal percent characters. */ }
    link = link.replace(/\\/g, "/");
    if (!link || /^[a-z][a-z0-9+.-]*:/i.test(link) || link.startsWith("/")) throw new Error("文本记录必须是任务清单内的笔记链接");
    const normalize = value => {
      const parts = [];
      for (const part of value.split("/")) {
        if (!part || part === ".") continue;
        if (part === "..") { if (!parts.length) throw new Error("文本链接超出笔记库"); parts.pop(); }
        else parts.push(part);
      }
      return parts.join("/");
    };
    const explicit = link.includes("/");
    const relative = /^\.{1,2}\//.test(link);
    let path = normalize(relative ? `${sourcePath.slice(0, sourcePath.lastIndexOf("/"))}/${link}` : link);
    if (!/\.md$/i.test(path)) path += ".md";
    if ((relative || link.startsWith(`${noteRoot}/`)) && !allowedNotePath(path)) throw new Error("文本记录链接实际指向任务清单以外的位置");
    const resolved = app.metadataCache?.getFirstLinkpathDest?.(link, sourcePath);
    if (resolved) {
      if (!allowedNotePath(resolved.path)) throw new Error("文本记录链接实际指向任务清单以外的位置");
      return resolved.path;
    }
    if (allowedNotePath(path)) {
      const exact = app.vault.getAbstractFileByPath(path);
      if (exact) return exact.path;
    }
    const candidates = (app.vault.getMarkdownFiles?.() ?? []).filter(file => allowedNotePath(file.path) &&
      (explicit ? file.path.toLowerCase() === path.toLowerCase() || (!relative && !link.startsWith(`${noteRoot}/`) && file.path.toLowerCase().endsWith(`/${path.toLowerCase()}`)) : file.path.split("/").at(-1).toLowerCase() === path.toLowerCase()));
    if (candidates.length === 1) return candidates[0].path;
    if (candidates.length > 1) throw new Error("有多个同名笔记，请使用包含子目录的链接");
    if (allowedNotePath(path)) return path;
    throw new Error(`找不到关联笔记：${link}，请使用任务清单内的完整路径`);
  }
  function validDay(value) {
    const date = DateTime.fromISO(String(value ?? ""));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "") || !date.isValid) throw new Error("打卡日期不正确");
    return date.startOf("day");
  }

  function parse(content, sourcePath = `${folder}/index.md`) {
    const front = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!front) return { metadata: {}, body: content, entries: [] };
    const metadata = parseYaml(front[1]) ?? {};
    const body = content.slice(front[0].length);
    if (metadata.tcc_checkin_version !== VERSION) return { metadata, body, entries: [] };
    if (!/^\d{4}-\d{2}$/.test(metadata.checkin_month ?? "")) throw new Error("打卡月份属性缺失");
    const entries = [], seen = new Set();
    const matches = [...body.matchAll(/<!-- tcc-checkin:(\d{4}-\d{2}-\d{2}) -->[\s\S]*?<!-- \/tcc-checkin:\1 -->/g)];
    if ((body.match(/<!-- \/?tcc-checkin:/g) ?? []).length !== matches.length * 2) throw new Error("打卡记录标记不完整，原文已保留");
    for (const match of matches) {
      const day = match[1], raw = match[0].replace(/\r\n/g, "\n");
      validDay(day);
      if (day.slice(0, 7) !== metadata.checkin_month || seen.has(day)) throw new Error("打卡日期重复或与月份不符");
      seen.add(day);
      const kind = raw.match(/^- 类型：(打卡|休息)$/m)?.[1];
      const minutes = Number(raw.match(/^- 时长：(\d+) 分钟$/m)?.[1]);
      if (!kind || !Number.isInteger(minutes) || minutes < 0 || minutes > 1440 || (kind === "休息" && minutes !== 0)) throw new Error("打卡类型或时长格式不正确");
      const readField = name => {
        const text = raw.match(new RegExp(`^### ${name}\\n([\\s\\S]*?)(?=\\n### |\\n<!-- /tcc-checkin:)`, "m"))?.[1];
        if (text === undefined) throw new Error("打卡记录字段缺失");
        const lines = text.replace(/\n+$/, "").split("\n");
        if (lines.some(line => !/^> ?/.test(line))) throw new Error("打卡正文格式已变化，请保留引用格式或将额外笔记放在记录块外");
        return lines.map(line => line.replace(/^> ?/, "")).join("\n");
      };
      const entry = { day, kind: kind === "休息" ? "rest" : "done", minutes, content: readField("今日内容"), reflection: readField("收获与问题"), next: readField("下一步"), raw };
      if (/^### 文本记录$/m.test(raw)) {
        entry.noteLinks = readField("文本记录").split("\n").map(line => {
          const link = line.match(/^\[\[(.+)\]\]$/)?.[1];
          if (!link) throw new Error("文本记录应使用每行一个双链的格式");
          return link;
        });
        entry.notePaths = [...new Set(entry.noteLinks.map(link => resolveNotePath(link, sourcePath)))];
        entry.notePath = entry.notePaths[0];
      }
      if (renderEntry(entry) !== raw) throw new Error("打卡块含额外内容，请移到记录块外后再编辑");
      entries.push(entry);
    }
    return { metadata, body, entries };
  }

  function files() {
    return (app.vault.getMarkdownFiles?.() ?? []).filter(file => file.path.startsWith(`${folder}/`));
  }

  async function load(tasks) {
    const ids = new Set(tasks.map(core.identity));
    const next = new Map(), allHistory = new Map(), errors = [];
    for (const file of files()) {
      try {
        const doc = parse(await app.vault.read(file), file.path);
        const key = doc.metadata.related_task_id;
        if (doc.metadata.tcc_checkin_version !== VERSION || typeof key !== "string" || !key.startsWith("tcc:")) continue;
        const record = allHistory.get(key) ?? { name: doc.metadata.related_task || "历史习惯", entries: [] };
        const entries = record.entries;
        if (doc.entries.some(entry => entries.some(item => item.day === entry.day))) throw new Error("同一任务的同一天存在重复打卡");
        for (const entry of doc.entries) {
          entries.push({ ...entry, path: file.path });
        }
        allHistory.set(key, record);
        if (ids.has(key)) next.set(key, entries);
      } catch (error) { errors.push(`${file.path}：${error.message}`); }
    }
    cache = next;
    history = allHistory;
    loadErrors = errors;
    return errors;
  }

  function stats(task) {
    const now = today(), start = now.startOf("week");
    const entries = (cache.get(core.identity(task)) ?? []).filter(entry => entry.day <= now.toFormat("yyyy-LL-dd")).slice().sort((a, b) => b.day.localeCompare(a.day));
    const completed = entries.filter(entry => entry.kind === "done");
    const week = completed.filter(entry => entry.day >= start.toFormat("yyyy-LL-dd"));
    return { entries, count: completed.length, minutes: completed.reduce((sum, entry) => sum + entry.minutes, 0), weekCount: week.length, weekMinutes: week.reduce((sum, entry) => sum + entry.minutes, 0), goal: core.habit(task).goal, current: entries.find(entry => entry.day === now.toFormat("yyyy-LL-dd")), growth: growth(entries, now) };
  }

  function overview(tasks) {
    const known = new Map(tasks.map(task => [core.identity(task), task]));
    const keys = new Set([...history.keys(), ...tasks.filter(task => core.habit(task).enabled).map(core.identity)]);
    const habits = [...keys].map(key => {
      const task = known.get(key), stored = history.get(key);
      const entries = (stored?.entries ?? cache.get(key) ?? []).filter(entry => entry.day <= today().toFormat("yyyy-LL-dd"));
      return { key, task, name: task ? titleOf(task.text) : stored?.name ?? "历史习惯", entries, growth: growth(entries, today()), goal: task ? core.habit(task).goal : null };
    }).sort((a, b) => b.growth.count - a.growth.count || a.name.localeCompare(b.name, "zh-CN"));
    const entries = habits.flatMap(item => item.entries.map(entry => ({ ...entry, taskId: item.key, name: item.name, task: item.task })));
    entries.sort((a, b) => b.day.localeCompare(a.day) || a.name.localeCompare(b.name, "zh-CN"));
    return { habits, entries, growth: growth(entries, today()), errors: loadErrors.slice() };
  }

  function growthHtml(data, task = null, readOnly = false) {
    const attribute = task ? `data-habit-checkin="${esc(core.identity(task))}"` : "";
    return `<div class="tcc-growth-level"><strong>Lv. ${data.level}</strong><span>${data.xp} 成长值</span><progress max="100" value="${data.levelProgress}" aria-label="当前等级进度"></progress><small>距下一级 ${100 - data.levelProgress}</small></div>
      <div class="tcc-growth-calendar"><h3>最近四周</h3><div class="tcc-growth-days">${data.calendar.map(item => `<button type="button" ${attribute} ${task ? `data-checkin-day="${item.day}"` : `data-reward-day="${item.day}"`} data-count="${Math.min(4, item.count)}" class="${item.rest && !item.count ? "rest" : ""}" ${item.future || readOnly ? "disabled" : ""} title="${item.day} · ${item.future ? "未到日期" : item.count ? `完成 ${item.count} 项` : item.rest ? "休息日" : "暂无记录"}" aria-label="${item.day}">${Number(item.day.slice(-2))}</button>`).join("")}</div></div>
      <div class="tcc-growth-badges">${data.milestones.map(item => `<span class="${item.unlocked ? "unlocked" : "locked"}" title="累计完成 ${item.count} 次"><span data-tcc-icon="${item.unlocked ? "award" : "lock"}"></span><b>${item.label}</b><small>${Math.min(data.count, item.count)}/${item.count} 次</small></span>`).join("")}</div>`;
  }

  function feedback(task, payload, before, after, beforeTotal = before.growth, afterTotal = after.growth) {
    const previous = before.entries.find(entry => entry.day === payload.day);
    const newDone = payload.kind === "done" && previous?.kind !== "done";
    const unlocked = after.growth.milestones.filter(item => item.unlocked && before.count < item.count);
    return {
      xp: newDone ? 10 : 0,
      title: payload.kind === "rest" ? "休息已记录" : newDone ? `${payload.day === today().toFormat("yyyy-LL-dd") ? "今日打卡完成" : "补记完成"} · +10 成长值` : "记录已更新",
      detail: `${titleOf(task.text)} · 本周 ${after.weekCount}/${after.goal} 天${after.weekCount >= after.goal ? " · 本周目标已达成" : ""}`,
      badges: [...new Set([...unlocked.map(item => item.label), ...(afterTotal.milestones ?? []).filter(item => item.unlocked && (beforeTotal.count ?? 0) < item.count).map(item => item.label)])],
      levelUp: afterTotal.level > beforeTotal.level, level: afterTotal.level
    };
  }

  function celebrate(result, sourceFile) {
    document.querySelectorAll(".tcc-reward-feedback").forEach(node => node.remove());
    const notice = document.createElement("aside");
    notice.className = "tcc-reward-feedback tasks-command-center";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    notice.innerHTML = `<span class="tcc-reward-mark" data-tcc-icon="${result.xp ? "circle-check" : "check"}"></span><div><strong>${esc(result.title)}</strong><p>${esc(result.detail)}</p>${result.badges.length ? `<p>解锁：${esc(result.badges.join("、"))}</p>` : ""}${result.levelUp ? `<p>成长等级提升：Lv. ${result.level}</p>` : ""}<button type="button" data-reward-open>查看成就</button></div><button type="button" data-dismiss aria-label="关闭反馈" title="关闭"><span data-tcc-icon="x">×</span></button>`;
    document.body.appendChild(notice);
    core.icons(notice);
    notice.querySelector("[data-dismiss]").addEventListener("click", () => notice.remove());
    notice.querySelector("[data-reward-open]").addEventListener("click", () => {
      app.workspace.openLinkText(`${sourceFile.slice(0, sourceFile.lastIndexOf("/") + 1)}打卡成就.md`, sourceFile, false);
      notice.remove();
    });
    setTimeout(() => notice.remove(), 7000);
  }

  async function ensureFolder(target = folder) {
    let path = "";
    for (const part of target.split("/")) {
      path = path ? `${path}/${part}` : part;
      if (!app.vault.getAbstractFileByPath(path)) {
        try { await app.vault.createFolder(path); }
        catch (error) { if (!app.vault.getAbstractFileByPath(path)) throw error; }
      }
    }
  }

  async function saveEntry(task, payload) {
    return serial(async () => {
      const date = validDay(payload.day);
      if (date > today()) throw new Error("不能提前打卡，请选择今天或过去的日期");
      if (!["done", "rest"].includes(payload.kind)) throw new Error("请选择打卡或休息日");
      const minutes = payload.kind === "rest" ? 0 : Number(payload.minutes ?? 0);
      if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) throw new Error("时长应为 0 至 1440 的整数分钟");
      const text = value => String(value ?? "").replace(/\r\n/g, "\n").trim();
      const entry = { day: payload.day, kind: payload.kind, minutes, content: text(payload.content), reflection: text(payload.reflection), next: text(payload.next) };
      if (entry.kind === "done" && !entry.content && !entry.reflection && !entry.next && !payload.withTextRecord) throw new Error("请填写简短记录或心得，或选择创建文本记录");
      if ([entry.content, entry.reflection, entry.next].some(value => /<!--\s*\/?tcc-checkin:/.test(value))) throw new Error("记录内容不能包含打卡系统标记");
      const live = await core.snapshot(task);
      if (!core.habit(live).enabled) throw new Error("请先开启任务的打卡模式");
      const key = core.identity(live), month = payload.day.slice(0, 7);
      function update(content, sourcePath) {
        const doc = parse(content, sourcePath);
        if (doc.metadata.tcc_checkin_version !== VERSION || doc.metadata.related_task_id !== key || doc.metadata.checkin_month !== month) throw new Error("月度记录归属已变化，请刷新后重试");
        const previous = doc.entries.find(item => item.day === entry.day);
        if (payload.expected !== undefined && payload.expected !== (previous?.raw ?? null)) throw new Error("当天记录已被修改，请重新打开后再保存");
        const newline = content.includes("\r\n") ? "\r\n" : "\n";
        const block = renderEntry({ ...entry, notePath: previous?.notePath, noteLinks: previous?.noteLinks }).replace(/\n/g, newline);
        let body;
        if (previous) body = doc.body.replace(previous.raw.replace(/\n/g, newline), () => block);
        else {
          const nextEntry = doc.entries.slice().sort((a, b) => a.day.localeCompare(b.day)).find(item => item.day > entry.day);
          if (nextEntry) {
            const at = doc.body.indexOf(nextEntry.raw.replace(/\n/g, newline));
            body = doc.body.slice(0, at) + block + newline + newline + doc.body.slice(at);
          } else body = `${doc.body}${newline}${block}${newline}`;
        }
        return content.slice(0, content.length - doc.body.length) + body;
      }
      const matches = [];
      for (const file of files()) {
        const content = await app.vault.read(file);
        const front = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
        let metadata;
        try { metadata = front ? parseYaml(front[1]) : {}; } catch { continue; }
        if (metadata?.tcc_checkin_version === VERSION && metadata.related_task_id === key && metadata.checkin_month === month) {
          parse(content, file.path);
          matches.push(file);
        }
      }
      if (matches.length > 1) throw new Error("同一任务存在多个当月打卡文件，请先合并");
      if (matches.length) {
        await app.vault.process(matches[0], content => update(content, matches[0].path));
        return matches[0].path;
      }
      await ensureFolder();
      const prefix = `${folder}/${month} ${safeName(titleOf(live.text))} ${live.id.slice(-8)}`;
      const metadata = { tcc_checkin_version: VERSION, related_task_id: key, related_task: titleOf(live.text), checkin_month: month };
      const content = `---\n${stringifyYaml(metadata).trimEnd()}\n---\n# ${titleOf(live.text)} · ${month}\n\n`;
      for (let suffix = 1; suffix < 100; suffix++) {
        const path = `${prefix}${suffix === 1 ? "" : ` (${suffix})`}.md`;
        const existing = app.vault.getAbstractFileByPath(path);
        if (existing) {
          const doc = parse(await app.vault.read(existing), existing.path);
          if (doc.metadata.related_task_id === key && doc.metadata.checkin_month === month && doc.metadata.tcc_checkin_version === VERSION) {
            await app.vault.process(existing, content => update(content, existing.path));
            return path;
          }
          continue;
        }
        try { await app.vault.create(path, update(content, path)); return path; }
        catch (error) { if (!app.vault.getAbstractFileByPath(path)) throw error; suffix--; }
      }
      throw new Error("同名文件过多，请整理打卡目录");
    });
  }

  function metadataOf(content) {
    const front = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    return front ? parseYaml(front[1]) ?? {} : {};
  }

  async function taskNoteFolder(task) {
    const names = [...new Set([titleOf(task.text), ...core.aliases(task)].map(noteName))];
    for (const name of names) {
      const path = `${noteRoot}/${name}`;
      const existing = app.vault.getAbstractFileByPath(path);
      if (existing && Array.isArray(existing.children)) return path;
    }
    return `${noteRoot}/${names[0]}`;
  }

  async function attachJournalNote(key, day, journalPath, path, replaceMissing = false) {
    if (!allowedNotePath(path) || !app.vault.getAbstractFileByPath(path)) throw new Error("找不到任务清单内的文本记录");
    const journal = app.vault.getAbstractFileByPath(journalPath);
    if (!journal) throw new Error("找不到当天打卡记录");
    await app.vault.process(journal, current => {
      const doc = parse(current, journalPath);
      const record = doc.entries.find(item => item.day === day);
      if (!record || doc.metadata.related_task_id !== key) throw new Error("当天记录归属已变化，请重新打开打卡");
      const original = record.noteLinks ?? [];
      const links = original.filter(ref => !replaceMissing || app.vault.getAbstractFileByPath(resolveNotePath(ref, journalPath)));
      if (!links.some(ref => resolveNotePath(ref, journalPath) === path)) links.push(path);
      if (JSON.stringify(links) === JSON.stringify(original)) return current;
      const newline = current.includes("\r\n") ? "\r\n" : "\n";
      return current.replace(record.raw.replace(/\n/g, newline), () => renderEntry({ ...record, noteLinks: links }).replace(/\n/g, newline));
    });
    return path;
  }

  async function attachTextRecord(task, day, journalPath, reference) {
    return serial(async () => {
      validDay(day);
      const live = await core.snapshot(task);
      return attachJournalNote(core.identity(live), day, journalPath, resolveNotePath(reference, journalPath));
    });
  }

  async function createTextRecord(task, day, journalPath, requestedTitle = "", options = {}) {
    return serial(async () => {
      validDay(day);
      const live = await core.snapshot(task), key = core.identity(live);
      const journal = app.vault.getAbstractFileByPath(journalPath);
      if (!journal) throw new Error("找不到当天打卡记录，请先保存打卡");
      const doc = parse(await app.vault.read(journal), journalPath);
      const entry = doc.entries.find(item => item.day === day);
      if (!entry || doc.metadata.related_task_id !== key) throw new Error("当天打卡归属不匹配");
      const title = String(requestedTitle || titleOf(live.text)).replace(/[\r\n]+/g, " ").trim();
      const attach = path => attachJournalNote(key, day, journalPath, path);
      const matches = [];
      for (const file of app.vault.getMarkdownFiles?.() ?? []) {
        if (!allowedNotePath(file.path)) continue;
        let meta = app.metadataCache?.getFileCache?.(file)?.frontmatter;
        if (!meta) { try { meta = metadataOf(await app.vault.read(file)); } catch { continue; } }
        const savedDay = meta.checkin_date instanceof Date ? meta.checkin_date.toISOString().slice(0, 10) : String(meta.checkin_date ?? "");
        if (meta.tcc_checkin_text_version === VERSION && meta.related_task_id === key && savedDay === day) matches.push({ path: file.path, title: meta.tcc_checkin_text_title });
      }
      const sameTitle = matches.filter(item => item.title === title);
      if (sameTitle.length > 1) throw new Error("有多篇同标题正文，请使用打开已关联或关联已有文件选择");
      if (sameTitle.length) return attach(sameTitle[0].path);
      if (!requestedTitle && matches.length === 1) return attachJournalNote(key, day, journalPath, matches[0].path, true);
      const subfolder = String(options.subfolder ?? "").trim().replace(/\\/g, "/");
      if (subfolder && (/[<>:"|?*\r\n]/.test(subfolder) || subfolder.split("/").some(part => !part || part === "." || part === ".."))) throw new Error("请填写任务目录内的相对子目录，不要使用上级路径");
      const directory = `${await taskNoteFolder(live)}${subfolder ? `/${subfolder}` : ""}`;
      await ensureFolder(directory);
      const prefix = `${directory}/${day.replace(/-/g, ".")} ${noteName(title)}`;
      const meta = { tcc_checkin_text_version: VERSION, tcc_checkin_text_title: title, related_task_id: key, related_task: titleOf(live.text), checkin_date: day, checkin_journal: `[[${journalPath}#${day}]]` };
      const content = `---\n${stringifyYaml(meta).trimEnd()}\n---\n# ${title.replace(/[<>]/g, "")}\n\n当天打卡：[[${journalPath}#${day}|${day}]]\n\n## 详细记录\n\n\n## 资料与引用\n\n\n## 总结\n\n`;
      for (let suffix = 1; suffix < 100; suffix++) {
        const path = `${prefix}${suffix === 1 ? "" : ` (${suffix})`}.md`;
        const existing = app.vault.getAbstractFileByPath(path);
        if (existing) {
          let saved;
          try { saved = metadataOf(await app.vault.read(existing)); } catch { continue; }
          if (saved.tcc_checkin_text_version === VERSION && saved.related_task_id === key && String(saved.checkin_date) === day) return attach(path);
          continue;
        }
        try { await app.vault.create(path, content); }
        catch (error) { if (!app.vault.getAbstractFileByPath(path)) throw error; suffix--; continue; }
        return attach(path);
      }
      throw new Error("同名记录过多，请修改文本标题");
    });
  }

  function textLink(entry) {
    const paths = entry?.notePaths ?? (entry?.notePath ? [entry.notePath] : []);
    return paths.map(path => `<button type="button" data-habit-note-path="${esc(path)}" title="${esc(path)}">${paths.length === 1 ? "打开文本记录" : esc(path.split("/").at(-1).replace(/\.md$/i, ""))}</button>`).join("");
  }

  function button(task, label = "今日打卡", day = "") {
    return `<button type="button" data-habit-checkin="${esc(core.identity(task))}" ${day ? `data-checkin-day="${day}"` : ""}>${esc(label)}</button>`;
  }

  function todayHtml(items) {
    if (!items.length) return "";
    const rows = items.map(item => ({ ...item, data: stats(item.task) }));
    const completed = rows.filter(item => item.data.current?.kind === "done");
    const pending = rows.filter(item => item.data.current?.kind !== "done");
    const rests = rows.filter(item => item.data.current?.kind === "rest").length;
    const target = items.length - rests;
    const minutes = completed.reduce((sum, item) => sum + item.data.current.minutes, 0);
    const render = ({ task, parent, data }) => `<div class="tcc-habit-row"><div><button type="button" class="tcc-today-title" data-today-detail="${esc(core.identity(task))}">${esc(titleOf(task.text))}</button>${parent ? `<small>所属：${esc(titleOf(parent.text))}</small>` : ""}<p>本周 ${data.weekCount}/${data.goal} 天 · ${data.weekMinutes} 分钟${data.weekCount >= data.goal ? " · 目标达成" : ""}</p>${data.current?.kind === "done" ? `<small class="tcc-completion-proof">已收获 10 成长值</small><p>${esc((data.current.reflection || data.current.content || "").slice(0, 140))}</p>` : ""}</div><span class="tcc-habit-status ${data.current ? "recorded" : ""}">${data.current ? data.current.kind === "rest" ? "今日休息" : `已打卡 · ${data.current.minutes} 分钟` : "今日未打卡"}</span><div class="tcc-habit-buttons">${textLink(data.current)}${button(task, data.current ? "修改记录" : "今日打卡")}</div></div>`;
    return `<section class="tcc-habits"><div class="tcc-habit-heading"><h3>今日打卡 <span>${items.length}</span></h3><button type="button" data-habit-achievements>完成记录与成就</button></div><div class="tcc-daily-victory"><strong>今日完成 ${completed.length}/${target}</strong><progress value="${completed.length}" max="${Math.max(1, target)}" aria-label="今日打卡完成进度"></progress><span>${minutes} 分钟 · ${completed.length * 10} 成长值${rests ? ` · 休息 ${rests} 项` : ""}</span></div>${pending.map(render).join("")}${completed.length ? `<details class="tcc-habit-completed" open><summary>今日已完成 ${completed.length}</summary>${completed.map(render).join("")}</details>` : ""}</section>`;
  }

  function detailHtml(task) {
    const data = stats(task), enabled = core.habit(task).enabled;
    if (!enabled && !data.entries.length) return "";
    const paths = [...new Set(data.entries.map(entry => entry.path))];
    return `<section class="tcc-detail-section tcc-habit-detail"><div class="tcc-section-head"><h2>打卡记录</h2>${enabled ? button(task, data.current ? "修改今日记录" : "今日打卡") : '<span>打卡模式已关闭</span>'}</div><div class="tcc-habit-stats"><span>本周 ${data.weekCount}/${data.goal} 天</span><span>本周 ${data.weekMinutes} 分钟</span><span>累计 ${data.count} 天</span><span>累计 ${data.minutes} 分钟</span></div>${growthHtml(data.growth, task, !enabled)}<button type="button" data-habit-achievements>全部习惯的完成记录</button><details class="tcc-habit-history" open><summary>最近记录</summary>${data.entries.slice(0, 31).map(entry => `<article><header><strong>${entry.day} · ${entry.kind === "rest" ? "休息日" : `${entry.minutes} 分钟`}</strong>${enabled ? button(task, "修改", entry.day) : ""}</header>${entry.content ? `<p>${esc(entry.content)}</p>` : ""}${entry.reflection ? `<p><b>收获与问题：</b>${esc(entry.reflection)}</p>` : ""}${entry.next ? `<p><b>下一步：</b>${esc(entry.next)}</p>` : ""}${textLink(entry)}</article>`).join("") || '<p class="tcc-empty">还没有打卡记录</p>'}</details><div class="tcc-habit-archives">${paths.map(path => `<button type="button" data-habit-path="${esc(path)}">${esc(path.split("/").at(-1).slice(0, 7))} 月度记录</button>`).join("")}</div></section>`;
  }

  function bind(root, tasks, sourceFile) {
    root.addEventListener("click", async event => {
      if (event.target.closest("[data-habit-achievements]")) app.workspace.openLinkText(`${sourceFile.slice(0, sourceFile.lastIndexOf("/") + 1)}打卡成就.md`, sourceFile, false);
      const archive = event.target.closest("[data-habit-path]");
      if (archive) app.workspace.openLinkText(archive.dataset.habitPath, sourceFile, false);
      const note = event.target.closest("[data-habit-note-path]");
      if (note) await core.attempt(async () => {
        if (!allowedNotePath(note.dataset.habitNotePath) || !app.vault.getAbstractFileByPath(note.dataset.habitNotePath)) throw new Error("文本已移动或不存在，请在当天打卡中选择创建或打开文本记录重新关联");
        app.workspace.openLinkText(note.dataset.habitNotePath, sourceFile, false);
      }, root);
      const trigger = event.target.closest("[data-habit-checkin]");
      if (!trigger || trigger.disabled) return;
      const task = tasks.find(item => core.identity(item) === trigger.dataset.habitCheckin);
      if (!task) return;
      trigger.disabled = true;
      const loaded = await core.attempt(() => load(tasks), root);
      trigger.disabled = false;
      if (loaded === false) return;
      const dialog = document.createElement("dialog");
      dialog.className = "tcc-editor-dialog tasks-command-center";
      const directory = await taskNoteFolder(task);
      const listId = `checkin-files-${globalThis.crypto.randomUUID()}`;
      const existingFiles = (app.vault.getMarkdownFiles?.() ?? []).filter(file => allowedNotePath(file.path) && file.path.startsWith(`${directory}/`)).slice(0, 300);
      const noteOptions = `<div data-note-options hidden>
        <label class="tcc-editor-field"><span>文本操作</span><select name="noteAction"><option value="create">新建一篇</option><option value="open">打开已关联文本</option><option value="attach">关联已有文件</option></select></label>
        <div data-note-create><label class="tcc-editor-field"><span>文本标题</span><input name="noteTitle" value="${esc(titleOf(task.text))}"></label><label class="tcc-editor-field"><span>子目录（可选）</span><input name="noteSubfolder" value=""></label><p class="tcc-record-location">${esc(directory)}</p></div>
        <label class="tcc-editor-field" data-note-open hidden><span>已关联文本</span><select name="linkedNote"></select></label>
        <label class="tcc-editor-field" data-note-attach hidden><span>笔记链接或路径</span><input name="existingNote" list="${listId}" value=""><datalist id="${listId}">${existingFiles.map(file => `<option value="${esc(file.path)}"></option>`).join("")}</datalist></label>
      </div>`;
      dialog.innerHTML = `<form><header><h3>${esc(titleOf(task.text))} · 打卡</h3><button type="button" data-close aria-label="关闭"><span data-tcc-icon="x">关闭</span></button></header><div class="tcc-editor-fields"><div class="tcc-editor-pair"><label class="tcc-editor-field"><span>日期</span><input type="date" name="day" max="${today().toFormat("yyyy-LL-dd")}" required></label><label class="tcc-editor-field"><span>记录类型</span><select name="kind"><option value="done">打卡</option><option value="rest">休息日</option></select></label></div><label class="tcc-editor-field"><span>时长（分钟）</span><input type="number" name="minutes" min="0" max="1440" step="1" value="0"></label><label class="tcc-editor-field"><span>简短记录</span><textarea name="content" rows="3"></textarea></label><label class="tcc-editor-field"><span>收获或问题</span><textarea name="reflection" rows="2"></textarea></label><label class="tcc-editor-field"><span>下一步</span><textarea name="next" rows="2"></textarea></label></div><label class="tcc-habit-toggle tcc-checkin-note-toggle"><input type="checkbox" name="withTextRecord"><span>创建或打开文本记录（可选）</span></label>${noteOptions}<p class="tcc-record-location" data-linked-note hidden></p><p class="tcc-editor-error" role="alert" hidden></p><footer><button type="button" data-close>取消</button><button type="submit">保存打卡</button></footer></form>`;
      document.body.appendChild(dialog);
      core.icons(dialog);
      const form = dialog.querySelector("form");
      let expected = null;
      let linkedPaths = [];
      const toggleRest = () => { form.elements.minutes.disabled = form.elements.kind.value === "rest"; };
      const toggleNote = () => {
        const selected = form.elements.withTextRecord.checked;
        const action = form.elements.noteAction.value;
        form.querySelector("[data-note-options]").hidden = !selected;
        form.querySelector("[data-note-create]").hidden = action !== "create";
        form.querySelector("[data-note-open]").hidden = action !== "open";
        form.querySelector("[data-note-attach]").hidden = action !== "attach";
        form.elements.noteTitle.required = selected && action === "create";
        form.elements.existingNote.required = selected && action === "attach";
        form.querySelector('[type="submit"]').textContent = selected ? "保存并打开文本" : "保存打卡";
      };
      const fill = () => {
        const entry = (cache.get(core.identity(task)) ?? []).find(item => item.day === form.elements.day.value);
        expected = entry?.raw ?? null;
        linkedPaths = entry?.notePaths ?? (entry?.notePath ? [entry.notePath] : []);
        form.elements.withTextRecord.checked = false;
        form.querySelector("[data-linked-note]").hidden = !linkedPaths.length;
        form.querySelector("[data-linked-note]").textContent = linkedPaths.length ? `已关联 ${linkedPaths.length} 篇正文` : "";
        form.elements.linkedNote.innerHTML = linkedPaths.map(path => `<option value="${esc(path)}">${esc(path.slice(noteRoot.length + 1))}</option>`).join("");
        form.elements.noteAction.querySelector('[value="open"]').disabled = !linkedPaths.length;
        form.elements.noteAction.value = linkedPaths.length ? "open" : "create";
        for (const name of ["kind", "minutes", "content", "reflection", "next"]) form.elements[name].value = entry?.[name] ?? (name === "kind" ? "done" : name === "minutes" ? 0 : "");
        toggleRest();
        toggleNote();
      };
      form.elements.day.value = trigger.dataset.checkinDay || today().toFormat("yyyy-LL-dd");
      fill();
      form.elements.day.addEventListener("change", fill);
      form.elements.kind.addEventListener("change", toggleRest);
      form.elements.withTextRecord.addEventListener("change", toggleNote);
      form.elements.noteAction.addEventListener("change", toggleNote);
      dialog.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => dialog.close()));
      dialog.addEventListener("close", () => dialog.remove(), { once: true });
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const submit = form.querySelector('[type="submit"]'), error = form.querySelector("[role=alert]");
        if (submit.disabled) return;
        submit.disabled = true;
        error.hidden = true;
        let saved = false, notePath = "";
        try {
          const payload = Object.fromEntries(new FormData(form));
          const before = stats(task);
          const beforeTotal = overview(tasks).growth;
          const withTextRecord = form.elements.withTextRecord.checked;
          const journalPath = await saveEntry(task, { ...payload, expected, withTextRecord });
          saved = true;
          await load(tasks);
          expected = (cache.get(core.identity(task)) ?? []).find(item => item.day === payload.day)?.raw ?? expected;
          if (withTextRecord) {
            if (payload.noteAction === "create") notePath = await createTextRecord(task, payload.day, journalPath, payload.noteTitle, { subfolder: payload.noteSubfolder });
            else if (payload.noteAction === "attach") notePath = await attachTextRecord(task, payload.day, journalPath, payload.existingNote);
            else {
              const current = (cache.get(core.identity(task)) ?? []).find(item => item.day === payload.day);
              if (!current?.notePaths?.includes(payload.linkedNote) || !app.vault.getAbstractFileByPath(payload.linkedNote)) throw new Error("请选择仍然存在的已关联文本；文件移动后可用关联已有文件重新连接");
              notePath = payload.linkedNote;
            }
          }
          const errors = await load(tasks);
          expected = (cache.get(core.identity(task)) ?? []).find(item => item.day === payload.day)?.raw ?? expected;
          if (!(cache.get(core.identity(task)) ?? []).some(item => item.day === payload.day)) throw new Error(errors.join("；") || "保存后的打卡记录未能读取，请重新打开页面核对");
          const result = feedback(task, payload, before, stats(task), beforeTotal, overview(tasks).growth);
          await core.refresh();
          if (notePath) app.workspace.openLinkText(notePath, sourceFile, false);
          dialog.close();
          if (errors.length) result.detail += " · 部分历史记录读取不完整";
          celebrate(result, sourceFile);
        } catch (failure) { error.textContent = saved ? `打卡已保存，后续操作未完成：${failure.message}` : failure.message; error.hidden = false; }
        finally { submit.disabled = false; }
      });
      dialog.showModal();
    });
  }

  return { load, stats, overview, growthHtml, feedback, saveEntry, createTextRecord, attachTextRecord, resolveNotePath, parse, todayHtml, detailHtml, bind };
}

module.exports = { create, renderEntry, growth };
