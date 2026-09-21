const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const shared = require('../tasks-core.js');
const records = require('../task-records.js');
const root = path.resolve(__dirname, '../..');
const plugin = fs.readFileSync(path.join(root, '.obsidian/plugins/dataview/main.js'), 'utf8');
const lib = plugin.slice(plugin.indexOf('// these'), plugin.indexOf('////////////////////', plugin.indexOf('var Luxon =')));
const { DateTime, Settings } = vm.runInNewContext(lib + ';Luxon;', { Intl, Date, console, setTimeout });
Settings.now = () => new Date('2026-09-18T12:00:00+08:00').getTime();
const sourcePath = 'task_outline/工作任务.md';
const legacy = 'daliy record/2026.09.18 Parent.md';
const data = new Map([[sourcePath, '## Today\n- [/] Parent ⏫ 📅 2026-09-20\n  - [x] Child A\n  - [>] Child B\n    - [ ] Nested\n## Next\n- [ ] Other\n'], [legacy, '# User record\n\nOriginal notes.\n']]);
const listeners = new Map();
let writes = 0;
const app = { vault: {
  getAbstractFileByPath: p => data.has(p) ? { path: p } : null,
  read: async file => data.get(file.path),
  create: async (p, content) => { assert(!data.has(p)); data.set(p, content); return { path: p }; },
  createFolder: async p => { data.set(p, ''); },
  process: async (file, update) => { data.set(file.path, update(data.get(file.path))); writes++; },
  getMarkdownFiles: () => [...data.keys()].filter(p => p.endsWith('.md')).map(path => ({ path })),
  on: (name, callback) => { const ref = { name, callback }; listeners.set(ref, ref); return ref; },
  offref: ref => listeners.delete(ref)
}, metadataCache: {}, workspace: { trigger() {} } };
const core = shared.create({ app, paths: [sourcePath], folder: 'task_outline', DateTime });
// JSON flow mappings are valid YAML; the application supplies Obsidian's YAML API.
const store = records.create({ app, core, DateTime, parseYaml: JSON.parse, stringifyYaml: x => JSON.stringify(x, null, 2), titleOf: shared.title });

(async () => {
  await core.initialize();
  const task = { ...shared.scan(data.get(sourcePath)).tasks[0], path: sourcePath };
  const created = await store.createRecord(task, { day: '2026-09-18', template: 'debug' });
  assert.equal(created.path, 'daliy record/2026.09.18 Parent (2).md');
  assert.equal(data.get(legacy), '# User record\n\nOriginal notes.\n');
  const record = store.readDocument(data.get(created.path));
  assert.equal(record.metadata.related_task_id, core.identity(task));
  assert.equal(record.metadata.task_status, '进行中');
  assert.equal(record.metadata.task_priority, '高');
  assert.equal(record.metadata.subtasks_total, 3);
  assert.equal(record.metadata.subtasks_done, 1);
  assert(record.body.includes('### Child B / Nested'));
  assert(record.body.includes('**现象与复现条件**'));
  assert(!record.body.includes('- [ ]'), 'record summaries must not create duplicate actionable tasks');
  const repeated = await store.createRecord(task, { day: '2026-09-18', template: 'standard' });
  assert.equal(repeated.created, false);
  assert.equal(repeated.path, created.path);
  const child = shared.scan(data.get(sourcePath)).tasks[2];
  const manual = '\n## 手写结论\n\n正文必须保留。\n![[my-image.png]]\n';
  data.set(created.path, data.get(created.path) + manual);
  const oldDate = store.readDocument(data.get(created.path)).metadata.date;
  await core.save({ ...child, path: sourcePath }, { title: 'Renamed B', status: 'x' });
  await core.addChild(task, { text: 'New child' });
  await core.save(task, { title: 'Renamed parent', next: 'Next action' });
  await core.initialize();
  assert.deepEqual(await store.syncAll(), []);
  const synced = store.readDocument(data.get(created.path));
  assert.equal(synced.metadata.related_task, 'Renamed parent');
  assert.equal(synced.metadata.date, oldDate);
  assert.equal(synced.metadata.task_next, 'Next action');
  assert.equal(synced.metadata.subtasks_total, 4);
  assert.equal(synced.metadata.subtasks_done, 2);
  assert(synced.body.includes('### Renamed B / Nested'));
  assert(synced.body.includes(manual));
  assert(synced.body.includes('### New child'));
  assert.equal((synced.body.match(/### New child/g) ?? []).length, 1);
  const beforeWrites = writes;
  const stable = data.get(created.path);
  await store.syncAll();
  assert.equal(data.get(created.path), stable);
  assert.equal(writes, beforeWrites, 'unchanged synchronization must not write files');
  data.set(created.path, stable.replace(/\n/g, '\r\n'));
  await core.save(task, { due: '2026-09-25' });
  await store.syncAll();
  assert(!/(?<!\r)\n/.test(data.get(created.path)), 'preserve line endings');
  const completeContent = data.get(created.path);
  data.set(created.path, completeContent.replace('<!-- tcc:task-summary:end -->', ''));
  const damaged = data.get(created.path);
  assert.equal((await store.syncAll()).length, 1);
  assert.equal(data.get(created.path), damaged, 'damaged managed markers must never cause body replacement');
  data.set(created.path, completeContent);
  const unsafeName = await store.createRecord(task, { name: '../../Other: record', template: 'headings' });
  assert(unsafeName.path.startsWith('daliy record/2026.09.18 '));
  assert(!unsafeName.path.slice('daliy record/'.length).includes('/'));
  const reports = [];
  store.watch([sourcePath], 'records-test', errors => reports.push(errors));
  store.watch([sourcePath], 'records-test', errors => reports.push(errors));
  assert.equal(listeners.size, 2, 'repeated view loads must replace the previous watcher');
  await core.save(task, { next: 'Watcher updated' });
  for (const ref of listeners.values()) if (ref.name === 'modify') ref.callback({ path: sourcePath });
  await new Promise(resolve => setTimeout(resolve, 550));
  assert.equal(store.readDocument(data.get(created.path)).metadata.task_next, 'Watcher updated');
  assert.deepEqual(reports, [[]]);
  globalThis[Symbol.for('tcc.record-watchers')].get('records-test').dispose();
  console.log('PASS: live snapshot, record creation, collision/reopen, templates, nested headings, metadata synchronization, idempotence, body preservation, CRLF, malformed markers and file watching.');
})().catch(error => { console.error(error); process.exitCode = 1; });
