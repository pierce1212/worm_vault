/* Day planning is independent from the in-progress-only Focus Queue. */
function build(tasks, { core, DateTime, today }) {
  const array = value => Array.isArray(value) ? value : value?.array?.() ?? Array.from(value ?? []);
  const key = task => `${task.path ?? ""}:${task.line}`;
  const nested = new Set(tasks.flatMap(task => core.children(task).map(key)));
  const roots = tasks.filter(task => !nested.has(key(task)));
  const day = (task, property, symbol) => {
    const value = task[property];
    const parsed = value?.isLuxonDateTime ? value : DateTime.fromISO(String(value ?? task.text?.match(new RegExp(`${symbol}\\s*(\\d{4}-\\d{2}-\\d{2})`, "u"))?.[1] ?? ""));
    return parsed.isValid ? parsed.startOf("day") : null;
  };
  const active = task => !["done", "cancelled", "postponed", "blocked"].includes(core.state(task).key);
  function activeNodes(task) {
    const result = [];
    function walk(node, root = false) {
      if (root || node.task) {
        if (!active(node)) return;
        result.push(node);
      }
      for (const child of array(node.children)) walk(child);
    }
    walk(task, true);
    return result;
  }
  function reasons(task) {
    const result = [];
    for (const [property, symbol, label] of [["scheduled", "⏳", "今日计划"], ["start", "🛫", "今日开始"], ["due", "📅", "今日截止"]]) {
      if (day(task, property, symbol)?.hasSame(today, "day")) result.push(label);
    }
    if (core.state(task).key === "doing") result.push("进行中");
    return result;
  }
  function entry(task, nodes, labels) {
    const priority = [task, ...nodes].map(core.priority).sort((a, b) => b.score - a.score)[0];
    const due = [task, ...nodes].map(node => day(node, "due", "📅")?.toMillis() ?? Infinity).sort((a, b) => a - b)[0];
    return { task, nodes, labels, priority, childPriority: priority.score > core.priority(task).score, due };
  }
  const planned = [], overdue = [], done = [];
  for (const task of roots) {
    if (core.state(task).key === "done") {
      if (day(task, "completion", "✅")?.hasSame(today, "day")) done.push(entry(task, [], ["今日完成"]));
      continue;
    }
    const nodes = activeNodes(task);
    const relevant = nodes.filter(node => reasons(node).length);
    if (relevant.length) {
      const own = reasons(task);
      const labels = own.length ? own : [...new Set(relevant.flatMap(node => reasons(node).map(reason => `子任务${reason}`)))];
      planned.push(entry(task, relevant, labels));
    } else {
      const late = nodes.filter(node => { const due = day(node, "due", "📅"); return due && due < today; });
      if (late.length) overdue.push(entry(task, late, ["逾期待安排"]));
    }
  }
  const compare = (a, b) => b.priority.score - a.priority.score || a.due - b.due || key(a.task).localeCompare(key(b.task), "zh-CN", { numeric: true });
  return { planned: planned.sort(compare), overdue: overdue.sort(compare), done: done.sort(compare) };
}

module.exports = { build };
