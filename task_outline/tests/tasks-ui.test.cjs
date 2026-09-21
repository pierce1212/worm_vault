const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const taskPath = 'task_outline/工作任务.md';
const source = name => fs.readFileSync(path.join(root, 'task_outline', name), 'utf8');
const script = name => source(name).match(/```dataviewjs\s*\n([\s\S]*?)\n```/)[1];
const plugin = fs.readFileSync(path.join(root, '.obsidian/plugins/dataview/main.js'), 'utf8');
const luxon = plugin.slice(plugin.indexOf('// these'), plugin.indexOf('////////////////////', plugin.indexOf('var Luxon =')));
const fixture = '## 今日任务\n- [ ] CAN 对标 拓普需求更新 🛫 2026-09-17 📅 2026-09-20\n  - [ ] 确认唤醒配置\n- [/] 存储栈 📅 2026-09-19\n## 长期任务\n- [ ] 长期项目\n  - [ ] 阶段一\n';
const payload = { core: source('tasks-core.js'), records: source('task-records.js'), css: source('tasks-command-center.css'), fixture,
  dashboard: script('obsidian_tasks_command_center.md'), detail: script('任务详情.md'), review: script('复习时间轴.md') };

(async () => {
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><html><meta charset="utf-8"><body class="tasks-command-center"><main id="view"></main></body></html>'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.addScriptTag({ content: luxon + ';window.luxon=Luxon;' });
    await page.addStyleTag({ content: ':root{--background-primary:#202124;--background-secondary:#292b2e;--text-normal:#eceef1;--text-muted:#a6a9b0;--interactive-accent:#4285f4;--font-text:Arial,sans-serif;}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:var(--text-normal);background:var(--background-primary)}button,input,select,textarea{font:inherit}button{color:inherit}input,select,textarea{background:#292b2e;color:#eceef1;border:1px solid #57595d;border-radius:4px}button{cursor:pointer}' });
    await page.evaluate(async payload => {
      luxon.Settings.now = () => new Date('2026-09-16T12:00:00+08:00').getTime();
      const taskPath = 'task_outline/工作任务.md';
      const memory = new Map([[taskPath, payload.fixture], ['task_outline/tasks-core.js', payload.core], ['task_outline/task-records.js', payload.records], ['task_outline/tasks-command-center.css', payload.css]]);
      window.require = () => ({ parseYaml: JSON.parse, stringifyYaml: data => JSON.stringify(data, null, 2) });
      window.testState = { memory, opened: [], renders: 0, mode: 'dashboard' };
      function parse(text) {
        const tasks = [], headings = [], stack = [];
        text.split(/\r?\n/).forEach((line, i) => {
          if (/^#{1,6} /.test(line)) { headings.push({ heading: line.replace(/^#+ /, ''), position: { start: { line: i } } }); stack.length = 0; return; }
          const m = line.match(/^(\s*)[-*+]\s+(?:\[([^\]])\]\s+)?(.*)$/);
          if (!m) return;
          const indent = m[1].replace(/\t/g, '    ').length;
          while (stack.length && stack.at(-1).indent >= indent) stack.pop();
          const item = { line: i, text: m[3], task: m[2] !== undefined, status: m[2] ?? '', completed: /x/i.test(m[2] ?? ''), path: taskPath, children: [], tags: [] };
          if (stack.length) stack.at(-1).item.children.push(item);
          stack.push({ item, indent });
          if (item.task) tasks.push(item);
        });
        return { tasks, headings };
      }
      const wrap = items => ({ array: () => items, where: fn => wrap(items.filter(fn)), file: { tasks: { where: fn => ({ array: () => items.flatMap(p => p.file.tasks ?? []).filter(fn) }) } } });
      window.app = { vault: {
        configDir: '.obsidian', getAbstractFileByPath: path => memory.has(path) ? { path } : null,
        read: async file => memory.get(file.path),
        create: async (path, text) => { memory.set(path, text); return { path }; },
        createFolder: async path => memory.set(path, ''),
        getMarkdownFiles: () => [...memory.keys()].filter(path => path.endsWith('.md')).map(path => ({ path })),
        process: async (file, change) => memory.set(file.path, change(memory.get(file.path))),
        adapter: { read: async path => memory.get(path), write: async (path, text) => memory.set(path, text), exists: async path => memory.has(path), mkdir: async path => memory.set(path, '') }
      }, metadataCache: { getCache: () => ({ headings: parse(memory.get(taskPath)).headings }) }, workspace: {
        openLinkText: path => testState.opened.push(path),
        trigger: () => window.renderTest()
      } };
      window.renderTest = async (mode = testState.mode) => {
        testState.mode = mode;
        document.getElementById('view').innerHTML = '';
        const names = { dashboard: 'obsidian_tasks_command_center.md', detail: '任务详情.md', review: '复习时间轴.md' };
        const recordPages = [...memory.entries()].filter(([path]) => path.startsWith('daliy record/') && path.endsWith('.md')).map(([path, content]) => ({ ...JSON.parse(content.match(/^---\n([\s\S]*?)\n---/)[1]), file: { path, name: path.split('/').at(-1).replace(/\.md$/, ''), tasks: [], lists: [] } }));
        window.dv = { luxon, container: document.getElementById('view'), current: () => ({ file: { path: 'task_outline/' + names[mode] } }), pages: () => wrap([{ file: { path: taskPath, tasks: parse(memory.get(taskPath)).tasks } }, ...recordPages]) };
        const code = payload[mode].replace('enabled: true', 'enabled: false');
        await new (Object.getPrototypeOf(async function() {}).constructor)('dv', 'app', code)(dv, app);
        testState.renders++;
      };
      await renderTest();
    }, payload);
    const card = () => page.locator('.tcc-focus-grid .tcc-task-card').filter({ has: page.locator('h3', { hasText: 'CAN 对标' }) });
    const revision = async () => page.evaluate(() => testState.renders);
    const saveDialog = async () => {
      const before = await revision();
      await page.locator('dialog button[type=submit]').click();
      await page.waitForFunction(n => testState.renders > n, before);
      await page.locator('dialog').waitFor({ state: 'detached' });
    };
    assert.equal(await card().count(), 1);
    await card().getByRole('button', { name: '编辑任务', exact: true }).click();
    await page.locator('dialog input[name=next]').fill('确认配置后进行台架测试');
    await page.locator('dialog input[name=due]').fill('2026-09-22');
    await page.locator('dialog select[name=status]').selectOption('/');
    await saveDialog();
    assert.match(await card().innerText(), /确认配置后进行台架测试/);
    await card().getByRole('button', { name: '添加子任务', exact: true }).click();
    await page.locator('dialog input[name=text]').fill('台架验证');
    await saveDialog();
    assert.equal(await card().locator('input[type=checkbox]').count(), 2);
    await card().getByRole('button', { name: '记录进展', exact: true }).click();
    await page.locator('dialog textarea').fill('已确认接口，准备测试');
    await saveDialog();
    const beforeCheck = await revision();
    await card().locator('input[type=checkbox]').first().check();
    await page.waitForFunction(n => testState.renders > n, beforeCheck);
    assert.match(await card().innerText(), /1\/2/);
    const beforeLast = await revision();
    await card().locator('input[type=checkbox]').last().check();
    await page.waitForFunction(n => testState.renders > n, beforeLast);
    assert.match(await card().innerText(), /待验收/);
    assert.equal(await page.evaluate(() => testState.opened.length), 0);
    await page.locator('[data-filter=maintenance]').click();
    assert.match(await page.locator('[data-filter-grid]').innerText(), /待验收/);
    await card().getByRole('button', { name: '编辑任务', exact: true }).click();
    await page.locator('dialog select[name=status]').selectOption('blocked');
    await page.locator('dialog input[name=reason]').fill('等待硬件到位');
    await page.locator('dialog input[name=check]').fill('2026-09-17');
    await page.setViewportSize({ width: 390, height: 844 });
    const output = path.join(root, 'output/playwright');
    fs.mkdirSync(output, { recursive: true });
    await page.locator('dialog').screenshot({ path: path.join(output, 'task-editor-mobile.png') });
    assert(await page.locator('dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    await saveDialog();
    await page.locator('[data-filter=blocked]').click();
    const blocked = page.locator('[data-filter-grid] .tcc-task-card').filter({ has: page.locator('h3', { hasText: 'CAN 对标' }) });
    assert.match(await blocked.innerText(), /等待硬件到位/);
    await blocked.getByRole('button', { name: '编辑任务', exact: true }).click();
    await page.locator('dialog select[name=status]').selectOption('/');
    await saveDialog();
    await card().getByRole('button', { name: '验收完成', exact: true }).click();
    await saveDialog();
    const accepted = page.locator('.tcc-week-done-grid .tcc-done-card').filter({ hasText: 'CAN 对标' });
    assert.equal(await accepted.count(), 1);
    await accepted.click({ position: { x: 20, y: 20 } });
    await page.evaluate(() => renderTest('detail'));
    assert.match(await page.locator('.tcc-detail-hero h2').innerText(), /CAN 对标/);
    assert.equal(await page.locator('.tcc-node-tree button').count(), 2);
    await page.evaluate(() => renderTest('review'));
    await page.evaluate(() => renderTest('dashboard'));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('.tcc-metrics').screenshot({ path: path.join(output, 'task-metrics-desktop.png') });
    await accepted.screenshot({ path: path.join(output, 'task-maintenance-desktop.png') });
    await page.evaluate(() => renderTest('detail'));
    await page.locator('.tcc-status-metric .tcc-state-badge').click();
    await page.locator('dialog select[name=status]').selectOption('/');
    await saveDialog();
    const nodeRow = () => page.locator('.tcc-node-row').first();
    for (const [state, key] of [['>', 'postponed'], ['/', 'doing'], ['?', 'pending'], ['!', 'important'], ['blocked', 'blocked'], ['-', 'cancelled'], [' ', 'todo'], ['x', 'done']]) {
      await nodeRow().locator('.tcc-state-badge').click();
      await page.locator('dialog select[name=status]').selectOption(state);
      if (['>', 'blocked'].includes(state)) {
        await page.locator('dialog input[name=reason]').fill('等待测试条件');
        await page.locator('dialog input[name=check]').fill('2026-09-23');
      }
      await saveDialog();
      assert.equal(await nodeRow().getAttribute('data-state'), key);
      assert.equal(await page.locator('.tcc-status-metric').getAttribute('data-state'), 'doing', 'child changes must not change the parent state');
    }
    const beforeToggle = await revision();
    await nodeRow().locator('input[type=checkbox]').uncheck();
    await page.waitForFunction(n => testState.renders > n, beforeToggle);
    assert.equal(await nodeRow().getAttribute('data-state'), 'todo');
    await page.evaluate(() => {
      const taskPath = 'task_outline/工作任务.md';
      const lines = testState.memory.get(taskPath).split('\n');
      const parent = lines.findIndex(line => line.includes('CAN 对标'));
      lines.splice(parent + 1, 0,
        '  - [>] 延期子任务 [tcc_reason:: 等待测试条件] [tcc_check:: 2026-09-23]',
        '  - [/] 进行中子任务', '  - [/] 阻塞子任务 [tcc_blocked:: true]',
        '  - [?] 待确认子任务', '  - [!] 重要子任务', '  - [-] 取消子任务');
      testState.memory.set(taskPath, lines.join('\n'));
    });
    await page.evaluate(() => renderTest('detail'));
    await page.locator('.tcc-node-tree').screenshot({ path: path.join(output, 'subtask-states-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.tcc-node-tree').screenshot({ path: path.join(output, 'subtask-states-mobile.png') });
    assert(await page.locator('.tcc-node-tree').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    await page.evaluate(() => renderTest('dashboard'));
    assert.equal(await card().locator('.tcc-state-badge[data-state=postponed]').count(), 1);
    await card().locator('.tcc-state-badge[data-state=postponed]').click();
    assert.equal(await page.locator('dialog select[name=status]').inputValue(), '>');
    await page.locator('dialog [data-close]').first().click();
    await page.evaluate(() => renderTest('detail'));
    await page.getByRole('button', { name: '创建任务记录', exact: true }).click();
    await page.locator('dialog select[name=template]').selectOption('debug');
    await page.locator('dialog').screenshot({ path: path.join(output, 'create-task-record-mobile.png') });
    assert(await page.locator('dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    await saveDialog();
    const createdPath = await page.evaluate(() => testState.opened.at(-1));
    assert(createdPath.startsWith('daliy record/2026.09.16 CAN 对标'));
    const createdRecord = await page.evaluate(p => testState.memory.get(p), createdPath);
    assert(createdRecord.includes('### 确认唤醒配置'));
    assert(createdRecord.includes('**现象与复现条件**'));
    assert.equal(await page.locator('.tcc-related-docs [role=link]').count(), 1);
    await page.locator('.tcc-related-docs [role=link]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => testState.opened.at(-1)), createdPath);
    await page.evaluate(p => testState.memory.set(p, testState.memory.get(p) + '\n用户手写记录必须保留\n'), createdPath);
    await page.locator('.tcc-status-metric .tcc-state-badge').click();
    await page.locator('dialog input[name=next]').fill('新增记录之后的下一步');
    await saveDialog();
    const refreshedRecord = await page.evaluate(p => testState.memory.get(p), createdPath);
    assert(refreshedRecord.includes('新增记录之后的下一步'));
    assert(refreshedRecord.includes('用户手写记录必须保留'));
    await page.getByRole('button', { name: '创建任务记录', exact: true }).click();
    await saveDialog();
    assert.equal(await page.evaluate(() => [...testState.memory.keys()].filter(p => p.startsWith('daliy record/') && p.endsWith('.md')).length), 1);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('.tcc-detail-grid').screenshot({ path: path.join(output, 'task-record-properties-desktop.png') });
    assert.deepEqual(errors, []);
    console.log('PASS: three views, quick edit, child creation, note logging, completion, acceptance, maintenance filter, blocking/restart and mobile editor.');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
