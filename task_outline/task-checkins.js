/* Daily check-ins are journal records, never task completion events. */
const VERSION = 1;
const esc = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const safeName = value => String(value).replace(/[\x00-\x1f<>:"/\\|?*]/g, "_").replace(/[. ]+$/, "").slice(0, 80) || "长期任务";
const quote = value => String(value ?? "").replace(/\r\n/g, "\n").split("\n").map(line => `> ${line}`).join("\n");

function renderEntry(entry) {
  return `<!-- tcc-checkin:${entry.day} -->\n## ${entry.day}\n\n- 类型：${entry.kind === "rest" ? "休息" : "打卡"}\n- 时长：${entry.minutes} 分钟\n\n### 今日内容\n${quote(entry.content)}\n\n### 收获与问题\n${quote(entry.reflection)}\n\n### 下一步\n${quote(entry.next)}\n<!-- /tcc-checkin:${entry.day} -->`;
}

function create({ app, core, DateTime, parseYaml, stringifyYaml, titleOf, folder = "daliy record/打卡记录" }) {
  let cache = new Map(), queue = Promise.resolve();
  const serial = action => { const job = queue.then(action); queue = job.catch(() => {}); return job; };
  const today = () => DateTime.now().startOf("day");
  function validDay(value) {
    const date = DateTime.fromISO(String(value ?? ""));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "") || !date.isValid) throw new Error("打卡日期不正确");
    return date.startOf("day");
  }

  function parse(content) {
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
    const next = new Map(), errors = [];
    for (const file of files()) {
      try {
        const doc = parse(await app.vault.read(file));
        const key = doc.metadata.related_task_id;
        if (doc.metadata.tcc_checkin_version !== VERSION || !ids.has(key)) continue;
        const entries = next.get(key) ?? [];
        for (const entry of doc.entries) {
          if (entries.some(item => item.day === entry.day)) throw new Error("同一任务的同一天存在重复打卡");
          entries.push({ ...entry, path: file.path });
        }
        next.set(key, entries);
      } catch (error) { errors.push(`${file.path}：${error.message}`); }
    }
    cache = next;
    return errors;
  }

  function stats(task) {
    const now = today(), start = now.startOf("week");
    const entries = (cache.get(core.identity(task)) ?? []).filter(entry => entry.day <= now.toFormat("yyyy-LL-dd")).slice().sort((a, b) => b.day.localeCompare(a.day));
    const completed = entries.filter(entry => entry.kind === "done");
    const week = completed.filter(entry => entry.day >= start.toFormat("yyyy-LL-dd"));
    return { entries, count: completed.length, minutes: completed.reduce((sum, entry) => sum + entry.minutes, 0), weekCount: week.length, weekMinutes: week.reduce((sum, entry) => sum + entry.minutes, 0), goal: core.habit(task).goal, current: entries.find(entry => entry.day === now.toFormat("yyyy-LL-dd")) };
  }

  async function ensureFolder() {
    let path = "";
    for (const part of folder.split("/")) {
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
      if (entry.kind === "done" && !entry.content) throw new Error("请记录今天完成了什么");
      if ([entry.content, entry.reflection, entry.next].some(value => /<!--\s*\/?tcc-checkin:/.test(value))) throw new Error("记录内容不能包含打卡系统标记");
      const live = await core.snapshot(task);
      if (!core.habit(live).enabled) throw new Error("请先开启任务的打卡模式");
      const key = core.identity(live), month = payload.day.slice(0, 7);
      function update(content) {
        const doc = parse(content);
        if (doc.metadata.tcc_checkin_version !== VERSION || doc.metadata.related_task_id !== key || doc.metadata.checkin_month !== month) throw new Error("月度记录归属已变化，请刷新后重试");
        const previous = doc.entries.find(item => item.day === entry.day);
        if (payload.expected !== undefined && payload.expected !== (previous?.raw ?? null)) throw new Error("当天记录已被修改，请重新打开后再保存");
        const newline = content.includes("\r\n") ? "\r\n" : "\n";
        const block = renderEntry(entry).replace(/\n/g, newline);
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
          parse(content);
          matches.push(file);
        }
      }
      if (matches.length > 1) throw new Error("同一任务存在多个当月打卡文件，请先合并");
      if (matches.length) {
        await app.vault.process(matches[0], update);
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
          const doc = parse(await app.vault.read(existing));
          if (doc.metadata.related_task_id === key && doc.metadata.checkin_month === month && doc.metadata.tcc_checkin_version === VERSION) {
            await app.vault.process(existing, update);
            return path;
          }
          continue;
        }
        try { await app.vault.create(path, update(content)); return path; }
        catch (error) { if (!app.vault.getAbstractFileByPath(path)) throw error; suffix--; }
      }
      throw new Error("同名文件过多，请整理打卡目录");
    });
  }

  function button(task, label = "今日打卡", day = "") {
    return `<button type="button" data-habit-checkin="${esc(core.identity(task))}" ${day ? `data-checkin-day="${day}"` : ""}>${esc(label)}</button>`;
  }

  function todayHtml(items) {
    if (!items.length) return "";
    return `<section class="tcc-habits"><h3>今日打卡 <span>${items.length}</span></h3>${items.map(({ task, parent }) => {
      const data = stats(task);
      return `<div class="tcc-habit-row"><div><button type="button" class="tcc-today-title" data-today-detail="${esc(core.identity(task))}">${esc(titleOf(task.text))}</button>${parent ? `<small>所属：${esc(titleOf(parent.text))}</small>` : ""}<p>本周 ${data.weekCount}/${data.goal} 天 · ${data.weekMinutes} 分钟</p></div><span class="tcc-habit-status ${data.current ? "recorded" : ""}">${data.current ? data.current.kind === "rest" ? "今日休息" : `已打卡 · ${data.current.minutes} 分钟` : "今日未打卡"}</span>${button(task, data.current ? "修改记录" : "今日打卡")}</div>`;
    }).join("")}</section>`;
  }

  function detailHtml(task) {
    const data = stats(task), enabled = core.habit(task).enabled;
    if (!enabled && !data.entries.length) return "";
    const paths = [...new Set(data.entries.map(entry => entry.path))];
    return `<section class="tcc-detail-section tcc-habit-detail"><div class="tcc-section-head"><h2>打卡记录</h2>${enabled ? button(task, data.current ? "修改今日记录" : "今日打卡") : '<span>打卡模式已关闭</span>'}</div><div class="tcc-habit-stats"><span>本周 ${data.weekCount}/${data.goal} 天</span><span>本周 ${data.weekMinutes} 分钟</span><span>累计 ${data.count} 天</span><span>累计 ${data.minutes} 分钟</span></div><details class="tcc-habit-history" open><summary>最近记录</summary>${data.entries.slice(0, 31).map(entry => `<article><header><strong>${entry.day} · ${entry.kind === "rest" ? "休息日" : `${entry.minutes} 分钟`}</strong>${enabled ? button(task, "修改", entry.day) : ""}</header>${entry.content ? `<p>${esc(entry.content)}</p>` : ""}${entry.reflection ? `<p><b>收获与问题：</b>${esc(entry.reflection)}</p>` : ""}${entry.next ? `<p><b>下一步：</b>${esc(entry.next)}</p>` : ""}</article>`).join("") || '<p class="tcc-empty">还没有打卡记录</p>'}</details><div class="tcc-habit-archives">${paths.map(path => `<button type="button" data-habit-path="${esc(path)}">${esc(path.split("/").at(-1).slice(0, 7))} 月度记录</button>`).join("")}</div></section>`;
  }

  function bind(root, tasks, sourceFile) {
    root.addEventListener("click", async event => {
      const archive = event.target.closest("[data-habit-path]");
      if (archive) app.workspace.openLinkText(archive.dataset.habitPath, sourceFile, false);
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
      dialog.innerHTML = `<form><header><h3>${esc(titleOf(task.text))} · 打卡</h3><button type="button" data-close aria-label="关闭"><span data-tcc-icon="x">关闭</span></button></header><div class="tcc-editor-fields"><div class="tcc-editor-pair"><label class="tcc-editor-field"><span>日期</span><input type="date" name="day" max="${today().toFormat("yyyy-LL-dd")}" required></label><label class="tcc-editor-field"><span>记录类型</span><select name="kind"><option value="done">打卡</option><option value="rest">休息日</option></select></label></div><label class="tcc-editor-field"><span>时长（分钟）</span><input type="number" name="minutes" min="0" max="1440" step="1" value="0"></label><label class="tcc-editor-field"><span>今天完成了什么</span><textarea name="content" rows="3" required></textarea></label><label class="tcc-editor-field"><span>收获或问题</span><textarea name="reflection" rows="2"></textarea></label><label class="tcc-editor-field"><span>下一步</span><textarea name="next" rows="2"></textarea></label></div><p class="tcc-editor-error" role="alert" hidden></p><footer><button type="button" data-close>取消</button><button type="submit">保存打卡</button></footer></form>`;
      document.body.appendChild(dialog);
      core.icons(dialog);
      const form = dialog.querySelector("form");
      let expected = null;
      const toggleRest = () => { const rest = form.elements.kind.value === "rest"; form.elements.minutes.disabled = rest; form.elements.content.required = !rest; };
      const fill = () => {
        const entry = (cache.get(core.identity(task)) ?? []).find(item => item.day === form.elements.day.value);
        expected = entry?.raw ?? null;
        for (const name of ["kind", "minutes", "content", "reflection", "next"]) form.elements[name].value = entry?.[name] ?? (name === "kind" ? "done" : name === "minutes" ? 0 : "");
        toggleRest();
      };
      form.elements.day.value = trigger.dataset.checkinDay || today().toFormat("yyyy-LL-dd");
      fill();
      form.elements.day.addEventListener("change", fill);
      form.elements.kind.addEventListener("change", toggleRest);
      dialog.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => dialog.close()));
      dialog.addEventListener("close", () => dialog.remove(), { once: true });
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const submit = form.querySelector('[type="submit"]'), error = form.querySelector("[role=alert]");
        if (submit.disabled) return;
        submit.disabled = true;
        error.hidden = true;
        try {
          await saveEntry(task, { ...Object.fromEntries(new FormData(form)), expected });
          const errors = await load(tasks);
          if (errors.length) throw new Error(errors.join("；"));
          fill();
          await core.refresh();
          dialog.close();
        } catch (failure) { error.textContent = failure.message; error.hidden = false; }
        finally { submit.disabled = false; }
      });
      dialog.showModal();
    });
  }

  return { load, stats, saveEntry, parse, todayHtml, detailHtml, bind };
}

module.exports = { create, renderEntry };
