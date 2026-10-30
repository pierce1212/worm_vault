const fs = require('node:fs');
const file = 'E:/github/worm_vault/task_outline/task-records.js';
const source = fs.readFileSync(file, 'utf8');
const old = source.split('\n').find(line => line.includes('dialog.innerHTML ='));
const next = old.replace('value="${esc(titleOf(task.text))}"', 'value="${esc(defaultName)}"');
if (old === next) throw Error('Title input anchor missing');
console.log('*** Begin Patch\n*** Update File: ' + file + '\n@@\n-' + old + '\n+' + next + '\n*** End Patch');
