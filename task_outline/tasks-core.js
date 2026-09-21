/* Shared task identity, Markdown writes and maintenance controls for Dataview. */
const list = value => Array.isArray(value) ? value : value?.array?.() ?? Array.from(value ?? []);
const field = (text, key) => String(text ?? "").match(new RegExp(`\\[(?:${key})::\\s*([^\\]]*)\\]`, "i"))?.[1]?.trim() ?? "";
const blockId = text => String(text ?? "").match(/\s\^([a-zA-Z0-9-]+)\s*$/)?.[1] ?? "";
const withoutId = text => String(text ?? "").replace(/\s*\^[a-zA-Z0-9-]+\s*$/, "").trimEnd();
const stripMeta = text => withoutId(text).replace(/\s*\[tcc_(?:next|reason|check|blocked)::[^\]]*\]/gi, "");
const oneLine = value => String(value ?? "").replace(/[\r\n]+/g, " ").trim();
const fieldText = value => oneLine(value).replace(/\[/g, "（").replace(/\]/g, "）");
const esc = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const status = task => String(task.status ?? " ").trim() || " ";
const isBlocked = task => field(task.text, "tcc_blocked") === "true" && !task.completed && ![">", "-"].includes(status(task));

function state(task) {
  if (task.completed || status(task).toLowerCase() === "x") return { key: "done", label: "完成" };
  if (status(task) === "-") return { key: "cancelled", label: "取消" };
  if (status(task) === ">") return { key: "postponed", label: "延期" };
  if (isBlocked(task)) return { key: "blocked", label: "阻塞" };
  return {
    "/": { key: "doing", label: "进行中" },
    "?": { key: "pending", label: "待确认" },
    "!": { key: "important", label: "重要" }
  }[status(task)] ?? { key: "todo", label: "待办" };
}

function title(text) {
  return stripMeta(text)
    .replace(/\[[^\]]+::[^\]]*\]/g, "")
    .replace(/(?:📅|⏳|🛫|➕|✅|❌)\s*\d{4}-\d{1,2}-\d{1,2}/gu, "")
    .replace(/[🔺⏫🔼🔽⏬]/gu, "").replace(/#[^\s]+/g, "")
    .replace(/\s+/g, " ").trim();
}

function children(task) {
  return list(task.children).flatMap(item => [...(item.task ? [item] : []), ...children(item)]);
}

function completion(task) {
  const kids = children(task);
  if (kids.length) {
    const done = kids.filter(item => item.completed).length;
    return { percent: Math.round(done / kids.length * 100), detail: `${done}/${kids.length}`, mode: "子任务" };
  }
  return task.completed ? { percent: 100, detail: "1/1", mode: "完成" }
    : { percent: 0, detail: status(task) === "/" ? "进行中" : "0/1", mode: "任务" };
}

function ready(task) {
  const kids = children(task);
  return !task.completed && ![">", "-"].includes(status(task)) && !isBlocked(task) && kids.length > 0 && kids.every(item => item.completed);
}

// Only real list checkboxes are migrated; fenced examples and frontmatter stay intact.
function scan(content) {
  const lines = content.split(/\r?\n/);
  const tasks = [];
  let fence = null, yaml = lines[0] === "---", comment = false;
  for (let line = 0; line < lines.length; line++) {
    const raw = lines[line];
    if (yaml) { if (line > 0 && /^(---|\.\.\.)\s*$/.test(raw)) yaml = false; continue; }
    if (comment) { if (raw.includes("-->")) comment = false; continue; }
    if (raw.trimStart().startsWith("<!--")) { comment = !raw.includes("-->"); continue; }
    const mark = raw.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      if (mark && mark[1][0] === fence[0] && mark[1].length >= fence.length) fence = null;
      continue;
    }
    if (mark) { fence = mark[1]; continue; }
    const match = raw.match(/^(\s*[-*+]\s+\[)([^\]])(\]\s+)(.*)$/);
    if (match) tasks.push({ line, prefix: match[1], status: match[2], gap: match[3], text: match[4], id: blockId(match[4]) });
  }
  return { lines, tasks, newline: content.includes("\r\n") ? "\r\n" : "\n" };
}

function endOfTask(lines, line) {
  const width = value => (value.match(/^\s*/)?.[0] ?? "").replace(/\t/g, "    ").length;
  const indent = width(lines[line]);
  let end = line + 1;
  for (let i = line + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    if (width(lines[i]) <= indent) break;
    end = i + 1;
  }
  return end;
}

function putField(text, key, value) {
  const clean = withoutId(text).replace(new RegExp(`\\s*\\[${key}::[^\\]]*\\]`, "gi"), "").trimEnd();
  return value === "" || value === null || value === undefined ? clean : `${clean} [${key}:: ${fieldText(value)}]`;
}

function hash(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return (value >>> 0).toString(16);
}

function create({ app, paths, folder, DateTime, setIcon }) {
  const indexPath = `${folder ? `${folder}/` : ""}_task-index.json`;
  let registry = { version: 1, tasks: {} };
  const locations = new Map();
  const boundIds = new WeakMap();
  const stamp = () => DateTime.now().toFormat("yyyy-LL-dd HH:mm");
  const uuid = () => `tcc-${globalThis.crypto.randomUUID()}`;
  const keyOf = task => `${task.path ?? paths[0]}:${task.line ?? task.position?.start?.line}`;
  const id = task => {
    if (boundIds.has(task)) return boundIds.get(task);
    const located = locations.get(keyOf(task));
    const value = blockId(task.text) || task.blockId || (located && withoutId(located.text).trim() === withoutId(String(task.text).split(/\r?\n/)[0]).trim() ? located.id : "");
    if (value) boundIds.set(task, value);
    return value;
  };
  const identity = task => id(task) ? `tcc:${id(task)}` : keyOf(task);
  const aliases = task => [...new Set([title(task.text), ...(registry.tasks[id(task)]?.aliases ?? [])])];
  const info = task => ({
    next: field(task.text, "tcc_next"), reason: field(task.text, "tcc_reason"),
    check: field(task.text, "tcc_check"), updated: registry.tasks[id(task)]?.updated ?? "",
    blocked: isBlocked(task), ready: ready(task)
  });

  async function initialize() {
    const indexFile = app.vault.getAbstractFileByPath(indexPath);
    if (indexFile) registry = JSON.parse(await app.vault.read(indexFile));
    if (registry.version !== 1 || !registry.tasks) throw new Error("任务索引格式不正确，请检查 _task-index.json");
    const seen = new Set();
    const changes = {};
    for (const path of paths) {
      const file = app.vault.getAbstractFileByPath(path);
      if (!file) continue;
      let content = await app.vault.read(file);
      if (scan(content).tasks.some(task => !task.id)) {
        await app.vault.process(file, current => {
          const parsed = scan(current);
          for (const task of parsed.tasks) if (!task.id) parsed.lines[task.line] += ` ^${uuid()}`;
          content = parsed.lines.join(parsed.newline);
          return content;
        });
      }
      const parsed = scan(content);
      for (const task of parsed.tasks) {
        if (seen.has(task.id)) throw new Error(`任务 ID 重复：${task.id}。复制任务时请移除副本末尾的 ID。`);
        seen.add(task.id);
        locations.set(`${path}:${task.line}`, task);
        const previous = registry.tasks[task.id];
        const currentTitle = title(task.text);
        const digest = hash(parsed.lines.slice(task.line, endOfTask(parsed.lines, task.line)).join("\n"));
        changes[task.id] = {
          path, title: currentTitle,
          aliases: [...new Set([...(previous?.aliases ?? []), previous?.title, currentTitle].filter(Boolean))],
          hash: digest, updated: previous?.hash === digest ? previous.updated : stamp()
        };
      }
    }
    const next = { version: 1, tasks: { ...registry.tasks, ...changes } };
    if (!indexFile) {
      try { await app.vault.create(indexPath, JSON.stringify(next, null, 2)); }
      catch (error) { if (!app.vault.getAbstractFileByPath(indexPath)) throw error; }
    }
    const saved = app.vault.getAbstractFileByPath(indexPath);
    if (saved && JSON.stringify(next) !== JSON.stringify(registry)) {
      await app.vault.process(saved, current => {
        const latest = JSON.parse(current);
        registry = { version: 1, tasks: { ...latest.tasks, ...changes } };
        return JSON.stringify(registry, null, 2);
      });
    } else registry = next;
  }

  async function locate(task) {
    const targetId = id(task);
    if (!targetId) throw new Error("任务尚未建立固定 ID，请刷新后重试");
    const candidates = [...new Set([task.path, registry.tasks[targetId]?.path, ...paths].filter(Boolean))];
    const matches = [];
    for (const path of candidates) {
      const file = app.vault.getAbstractFileByPath(path);
      if (file && scan(await app.vault.read(file)).tasks.some(item => item.id === targetId)) matches.push(file);
    }
    if (matches.length !== 1) throw new Error(matches.length ? "任务 ID 重复，无法确定要修改的任务" : "任务已删除或移出任务源，请刷新后重试");
    return { file: matches[0], targetId };
  }

  async function mutate(task, transform) {
    const { file, targetId } = await locate(task);
    await app.vault.process(file, current => {
      const parsed = scan(current);
      const matches = parsed.tasks.filter(item => item.id === targetId);
      if (matches.length !== 1) throw new Error("任务源已变化，请刷新后重试");
      transform(parsed, matches[0]);
      return parsed.lines.join(parsed.newline);
    });
    return true;
  }

  async function snapshot(task) {
    const { file, targetId } = await locate(task);
    const parsed = scan(await app.vault.read(file));
    const root = parsed.tasks.find(item => item.id === targetId);
    if (!root) throw new Error("任务已不存在，请刷新后重试");
    const end = endOfTask(parsed.lines, root.line);
    const stack = [];
    let result;
    for (const item of parsed.tasks.filter(item => item.line >= root.line && item.line < end)) {
      const indent = item.prefix.match(/^\s*/)[0].replace(/\t/g, "    ").length;
      const node = { ...item, path: file.path, task: true, completed: item.status.toLowerCase() === "x", children: [] };
      while (stack.length && stack.at(-1).indent >= indent) stack.pop();
      if (stack.length) stack.at(-1).node.children.push(node);
      else result = node;
      stack.push({ indent, node });
    }
    return result;
  }

  function setLine(parsed, task, text, nextStatus = task.status) {
    parsed.lines[task.line] = `${task.prefix}${nextStatus}${task.gap}${withoutId(text).trimEnd()} ^${task.id}`;
  }

  function append(parsed, task, text) {
    const indent = parsed.lines[task.line].match(/^\s*/)[0] + "  ";
    parsed.lines.splice(endOfTask(parsed.lines, task.line), 0, `${indent}- ${text}`);
  }

  function dateInput(value) {
    if (!value) return "";
    const parsed = DateTime.fromISO(String(value));
    if (!parsed.isValid || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("日期格式不正确");
    return parsed.toFormat("yyyy-LL-dd");
  }

  async function save(task, payload) {
    const due = payload.due === undefined ? undefined : dateInput(payload.due);
    const check = payload.check === undefined ? undefined : dateInput(payload.check);
    const allowed = [" ", "/", "x", ">", "?", "-", "!", "blocked"];
    if (payload.status !== undefined && !allowed.includes(payload.status)) throw new Error("不支持的任务状态");
    return mutate(task, (parsed, current) => {
      if (payload.accept) {
        const end = endOfTask(parsed.lines, current.line);
        const kids = parsed.tasks.filter(item => item.line > current.line && item.line < end);
        if (!kids.length || kids.some(item => item.status.toLowerCase() !== "x")) throw new Error("子任务有未完成项，请刷新后检查");
      }
      let text = withoutId(current.text);
      if (payload.title !== undefined && oneLine(payload.title) !== title(text)) {
        const name = fieldText(payload.title).replace(/\s*\^[a-zA-Z0-9-]+$/, "");
        if (!name) throw new Error("任务名称不能为空");
        const previousTitle = title(text);
        const offset = text.indexOf(previousTitle);
        if (offset < 0) throw new Error("任务名称含特殊格式，请在源文件中改名");
        text = text.slice(0, offset) + name + text.slice(offset + previousTitle.length);
      }
      if (due !== undefined) text = text.replace(/\s*📅\s*\d{4}-\d{1,2}-\d{1,2}/gu, "") + (due ? ` 📅 ${due}` : "");
      for (const [key, value] of [["tcc_next", payload.next], ["tcc_reason", payload.reason], ["tcc_check", check]]) {
        if (value !== undefined) text = putField(text, key, value);
      }
      let nextStatus = current.status;
      if (payload.status !== undefined) {
        nextStatus = payload.status === "blocked" ? "/" : payload.status;
        text = putField(text, "tcc_blocked", payload.status === "blocked" ? "true" : "");
        const previousCompletion = current.status.toLowerCase() === "x" ? text.match(/✅\s*(\d{4}-\d{2}-\d{2})/u)?.[1] : null;
        text = text.replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/gu, "");
        if (nextStatus === "x") text += ` ✅ ${previousCompletion ?? DateTime.now().toFormat("yyyy-LL-dd")}`;
        if (![">", "blocked"].includes(payload.status)) {
          text = putField(putField(text, "tcc_reason", ""), "tcc_check", "");
        }
      }
      setLine(parsed, current, text, nextStatus);
      if (payload.status !== undefined && (nextStatus !== current.status || isBlocked({ text: current.text }) !== (payload.status === "blocked"))) {
        const names = { " ": "待办", "/": "进行中", x: "完成", ">": "延期", "?": "待确认", "-": "取消", "!": "重要", blocked: "阻塞" };
        const reason = field(text, "tcc_reason");
        append(parsed, current, `[timeline:: ${stamp()}] [type:: 状态] ${names[payload.status]}${reason ? `：${reason}` : ""}`);
      }
    });
  }

  async function addChild(task, payload) {
    const text = oneLine(payload.text).replace(/\s*\^[a-zA-Z0-9-]+$/, "");
    if (!text) throw new Error("子任务内容不能为空");
    const due = dateInput(payload.due);
    return mutate(task, (parsed, current) => append(parsed, current, `[ ] ${text}${due ? ` 📅 ${due}` : ""} ^${uuid()}`));
  }

  async function addNote(task, payload) {
    const text = oneLine(payload.text);
    if (!text) throw new Error("进展内容不能为空");
    const moment = payload.moment ? DateTime.fromISO(String(payload.moment).replace(" ", "T")) : DateTime.now();
    if (!moment.isValid) throw new Error("记录时间不正确");
    const progress = payload.progress === "" || payload.progress == null ? null : Number(String(payload.progress).replace(/%$/, ""));
    if (progress !== null && (!Number.isFinite(progress) || progress < 0 || progress > 100)) throw new Error("进度应在 0 到 100 之间");
    return mutate(task, (parsed, current) => append(parsed, current,
      `[timeline:: ${moment.toFormat("yyyy-LL-dd HH:mm")}] [type:: ${fieldText(payload.type) || "进展"}]${progress === null ? "" : ` [progress:: ${progress}%]`} ${text}`));
  }

  async function setReview(task, enabled) {
    return mutate(task, (parsed, current) => {
      const text = withoutId(current.text).replace(/\s*\[(?:needsReview|需要复习|reviewEnabled|复习开关)::[^\]]+\]/giu, "");
      setLine(parsed, current, `${text} [needsReview:: ${Boolean(enabled)}]`);
    });
  }

  async function markReview(task, interval, completionDate) {
    const days = Number(interval);
    if (!completionDate || !Number.isInteger(days) || days <= 0) throw new Error("复习日期不完整");
    const due = completionDate.plus({ days }).toFormat("yyyy-LL-dd");
    const done = DateTime.now().toFormat("yyyy-LL-dd");
    return mutate(task, (parsed, current) => {
      const end = endOfTask(parsed.lines, current.line);
      const childIndent = parsed.lines[current.line].match(/^\s*/)[0] + "  ";
      for (let i = current.line + 1; i < end; i++) {
        const text = parsed.lines[i];
        if (text.match(/^\s*/)[0] !== childIndent) continue;
        if (field(text, "review|复习") !== due) continue;
        parsed.lines[i] = text.replace(/\s*\[(?:review_done|复习完成|done|完成)::[^\]]*\]/giu, "") + ` [review_done:: ${done}]`;
        return;
      }
      append(parsed, current, `[review:: ${due}] [interval:: ${days}] [review_done:: ${done}] D+${days} 复习完成`);
    });
  }

  function reasons(task, staleDays = 14) {
    if (task.completed || status(task) === "-") return [];
    const data = info(task), output = [], today = DateTime.now().startOf("day");
    const waiting = status(task) === ">" || data.blocked;
    if (data.ready) output.push("待验收");
    if (waiting) {
      if (!data.reason) output.push("待补原因");
      if (!data.check) output.push("待安排检查日期");
      else if (DateTime.fromISO(data.check) <= today) output.push("到期检查");
    } else {
      if (!data.next && !data.ready) output.push("缺少下一步");
      const due = task.text.match(/📅\s*(\d{4}-\d{2}-\d{2})/u)?.[1];
      if (due && DateTime.fromISO(due) < today) output.push("已逾期");
      const updated = DateTime.fromISO(data.updated.replace(" ", "T"));
      if (updated.isValid && today.diff(updated.startOf("day"), "days").days >= staleDays) output.push(`${staleDays} 天未更新`);
    }
    return output;
  }

  async function syncStyles() {
    const css = await app.vault.adapter.read(`${folder ? `${folder}/` : ""}tasks-command-center.css`);
    const directory = `${app.vault.configDir ?? ".obsidian"}/snippets`;
    const target = `${directory}/tasks-command-center.css`;
    if (!await app.vault.adapter.exists(directory)) await app.vault.adapter.mkdir(directory);
    const current = await app.vault.adapter.exists(target) ? await app.vault.adapter.read(target) : "";
    if (current !== css) await app.vault.adapter.write(target, css);
    return css;
  }

  const iconButton = (action, label, icon, task) => `<button type="button" class="tcc-tool${setIcon ? "" : " tcc-tool-text"}" data-task-action="${action}" data-task-key="${esc(identity(task))}" title="${label}" aria-label="${label}"><span data-tcc-icon="${icon}">${label}</span></button>`;
  function statusBadge(task, editable = false) {
    const current = state(task);
    const attrs = `class="tcc-state-badge" data-state="${current.key}"`;
    return editable
      ? `<button type="button" ${attrs} data-task-action="edit" data-task-key="${esc(identity(task))}" title="修改状态：${esc(title(task.text))}" aria-label="修改状态：${esc(title(task.text))}">${current.label}</button>`
      : `<span ${attrs}>${current.label}</span>`;
  }
  function controls(task) {
    const data = info(task);
    return `<div class="tcc-maintenance">
      ${data.next && !task.completed ? `<p class="tcc-next"><span>下一步</span>${esc(data.next)}</p>` : ""}
      ${data.reason && (data.blocked || status(task) === ">") ? `<p class="tcc-waiting">${esc(data.reason)}${data.check ? ` · ${esc(data.check)} 检查` : ""}</p>` : ""}
      <div class="tcc-card-tools">
        <span class="tcc-acceptance">${data.ready ? "子任务已完成 · 待验收" : data.blocked ? "阻塞中" : ""}</span>
        ${data.ready ? iconButton("accept", "验收完成", "check-check", task) : ""}
        ${iconButton("child", "添加子任务", "plus", task)}
        ${iconButton("edit", "编辑任务", "pencil", task)}
        ${iconButton("note", "记录进展", "notebook-pen", task)}
      </div>
    </div>`;
  }

  function icons(root) {
    if (!setIcon) return;
    root.querySelectorAll("[data-tcc-icon]").forEach(node => { node.textContent = ""; setIcon(node, node.dataset.tccIcon); });
  }

  async function refresh() {
    await initialize();
    setTimeout(() => app.workspace.trigger("dataview:refresh-views"), 180);
  }

  async function attempt(action, scope) {
    let errorNode = scope.querySelector(":scope > .tcc-operation-error");
    if (!errorNode) {
      errorNode = document.createElement("p");
      errorNode.className = "tcc-operation-error";
      errorNode.setAttribute("role", "alert");
      scope.appendChild(errorNode);
    }
    const buttons = [...scope.querySelectorAll('button[type="submit"]')];
    if (buttons.some(button => button.disabled)) return false;
    buttons.forEach(button => { button.disabled = true; });
    errorNode.hidden = true;
    try { return await action(); }
    catch (error) { errorNode.textContent = error.message; errorNode.hidden = false; return false; }
    finally { buttons.forEach(button => { button.disabled = false; }); }
  }

  async function editDialog(task, action) {
    const data = info(task);
    const dialog = document.createElement("dialog");
    dialog.className = "tcc-editor-dialog tasks-command-center";
    const current = data.blocked ? "blocked" : task.completed ? "x" : status(task);
    const statuses = [[" ", "待办"], ["/", "进行中"], ["blocked", "阻塞"], [">", "延期"], ["?", "待确认"], ["!", "重要"], ["x", "完成"], ["-", "取消"]];
    const label = (name, text, input) => `<label class="tcc-editor-field"><span>${text}</span>${input}</label>`;
    const input = (name, value, type = "text", required = false) => `<input name="${name}" type="${type}" value="${esc(value)}" ${required ? "required" : ""}>`;
    const heading = { edit: "编辑任务", child: "添加子任务", note: "记录进展", accept: "验收任务" }[action];
    let fields = "";
    if (action === "edit") fields =
      label("title", "任务名称", input("title", title(task.text), "text", true)) +
      `<div class="tcc-editor-pair">${label("status", "状态", `<select name="status">${statuses.map(([value, text]) => `<option value="${value}" ${value === current ? "selected" : ""}>${text}</option>`).join("")}</select>`)}${label("due", "截止日期", input("due", task.text.match(/📅\s*(\d{4}-\d{2}-\d{2})/u)?.[1] ?? "", "date"))}</div>` +
      label("next", "下一步行动", input("next", data.next)) +
      `<div data-wait-fields>${label("reason", "延期 / 阻塞原因", input("reason", data.reason))}${label("check", "下次检查日期", input("check", data.check, "date"))}</div>`;
    else if (action === "child") fields = label("text", "子任务名称", input("text", "", "text", true)) + label("due", "截止日期", input("due", "", "date"));
    else if (action === "note") fields = label("text", "本次进展", '<textarea name="text" rows="4" required></textarea>');
    else fields = `<p>${esc(title(task.text))}</p><p>子任务 ${completion(task).detail} 已完成</p>`;
    dialog.innerHTML = `<form><header><h3>${heading}</h3><button type="button" data-close aria-label="关闭" title="关闭"><span data-tcc-icon="x">关闭</span></button></header><div class="tcc-editor-fields">${fields}</div><p class="tcc-editor-error" role="alert" hidden></p><footer><button type="button" data-close>取消</button><button type="submit">${action === "accept" ? "确认验收" : "保存"}</button></footer></form>`;
    document.body.appendChild(dialog);
    icons(dialog);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => dialog.close()));
    const form = dialog.querySelector("form");
    const initial = Object.fromEntries(new FormData(form));
    const toggleWaiting = () => {
      const waiting = [">", "blocked"].includes(form.elements.status?.value);
      const group = form.querySelector("[data-wait-fields]");
      if (group) { group.hidden = !waiting; form.elements.reason.required = waiting; form.elements.check.required = waiting; }
    };
    form.elements.status?.addEventListener("change", toggleWaiting);
    toggleWaiting();
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      const errorNode = form.querySelector("[role=alert]");
      const values = Object.fromEntries(new FormData(form));
      const payload = action === "edit" ? Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== initial[key])) : values;
      submit.disabled = true;
      errorNode.hidden = true;
      try {
        if (action === "edit") await save(task, payload);
        if (action === "child") await addChild(task, payload);
        if (action === "note") await addNote(task, payload);
        if (action === "accept") await save(task, { status: "x", accept: true });
        await refresh();
        dialog.close();
      } catch (error) { errorNode.textContent = error.message; errorNode.hidden = false; }
      finally { submit.disabled = false; }
    });
    dialog.showModal();
  }

  function bind(root, tasks) {
    icons(root);
    root.addEventListener("click", event => {
      const button = event.target.closest("[data-task-action]");
      if (!button) return;
      event.stopPropagation();
      const task = tasks.find(item => identity(item) === button.dataset.taskKey);
      if (task) editDialog(task, button.dataset.taskAction);
    });
  }

  return { initialize, identity, aliases, info, save, addChild, addNote, setReview, markReview, snapshot,
    reasons, controls, icons, bind, refresh, attempt, syncStyles, completion, children, ready, isBlocked, stripMeta, state, statusBadge,
    matches(task, saved, clean) { return identity(task) === saved || `${task.path ?? paths[0]}:${task.line ?? ""}:${clean(task.text)}` === saved; }
  };
}

module.exports = { create, scan, endOfTask, stripMeta, title, children, completion, ready, isBlocked, state };
