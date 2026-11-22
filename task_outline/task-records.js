/* Managed task snapshots never replace the editable body of a work record. */
const START = "<!-- tcc:task-summary:start -->";
const END = "<!-- tcc:task-summary:end -->";
const VERSION = 1; // Only legacy records opt into live synchronization.
const DAILY_VERSION = 2;
const templates = {
  standard: { label: "工作记录", body: "**目标**\n\n\n**实施过程**\n\n\n**验证结果**\n\n\n**问题与下一步**\n\n" },
  debug: { label: "故障排查", body: "**现象与复现条件**\n\n\n**排查过程与证据**\n\n\n**原因与修复方案**\n\n\n**回归验证**\n\n" },
  headings: { label: "仅生成标题", body: "\n" }
};
const esc = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const md = value => String(value ?? "").replace(/[\r\n]+/g, " ").replace(/[\\`*_{}[\]<>|]/g, "\\$&");
const field = (text, key) => text.match(new RegExp(`\\[(?:${key})::\\s*([^\\]]*)\\]`, "i"))?.[1]?.trim() ?? "";
const filename = value => String(value).replace(/[\x00-\x1f<>:"/\\|?*]/g, "_").replace(/[. ]+$/, "").trim().slice(0, 100) || "任务记录";

function create({ app, core, DateTime, parseYaml, stringifyYaml, folder = "daliy record", titleOf }) {
  if (!parseYaml || !stringifyYaml) throw new Error("任务记录需要 Obsidian YAML 支持");
  const known = new Set();
  let queue = Promise.resolve();
  const serial = action => { const next = queue.then(action); queue = next.catch(() => {}); return next; };

  function readDocument(content) {
    const newline = content.includes("\r\n") ? "\r\n" : "\n";
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) return { metadata: {}, body: content, newline };
    const metadata = parseYaml(match[1]) ?? {};
    if (typeof metadata !== "object" || Array.isArray(metadata)) throw new Error("记录属性格式不正确");
    return { metadata, body: content.slice(match[0].length), newline };
  }

  function flatten(task, ancestors = []) {
    return task.children.flatMap(child => {
      const names = [...ancestors, titleOf(child.text)];
      return [{ task: child, names, depth: ancestors.length }, ...flatten(child, names)];
    });
  }

  function recordName(task, requested = "") {
    const prefix = (task.ancestors ?? []).map(item => titleOf(item.text)).join(" - ");
    const name = String(requested || titleOf(task.text)).replace(/[\r\n]+/g, " ").trim();
    return prefix && !name.startsWith(`${prefix} - `) ? `${prefix} - ${name}` : name;
  }

  function properties(task) {
    const data = core.info(task), kids = flatten(task);
    const day = symbol => task.text.match(new RegExp(`${symbol}\\s*(\\d{4}-\\d{1,2}-\\d{1,2})`, "u"))?.[1] ?? "";
    const priority = core.priority(task).label;
    return {
      related_task: titleOf(task.text), related_task_id: core.identity(task),
      task_ancestors: (task.ancestors ?? []).map(item => titleOf(item.text)),
      task_ancestor_ids: (task.ancestors ?? []).map(core.identity),
      task_source: `[[${task.path}#^${task.id}]]`, task_status: core.state(task).label,
      task_priority: priority, task_start: day("🛫"), task_due: day("📅"),
      task_created: day("➕"), task_scheduled: day("⏳"), task_completed: day("✅"),
      task_tags: task.text.match(/#[^\s]+/g) ?? [],
      task_review: field(task.text, "needsReview|reviewEnabled|需要复习|复习开关") || "未设置",
      task_next: data.next, task_reason: data.reason, task_check: data.check,
      task_progress: core.completion(task).percent,
      subtasks_total: kids.length, subtasks_done: kids.filter(item => item.task.completed).length,
      subtasks: kids.map(item => `${core.state(item.task).label} · ${item.names.join(" / ")}`),
      subtask_ids: kids.map(item => core.identity(item.task))
    };
  }

  function folderChoices() {
    const folders = app.vault.getAllLoadedFiles().filter(node => Array.isArray(node.children)).map(node => node.path);
    return [...new Set([folder, "/", ...folders.filter(path => path !== "/").sort((a, b) => a.localeCompare(b, "zh-CN"))])];
  }

  function summary(task, props) {
    const rows = [
      ["任务", `[[${task.path}#^${task.id}\\|${md(props.related_task)}]]`],
      ["状态", props.task_status], ["优先级", props.task_priority],
      ["开始 / 截止", `${props.task_start || "未设置"} / ${props.task_due || "未设置"}`],
      ["下一步", md(props.task_next || "未设置")],
      ["子任务完成", `${props.subtasks_done}/${props.subtasks_total}`]
    ];
    if (props.task_reason) rows.push(["延期 / 阻塞原因", md(props.task_reason)]);
    if (props.task_ancestors.length) rows.unshift(["所属任务", md(props.task_ancestors.join(" / "))]);
    if (props.task_check) rows.push(["下次检查", props.task_check]);
    const kids = flatten(task);
    return `${START}\n## 当前任务\n\n| 属性 | 内容 |\n| --- | --- |\n${rows.map(([key, value]) => `| ${key} | ${value} |`).join("\n")}\n\n### 当前子任务\n\n${kids.length ? kids.map(item => `${"  ".repeat(item.depth)}- **${core.state(item.task).label}** · ${md(titleOf(item.task.text))}`).join("\n") : "暂无子任务"}\n${END}`;
  }

  function updateBody(body, task, props, template, fresh) {
    const start = body.indexOf(START), end = body.indexOf(END);
    if (!fresh && (start < 0 || end < start || body.indexOf(START, start + START.length) >= 0 || body.indexOf(END, end + END.length) >= 0)) {
      return null;
    }
    const block = summary(task, props);
    let next = fresh ? `${block}\n\n## 本次记录\n\n${templates[template].body}\n## 子任务记录\n\n`
      : body.slice(0, start) + block.replace(/\n/g, body.includes("\r\n") ? "\r\n" : "\n") + body.slice(end + END.length);
    const newline = next.includes("\r\n") ? "\r\n" : "\n";
    for (const item of flatten(task)) {
      const marker = `<!-- tcc:subtask:${item.task.id}:heading -->`;
      const close = `<!-- tcc:subtask:${item.task.id}:end-heading -->`;
      const heading = `${marker}${newline}### ${md(item.names.join(" / "))}${newline}${close}`;
      const at = next.indexOf(marker), stop = next.indexOf(close);
      if (at >= 0 && stop > at && next.indexOf(marker, at + marker.length) < 0 && next.indexOf(close, stop + close.length) < 0)
        next = next.slice(0, at) + heading + next.slice(stop + close.length);
      else if (at >= 0 || stop >= 0) return null;
      else next += `${newline}${heading}${newline}${newline}${templates[template].body.replace(/\n/g, newline)}`;
    }
    return next;
  }

  function compose(content, task, options = null) {
    const parsed = readDocument(content);
    const old = parsed.metadata;
    if (!options && (old.tcc_record_version !== VERSION || old.related_task_id !== core.identity(task))) return content;
    const template = options?.template ?? old.tcc_template ?? "standard";
    if (!templates[template]) throw new Error("记录模板不受支持");
    const props = properties(task);
    const updatedBody = updateBody(parsed.body, task, props, template, Boolean(options));
    // A manually edited legacy record without safe boundaries is no longer managed.
    if (updatedBody === null) return content;
    const body = options?.name ? `# ${md(options.name)}\n\n${updatedBody}` : updatedBody;
    const metadata = options ? { date: options.date, timeline: true, tcc_record_version: VERSION, tcc_template: template, ...props } : { ...old, ...props };
    const changed = Boolean(options) || JSON.stringify(metadata) !== JSON.stringify(old) || body !== parsed.body;
    if (!changed) return content;
    metadata.task_synced_at = DateTime.now().toFormat("yyyy-LL-dd HH:mm");
    return `---${parsed.newline}${stringifyYaml(metadata).trimEnd().replace(/\r?\n/g, parsed.newline)}${parsed.newline}---${parsed.newline}${body}`;
  }

  async function synchronizeFile(file, task) {
    const before = await app.vault.read(file);
    const after = compose(before, task);
    if (after !== before) await app.vault.process(file, current => compose(current, task));
  }

  async function createRecord(task, options = {}) {
    return serial(async () => {
      const live = await core.snapshot(task);
      const day = DateTime.fromISO(options.day || DateTime.now().toFormat("yyyy-LL-dd"));
      if (!day.isValid) throw new Error("记录日期不正确");
      const destination = options.folder ?? folder;
      if (destination !== folder && destination !== "/" && !Array.isArray(app.vault.getAbstractFileByPath(destination)?.children))
        throw new Error("所选文件夹不存在，请重新选择存放位置");
      const displayName = recordName(live, options.name);
      const name = filename(displayName);
      const prefix = `${destination === "/" ? "" : destination + "/"}${day.toFormat("yyyy.LL.dd")} ${name}`;
      if (destination === folder && !app.vault.getAbstractFileByPath(folder)) {
        try { await app.vault.createFolder(folder); }
        catch (error) { if (!app.vault.getAbstractFileByPath(folder)) throw error; }
      }
      for (let index = 1; index < 100; index++) {
        const path = `${prefix}${index === 1 ? "" : ` (${index})`}.md`;
        const existing = app.vault.getAbstractFileByPath(path);
        if (existing) {
          let saved;
          try { saved = readDocument(await app.vault.read(existing)).metadata; }
          catch { continue; }
          if ([VERSION, DAILY_VERSION].includes(saved.tcc_record_version) && saved.related_task_id === core.identity(live)) {
            await synchronizeFile(existing, live);
            known.add(path);
            return { path, created: false };
          }
          continue;
        }
        const progress = options.progress == null || options.progress === "" ? core.completion(live).percent : Number(options.progress);
        if (!Number.isInteger(progress) || progress < 0 || progress > 100) throw new Error("完成进度应为 0 到 100 的整数");
        const note = String(options.summary ?? "").trim();
        const metadata = {
          date: `${day.toFormat("yyyy-LL-dd")} ${DateTime.now().toFormat("HH:mm")}`,
          related_task: titleOf(live.text), task_priority: core.priority(live).label, task_status: core.state(live).label,
          task_progress: progress, ...(note ? { summary: note } : {}),
          related_task_id: core.identity(live), tcc_record_version: DAILY_VERSION
        };
        const record = `---\n${stringifyYaml(metadata).trimEnd()}\n---\n# ${md(displayName)}\n\n`;
        try {
          await app.vault.create(path, record);
          known.add(path);
          return { path, created: true };
        } catch (error) { if (!app.vault.getAbstractFileByPath(path)) throw error; index--; }
      }
      throw new Error("同名记录过多，请修改记录名称");
    });
  }

  async function syncAll() {
    return serial(async () => {
      const errors = [], snapshots = new Map();
      const records = app.vault.getMarkdownFiles?.() ?? [];
      for (const file of records) {
        try {
          const cached = app.metadataCache.getFileCache?.(file);
          if (!known.has(file.path) && cached?.frontmatter?.tcc_record_version !== VERSION &&
              (cached || !file.path.startsWith(`${folder}/`))) continue;
          const metadata = readDocument(await app.vault.read(file)).metadata;
          if (metadata.tcc_record_version !== VERSION || typeof metadata.related_task_id !== "string") continue;
          const key = metadata.related_task_id;
          if (!key.startsWith("tcc:")) continue;
          if (!snapshots.has(key)) snapshots.set(key, await core.snapshot({ text: ` ^${key.slice(4)}` }));
          await synchronizeFile(file, snapshots.get(key));
        } catch (error) {
          if (error.code !== "TASK_NOT_FOUND") errors.push(`${file.path}：${error.message}`);
        }
      }
      return errors;
    });
  }

  function reportSync(container, errors) {
    let details = container.querySelector("[data-record-sync-issues]");
    if (!errors.length) { details?.remove(); return; }
    if (!details) {
      details = document.createElement("details");
      details.dataset.recordSyncIssues = "";
      container.prepend(details);
    }
    const summary = document.createElement("summary"), list = document.createElement("ul");
    summary.textContent = `任务记录同步：${errors.length} 条提示`;
    for (const error of errors) {
      const item = document.createElement("li");
      item.textContent = error;
      list.appendChild(item);
    }
    details.replaceChildren(summary, list);
  }

  function watch(paths, key, report) {
    if (!app.vault.on || !app.vault.offref) return;
    const registry = globalThis[Symbol.for("tcc.record-watchers")] ??= new Map();
    registry.get(key)?.dispose();
    let timer, active = true;
    const changed = file => {
      if (!active || !paths.includes(file.path)) return;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try { await core.initialize(); const errors = await syncAll(); if (active) report(errors); }
        catch (error) { if (active) report([error.message]); }
      }, 350);
    };
    const refs = [app.vault.on("modify", changed), app.vault.on("create", changed)];
    registry.set(key, { dispose() { active = false; clearTimeout(timer); refs.forEach(ref => app.vault.offref(ref)); } });
  }

  function bind(root, task, sourceFile, displayedPercent) {
    const button = root.querySelector("[data-create-task-record]");
    button?.addEventListener("click", async () => {
      if (button.disabled) return;
      button.disabled = true;
      const live = await core.attempt(() => core.snapshot(task), root);
      button.disabled = false;
      if (!live) return;
      const defaultName = recordName(live);
      const dialog = document.createElement("dialog");
      dialog.className = "tcc-editor-dialog tasks-command-center";
      dialog.innerHTML = `<form><header><h3>创建任务记录</h3><button type="button" data-close aria-label="关闭" title="关闭"><span data-tcc-icon="x">关闭</span></button></header><div class="tcc-editor-fields"><label class="tcc-editor-field"><span>记录名称</span><input name="name" value="${esc(defaultName)}" required></label><div class="tcc-editor-pair"><label class="tcc-editor-field"><span>日期</span><input type="date" name="day" value="${DateTime.now().toFormat("yyyy-LL-dd")}" required></label><label class="tcc-editor-field"><span>存放位置</span><select name="folder">${folderChoices().map(path => `<option value="${esc(path)}">${esc(path === "/" ? "库根目录" : path)}</option>`).join("")}</select></label></div><label class="tcc-editor-field"><span>完成进度（%）</span><input name="progress" type="number" min="0" max="100" step="1" value="${esc(displayedPercent ?? core.completion(live).percent)}" required></label><label class="tcc-editor-field"><span>今日做了什么（可选）</span><input name="summary"></label></div><p role="alert" class="tcc-editor-error" hidden></p><footer><button type="button" data-close>取消</button><button type="submit">创建并打开</button></footer></form>`;
      document.body.appendChild(dialog);
      const messages = { name: "请输入记录名称", day: "请选择有效日期", progress: "完成进度应为 0 到 100 的整数" };
      for (const input of dialog.querySelectorAll("input[required]")) {
        const hint = document.createElement("small");
        hint.id = `tcc-record-${input.name}-${crypto.randomUUID()}`;
        hint.textContent = messages[input.name];
        hint.hidden = true;
        hint.setAttribute("aria-live", "polite");
        input.setAttribute("aria-describedby", hint.id);
        input.after(hint);
        const validate = () => {
          if (input.name === "name") input.setCustomValidity(input.value.trim() ? "" : messages.name);
          hint.hidden = input.validity.valid;
          input.setAttribute("aria-invalid", String(!input.validity.valid));
        };
        for (const event of ["input", "blur", "invalid"]) input.addEventListener(event, validate);
      }
      core.icons(dialog);
      dialog.querySelectorAll("[data-close]").forEach(item => item.addEventListener("click", () => dialog.close()));
      dialog.addEventListener("close", () => dialog.remove(), { once: true });
      dialog.querySelector("form").addEventListener("submit", async event => {
        event.preventDefault();
        const form = event.currentTarget, submit = form.querySelector('[type="submit"]');
        if (submit.disabled) return;
        submit.disabled = true;
        const errorNode = dialog.querySelector("[role=alert]");
        errorNode.hidden = true;
        try {
          const result = await createRecord(task, Object.fromEntries(new FormData(form)));
          await core.refresh();
          app.workspace.openLinkText(result.path, sourceFile, false);
          dialog.close();
        } catch (error) { errorNode.textContent = error.message; errorNode.hidden = false; }
        finally { submit.disabled = false; }
      });
      dialog.showModal();
    });
  }

  return { createRecord, syncAll, reportSync, watch, bind, compose, readDocument };
}

module.exports = { create };
