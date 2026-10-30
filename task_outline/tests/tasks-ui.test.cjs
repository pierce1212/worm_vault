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
const fixture = '## 今日任务\n- [/] CAN 对标 拓普需求更新 🛫 2026-09-17 📅 2026-09-20\n  - [ ] 确认唤醒配置\n- [/] 存储栈 📅 2026-09-19\n## 长期任务\n- [ ] 长期项目\n  - [ ] 阶段一\n';
const payload = { core: source('tasks-core.js'), records: source('task-records.js'), todayModule: source('tasks-today.js'), checkins: source('task-checkins.js'), css: source('tasks-command-center.css'), fixture,
  dashboard: script('obsidian_tasks_command_center.md'), detail: script('任务详情.md'), review: script('复习时间轴.md'), today: script('今日任务.md'), achievements: script('打卡成就.md') };

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
      const memory = new Map([[taskPath, payload.fixture], ['task_outline/tasks-core.js', payload.core], ['task_outline/task-records.js', payload.records], ['task_outline/tasks-today.js', payload.todayModule], ['task_outline/task-checkins.js', payload.checkins], ['task_outline/tasks-command-center.css', payload.css]]);
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
        const names = { dashboard: 'obsidian_tasks_command_center.md', detail: '任务详情.md', review: '复习时间轴.md', today: '今日任务.md', achievements: '打卡成就.md' };
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
    const output = path.resolve(root, process.env.TCC_UI_ARTIFACT_DIR || 'output/playwright');
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
    await page.evaluate(async () => {
      luxon.Settings.now = () => new Date('2026-10-12T12:00:00+08:00').getTime();
      testState.memory.set('task_outline/工作任务.md', [
        '## 长期任务',
        '- [/] AI电影制作 （夸克） 2026 🛫 2026-08-16 📅 2026-10-20',
        '  - [/] 新婚致辞--三十岁总结 🛫 2026-10-12 📅 2026-12-18',
        '  - [ ] AI生成婚纱照 📅 2026-10-13',
        '  - [ ] 婚礼流程确定 📅 2026-10-17',
        '  - [ ] 婚礼台词 📅 2026-10-17',
        '- [ ] 由子任务推进的长期项目',
        '  - [/] 正在推进的子任务',
        '- [ ] 子任务本周到期的长期项目',
        '  - [ ] 交付 📅 2026-10-13',
        '- [ ] 本周开始的长期项目 🛫 2026-10-12 📅 2026-12-31',
        '- [ ] 待定长期项目 🛫 2026-01-01 📅 2026-12-31',
        '- [ ] 未来长期项目 📅 2026-12-31',
        '- [>] 已延期项目', '  - [/] 已暂停父任务下的子任务',
        '- [/] 已阻塞项目 [tcc_blocked:: true]', '  - [/] 已阻塞父任务下的子任务',
        '- [x] 已完成项目', '  - [/] 已归档父任务下的子任务',
        '- [ ] 暂停分支项目', '  - [>] 延期分支', '    - [/] 分支下的活动不应泄漏',
        '- [ ] 已取消分支项目', '  - [-] 取消分支', '    - [ ] 本周日期不应泄漏 📅 2026-10-13',
        '- [ ] 已完成子任务项目', '  - [x] 本周完成子任务 📅 2026-10-13',
        '- [ ] 由逾期子任务推进的长期项目', '  - [ ] 待交付 📅 2026-10-11',
        '- [ ] 关节电机驱动开发 📅 2026-12-13', '  - [ ] 电机基础 demo 开发 📅 2026-09-23'
      ].join('\n'));
      await renderTest('dashboard');
    });
    const focusGrid = page.locator('.tcc-focus-grid').first();
    const expectedFocus = ['AI电影制作 （夸克） 2026', '由子任务推进的长期项目'];
    const expectedWeek = [...expectedFocus, '子任务本周到期的长期项目', '本周开始的长期项目', '由逾期子任务推进的长期项目', '关节电机驱动开发'];
    assert.deepEqual((await focusGrid.locator('h3').allTextContents()).sort(), expectedFocus.slice().sort());
    assert.equal(await focusGrid.locator('.tcc-task-card').filter({ hasText: 'AI生成婚纱照' }).count(), 1, 'children remain inside the parent');
    assert.match(await focusGrid.locator('.tcc-task-card').filter({ hasText: '由子任务推进的长期项目' }).innerText(), /子任务进行中/);
    assert.equal(await page.locator('.tcc-ticker').filter({ hasText: '关节电机驱动开发' }).count(), 0);
    await page.locator('[data-filter=week]').first().click();
    assert.deepEqual((await page.locator('[data-filter-grid] h3').allTextContents()).sort(), expectedWeek.slice().sort());
    await focusGrid.screenshot({ path: path.join(output, 'long-term-focus-regression.png') });
    await page.evaluate(async () => {
      testState.memory.set('task_outline/工作任务.md', '## 今日任务\n' + Array.from({ length: 14 }, (_, i) => '- [ ] 本周任务 ' + i).join('\n'));
      await renderTest('dashboard');
    });
    assert.equal(await page.locator('.tcc-focus-grid').first().locator('.tcc-task-card').count(), 0, 'today-section todos must not enter Focus Queue');
    await page.locator('[data-filter=week]').first().click();
    assert.equal(await page.locator('[data-filter-grid] .tcc-task-card').count(), 14);
    await page.evaluate(async () => {
      testState.memory.set('task_outline/工作任务.md', '## 今日任务\n' + Array.from({ length: 14 }, (_, i) => '- [/] 进行任务 ' + i).join('\n') + '\n- [ ] 待办不要混入关注筛选\n');
      await renderTest('dashboard');
    });
    assert.equal(await page.locator('.tcc-focus-grid').first().locator('.tcc-task-card').count(), 12);
    await page.getByRole('button', { name: '查看全部 14 项', exact: true }).click();
    assert.equal(await page.locator('[data-filter-grid] .tcc-task-card').count(), 14);
    assert.equal(await page.locator('[data-filter-grid] .tcc-task-card').filter({ hasText: '待办不要混入关注筛选' }).count(), 0);
    await page.getByRole('button', { name: '新增任务', exact: true }).click();
    assert.equal(await page.locator('dialog select[name=section]').inputValue(), '今日任务');
    assert.equal(await page.locator('dialog select[name=priority] option').count(), 6);
    await page.locator('dialog input[name=title]').fill('中心直接新增的任务');
    await page.locator('dialog select[name=priority]').selectOption('highest');
    await page.locator('dialog select[name=status]').selectOption('/');
    await page.locator('dialog input[name=start]').fill('2026-10-12');
    await page.locator('dialog input[name=due]').fill('2026-10-17');
    await page.locator('dialog input[name=next]').fill('确认验收标准');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('dialog').screenshot({ path: path.join(output, 'create-root-task-mobile.png') });
    assert(await page.locator('dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    await saveDialog();
    const newCard = page.locator('.tcc-focus-grid').first().locator('.tcc-task-card').filter({ has: page.locator('h3', { hasText: '中心直接新增的任务' }) });
    assert.equal(await newCard.count(), 1);
    assert.match(await newCard.innerText(), /最高/);
    await newCard.locator('h3').click();
    await page.evaluate(() => renderTest('detail'));
    assert.equal(await page.locator('[data-task-priority]').inputValue(), 'highest');
    for (const value of ['high', 'medium', 'normal', 'low', 'lowest']) {
      const beforePriority = await revision();
      await page.locator('[data-task-priority]').selectOption(value);
      await page.waitForFunction(n => testState.renders > n, beforePriority);
      assert.equal(await page.locator('[data-task-priority]').inputValue(), value);
      assert.match(await page.locator('.tcc-detail-hero h2').innerText(), /中心直接新增的任务/);
    }
    await page.getByRole('button', { name: '编辑任务', exact: true }).click();
    assert.equal(await page.locator('dialog select[name=priority]').inputValue(), 'lowest');
    await page.locator('dialog select[name=priority]').selectOption('high');
    await saveDialog();
    assert.equal(await page.locator('[data-task-priority]').inputValue(), 'high');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('.tcc-detail-grid').screenshot({ path: path.join(output, 'editable-priority-desktop.png') });
    await page.evaluate(async () => {
      testState.memory.set('task_outline/工作任务.md', [
        '## 今日任务',
        '- [ ] 今日高优先级 ⏫ ⏳ 2026-10-12',
        '- [ ] 今日最高优先级 🔺 📅 2026-10-12',
        '- [/] 无日期进行中',
        '- [ ] 今日分区中的未来任务 📅 2026-12-31',
        '- [ ] 逾期待安排 📅 2026-10-01',
        '- [>] 延期不入今日 ⏳ 2026-10-12',
        '## 长期任务',
        '- [ ] 长期父任务',
        '  - [ ] 今日子任务 🔼 ⏳ 2026-10-12',
        '  - [ ] 未来子任务 📅 2026-12-31'
      ].join('\n'));
      await renderTest('dashboard');
    });
    await page.locator('[data-filter=today]').first().click();
    assert.equal(await page.evaluate(() => testState.opened.at(-1)), 'task_outline/今日任务.md');
    await page.evaluate(() => renderTest('today'));
    const plannedRows = page.locator('[data-today-list] > .tcc-today-row');
    assert.deepEqual(await plannedRows.locator(':scope > .tcc-today-main > .tcc-today-title').allTextContents(), ['今日最高优先级', '今日高优先级', '长期父任务', '无日期进行中']);
    assert.equal(await page.locator('.tcc-today-secondary[open]').count(), 0);
    await page.locator('.tcc-today-shell').screenshot({ path: path.join(output, 'today-tasks-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.tcc-today-shell').screenshot({ path: path.join(output, 'today-tasks-mobile.png') });
    assert(await page.locator('.tcc-today-shell').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    const dailyParent = () => plannedRows.filter({ has: page.locator('.tcc-today-title', { hasText: '长期父任务' }) });
    await dailyParent().locator('summary').click();
    const beforeChild = await revision();
    await dailyParent().getByRole('checkbox', { name: '完成子任务：今日子任务', exact: true }).check();
    await page.waitForFunction(n => testState.renders > n, beforeChild);
    assert.equal(await dailyParent().count(), 0, 'completed child alone must not keep its parent in today');
    await page.locator('.tcc-today-secondary').first().locator('summary').click();
    const beforePlan = await revision();
    await page.getByRole('button', { name: '安排今天', exact: true }).click();
    await page.waitForFunction(n => testState.renders > n, beforePlan);
    assert.equal(await plannedRows.filter({ hasText: '逾期待安排' }).count(), 1);
    await page.getByRole('button', { name: '新增今日任务', exact: true }).click();
    assert.equal(await page.locator('dialog input[name=scheduled]').inputValue(), '2026-10-12');
    await page.locator('dialog input[name=title]').fill('从今日页新建');
    await page.locator('dialog select[name=priority]').selectOption('high');
    await saveDialog();
    assert.equal(await plannedRows.filter({ hasText: '从今日页新建' }).count(), 1);
    const beforeComplete = await revision();
    await plannedRows.filter({ hasText: '从今日页新建' }).getByRole('checkbox').check();
    await page.waitForFunction(n => testState.renders > n, beforeComplete);
    assert.equal(await plannedRows.filter({ hasText: '从今日页新建' }).count(), 0);
    await page.locator('.tcc-today-secondary').last().locator('summary').click();
    assert.equal(await page.locator('.tcc-today-secondary').last().locator('.tcc-today-row').filter({ hasText: '从今日页新建' }).count(), 1);
    await page.evaluate(async () => {
      luxon.Settings.now = () => new Date('2026-10-14T12:00:00+08:00').getTime();
      testState.memory.set('task_outline/工作任务.md', '## 长期任务\n- [/] 英语学习\n  - [ ] 语法复习\n');
      await renderTest('today');
    });
    await page.locator('[data-today-list]').getByRole('button', { name: '编辑任务', exact: true }).click();
    await page.getByRole('checkbox', { name: '开启每日打卡', exact: true }).check();
    assert.equal(await page.locator('dialog input[name=weeklyGoal]').inputValue(), '5');
    await saveDialog();
    assert.equal(await page.locator('.tcc-habit-row').count(), 1);
    assert.equal(await plannedRows.count(), 0, 'habit tasks have their own area');
    const unchangedTaskSource = await page.evaluate(() => testState.memory.get('task_outline/工作任务.md'));
    await page.getByRole('button', { name: '今日打卡', exact: true }).click();
    assert.equal(await page.getByRole('checkbox', { name: '创建或打开文本记录（可选）', exact: true }).isChecked(), false);
    await page.locator('dialog input[name=minutes]').fill('25');
    await page.locator('dialog textarea[name=content]').fill('跟读一段技术视频\n复习15个单词');
    await page.locator('dialog textarea[name=reflection]').fill('能够复述主要内容，连读需要练习');
    await page.locator('dialog textarea[name=next]').fill('录音对比');
    await page.locator('dialog').screenshot({ path: path.join(output, 'checkin-editor-mobile.png') });
    assert(await page.locator('dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    await saveDialog();
    assert.match(await page.locator('.tcc-habit-row').innerText(), /本周 1\/5 天 · 25 分钟/);
    assert.match(await page.locator('.tcc-reward-feedback').innerText(), /\+10 成长值/);
    assert.match(await page.locator('.tcc-reward-feedback').innerText(), /迈出第一步/);
    assert.match(await page.locator('.tcc-habit-completed summary').innerText(), /今日已完成 1/);
    await page.locator('.tcc-reward-feedback').screenshot({ path: path.join(output, 'checkin-success-feedback.png') });
    await page.getByRole('button', { name: '关闭反馈', exact: true }).click();
    assert.equal(await page.evaluate(() => [...testState.memory.keys()].filter(p => p.startsWith('任务清单/')).length), 0, 'text records must be opt-in');
    await page.getByRole('button', { name: '修改记录', exact: true }).click();
    assert.equal(await page.locator('dialog input[name=minutes]').inputValue(), '25');
    await page.locator('dialog input[name=minutes]').fill('30');
    await saveDialog();
    assert.match(await page.locator('.tcc-habit-row').innerText(), /本周 1\/5 天 · 30 分钟/);
    assert.match(await page.locator('.tcc-reward-feedback').innerText(), /记录已更新/);
    assert(!/\+10/.test(await page.locator('.tcc-reward-feedback').innerText()), 'editing must not announce another XP award');
    await page.getByRole('button', { name: '修改记录', exact: true }).click();
    await page.locator('dialog input[name=day]').fill('2026-10-12');
    await page.locator('dialog input[name=minutes]').fill('20');
    await page.locator('dialog textarea[name=content]').fill('复习时态');
    await saveDialog();
    await page.getByRole('button', { name: '修改记录', exact: true }).click();
    await page.locator('dialog input[name=day]').fill('2026-10-13');
    await page.locator('dialog select[name=kind]').selectOption('rest');
    assert(await page.locator('dialog input[name=minutes]').isDisabled());
    await saveDialog();
    assert.match(await page.locator('.tcc-habit-row').innerText(), /本周 2\/5 天 · 50 分钟/);
    assert.equal(await page.evaluate(() => testState.memory.get('task_outline/工作任务.md')), unchangedTaskSource);
    assert.equal(await page.evaluate(() => [...testState.memory.keys()].filter(p => p.startsWith('daliy record/打卡记录/') && p.endsWith('.md')).length), 1);
    await page.evaluate(() => {
      testState.memory.set('任务清单', '');
      testState.memory.set('任务清单/英语学习', '');
      testState.memory.set('任务清单/英语学习/英语计划.md', '# User plan');
    });
    await page.getByRole('button', { name: '修改记录', exact: true }).click();
    assert.equal(await page.getByRole('checkbox', { name: '创建或打开文本记录（可选）', exact: true }).isChecked(), false);
    await page.getByRole('checkbox', { name: '创建或打开文本记录（可选）', exact: true }).check();
    await page.locator('dialog input[name=noteTitle]').fill('跟读练习正文');
    assert.match(await page.locator('dialog [data-note-options]').innerText(), /任务清单\/英语学习/);
    await page.locator('dialog').screenshot({ path: path.join(output, 'checkin-optional-text-mobile.png') });
    assert(await page.locator('dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    await saveDialog();
    const textPath = await page.evaluate(() => testState.opened.at(-1));
    assert.equal(textPath, '任务清单/英语学习/2026.10.14 跟读练习正文.md');
    assert.equal(await page.evaluate(() => testState.memory.get('任务清单/英语学习/英语计划.md')), '# User plan');
    const textBefore = await page.evaluate(p => {
      const content = testState.memory.get(p) + '\n用户自行写入正文与图片 ![[record.png]]\n';
      testState.memory.set(p, content);
      return content;
    }, textPath);
    await page.getByRole('button', { name: '修改记录', exact: true }).click();
    assert.equal(await page.getByRole('checkbox', { name: '创建或打开文本记录（可选）', exact: true }).isChecked(), false);
    await page.locator('dialog textarea[name=content]').fill('');
    await page.locator('dialog textarea[name=reflection]').fill('这里仅记录新心得');
    await saveDialog();
    assert.equal(await page.evaluate(p => testState.memory.get(p), textPath), textBefore);
    await page.getByRole('button', { name: '打开文本记录', exact: true }).click();
    assert.equal(await page.evaluate(() => testState.opened.at(-1)), textPath);
    await page.getByRole('button', { name: '修改记录', exact: true }).click();
    await page.getByRole('checkbox', { name: '创建或打开文本记录（可选）', exact: true }).check();
    await saveDialog();
    assert.equal(await page.evaluate(p => testState.memory.get(p), textPath), textBefore);
    assert.equal(await page.evaluate(() => [...testState.memory.keys()].filter(p => p.startsWith('任务清单/英语学习/') && p.endsWith('.md')).length), 2);
    await page.getByRole('button', { name: '修改记录', exact: true }).click();
    await page.getByRole('checkbox', { name: '创建或打开文本记录（可选）', exact: true }).check();
    await page.locator('dialog select[name=noteAction]').selectOption('create');
    await page.locator('dialog input[name=noteTitle]').fill('另一篇学习正文');
    await page.locator('dialog input[name=noteSubfolder]').fill('NeedCar-Archive/articles');
    await saveDialog();
    const secondText = await page.evaluate(() => testState.opened.at(-1));
    assert.equal(secondText, '任务清单/英语学习/NeedCar-Archive/articles/2026.10.14 另一篇学习正文.md');
    await page.getByRole('button', { name: '修改记录', exact: true }).click();
    await page.getByRole('checkbox', { name: '创建或打开文本记录（可选）', exact: true }).check();
    await page.locator('dialog select[name=noteAction]').selectOption('attach');
    await page.locator('dialog input[name=existingNote]').fill('任务清单/英语学习/英语计划.md');
    await saveDialog();
    assert.equal(await page.locator('.tcc-habit-row [data-habit-note-path]').count(), 3);
    await page.evaluate(path => {
      const journalPath = [...testState.memory.keys()].find(p => p.startsWith('daliy record/打卡记录/') && p.endsWith('.md'));
      testState.memory.set(journalPath, testState.memory.get(journalPath).replace('[[' + path + ']]', '[[../../' + path.replace(/\.md$/, '') + '|学习正文]]'));
    }, textPath);
    await page.evaluate(() => renderTest('today'));
    await page.getByRole('button', { name: '修改记录', exact: true }).click();
    assert.match(await page.locator('dialog [data-linked-note]').innerText(), /3 篇/);
    await page.getByRole('checkbox', { name: '创建或打开文本记录（可选）', exact: true }).check();
    assert.equal(await page.locator('dialog select[name=linkedNote] option').count(), 3);
    await page.locator('dialog select[name=linkedNote]').selectOption(secondText);
    await page.locator('dialog').screenshot({ path: path.join(output, 'multiple-checkin-text-mobile.png') });
    await saveDialog();
    assert.equal(await page.evaluate(() => testState.opened.at(-1)), secondText);
    assert.equal(await page.evaluate(p => testState.memory.get(p), textPath), textBefore);
    assert.equal(await page.evaluate(() => testState.memory.get('任务清单/英语学习/英语计划.md')), '# User plan');
    assert.match(await page.locator('.tcc-habit-row').innerText(), /本周 2\/5 天 · 50 分钟/);
    await page.locator('.tcc-today-shell').screenshot({ path: path.join(output, 'habit-today-mobile.png') });
    await page.locator('.tcc-habit-row .tcc-today-title').click();
    await page.evaluate(() => renderTest('detail'));
    assert.equal(await page.locator('.tcc-habit-history article').count(), 3);
    assert.match(await page.locator('.tcc-habit-stats').innerText(), /累计 2 天/);
    await page.locator('.tcc-habit-archives button').click();
    assert((await page.evaluate(() => testState.opened.at(-1))).startsWith('daliy record/打卡记录/2026-10'));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('.tcc-habit-detail').screenshot({ path: path.join(output, 'habit-history-desktop.png') });
    await page.getByRole('button', { name: '编辑任务', exact: true }).click();
    await page.getByRole('checkbox', { name: '开启每日打卡', exact: true }).uncheck();
    await saveDialog();
    assert.equal(await page.locator('.tcc-habit-history article').count(), 3, 'disabling habit mode preserves history');
    await page.getByRole('button', { name: '全部习惯的完成记录', exact: true }).click();
    assert.equal(await page.evaluate(() => testState.opened.at(-1)), 'task_outline/打卡成就.md');
    await page.evaluate(() => renderTest('achievements'));
    assert.match(await page.locator('.tcc-growth-level').innerText(), /20 成长值/);
    assert.equal(await page.locator('.tcc-achievement-entry').count(), 2);
    assert.equal(await page.locator('.tcc-growth-days button').count(), 28);
    await page.locator('[data-history-rest]').check();
    assert.equal(await page.locator('.tcc-achievement-entry').count(), 3);
    await page.locator('[data-reward-day="2026-10-13"]').click();
    assert.equal(await page.locator('.tcc-achievement-entry').count(), 1);
    assert.match(await page.locator('.tcc-achievement-entry').innerText(), /休息日/);
    await page.getByRole('button', { name: '重置筛选', exact: true }).click();
    assert.equal(await page.locator('.tcc-achievement-entry').count(), 2);
    if (await page.getByRole('button', { name: '关闭反馈', exact: true }).count()) await page.getByRole('button', { name: '关闭反馈', exact: true }).click();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('.tcc-achievement-shell').screenshot({ path: path.join(output, 'habit-achievements-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.tcc-achievement-shell').screenshot({ path: path.join(output, 'habit-achievements-mobile.png') });
    assert(await page.locator('.tcc-achievement-shell').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    assert.deepEqual(errors, []);
    console.log('PASS: three views, quick edit, child creation, note logging, completion, acceptance, maintenance filter, blocking/restart and mobile editor.');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
