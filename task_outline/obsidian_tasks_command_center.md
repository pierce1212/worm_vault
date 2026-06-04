---
cssclasses:
  - tasks-command-center
---

```dataviewjs
const CONFIG = {
  taskSourceFiles: ["工作任务.md"],
  detailFile: "任务详情.md",
  dailyNoteFolder: "日报",
  weeklyNoteFolder: "周报",
  longTermTags: ["#长期", "#longterm", "#someday", "#长期任务"],
  projectTags: ["#project", "#项目", "#工作", "#学习", "#通信", "#安全", "#生活", "#机器人", "#嵌入式"],
  focusLimit: 12,
  recentDoneDays: 21,
  recentDoneLimit: 24,
  completedArchiveWeeks: 52,
  timelineWeeksBefore: 1,
  timelineWeeksAfter: 3,
  weather: {
    enabled: true,
    city: "上海",
    latitude: 31.2304,
    longitude: 121.4737
  }
};

const { DateTime } = dv.luxon;
const now = DateTime.now();
const today = now.startOf("day");
const weekStart = today.startOf("week");
const weekEnd = weekStart.plus({ days: 6 }).endOf("day");
const mottoText = "路虽远行则将至，事虽难做则必成!";
const sourceFile = dv.current().file.path;
const sourceFolder = sourceFile.includes("/") ? sourceFile.slice(0, sourceFile.lastIndexOf("/")) : "";
const localPath = (name) => sourceFolder && !name.startsWith(`${sourceFolder}/`) ? `${sourceFolder}/${name}` : name;
const taskSourcePaths = CONFIG.taskSourceFiles.map(localPath);
const detailPath = localPath(CONFIG.detailFile);
const dailyNoteFolder = localPath(CONFIG.dailyNoteFolder);
const weeklyNoteFolder = localPath(CONFIG.weeklyNoteFolder);
const heroAssetPaths = [
  "assets/ruoxi-desktop-banner-1.webp",
  "assets/task-dashboard-hero.png"
].map(localPath);

function mottoHtml() {
  return Array.from(mottoText)
    .map((char, index) => `<span style="--i:${index}">${esc(char)}</span>`)
    .join("");
}

function arr(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value.array === "function") return value.array();
  try { return Array.from(value); } catch { return []; }
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mount(markup) {
  const wrap = document.createElement("div");
  wrap.innerHTML = markup.trim();
  const first = wrap.firstElementChild;
  if (first) dv.container.appendChild(first);
  return first;
}

function dt(value) {
  if (!value) return null;
  if (value.isLuxonDateTime || (value.toISO && value.ts)) return value;
  const raw = String(value).trim();
  if (!raw) return null;
  const plain = raw.replace(/^\[\[/, "").replace(/\]\]$/, "").replace(" ", "T");
  let parsed = DateTime.fromISO(plain);
  if (!parsed.isValid) parsed = DateTime.fromISO(plain.replace(/\//g, "-"));
  if (!parsed.isValid) parsed = DateTime.fromFormat(raw, "yyyy-LL-dd HH:mm");
  if (!parsed.isValid) parsed = DateTime.fromFormat(raw, "yyyy-LL-dd");
  if (!parsed.isValid) parsed = DateTime.fromFormat(raw, "yyyy/MM/dd HH:mm");
  if (!parsed.isValid) parsed = DateTime.fromFormat(raw, "yyyy/MM/dd");
  return parsed.isValid ? parsed : null;
}

function date(value) {
  const parsed = dt(value);
  return parsed ? parsed.startOf("day") : null;
}

function sameDay(a, b) {
  return a && b && a.hasSame(b, "day");
}

function inRange(value, start, end) {
  if (!value) return false;
  const ms = value.toMillis();
  return ms >= start.toMillis() && ms <= end.toMillis();
}

function fmtDate(value, format = "yyyy-LL-dd") {
  const parsed = date(value);
  return parsed ? parsed.toFormat(format) : "—";
}

function fmtDateTime(value) {
  const parsed = dt(value);
  if (!parsed) return "—";
  const hasTime = parsed.hour !== 0 || parsed.minute !== 0;
  return hasTime ? parsed.toFormat("yyyy-LL-dd HH:mm") : parsed.toFormat("yyyy-LL-dd");
}

function taskTags(task) {
  return arr(task.tags).map(String);
}

function hasAnyTag(task, tags) {
  const own = taskTags(task);
  return tags.some(tag => own.includes(tag));
}

function completedAtValue(task) {
  return task.completedAt ?? task["completedAt"] ?? task["完成时间"] ?? task.completion;
}

function symbolDay(task, symbol) {
  const raw = String(task.text ?? "");
  const match = raw.match(new RegExp(`${symbol}\\s*(\\d{4}-\\d{2}-\\d{2})`, "u"));
  return match ? date(match[1]) : null;
}

function completedDay(task) {
  return date(completedAtValue(task)) ?? symbolDay(task, "✅");
}

function createdDay(task) {
  return date(task.created ?? task.creation ?? task.createdAt ?? task["创建日期"]) ?? symbolDay(task, "➕");
}

function scheduledDay(task) {
  return date(task.scheduled) ?? symbolDay(task, "⏳");
}

function startDay(task) {
  return date(task.start) ?? symbolDay(task, "🛫");
}

function dueDay(task) {
  return date(task.due) ?? symbolDay(task, "📅");
}

function plannedDay(task) {
  const dates = [scheduledDay(task), startDay(task), dueDay(task)]
    .filter(Boolean)
    .sort((a, b) => a.toMillis() - b.toMillis());
  return dates[0] ?? null;
}

function relevantDay(task) {
  return plannedDay(task) ?? dueDay(task) ?? completedDay(task);
}

function statusChar(task) {
  return String(task.status ?? " ").trim() || " ";
}

function statusText(task) {
  const s = statusChar(task);
  if (task.completed) return "完成";
  if (s === "/") return "进行中";
  if (s === "-") return "取消";
  if (s === ">") return "延期";
  if (s === "?") return "待确认";
  if (s === "!") return "重要";
  return "待办";
}

function priority(task) {
  const text = String(task.text ?? "");
  if (text.includes("🔺")) return { label: "最高", score: 120, cls: "p-highest" };
  if (text.includes("⏫")) return { label: "高", score: 80, cls: "p-high" };
  if (text.includes("🔼")) return { label: "中", score: 40, cls: "p-mid" };
  if (text.includes("🔽")) return { label: "低", score: -10, cls: "p-low" };
  if (text.includes("⏬")) return { label: "最低", score: -20, cls: "p-lowest" };
  return { label: "普通", score: 0, cls: "p-normal" };
}

function isCancelled(task) {
  return statusChar(task) === "-";
}

function isOpen(task) {
  return !task.completed && !isCancelled(task);
}

function isOverdue(task) {
  const due = dueDay(task);
  return isOpen(task) && due && due < today;
}

function taskVisualStatus(task) {
  const s = statusChar(task);
  if (task.completed) return "done";
  if (s === ">") return "postponed";
  if (isOverdue(task)) return "overdue";
  if (s === "/") return "doing";
  return "todo";
}

function isLongTerm(task) {
  const planned = plannedDay(task);
  return hasAnyTag(task, CONFIG.longTermTags) || (planned && planned > weekEnd);
}

function cleanText(text, removeTags = true) {
  let output = String(text ?? "")
    .replace(/[🔺⏫🔼🔽⏬]\s*/gu, "")
    .replace(/(?:📅|⏳|🛫|➕|✅|❌)\s*\d{4}-\d{2}-\d{2}/gu, "")
    .replace(/🔁\s*[^#\[]+/gu, "")
    .replace(/\[(?:completedAt|完成时间)::[^\]]+\]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  if (removeTags) {
    const dynamicTags = typeof taskTagUniverse === "undefined" ? [] : taskTagUniverse;
    for (const tag of [...dynamicTags, ...CONFIG.projectTags, ...CONFIG.longTermTags]) {
      output = output.replaceAll(tag, "");
    }
    output = output.replace(/\s+/g, " ").trim();
  }
  return output;
}

function childTasks(task) {
  const output = [];
  function walk(items) {
    for (const item of arr(items)) {
      if (item.task) output.push(item);
      walk(item.children);
    }
  }
  walk(task.children);
  return output;
}

function completionProgress(task) {
  const kids = childTasks(task);
  if (kids.length > 0) {
    const done = kids.filter(child => child.completed).length;
    return { percent: Math.round(done / kids.length * 100), detail: `${done}/${kids.length}`, mode: "子任务" };
  }
  if (task.completed) return { percent: 100, detail: "1/1", mode: "完成" };
  if (statusChar(task) === "/") return { percent: 50, detail: "进行中", mode: "状态" };
  return { percent: 0, detail: "0/1", mode: "任务" };
}

function timeProgress(task) {
  const start = startDay(task) ?? createdDay(task) ?? scheduledDay(task) ?? plannedDay(task) ?? today;
  const due = dueDay(task);
  if (!due || due < start) return null;
  const total = Math.max(1, due.diff(start, "days").days || 1);
  const elapsed = today.diff(start, "days").days;
  const percent = Math.max(0, Math.min(100, Math.round(elapsed / total * 100)));
  return { percent, detail: `${Math.max(0, Math.round(total - elapsed))} 天余量`, mode: "时间" };
}

function bar(value, label = "") {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return `
    <div class="tcc-bar" data-value="${safe}">
      <span style="--target:${safe}%"></span>
      <em>${safe}%${label ? ` · ${esc(label)}` : ""}</em>
    </div>
  `;
}

function ring(value, label, sub = "", cls = "") {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return `
    <div class="tcc-ring ${cls}" data-value="${safe}" style="--value:0;">
      <div>
        <strong data-count="${safe}">0%</strong>
        <span>${esc(label)}</span>
        ${sub ? `<small>${esc(sub)}</small>` : ""}
      </div>
    </div>
  `;
}

function heat(value) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return `<div class="tcc-heat">${Array.from({ length: 24 }, (_, index) => {
    const active = index < Math.round(safe / 100 * 24);
    return `<span class="${active ? "on" : ""}" style="--i:${index}"></span>`;
  }).join("")}</div>`;
}

function tagsHtml(task) {
  return taskTags(task)
    .filter(tag => !CONFIG.longTermTags.includes(tag))
    .slice(0, 5)
    .map(tag => `<span>${esc(tag)}</span>`)
    .join("");
}

function sourcePath(task) {
  return task.path ?? taskSourcePaths[0];
}

function taskId(task) {
  return `${sourcePath(task)}:${task.line ?? ""}:${cleanText(task.text)}`;
}

function openPath(path) {
  app.workspace.openLinkText(path, sourceFile, false);
}

function dailyPath(day) {
  return `${dailyNoteFolder}/${day.toFormat("yyyy-LL-dd")}.md`;
}

function weeklyPath(start) {
  return `${weeklyNoteFolder}/${start.toFormat("yyyy")}-W${String(start.weekNumber).padStart(2, "0")}.md`;
}

const sourcePages = dv.pages()
  .where(page => taskSourcePaths.includes(page.file.path));
const allPages = dv.pages().array();
const taskPages = sourcePages.array();
const tasks = sourcePages.file.tasks.where(task => task.task).array();
const taskTagUniverse = [...new Set(tasks.flatMap(task => taskTags(task)))];
const sectionByPath = new Map();

for (const page of taskPages) {
  const cache = app.metadataCache.getCache(page.file.path);
  const headings = arr(cache?.headings).sort((a, b) => a.position.start.line - b.position.start.line);
  sectionByPath.set(page.file.path, headings);
}

function taskSection(task) {
  const headings = sectionByPath.get(sourcePath(task)) ?? [];
  const line = Number(task.line ?? task.position?.start?.line ?? -1);
  const current = headings
    .filter(heading => heading.position.start.line <= line)
    .sort((a, b) => b.position.start.line - a.position.start.line)[0];
  return String(current?.heading ?? "");
}

function isInLongTermSection(task) {
  return /长期|长程|长期任务|长期目标/i.test(taskSection(task));
}

const open = tasks.filter(isOpen);
const done = tasks.filter(task => task.completed);
const overdue = open.filter(isOverdue);
const dueToday = open.filter(task => sameDay(dueDay(task), today) || sameDay(scheduledDay(task), today));
const dueThisWeek = tasks.filter(task => inRange(relevantDay(task), weekStart, weekEnd));
const doneThisWeek = done.filter(task => inRange(completedDay(task), weekStart, weekEnd));
const longTerm = open.filter(task => isInLongTermSection(task) || isLongTerm(task));
const focusCandidates = open.filter(task => !longTerm.includes(task));
const openThisWeek = focusCandidates.filter(task => inRange(relevantDay(task), weekStart, weekEnd));
const weekPercent = dueThisWeek.length ? Math.round(doneThisWeek.length / dueThisWeek.length * 100) : 0;
const completionRatio = tasks.length ? Math.round(done.length / tasks.length * 100) : 0;
const health = Math.max(0, Math.min(100, Math.round(100 - overdue.length * 9 + doneThisWeek.length * 4)));

function daysLeft(task) {
  const due = dueDay(task);
  if (!due) return null;
  return Math.floor(due.diff(today, "days").days);
}

function focusScore(task) {
  let score = priority(task).score;
  const dueDelta = daysLeft(task);
  if (dueDelta !== null) {
    if (dueDelta < 0) score += 160 + Math.min(80, Math.abs(dueDelta) * 10);
    else if (dueDelta === 0) score += 150;
    else if (dueDelta === 1) score += 95;
    else if (dueDelta <= 3) score += 60;
    else if (dueDelta <= 7) score += 30;
  }
  if (sameDay(scheduledDay(task), today)) score += 85;
  if (statusChar(task) === "/") score += 45;
  return score;
}

function taskMeta(task) {
  const dueDelta = daysLeft(task);
  const due = dueDay(task);
  let dueText = due ? `截止 ${fmtDate(due)}` : "无截止";
  if (dueDelta !== null) {
    if (dueDelta < 0) dueText += ` · 逾期 ${Math.abs(dueDelta)} 天`;
    else if (dueDelta === 0) dueText += " · 今天";
    else dueText += ` · 还有 ${dueDelta} 天`;
  }
  return [
    scheduledDay(task) ? `计划 ${fmtDate(scheduledDay(task))}` : null,
    startDay(task) ? `开始 ${fmtDate(startDay(task))}` : createdDay(task) ? `创建 ${fmtDate(createdDay(task))}` : null,
    dueText
  ].filter(Boolean).join(" / ");
}

function pageDate(page) {
  return date(page.date ?? page.created ?? page.file.day);
}

function pageRelatedTasks(page) {
  const fields = [
    page.related_task,
    page.relatedTask,
    page.task,
    page.task_name,
    page.taskName,
    page["关联任务"],
    page["相关任务"],
    page["任务"]
  ];
  return fields
    .flatMap(value => {
      if (value === null || value === undefined) return [];
      if (Array.isArray(value)) return value;
      if (typeof value === "string") return [value];
      if (typeof value.array === "function") return value.array();
      return [value];
    })
    .filter(value => value !== null && value !== undefined && String(value).trim())
    .map(value => String(value).replace(/^\[\[/, "").replace(/\]\]$/, "").trim());
}

function normalizeMatchText(value) {
  return String(value ?? "")
    .replace(/^#/, "")
    .replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, "")
    .toLowerCase();
}

function pageMatchesTask(page, task) {
  const taskName = cleanText(task.text);
  const keys = [taskName, ...taskTags(task).map(tag => tag.replace(/^#/, ""))]
    .map(normalizeMatchText)
    .filter(Boolean);
  const related = pageRelatedTasks(page).map(normalizeMatchText).filter(Boolean);
  return related.some(item => keys.some(key => item === key || item.includes(key) || key.includes(item)));
}

function pageTimelineDate(page, task) {
  if (task && pageMatchesTask(page, task)) {
    return date(page.timeline_date ?? page.timelineDate ?? page["时间轴日期"] ?? page.created ?? page.date ?? page.file.day);
  }
  return pageDate(page);
}

function progressValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const match = String(value).match(/(\d+(?:\.\d+)?)\s*%?/);
  if (!match) return null;
  return Math.max(0, Math.min(100, Math.round(Number(match[1]))));
}

function progressFromText(text) {
  const raw = String(text ?? "");
  const match = raw.match(/(?:progress|进度|完成度)\s*(?::+|：|=)?\s*(\d+(?:\.\d+)?)\s*%?/i);
  return match ? progressValue(match[1]) : null;
}

function pageProgress(page, task) {
  const frontmatter = progressValue(page.progress ?? page["进度"] ?? page["完成度"] ?? page.percent ?? page["百分比"]);
  if (frontmatter !== null) return frontmatter;

  const taskName = cleanText(task.text);
  const tags = taskTags(task);
  const lines = arr(page.file?.lists)
    .map(item => String(item.text ?? "").trim())
    .filter(Boolean);
  const relatedLines = lines.filter(text => {
    return text.includes(taskName) || tags.some(tag => text.includes(tag));
  });

  for (const text of [...relatedLines, ...lines]) {
    const value = progressFromText(text);
    if (value !== null) return value;
  }

  return null;
}

function latestRecordedProgress(task) {
  const records = allPages
    .filter(page => !taskSourcePaths.includes(page.file.path) && pageMatchesTask(page, task))
    .map(page => {
      const progress = pageProgress(page, task);
      const day = pageTimelineDate(page, task) ?? pageDate(page);
      return progress === null || !day ? null : { progress, day, page };
    })
    .filter(Boolean)
    .sort((a, b) => a.day.toMillis() - b.day.toMillis());
  return records.at(-1) ?? null;
}

function displayedProgress(task) {
  const recorded = latestRecordedProgress(task);
  if (recorded) {
    return { percent: recorded.progress, detail: recorded.page.file.name, mode: "记录" };
  }
  return completionProgress(task);
}

function dailyPagesFor(day) {
  return allPages.filter(page => {
    if (taskSourcePaths.includes(page.file.path)) return false;
    return sameDay(pageDate(page), day);
  });
}

function pagesInRange(start, end) {
  return allPages.filter(page => {
    if (taskSourcePaths.includes(page.file.path)) return false;
    const day = pageDate(page);
    return day && inRange(day, start, end);
  });
}

function listSnippets(page, limit = 3) {
  const items = arr(page.file?.lists)
    .filter(item => !item.task)
    .map(item => String(item.text ?? "").trim())
    .filter(Boolean)
    .slice(0, limit);
  return items;
}

function dailyReport(day) {
  const pages = dailyPagesFor(day);
  const planned = tasks.filter(task => sameDay(relevantDay(task), day));
  const finished = done.filter(task => sameDay(completedDay(task), day));
  const docNames = pages
    .map(page => page.file?.name ?? page.file?.path ?? "")
    .filter(Boolean);
  const summary = docNames.length
    ? docNames.slice(0, 4).join(" / ")
    : "未找到日报文档";
  const percent = planned.length ? Math.round(planned.filter(task => task.completed).length / planned.length * 100) : 0;
  return {
    day,
    pages,
    path: pages[0]?.file.path ?? dailyPath(day),
    planned,
    finished,
    docNames,
    summary,
    percent
  };
}

function weekRangeFromStart(start) {
  return { start, end: start.plus({ days: 6 }).endOf("day") };
}

function taskSummaryList(taskList, limit = 6) {
  return taskList
    .slice(0, limit)
    .map(task => cleanText(task.text))
    .filter(Boolean);
}

function noteSummaryText(page) {
  const direct = page.summary ?? page["总结"] ?? page.week_summary ?? page["周总结"] ?? page.report;
  if (direct) return String(direct);
  const snippets = listSnippets(page, 4);
  return snippets.join(" / ");
}

function weeklyNotePages(range) {
  return pagesInRange(range.start, range.end).filter(page => {
    const path = String(page.file?.path ?? "");
    const name = String(page.file?.name ?? "");
    return path.startsWith(weeklyNoteFolder + "/") || /周报|周总结|week|weekly/i.test(name);
  });
}

function weekArchive(start) {
  const range = weekRangeFromStart(start);
  const planned = tasks.filter(task => inRange(relevantDay(task), range.start, range.end));
  const finished = done.filter(task => inRange(completedDay(task), range.start, range.end));
  const pages = pagesInRange(range.start, range.end);
  const dailyDocs = pages.filter(page => String(page.file?.path ?? "").startsWith(dailyNoteFolder + "/"));
  const weeklyDocs = weeklyNotePages(range);
  const percent = planned.length ? Math.round(finished.length / planned.length * 100) : 0;
  const summaryPieces = [
    weeklyDocs.map(noteSummaryText).filter(Boolean)[0],
    finished.length ? `完成 ${taskSummaryList(finished, 5).join(" / ")}` : "",
    dailyDocs.length ? `记录 ${dailyDocs.length} 篇日报` : ""
  ].filter(Boolean);
  return {
    ...range,
    planned,
    finished,
    pages,
    dailyDocs,
    weeklyDocs,
    percent,
    path: weeklyDocs[0]?.file.path ?? weeklyPath(range.start),
    summary: summaryPieces.join("；") || "暂无周总结，点击可补写本周回顾。"
  };
}

function completedTaskCard(task) {
  const doneDay = completedDay(task);
  return `
    <article class="tcc-done-card" data-detail-task="${esc(taskId(task))}">
      <div>
        <strong>${esc(cleanText(task.text))}</strong>
        <time>${fmtDate(doneDay)}</time>
      </div>
      <p>${esc(taskMeta(task))}</p>
      <div class="tcc-task-tags">${tagsHtml(task)}</div>
    </article>
  `;
}

function weeklyArchiveCard(item, index) {
  const finishedNames = taskSummaryList(item.finished, 8);
  return `
    <article class="tcc-archive-week ${item.start.hasSame(weekStart, "day") ? "current" : ""}" data-open-path="${esc(item.path)}">
      <div class="tcc-archive-top">
        <span>${index + 1}</span>
        <div>
          <strong>${item.start.toFormat("yyyy-LL-dd")} 至 ${item.end.toFormat("LL-dd")}</strong>
          <em>${item.finished.length} 完成 · ${item.planned.length} 计划 · ${item.dailyDocs.length} 日报 · ${item.weeklyDocs.length} 周报</em>
        </div>
      </div>
      ${bar(item.percent, `${item.finished.length}/${item.planned.length}`)}
      <p>${esc(item.summary)}</p>
      <div class="tcc-completed-list">
        ${finishedNames.map(name => `<span>${esc(name)}</span>`).join("") || `<span>暂无完成任务</span>`}
      </div>
    </article>
  `;
}

function taskDailyTrail(task) {
  const days = Array.from({ length: 7 }, (_, index) => weekStart.plus({ days: index }));
  const taskName = cleanText(task.text);
  const tags = taskTags(task);
  return days.map(day => {
    const pages = dailyPagesFor(day);
    const snippets = pages.flatMap(page => {
      const pageItems = listSnippets(page, 10);
      return pageItems.filter(text => {
        return text.includes(taskName) || tags.some(tag => text.includes(tag));
      });
    });
    const markers = [];
    if (sameDay(createdDay(task), day)) markers.push("创建");
    if (sameDay(startDay(task), day)) markers.push("开始");
    if (sameDay(scheduledDay(task), day)) markers.push("计划");
    if (sameDay(dueDay(task), day)) markers.push("截止");
    if (sameDay(completedDay(task), day)) markers.push("完成");
    return { day, snippets, markers };
  });
}

function taskTrailHtml(task) {
  const trail = taskDailyTrail(task);
  return `
    <div class="tcc-task-trail">
      ${trail.map(item => `
        <div class="${item.markers.length || item.snippets.length ? "active" : ""}">
          <time>${item.day.setLocale("zh-cn").toFormat("ccc")} ${item.day.toFormat("LL-dd")}</time>
          <strong>${item.markers.join(" / ") || "记录"}</strong>
          <p>${esc(item.snippets[0] ?? "暂无日报进展")}</p>
        </div>
      `).join("")}
    </div>
  `;
}

function taskCard(task, index) {
  const pg = displayedProgress(task);
  const p = priority(task);
  const status = taskVisualStatus(task);
  return `
    <article class="tcc-task-card ${status}" data-detail-task="${esc(taskId(task))}">
      <div class="tcc-task-head">
        <span class="tcc-rank">${index}</span>
        <span class="tcc-status ${status}">${statusText(task)}</span>
        <span class="tcc-priority ${p.cls}">${p.label}</span>
      </div>
      <h3>${esc(cleanText(task.text))}</h3>
      <div class="tcc-task-tags">${tagsHtml(task)}</div>
      <div class="tcc-muted">${esc(taskMeta(task))}</div>
      <button class="tcc-progress-trigger" data-task-id="${esc(taskId(task))}" type="button">
        ${bar(pg.percent, `${pg.mode} ${pg.detail}`)}
      </button>
    </article>
  `;
}

function metricCard(label, value, sub, cls = "") {
  return `
    <div class="tcc-metric ${cls}">
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
      <em>${esc(sub)}</em>
    </div>
  `;
}

function tickerItem(task) {
  const dueDelta = daysLeft(task);
  const label = dueDelta === null
    ? "未安排"
    : dueDelta < 0
      ? `逾期 ${Math.abs(dueDelta)} 天`
      : dueDelta === 0
        ? "今天"
        : `${dueDelta} 天后`;
  return `<span>${esc(label)} · ${esc(cleanText(task.text))}</span>`;
}

function weatherName(code) {
  if (code === 0) return ["晴", "clear"];
  if ([1, 2, 3].includes(code)) return ["多云", "cloud"];
  if ([45, 48].includes(code)) return ["雾", "fog"];
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return ["雨", "rain"];
  if (code >= 71 && code <= 77) return ["雪", "snow"];
  if (code >= 95) return ["雷雨", "storm"];
  return ["天气", "cloud"];
}

async function loadWeather(root) {
  const card = root.querySelector(".tcc-weather");
  if (!CONFIG.weather.enabled || !card) return;

  const { latitude, longitude, city } = CONFIG.weather;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    const current = data.current ?? {};
    const daily = data.daily ?? {};
    const [name, theme] = weatherName(Number(current.weather_code ?? 2));
    const max = Math.round(daily.temperature_2m_max?.[0] ?? current.temperature_2m ?? 0);
    const min = Math.round(daily.temperature_2m_min?.[0] ?? current.temperature_2m ?? 0);
    root.dataset.weather = theme;
    card.innerHTML = `
      <div>
        <span>${esc(city)} · ${name}</span>
        <strong>${Math.round(current.temperature_2m ?? 0)}°C</strong>
        <em>今日 ${min}/${max}° · 风速 ${Math.round(current.wind_speed_10m ?? 0)} km/h</em>
      </div>
    `;
  } catch (error) {
    root.dataset.weather = "cloud";
    card.innerHTML = `
      <div>
        <span>${esc(CONFIG.weather.city)} · 天气离线</span>
        <strong>--°C</strong>
        <em>网络不可用时使用默认背景</em>
      </div>
    `;
  }
}

function dayCard(report) {
  const day = report.day;
  const plannedDone = report.planned.filter(task => task.completed).length;
  const docTitle = report.docNames.length ? report.docNames.slice(0, 4).join(" / ") : "未找到日报文档";
  return `
    <article class="tcc-day ${sameDay(day, today) ? "today" : ""}" data-open-path="${esc(report.path)}">
      <div class="tcc-day-top">
        <strong>${day.setLocale("zh-cn").toFormat("cccc")}</strong>
        <span>${day.toFormat("yyyy-LL-dd")}</span>
      </div>
      ${bar(report.percent, `${plannedDone}/${report.planned.length}`)}
      ${heat(report.percent)}
      <p class="tcc-day-docs">${esc(docTitle)}</p>
    </article>
  `;
}

function weekRange(offset) {
  const start = weekStart.plus({ weeks: offset });
  return { start, end: start.plus({ days: 6 }).endOf("day") };
}

function weekSummary(offset) {
  return weekArchive(weekRange(offset).start);
}

function weeklyTimelineHtml() {
  const offsets = [];
  for (let i = -CONFIG.timelineWeeksBefore; i <= CONFIG.timelineWeeksAfter; i++) offsets.push(i);
  return offsets.map(offset => {
    const item = weekSummary(offset);
    const work = item.finished.length
      ? item.finished.slice(0, 4).map(task => cleanText(task.text)).join(" / ")
      : item.planned.slice(0, 4).map(task => cleanText(task.text)).join(" / ") || "暂无任务";
    return `
      <article class="tcc-week-event ${offset === 0 ? "current" : ""}" data-open-path="${esc(item.path)}">
        <time>${item.start.toFormat("LL-dd")} 至 ${item.end.toFormat("LL-dd")}</time>
        <div>
          <strong>${offset === 0 ? "本周" : offset < 0 ? `前 ${Math.abs(offset)} 周` : `后 ${offset} 周`}</strong>
          <p>${esc(item.summary || work)}</p>
          <small>${esc(work)}</small>
        </div>
        <div class="tcc-week-score">
          ${bar(item.percent, `${item.finished.length}/${item.planned.length}`)}
        </div>
      </article>
    `;
  }).join("");
}

function longTermCard(task) {
  const doneProgress = displayedProgress(task);
  const runway = timeProgress(task);
  const status = taskVisualStatus(task);
  return `
    <article class="tcc-long-card ${status}" data-detail-task="${esc(taskId(task))}">
      <div>
        <span>${priority(task).label}</span>
        <strong>${esc(cleanText(task.text))}</strong>
      </div>
      <div class="tcc-task-tags">${tagsHtml(task)}</div>
      ${bar(doneProgress.percent, `完成 ${doneProgress.detail}`)}
      ${runway ? bar(runway.percent, runway.detail) : `<p class="tcc-muted">没有开始/截止日期，无法计算时间进度</p>`}
      <em>${esc(taskMeta(task))}</em>
    </article>
  `;
}

const activeByTag = open.reduce((map, task) => {
  for (const tag of taskTags(task)) map[tag] = (map[tag] ?? 0) + 1;
  return map;
}, {});
const topTags = Object.entries(activeByTag).sort((a, b) => b[1] - a[1]).slice(0, 8);
const urgentTicker = focusCandidates.slice().sort((a, b) => focusScore(b) - focusScore(a)).slice(0, 10);
const focus = openThisWeek.slice().sort((a, b) => focusScore(b) - focusScore(a)).slice(0, CONFIG.focusLimit);
const weekReports = Array.from({ length: 7 }, (_, index) => dailyReport(weekStart.plus({ days: index })));
const recentDone = done
  .filter(task => completedDay(task))
  .sort((a, b) => completedDay(b).toMillis() - completedDay(a).toMillis())
  .slice(0, CONFIG.recentDoneLimit);
const archiveWeeks = Array.from({ length: CONFIG.completedArchiveWeeks }, (_, index) => weekArchive(weekStart.minus({ weeks: index })))
  .filter(item => item.finished.length || item.dailyDocs.length || item.weeklyDocs.length || item.start.hasSame(weekStart, "day"));
const tickerMarkup = urgentTicker.map(tickerItem).join("") || "<span>当前没有待处理任务</span>";

const root = mount(`
  <section class="tcc-shell" data-weather="cloud">
    <div class="tcc-motto" data-motto="${esc(mottoText)}" aria-label="${esc(mottoText)}"></div>

    <section class="tcc-hero">
      <div class="tcc-hero-main">
        <p class="tcc-eyebrow">${now.toFormat("yyyy-LL-dd HH:mm")} · ${weekStart.toFormat("LL-dd")} 至 ${weekEnd.toFormat("LL-dd")}</p>
        <h2>任务作战室</h2>
        <p>今日、本周、长期目标、日报和周报汇总在同一屏里动态更新。</p>
        <div class="tcc-tag-cloud">
          ${topTags.map(([tag, count]) => `<span>${esc(tag)} · ${count}</span>`).join("") || `<span>等待任务数据</span>`}
        </div>
      </div>
      <aside class="tcc-weather">
        <div>
          <span>${esc(CONFIG.weather.city)} · 天气加载中</span>
          <strong>--°C</strong>
          <em>正在获取天气并切换背景</em>
        </div>
      </aside>
      <div class="tcc-rings">
        ${ring(weekPercent, "本周完成", `${doneThisWeek.length}/${dueThisWeek.length}`)}
        ${ring(completionRatio, "总完成率", `${done.length}/${tasks.length}`)}
        ${ring(health, "健康分", overdue.length ? `${overdue.length} 项逾期` : "节奏正常", "health")}
      </div>
    </section>

    <section class="tcc-metrics">
      ${metricCard("今日焦点", String(dueToday.length), "计划或截止在今天", "hot")}
      ${metricCard("本周任务", String(openThisWeek.length), "Focus Queue 来源")}
      ${metricCard("逾期", String(overdue.length), "需要优先处理", "danger")}
      ${metricCard("本周完成", String(doneThisWeek.length), "已记录完成日期", "success")}
      ${metricCard("长期任务", String(longTerm.length), "单独跟踪进度")}
    </section>

    <section class="tcc-ticker">
      <strong>Live Queue</strong>
      <div><p>${tickerMarkup}${tickerMarkup}</p></div>
    </section>

    <section class="tcc-section">
      <div class="tcc-section-head">
        <h2>Focus Queue</h2>
        <span>只显示今日与本周任务，点击卡片进入任务源，点击进度展开本周进展</span>
      </div>
      <div class="tcc-focus-grid">
        ${focus.map((task, index) => taskCard(task, index + 1)).join("") || `<p class="tcc-empty">本周没有待处理任务。</p>`}
      </div>
    </section>

    <section class="tcc-section">
      <div class="tcc-section-head">
        <h2>Weekly Pulse</h2>
        <span>周一到周日，每日进度与日报文档</span>
      </div>
      <div class="tcc-week">
        ${weekReports.map(dayCard).join("")}
      </div>
    </section>

    <section class="tcc-section">
      <div class="tcc-section-head">
        <h2>Weekly Timeline</h2>
        <span>以周为单位汇总任务完成情况和工作记录</span>
      </div>
      <div class="tcc-week-timeline">
        ${weeklyTimelineHtml()}
      </div>
    </section>

    <section class="tcc-section">
      <div class="tcc-section-head">
        <h2>长期任务进度</h2>
        <span>完成进度与时间进度单独展示</span>
      </div>
      <div class="tcc-long-grid">
        ${longTerm.map(longTermCard).join("") || `<p class="tcc-empty">暂无长期任务。</p>`}
      </div>
    </section>

    <section class="tcc-section">
      <div class="tcc-section-head">
        <h2>已完成任务</h2>
        <span>按完成时间倒序保留最近完成记录</span>
      </div>
      <div class="tcc-done-grid">
        ${recentDone.map(completedTaskCard).join("") || `<p class="tcc-empty">还没有带完成日期的任务。</p>`}
      </div>
    </section>

    <section class="tcc-section">
      <div class="tcc-section-head">
        <h2>年度周档案</h2>
        <span>最近 52 周的完成任务、日报和周总结，点击卡片进入周报</span>
      </div>
      <div class="tcc-archive-grid">
        ${archiveWeeks.map(weeklyArchiveCard).join("") || `<p class="tcc-empty">暂无周归档。</p>`}
      </div>
    </section>
  </section>
`);

function bindInteractions(root) {
  root.querySelectorAll("[data-detail-task]").forEach(element => {
    element.addEventListener("click", event => {
      const taskId = element.dataset.detailTask;
      if (!taskId) return;
      window.localStorage.setItem("tcc:selectedTaskId", taskId);
      window.localStorage.setItem("tcc:selectedTaskAt", new Date().toISOString());
      openPath(detailPath);
    });
  });

  root.querySelectorAll("[data-open-path]").forEach(element => {
    element.addEventListener("click", event => {
      if (event.target.closest("button, a")) return;
      openPath(element.dataset.openPath);
    });
  });

  requestAnimationFrame(() => {
    root.querySelectorAll(".tcc-ring").forEach(ring => {
      const value = Number(ring.dataset.value ?? 0);
      ring.style.setProperty("--value", value);
      const counter = ring.querySelector("[data-count]");
      if (!counter) return;
      let current = 0;
      const step = () => {
        current += Math.max(1, Math.ceil(value / 18));
        if (current >= value) current = value;
        counter.textContent = `${current}%`;
        if (current < value) requestAnimationFrame(step);
      };
      step();
    });
  });
}

bindInteractions(root);
function runMotto(root) {
  const node = root.querySelector(".tcc-motto");
  if (!node) return;
  const chars = Array.from(node.dataset.motto ?? "");
  const step = 120;
  let cycle = 0;

  const play = () => {
    if (!document.body.contains(node)) return;
    const run = ++cycle;
    node.classList.remove("is-fading");
    node.innerHTML = "";

    chars.forEach((char, index) => {
      window.setTimeout(() => {
        if (cycle !== run || !document.body.contains(node)) return;
        const span = document.createElement("span");
        span.textContent = char;
        node.appendChild(span);
        requestAnimationFrame(() => span.classList.add("is-visible"));
      }, index * step);
    });

    const fullyShownAt = chars.length * step;
    window.setTimeout(() => {
      if (cycle === run && document.body.contains(node)) node.classList.add("is-fading");
    }, fullyShownAt + 2000);
    window.setTimeout(play, fullyShownAt + 2900);
  };

  play();
}

runMotto(root);
const heroAsset = heroAssetPaths
  .map(path => app.vault.getAbstractFileByPath(path))
  .find(Boolean);
if (heroAsset) {
  root.style.setProperty("--tcc-hero-image", `url("${app.vault.getResourcePath(heroAsset)}")`);
}
loadWeather(root);
```
