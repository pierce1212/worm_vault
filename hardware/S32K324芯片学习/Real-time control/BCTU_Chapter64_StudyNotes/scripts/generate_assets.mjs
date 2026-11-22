import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const assetDir = path.join(root, 'assets');
const sharpPath = 'E:/github/.codex_tools/siul2_notes/node_modules/sharp/lib/index.js';
const { default: sharp } = await import(`file:///${sharpPath.replaceAll('\\', '/')}`);

const colors = {
  ink: '#1f2933',
  muted: '#52616b',
  faint: '#edf2f7',
  panel: '#ffffff',
  line: '#9fb3c8',
  blue: '#2563eb',
  teal: '#0891b2',
  green: '#16a34a',
  amber: '#d97706',
  red: '#dc2626',
  violet: '#7c3aed',
  bg: '#f7fafc',
};

await fs.mkdir(assetDir, { recursive: true });

function esc(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function wrap(text, max = 18) {
  const raw = String(text).replaceAll('\\n', '\n');
  if (raw.includes('\n')) {
    return raw.split('\n').flatMap((line) => wrap(line, max));
  }
  const parts = raw.split(/(\s+|\/|_|-)/).filter(Boolean);
  const lines = [];
  let line = '';
  const splitToken = (token) => {
    if (token.length <= max) return [token];
    const chunks = [];
    for (let i = 0; i < token.length; i += max) {
      chunks.push(token.slice(i, i + max));
    }
    return chunks;
  };
  for (const p of parts) {
    const clean = p.trim();
    if (!clean) continue;
    if (clean.length > max) {
      if (line.trim()) {
        lines.push(line.trim());
        line = '';
      }
      lines.push(...splitToken(clean));
      continue;
    }
    const candidate = line ? `${line}${p}` : clean;
    if (candidate.length > max && line) {
      lines.push(line.trim());
      line = clean;
    } else {
      line = candidate;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

function textBlock(text, x, y, opts = {}) {
  const {
    size = 20,
    fill = colors.ink,
    weight = 500,
    width = 22,
    anchor = 'start',
    lineHeight = Math.round(size * 1.25),
    family = 'Arial, Microsoft YaHei, sans-serif',
  } = opts;
  const lines = Array.isArray(text) ? text : wrap(text, width);
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${lines.map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${esc(line)}</tspan>`).join('')}</text>`;
}

function box(x, y, w, h, label, opts = {}) {
  const {
    fill = colors.panel,
    stroke = colors.line,
    radius = 8,
    titleFill = colors.ink,
    titleSize = 20,
    subtitle,
    subtitleFill = colors.muted,
    accent,
    width = Math.max(12, Math.floor(w / 18)),
  } = opts;
  const stripe = accent ? `<rect x="${x}" y="${y}" width="7" height="${h}" rx="${radius}" fill="${accent}"/>` : '';
  const titleY = subtitle ? y + h / 2 - 8 : y + h / 2 + titleSize / 3;
  const subtitleSvg = subtitle ? textBlock(subtitle, x + w / 2, y + h / 2 + 24, {
    size: 15,
    fill: subtitleFill,
    weight: 400,
    width: Math.floor(w / 13),
    anchor: 'middle',
    lineHeight: 18,
  }) : '';
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>
    ${stripe}
    ${textBlock(label, x + w / 2, titleY, { size: titleSize, fill: titleFill, weight: 700, width, anchor: 'middle' })}
    ${subtitleSvg}
  </g>`;
}

function arrow(x1, y1, x2, y2, opts = {}) {
  const { stroke = colors.blue, width = 2.5, dashed = false, label, labelFill = colors.muted } = opts;
  const midx = (x1 + x2) / 2;
  const midy = (y1 + y2) / 2;
  return `<g>
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" ${dashed ? 'stroke-dasharray="7 7"' : ''} marker-end="url(#arrow)"/>
    ${label ? textBlock(label, midx, midy - 8, { size: 14, fill: labelFill, anchor: 'middle', width: 18 }) : ''}
  </g>`;
}

async function writeSvgPng(name, width, height, body, title) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="strokeWidth">
      <path d="M2,2 L10,6 L2,10 Z" fill="${colors.blue}"/>
    </marker>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#0f172a" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="${colors.bg}"/>
  ${title ? textBlock(title, 40, 46, { size: 28, weight: 800, width: 70 }) : ''}
  ${body}
</svg>`;
  await fs.writeFile(path.join(assetDir, `${name}.svg`), svg, 'utf8');
  await sharp(Buffer.from(svg)).png().toFile(path.join(assetDir, `${name}.png`));
}

function chip(x, y, text, fill = '#e0f2fe', stroke = '#38bdf8') {
  const w = Math.max(70, text.length * 9 + 24);
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="32" rx="16" fill="${fill}" stroke="${stroke}"/>
    ${textBlock(text, x + w / 2, y + 21, { size: 14, weight: 700, anchor: 'middle', width: 20 })}
  </g>`;
}

await writeSvgPng('01_bctu_overview', 1500, 880, `
  <g filter="url(#shadow)">
    ${box(60, 125, 220, 100, 'eMIOS0/1/2', { subtitle: '定时器通道输出\\n触发源 0..22 / 24..46 / 48..70', accent: colors.teal })}
    ${box(60, 280, 220, 100, 'TRGMUX', { subtitle: '任意输入可路由到\\nBCTU_TRG23/47/71', accent: colors.violet })}
    ${box(60, 435, 220, 100, 'CPU 软件触发', { subtitle: 'SFTRGR1/2/3\\n写 1 发起一次请求', accent: colors.amber })}
    ${box(360, 120, 380, 420, 'BCTU', { subtitle: '72 路触发锁存 + TRGCFG\\n每个 ADC 一套优先级选择\\n可发单次转换或 CL 转换列表\\n结果写 ADCDR 或 FIFO', accent: colors.blue, titleSize: 30 })}
    ${box(850, 110, 180, 90, 'ADC0', { subtitle: 'bctu_trigger\\nchannel + push', accent: colors.green })}
    ${box(850, 255, 180, 90, 'ADC1', { subtitle: 'bctu_trigger\\nchannel + push', accent: colors.green })}
    ${box(850, 400, 180, 90, 'ADC2', { subtitle: 'bctu_trigger\\nchannel + push', accent: colors.green })}
    ${box(1130, 120, 240, 100, 'ADCDR0..2', { subtitle: 'CPU 读结果\\nTRG_SRC/CH/LIST/LAST/DATA', accent: colors.blue })}
    ${box(1130, 310, 250, 115, 'FIFO1 / FIFO2', { subtitle: 'FIFO1: 16 words\\nFIFO2: 8 words\\n可 IRQ/DMA', accent: colors.red })}
    ${box(1130, 505, 250, 110, 'DMA / IRQ', { subtitle: 'NDATA / DATAOVR\\nLIST_LAST / WM\\nOVR / UNDR', accent: colors.amber })}
  </g>
  ${arrow(280, 175, 360, 205, { label: '硬触发' })}
  ${arrow(280, 330, 360, 330, { label: '复用触发' })}
  ${arrow(280, 485, 360, 455, { label: '软触发' })}
  ${arrow(740, 205, 850, 155, { label: 'ADC_SEL0' })}
  ${arrow(740, 330, 850, 300, { label: 'ADC_SEL1' })}
  ${arrow(740, 455, 850, 445, { label: 'ADC_SEL2' })}
  ${arrow(1030, 155, 1130, 170, { label: '结果直达' })}
  ${arrow(1030, 310, 1130, 365)}
  ${arrow(1255, 425, 1255, 505)}
  ${arrow(1255, 220, 1255, 505, { dashed: true })}
  ${chip(370, 590, 'TRGCFG_0..71')}
  ${chip(530, 590, 'LISTCHR_0..15', '#fef3c7', '#f59e0b')}
  ${chip(690, 590, 'MCR/MSR', '#dcfce7', '#22c55e')}
  ${chip(830, 590, 'WRPROT + SFTRGR', '#f3e8ff', '#a855f7')}
  ${textBlock('一句话：BCTU 是“定时器/软件事件 -> 指定 ADC 通道 -> 结果/中断/DMA”的硬件调度器。', 90, 740, { size: 24, weight: 700, width: 90 })}
`, 'BCTU 模块全景');

await writeSvgPng('02_trigger_lifecycle', 1500, 760, `
  <g filter="url(#shadow)">
    ${box(60, 130, 180, 90, '1. 触发为 1', { subtitle: 'eMIOS/TRGMUX\\n或 SFTRGR 写 1', accent: colors.teal })}
    ${box(300, 130, 190, 90, '2. 锁存', { subtitle: 'TRG_FLAG=1\\n触发保持 pending', accent: colors.blue })}
    ${box(550, 130, 230, 90, '3. 优先级仲裁', { subtitle: '同一 ADC：编号越小\\n优先级越高', accent: colors.violet })}
    ${box(845, 130, 210, 90, '4. 发 ADC 命令', { subtitle: '约 4 个 BCTU clock\\nADC busy 后续约 3 个', accent: colors.green })}
    ${box(1120, 130, 230, 90, '5. 清触发', { subtitle: '单次转换开始即清\\nCL 到最后一次开始清', accent: colors.amber })}
    ${box(1120, 340, 230, 90, '6. 结果返回', { subtitle: 'ADC push + data\\n写 ADCDR 或 FIFO', accent: colors.red })}
    ${box(845, 340, 210, 90, '7. 软件处理', { subtitle: 'CPU 读结果\\n或 DMA/IRQ 通知', accent: colors.blue })}
  </g>
  ${arrow(240, 175, 300, 175)}
  ${arrow(490, 175, 550, 175)}
  ${arrow(780, 175, 845, 175)}
  ${arrow(1055, 175, 1120, 175)}
  ${arrow(1235, 220, 1235, 340)}
  ${arrow(1120, 385, 1055, 385)}
  <path d="M 655 235 C 655 315 1045 315 1045 385" fill="none" stroke="${colors.line}" stroke-width="2" stroke-dasharray="8 8"/>
  ${textBlock('关键边界条件', 70, 555, { size: 24, weight: 800 })}
  ${chip(70, 590, '触发输入是 level-sensitive', '#e0f2fe', '#0891b2')}
  ${chip(345, 590, '重复置位会被忽略', '#fee2e2', '#ef4444')}
  ${chip(570, 590, '清除同时置位：置位优先', '#fef3c7', '#f59e0b')}
  ${chip(845, 590, 'TRG_FLAG=1 时不要改 TRGCFG', '#f3e8ff', '#a855f7')}
  ${chip(1190, 590, 'TRGMUX 改完后清 TRG_FLAG', '#dcfce7', '#22c55e')}
`, '一次 BCTU 触发的生命周期');

await writeSvgPng('03_priority_timing', 1500, 760, `
  ${textBlock('同一 ADC 的竞争：编号越小越先服务', 70, 105, { size: 24, weight: 800 })}
  <g filter="url(#shadow)">
    ${box(80, 170, 230, 90, 'Trigger 0', { subtitle: '高优先级\\n先进入 ADC', accent: colors.blue })}
    ${box(80, 315, 230, 90, 'Trigger 1', { subtitle: '低优先级\\n保持 pending', accent: colors.amber })}
    ${box(455, 205, 250, 155, 'ADC0 busy', { subtitle: '正在执行 Trigger 0\\n期间 Trigger 1 不丢失\\n等待下一次选择', accent: colors.green })}
    ${box(850, 170, 250, 90, 'Trigger 0 再次置位', { subtitle: '如果转换结束前再次有效\\n可能再次抢占', accent: colors.red })}
    ${box(850, 315, 250, 90, 'Trigger 1 继续等待', { subtitle: '只有高优先级不再抢占\\n才轮到它', accent: colors.amber })}
    ${box(1190, 250, 220, 110, '不同 ADC', { subtitle: '如果目标 ADC 不同\\n可以并行处理', accent: colors.violet })}
  </g>
  ${arrow(310, 215, 455, 250, { label: '胜出' })}
  ${arrow(310, 360, 455, 330, { label: 'pending' })}
  ${arrow(705, 250, 850, 215, { label: '结束时重新仲裁' })}
  ${arrow(705, 330, 850, 360, { label: '仍等待' })}
  ${arrow(1100, 315, 1190, 305, { dashed: true, label: '目标不同不冲突' })}
  <line x1="90" y1="560" x2="1370" y2="560" stroke="${colors.line}" stroke-width="3"/>
  <g>
    <circle cx="160" cy="560" r="9" fill="${colors.blue}"/>
    <circle cx="420" cy="560" r="9" fill="${colors.amber}"/>
    <circle cx="720" cy="560" r="9" fill="${colors.green}"/>
    <circle cx="1030" cy="560" r="9" fill="${colors.red}"/>
    ${textBlock('同一周期 T0/T1 置位', 160, 600, { size: 16, anchor: 'middle', width: 16 })}
    ${textBlock('T0 发给 ADC', 420, 600, { size: 16, anchor: 'middle', width: 16 })}
    ${textBlock('ADC 忙，T1 pending', 720, 600, { size: 16, anchor: 'middle', width: 18 })}
    ${textBlock('结束后重新选', 1030, 600, { size: 16, anchor: 'middle', width: 16 })}
  </g>
`, '优先级与 ADC busy 行为');

await writeSvgPng('04_conversion_modes', 1500, 820, `
  <g filter="url(#shadow)">
    ${box(70, 130, 380, 185, 'Single conversion', { subtitle: 'TRS=0\\nCHANNEL_VALUE_OR_LADDR = ADC channel\\n只能选择一个 ADC_SELx\\n多 ADC mask 会被硬件忽略', accent: colors.blue })}
    ${box(560, 130, 380, 185, 'Conversion List (CL)', { subtitle: 'TRS=1\\nCHANNEL_VALUE_OR_LADDR = LIST 起点\\nLISTCHR 每个寄存器放 2 个元素\\n遇到 LAST 停止', accent: colors.green })}
    ${box(1050, 130, 380, 185, 'Multi ADC CL', { subtitle: '只对 LIST 有意义\\n一个触发可选择多个 ADC_SELx\\nBCTU 等待目标 ADC 可用', accent: colors.violet })}
    ${box(70, 450, 290, 110, 'LISTCHR 元素', { subtitle: 'ADC_CH\\nNEXT_CH_WAIT_ON_TRIG\\nLAST', accent: colors.amber })}
    ${box(455, 430, 250, 150, '暂停点', { subtitle: 'NEXT_CH_WAIT_ON_TRIG=1\\n当前转换完成后暂停\\n同一 trigger 再次有效后继续', accent: colors.red })}
    ${box(800, 430, 290, 150, '结果标记', { subtitle: 'ADCDR: LIST/LAST 位\\nFIFO: TRG_SRC/CH/ADC_NUM/DATA\\n用于追溯来源', accent: colors.blue })}
    ${box(1180, 450, 230, 110, '项目现状', { subtitle: 'NumListItems=0\\n全部 BCTU_IP_TRIG_TYPE_SINGLE', accent: colors.teal })}
  </g>
  ${arrow(450, 220, 560, 220)}
  ${arrow(940, 220, 1050, 220)}
  ${arrow(360, 505, 455, 505)}
  ${arrow(705, 505, 800, 505)}
  ${arrow(1090, 505, 1180, 505)}
`, '单次转换、CL 与多 ADC CL');

await writeSvgPng('05_register_map', 1500, 900, `
  ${textBlock('BCTU base address: 0x4008_4000，所有寄存器 32 bit；8 bit 写允许，但软件要自己保证一致性。', 70, 100, { size: 20, weight: 600, width: 110 })}
  <g filter="url(#shadow)">
    ${box(80, 145, 300, 85, 'MCR @0x000', { subtitle: 'MDIS/FRZ/GTRGEN\\nDMA/IRQ enable', accent: colors.blue })}
    ${box(430, 145, 300, 85, 'MSR @0x008', { subtitle: 'NDATA/DATAOVR/LIST_LAST/TRGF\\nW1C 清状态', accent: colors.green })}
    ${box(780, 145, 340, 85, 'TRGCFG0..71 @0x018', { subtitle: 'LOOP/DATA_DEST/TRIGEN/TRG_FLAG\\nTRS/ADC_SEL/CHANNEL_OR_LADDR', accent: colors.violet })}
    ${box(1170, 145, 260, 85, 'WRPROT @0x228', { subtitle: '保护 SFTRGR\\n0x9 一次写 / 0xA 永久开', accent: colors.amber })}
    ${box(80, 305, 300, 85, 'SFTRGR1..3', { subtitle: '软件触发 0..71\\n建议关闭对应硬触发', accent: colors.red })}
    ${box(430, 305, 300, 85, 'ADCDR0..2', { subtitle: 'TRG_SRC/CH/LIST/LAST/ADC_DATA\\n直达结果寄存器', accent: colors.blue })}
    ${box(780, 305, 340, 85, 'LISTSTAR + LISTCHR0..15', { subtitle: 'CL size=32 elements\\n每个 LISTCHR 两个 CL 元素', accent: colors.green })}
    ${box(1170, 305, 260, 85, 'FIFO1DR/FIFO2DR', { subtitle: 'TRG_SRC/CH/ADC_NUM/ADC_DATA\\nFIFO1=16, FIFO2=8', accent: colors.red })}
    ${box(80, 465, 300, 85, 'FIFOCR', { subtitle: 'IEN_FIFOx / DMA_EN_FIFOx', accent: colors.amber })}
    ${box(430, 465, 300, 85, 'FIFOWM', { subtitle: 'WM_FIFO1/WM_FIFO2\\n超过水位触发 IRQ/DMA', accent: colors.teal })}
    ${box(780, 465, 340, 85, 'FIFOERR', { subtitle: 'WM_INT/OVR_ERR/UNDR_ERR\\nW1C 清除', accent: colors.red })}
    ${box(1170, 465, 260, 85, 'FIFOSR/FIFOCNTR', { subtitle: 'FULL flag\\n当前有效 entry 数', accent: colors.blue })}
  </g>
  ${textBlock('TRGCFG_a 位段速记', 90, 650, { size: 24, weight: 800 })}
  <g>
    <rect x="90" y="680" width="1240" height="56" rx="8" fill="#ffffff" stroke="${colors.line}"/>
    <rect x="90" y="680" width="170" height="56" fill="#dbeafe"/><text x="175" y="715" font-size="16" font-family="Arial" text-anchor="middle" font-weight="700">31 LOOP</text>
    <rect x="260" y="680" width="200" height="56" fill="#fef3c7"/><text x="360" y="715" font-size="16" font-family="Arial" text-anchor="middle" font-weight="700">30..28 DATA_DEST</text>
    <rect x="460" y="680" width="160" height="56" fill="#dcfce7"/><text x="540" y="715" font-size="16" font-family="Arial" text-anchor="middle" font-weight="700">15 TRIGEN</text>
    <rect x="620" y="680" width="170" height="56" fill="#fee2e2"/><text x="705" y="715" font-size="16" font-family="Arial" text-anchor="middle" font-weight="700">14 TRG_FLAG</text>
    <rect x="790" y="680" width="130" height="56" fill="#f3e8ff"/><text x="855" y="715" font-size="16" font-family="Arial" text-anchor="middle" font-weight="700">13 TRS</text>
    <rect x="920" y="680" width="170" height="56" fill="#e0f2fe"/><text x="1005" y="715" font-size="16" font-family="Arial" text-anchor="middle" font-weight="700">10..8 ADC_SEL</text>
    <rect x="1090" y="680" width="240" height="56" fill="#f8fafc"/><text x="1210" y="715" font-size="16" font-family="Arial" text-anchor="middle" font-weight="700">6..0 CH or LADDR</text>
  </g>
`, '寄存器速查图');

await writeSvgPng('06_eb_configuration_flow', 1500, 920, `
  <g filter="url(#shadow)">
    ${box(70, 130, 260, 120, 'EB Tresos / RTD', { subtitle: 'Adc.xdm\\nMcl.xdm\\nMcu/Rm/Platform', accent: colors.blue })}
    ${box(430, 95, 330, 105, 'AdcConfigSet / BctuHwUnit', { subtitle: 'BctuGlobalHwTriggers\\nBctuInternalTrigger\\nBctuResultFifos', accent: colors.green })}
    ${box(430, 235, 330, 100, 'AdcHwTrigger', { subtitle: 'BCTU_EMIOS_0_x\\nEXT_TRIG\\nBCTU_TRG23/47/71', accent: colors.teal })}
    ${box(430, 375, 330, 110, 'Mcl / TRGMUX', { subtitle: '普通 ADC 外触发\\n或 BCTU_TRG23/47/71\\n本项目 PIT0_CH1 -> ADC12x', accent: colors.violet })}
    ${box(850, 130, 300, 120, '生成代码', { subtitle: 'Bctu_Ip_PBcfg.c\\nAdc_Ipw_PBcfg.c\\nAdc_CfgDefines.h', accent: colors.amber })}
    ${box(850, 330, 300, 120, '运行时 API', { subtitle: 'Adc_EnableCtuControlMode\\nAdc_CtuEnableHwTrigger\\nAdc_CtuStartConversion\\nAdc_CtuReadConvResult', accent: colors.red })}
    ${box(1220, 225, 220, 120, '业务层', { subtitle: 'Cdd_Adc.c\\nBctuTriggerNotification\\nAdcCfgAndUse 初始化', accent: colors.blue })}
    ${box(70, 590, 300, 120, '本项目配置摘要', { subtitle: '15 个 BCTU internal triggers\\nTrigger 1..10,13,15..18', accent: colors.green })}
    ${box(450, 590, 300, 140, '触发/结果模式', { subtitle: 'eMIOS0 硬触发\\nSINGLE\\nDATA_DEST=ADC_DATA_REG', accent: colors.teal })}
    ${box(830, 590, 300, 140, 'FIFO 配置', { subtitle: 'FIFO1 WM=3 + 通知\\nFIFO2 disabled\\n当前触发不写 FIFO', accent: colors.amber })}
    ${box(1210, 590, 230, 150, '复核点', { subtitle: 'XDM 中 GlobalHwTriggers=false\\nRTD init 仍写 GTRGEN\\n调试时读 MCR 确认', accent: colors.red })}
  </g>
  ${arrow(330, 190, 430, 145)}
  ${arrow(330, 190, 430, 275)}
  ${arrow(330, 190, 430, 405)}
  ${arrow(750, 145, 850, 190)}
  ${arrow(750, 275, 850, 190)}
  ${arrow(750, 405, 850, 390)}
  ${arrow(1150, 190, 1220, 265)}
  ${arrow(1150, 390, 1220, 285)}
  ${arrow(220, 250, 220, 590, { dashed: true, label: '工程落点' })}
`, 'EB 配置到工程代码链路');

function codeCard(title, subtitle, lines, width = 1450) {
  const lineHeight = 26;
  const headerH = 82;
  const pad = 34;
  const height = headerH + pad + lines.length * lineHeight + 40;
  const escapedLines = lines.map((l) => esc(l));
  return {
    width,
    height,
    svg: `
      <rect x="0" y="0" width="${width}" height="${height}" fill="#0b1220"/>
      <rect x="0" y="0" width="${width}" height="${headerH}" fill="#111827"/>
      ${textBlock(title, 34, 36, { size: 24, weight: 800, fill: '#f8fafc', width: 80 })}
      ${textBlock(subtitle, 34, 66, { size: 15, weight: 500, fill: '#cbd5e1', width: 120 })}
      <g font-family="Consolas, 'Courier New', monospace" font-size="17" fill="#d1d5db">
        ${escapedLines.map((l, i) => {
          const y = headerH + pad + (i * lineHeight);
          const num = String(i + 1).padStart(2, ' ');
          return `<text x="34" y="${y}" fill="#64748b">${num}</text><text x="82" y="${y}">${l}</text>`;
        }).join('')}
      </g>
    `,
  };
}

async function writeCodeCard(name, title, subtitle, lines) {
  const c = codeCard(title, subtitle, lines);
  await writeSvgPng(name, c.width, c.height, c.svg, '');
}

await writeCodeCard('07_project_bctu_pb_config_card', '工程截图：Bctu_Ip_PBcfg.c 核心配置', 'BasicSoftware/integration/mcal/src/gen/src/Bctu_Ip_PBcfg.c', [
  'static const Bctu_Ip_TrigConfigType BctuIpControlModeInternalTriggers_0[] =',
  '{',
  '    { 1U, FALSE, BCTU_IP_DATA_DEST_ADC_DATA_REG, TRUE, BCTU_IP_TRIG_TYPE_SINGLE, 1U, 3U },',
  '    { 2U, FALSE, BCTU_IP_DATA_DEST_ADC_DATA_REG, TRUE, BCTU_IP_TRIG_TYPE_SINGLE, 1U, 7U },',
  '    ...',
  '    { 13U, FALSE, BCTU_IP_DATA_DEST_ADC_DATA_REG, TRUE, BCTU_IP_TRIG_TYPE_SINGLE, 1U, 47U },',
  '    { 15U, FALSE, BCTU_IP_DATA_DEST_ADC_DATA_REG, TRUE, BCTU_IP_TRIG_TYPE_SINGLE, 1U, 45U },',
  '    { 16U, FALSE, BCTU_IP_DATA_DEST_ADC_DATA_REG, TRUE, BCTU_IP_TRIG_TYPE_SINGLE, 1U, 46U },',
  '    { 17U, FALSE, BCTU_IP_DATA_DEST_ADC_DATA_REG, TRUE, BCTU_IP_TRIG_TYPE_SINGLE, 1U, 47U },',
  '    { 18U, FALSE, BCTU_IP_DATA_DEST_ADC_DATA_REG, TRUE, BCTU_IP_TRIG_TYPE_SINGLE, 1U, 35U }',
  '};',
  '',
  'const Bctu_Ip_ConfigType BctuIpConfigControlMode_0 =',
  '{',
  '    FALSE, FALSE, 0U, BctuTriggerNotification,',
  '    { { Adc0NewDataNotification, NULL_PTR, NULL_PTR },',
  '      { Adc1NewDataNotification, NULL_PTR, NULL_PTR },',
  '      { NULL_PTR, NULL_PTR, NULL_PTR } },',
  '    15U, BctuIpControlModeInternalTriggers_0,',
  '    0U, NULL_PTR,',
  '    2U, BctuIpResultFifos_0',
  '};',
]);

await writeCodeCard('08_project_eb_xdm_card', '工程截图：Adc.xdm 里的 EB 字段', 'BasicSoftware/integration/mcal/MCAL_Cfg/config/Adc.xdm', [
  '<d:lst name="BctuHwUnit" type="MAP">',
  '  <d:ctr name="BctuHwUnit_0">',
  '    <d:var name="BctuGlobalHwTriggers" value="false"/>',
  '    <d:var name="BctuTriggerNotification" value="BctuTriggerNotification"/>',
  '    <d:lst name="BctuInternalTrigger">',
  '      <d:ctr name="BctuInternalTrigger_1">',
  '        <d:ref name="BctuTriggerSource" value=".../AdcHwTrigger_1"/>',
  '        <d:var name="BctuDataDestination" value="BCTU_ADC_DATA_REG"/>',
  '        <d:var name="BctuHwTriggerEnable" value="true"/>',
  '        <d:var name="BctuTriggerConversionMode" value="SINGLE"/>',
  '        <d:var name="BctuAdcTargetMask" value="1"/>',
  '        <d:ref name="BctuAdcChannelSingle" value=".../Adc0Channel_PTE15_V_M_Pos"/>',
  '      </d:ctr>',
  '    </d:lst>',
  '  </d:ctr>',
  '</d:lst>',
]);

await writeCodeCard('09_project_callback_irq_card', '工程截图：通知回调与中断链路', 'Cdd_Adc.c + Bctu_Ip_Irq.c + Bctu_Ip.c', [
  '#include "Bctu_Ip_Irq.h"',
  '#define BCTU_IRQ BCTU_IRQn',
  'volatile uint8 BctuTrigNotif = 0u;',
  '',
  'void BctuTriggerNotification(void)',
  '{',
  '    BctuTrigNotif++;',
  '}',
  '',
  'ISR(Bctu_0_Isr)',
  '{',
  '    Bctu_Ip_IRQHandler(0UL);',
  '}',
  '',
  'Bctu_Ip_IRQHandler():',
  '  MSR[TRGF]      -> TriggerNotification',
  '  MSR[NDATAx]    -> AdcXNewDataNotification',
  '  MSR[DATAOVRx]  -> overrun notification',
  '  FIFOERR[WM/OVR/UNDR] -> FIFO callbacks',
]);

await writeCodeCard('10_trigger_matrix_card', '本项目 BCTU 触发矩阵', '从 Adc.xdm 与 Bctu_Ip_PBcfg.c 对齐整理', [
  'Trig  Source          EB channel                         Generated channel ID',
  '1     BCTU_EMIOS_0_1  Adc0Channel_PTE15_V_M_Pos          3',
  '2     BCTU_EMIOS_0_2  Adc0Channel_PTA9_IVV               7',
  '3     BCTU_EMIOS_0_3  Adc0Channel_PTA1_KL15              33',
  '4     BCTU_EMIOS_0_4  Adc0Channel_PTA7_MOS_TEMP1         35',
  '5     BCTU_EMIOS_0_5  Adc0Channel_PTB0_VBAT2             38',
  '6     BCTU_EMIOS_0_6  Adc0Channel_PTB1_PS_OUT2           39',
  '7     BCTU_EMIOS_0_7  Adc0Channel_PTC11_VBAT1            41',
  '8     BCTU_EMIOS_0_8  Adc0Channel_PTA6_PS_OUT1           42',
  '9     BCTU_EMIOS_0_9  Adc0Channel_PTC25_RTC              44',
  '10    BCTU_EMIOS_0_10 Adc0Channel_PTC26_CAN1_INH         45',
  '13    BCTU_EMIOS_0_13 Adc0Channel_PTD21_HeatingCurrent   47',
  '15    BCTU_EMIOS_0_15 Adc1Channel_PTD27_KL30_M           45',
  '16    BCTU_EMIOS_0_16 Adc1Channel_PTD28_ENV_TEMP2        46',
  '17    BCTU_EMIOS_0_17 Adc1Channel_PTD29_Safe_switch      47',
  '18    BCTU_EMIOS_0_18 Adc1Channel_PTB15_Sup5vRTC         35',
]);

console.log(`Generated assets in ${assetDir}`);
