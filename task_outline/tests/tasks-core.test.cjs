const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const core = require('../tasks-core.js');
const root = path.resolve(__dirname, '../..');
const plugin = fs.readFileSync(path.join(root, '.obsidian/plugins/dataview/main.js'), 'utf8');
const start = plugin.indexOf('// these');
const end = plugin.indexOf('////////////////////', plugin.indexOf('var Luxon ='));
const { DateTime, Settings } = vm.runInNewContext(plugin.slice(start, end) + '; Luxon;', { Intl, Date, console, setTimeout });
Settings.now = () => new Date('2026-09-16T12:00:00+08:00').getTime();
const taskPath = 'task_outline/工作任务.md';

function setup(text) {
  const storage = new Map([[taskPath, text], ['task_outline/tasks-command-center.css', 'test css']]);
  const app = { vault: {
    configDir: '.obsidian',
    getAbstractFileByPath: path => storage.has(path) ? { path } : null,
    read: async file => storage.get(file.path),
    create: async (path, text) => { assert(!storage.has(path)); storage.set(path, text); return { path }; },
    process: async (file, update) => { storage.set(file.path, update(storage.get(file.path))); },
    adapter: {
      read: async path => storage.get(path),
      write: async (path, text) => storage.set(path, text),
      exists: async path => storage.has(path),
      mkdir: async path => storage.set(path, '')
    }
  }, workspace: { trigger() {} } };
  const store = core.create({ app, paths: [taskPath], folder: 'task_outline', DateTime });
  const tasks = () => core.scan(storage.get(taskPath)).tasks.map(t => ({ ...t, path: taskPath, task: true, completed: t.status.toLowerCase() === 'x', children: [] }));
  return { store, tasks, storage, app };
}

(async () => {
  for (const [status, key, label] of [[' ', 'todo', '待办'], ['/', 'doing', '进行中'], ['>', 'postponed', '延期'], ['?', 'pending', '待确认'], ['!', 'important', '重要'], ['x', 'done', '完成'], ['-', 'cancelled', '取消']]) {
    assert.deepEqual(core.state({ status, text: 'Task' }), { key, label });
  }
  assert.equal(core.state({ status: '/', text: 'Task [tcc_blocked:: true]' }).key, 'blocked');
  assert.equal(core.state({ status: '>', text: 'Task [tcc_blocked:: true]' }).key, 'postponed');
  assert.equal(core.state({ completed: true, text: 'Task [tcc_blocked:: true]' }).key, 'done');
  for (const name of ['obsidian_tasks_command_center.md', '任务详情.md', '复习时间轴.md']) {
    const content = fs.readFileSync(path.join(root, 'task_outline', name), 'utf8');
    const source = content.match(/```dataviewjs\s*\n([\s\S]*?)\n```/)[1];
    new vm.Script('(async function(){' + source + '\n})');
  }
  const sample = '---\r\nexample: "- [ ] YAML"\r\n---\r\n```markdown\r\n- [ ] Example\r\n```\r\n~~~\r\n- [ ] Other example\r\n~~~\r\n<!--\r\n- [ ] Comment\r\n-->\r\n## Today\r\n- [ ] Parent\r\n\t- [ ] Child\r\n\r\n## Next\r\n- [ ] Neighbor\r\n';
  const f = setup(sample);
  await f.store.initialize();
  assert.equal(f.tasks().length, 3);
  assert.equal(f.tasks().filter(t => t.id).length, 3);
  const migrated = f.storage.get(taskPath);
  assert(migrated.includes('- [ ] Example\r\n'));
  assert(migrated.includes('- [ ] Comment\r\n'));
  await f.store.initialize();
  assert.equal(f.storage.get(taskPath), migrated, 'migration must be idempotent');
  const parent = f.tasks()[0];
  const identity = f.store.identity(parent);
  f.storage.set(taskPath, '\r\n' + f.storage.get(taskPath));
  await f.store.save(parent, { title: 'Renamed parent', due: '2026-10-01', next: 'Confirm the interface' });
  assert.equal(f.tasks()[0].id, parent.id, 'rename/move must preserve identity');
  await f.store.initialize();
  assert.equal(f.store.identity(f.tasks()[0]), identity);
  assert(f.store.aliases(f.tasks()[0]).includes('Parent'));
  await f.store.addChild(parent, { text: 'Another\nchild', due: '2026-09-18' });
  assert(f.storage.get(taskPath).includes('  - [ ] Another child 📅 2026-09-18 ^tcc-'));
  assert(f.storage.get(taskPath).indexOf('Another child') < f.storage.get(taskPath).indexOf('## Next'));
  assert(!/(?<!\r)\n/.test(f.storage.get(taskPath)), 'preserve CRLF');
  await f.store.save(parent, { status: 'blocked', reason: 'Waiting for review', check: '2026-09-17' });
  assert(core.isBlocked(f.tasks()[0]));
  assert.equal(f.store.info(f.tasks()[0]).check, '2026-09-17');
  assert(!f.store.reasons(f.tasks()[0]).includes('到期检查'));
  await f.store.save(parent, { status: '>', reason: 'Capacity', check: '2026-09-15' });
  assert(f.store.reasons(f.tasks()[0]).includes('到期检查'));
  await f.store.save(parent, { status: '/' });
  assert(!core.isBlocked(f.tasks()[0]));
  assert.equal(f.store.info(f.tasks()[0]).check, '');
  const child = f.tasks()[1];
  await f.store.save(child, { status: 'x' });
  assert.equal(f.tasks()[1].status, 'x');
  assert(f.tasks()[1].text.includes('✅ 2026-09-16'));
  await f.store.save(child, { status: ' ' });
  assert(!f.tasks()[1].text.includes('✅'));
  await f.store.addNote(parent, { text: 'Progress', progress: '35', moment: '2026-09-16T12:00' });
  assert(f.storage.get(taskPath).includes('[progress:: 35%] Progress'));
  await f.store.setReview(parent, true);
  await f.store.markReview(parent, 1, DateTime.fromISO('2026-09-15'));
  await f.store.markReview(parent, 1, DateTime.fromISO('2026-09-15'));
  assert.equal((f.storage.get(taskPath).match(/\[review::/g) ?? []).length, 1);
  assert(f.tasks()[0].text.endsWith('^' + parent.id), 'metadata updates keep block ID last');
  const beforeInvalid = f.storage.get(taskPath);
  await assert.rejects(f.store.save(parent, { status: 'x', accept: true }), /未完成/);
  await assert.rejects(f.store.addNote(parent, { text: 'Bad', progress: '150' }));
  await assert.rejects(f.store.save(parent, { due: '2026-02-30' }));
  assert.equal(f.storage.get(taskPath), beforeInvalid);
  await f.store.syncStyles();
  assert.equal(f.storage.get('.obsidian/snippets/tasks-command-center.css'), 'test css');
  const tree = { completed: false, status: '/', text: 'Parent', children: [
    { task: true, completed: true, children: [] },
    { task: true, completed: true, children: [{ task: true, completed: true, children: [] }] }
  ] };
  assert.equal(core.completion(tree).percent, 100);
  assert(core.ready(tree));
  assert.equal(tree.completed, false, 'subtask completion must not accept the parent');
  tree.children[1].children[0].completed = false;
  assert.equal(core.completion(tree).detail, '2/3');
  assert(!core.ready(tree));
  const duplicate = setup('- [ ] A ^same\n- [ ] B ^same\n');
  await assert.rejects(duplicate.store.initialize(), /重复/);
  const removed = setup('- [ ] Remove me\n');
  await removed.store.initialize();
  const deleted = removed.tasks()[0];
  removed.storage.set(taskPath, '- [ ] Someone else\n');
  await assert.rejects(removed.store.save(deleted, { status: 'x' }));
  assert(!removed.storage.get(taskPath).includes('[x]'));
  const historic = setup('- [x] Finished ✅ 2026-08-01\n');
  await historic.store.initialize();
  await historic.store.save(historic.tasks()[0], { status: 'x', title: 'Renamed finished' });
  assert(historic.tasks()[0].text.includes('✅ 2026-08-01'), 'editing a completed task must preserve its completion date');
  console.log('PASS: view syntax, migration, stable IDs, aliases, subtree insertion, state changes, review records, validation, acceptance, CSS sync and stale-write protection.');
})().catch(error => { console.error(error); process.exitCode = 1; });
