const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const shared = require('../tasks-core.js');
const checkinModule = require('../task-checkins.js');
const source = fs.readFileSync(path.resolve(__dirname, '../../.obsidian/plugins/dataview/main.js'), 'utf8');
const { DateTime, Settings } = vm.runInNewContext(source.slice(source.indexOf('// these'), source.indexOf('////////////////////', source.indexOf('var Luxon ='))) + ';Luxon;', { Date, Intl });
Settings.now = () => new Date('2026-10-14T12:00:00+08:00').getTime();
const taskPath = 'task_outline/工作任务.md';
const data = new Map([[taskPath, '- [/] 英语学习 [tcc_habit:: true] [tcc_habit_goal:: 5]\n  - [ ] 语法复习\n']]);
const app = { vault: {
  getAbstractFileByPath: p => data.has(p) ? { path: p } : null,
  read: async file => data.get(file.path),
  create: async (p, content) => { assert(!data.has(p)); data.set(p, content); return { path: p }; },
  createFolder: async p => data.set(p, ''),
  process: async (file, fn) => data.set(file.path, fn(data.get(file.path))),
  getMarkdownFiles: () => [...data.keys()].filter(p => p.endsWith('.md')).map(path => ({ path }))
}, workspace: { trigger() {} } };
const core = shared.create({ app, paths: [taskPath], folder: 'task_outline', DateTime });
const store = checkinModule.create({ app, core, DateTime, parseYaml: JSON.parse, stringifyYaml: obj => JSON.stringify(obj, null, 2), titleOf: shared.title });

(async () => {
  await core.initialize();
  const task = { ...shared.scan(data.get(taskPath)).tasks[0], path: taskPath };
  const before = data.get(taskPath);
  const entry = { day: '2026-10-14', kind: 'done', minutes: 25, content: '跟读技术视频\n复习十五个单词', reflection: '连读需要练习', next: '录音对比' };
  const file = await store.saveEntry(task, entry);
  assert(file.startsWith('daliy record/打卡记录/2026-10 '));
  assert.equal(data.get(taskPath), before, 'check-ins never change task status or children');
  await store.load([task]);
  assert.equal(store.stats(task).weekCount, 1);
  assert.equal(store.stats(task).minutes, 25);
  assert.equal(store.stats(task).goal, 5);
  assert.equal(store.stats(task).current.content, entry.content);
  data.set(file, data.get(file) + '\n## 自由笔记\n![[screenshot.png]]\n');
  const old = store.stats(task).current.raw;
  assert.equal(await store.saveEntry(task, { ...entry, minutes: 30, expected: old }), file);
  assert(data.get(file).includes('## 自由笔记\n![[screenshot.png]]'));
  await assert.rejects(store.saveEntry(task, { ...entry, expected: old }), /已被修改/);
  await store.saveEntry(task, { ...entry, day: '2026-10-12', minutes: 20 });
  await store.saveEntry(task, { ...entry, day: '2026-10-13', kind: 'rest', minutes: 300, content: '' });
  await store.saveEntry(task, { ...entry, day: '2026-09-30', minutes: 15 });
  await store.load([task]);
  const stats = store.stats(task);
  assert.equal(stats.weekCount, 2);
  assert.equal(stats.weekMinutes, 50);
  assert.equal(stats.count, 3);
  assert.equal(stats.minutes, 65);
  assert.equal(stats.entries.find(item => item.day === '2026-10-13').minutes, 0);
  assert(data.get(file).indexOf('<!-- tcc-checkin:2026-10-12') < data.get(file).indexOf('<!-- tcc-checkin:2026-10-14'));
  assert.equal([...data.keys()].filter(p => p.startsWith('daliy record/') && p.endsWith('.md')).length, 2);
  const filesBefore = JSON.stringify([...data]);
  for (const invalid of [{ day: '2026-10-15' }, { day: '2026-02-30' }, { minutes: -1 }, { minutes: 2.5 }, { minutes: 1441 }, { content: '' }]) await assert.rejects(store.saveEntry(task, { ...entry, ...invalid }));
  assert.equal(JSON.stringify([...data]), filesBefore);
  await core.save(task, { title: 'English learning', weeklyGoal: 4 });
  assert.equal(await store.saveEntry(task, { ...entry, minutes: 35 }), file, 'renaming a task must reuse its monthly record');
  data.set(file, data.get(file).replace(/\n/g, '\r\n'));
  await store.saveEntry(task, { ...entry, minutes: 36 });
  assert(!/(?<!\r)\n/.test(data.get(file)));
  await core.save(task, { habit: 'false' });
  await assert.rejects(store.saveEntry(task, entry), /开启/);
  await store.load([task]);
  assert.equal(store.stats(task).count, 3, 'turning off habit mode retains history');
  assert.equal(shared.scan(data.get(taskPath)).tasks[0].status, '/');
  assert.equal(shared.scan(data.get(taskPath)).tasks[1].status, ' ');
  const damaged = data.get(file).replace('<!-- /tcc-checkin:2026-10-14 -->', '');
  data.set(file, damaged);
  assert.equal((await store.load([task])).length, 1);
  assert.equal(data.get(file), damaged);
  const another = await core.createTask({ title: '另一项学习', habit: true, weeklyGoal: 3 });
  await store.saveEntry(another, { ...entry, minutes: 10 });
  await store.load([task, another]);
  assert.equal(store.stats(another).weekCount, 1);
  assert.equal(store.stats(another).minutes, 10, 'statistics must remain separate by task ID');
  console.log('PASS: daily editing, backfill, rest days, weekly targets, totals, monthly grouping, rename identity, optimistic conflict checks, CRLF, validation and task-state isolation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
