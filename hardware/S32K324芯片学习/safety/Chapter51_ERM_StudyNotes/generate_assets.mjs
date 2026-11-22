import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";

const require = createRequire("E:/github/.codex_tools/siul2_notes/package.json");
const pdfjs = await import(pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href);
const { createCanvas } = require("@napi-rs/canvas");

const pdfPath = "C:/Users/nvtc140/Zotero/storage/GKPNECE2/S32K3xx Reference Manual.pdf";
const outDir = "E:/github/ECAS_RTA_S32K324GHS_Heating/Doc/Chapter51_ERM_StudyNotes/assets";
fs.mkdirSync(outDir, { recursive: true });

const palette = {
  ink: "#1f2933",
  muted: "#52606d",
  line: "#d9e2ec",
  bg: "#f7f9fb",
  card: "#ffffff",
  blue: "#2f6f9f",
  teal: "#147d7e",
  green: "#2f7d4a",
  amber: "#a65f00",
  red: "#b42318",
  violet: "#6b5ca5",
};

function makeCanvas(width, height) {
  const c = createCanvas(width, height);
  const ctx = c.getContext("2d");
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  return { c, ctx };
}

function save(c, name) {
  fs.writeFileSync(path.join(outDir, name), c.toBuffer("image/png"));
}

function roundRect(ctx, x, y, w, h, r = 14) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function box(ctx, x, y, w, h, title, lines = [], color = palette.blue, opts = {}) {
  ctx.save();
  roundRect(ctx, x, y, w, h, opts.radius ?? 12);
  ctx.fillStyle = opts.fill ?? palette.card;
  ctx.fill();
  ctx.lineWidth = opts.lineWidth ?? 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = opts.titleFont ?? "700 24px Microsoft YaHei, Segoe UI, sans-serif";
  ctx.fillText(title, x + 18, y + 16);
  ctx.fillStyle = palette.ink;
  ctx.font = opts.bodyFont ?? "18px Microsoft YaHei, Segoe UI, sans-serif";
  let ty = y + 52;
  for (const line of lines) {
    ctx.fillText(line, x + 18, ty);
    ty += opts.lineGap ?? 28;
  }
  ctx.restore();
}

function label(ctx, text, x, y, size = 22, color = palette.ink, weight = 400) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px Microsoft YaHei, Segoe UI, sans-serif`;
  ctx.fillText(text, x, y);
}

function arrow(ctx, x1, y1, x2, y2, color = palette.muted) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = 13;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - len * Math.cos(angle - Math.PI / 6), y2 - len * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - len * Math.cos(angle + Math.PI / 6), y2 - len * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTable(ctx, x, y, cols, rows, widths, rowH = 38) {
  ctx.save();
  const totalW = widths.reduce((a, b) => a + b, 0);
  ctx.font = "700 18px Microsoft YaHei, Segoe UI, sans-serif";
  let cx = x;
  ctx.fillStyle = "#e6f0f7";
  ctx.fillRect(x, y, totalW, rowH);
  for (let i = 0; i < cols.length; i++) {
    ctx.strokeStyle = palette.line;
    ctx.strokeRect(cx, y, widths[i], rowH);
    ctx.fillStyle = palette.ink;
    ctx.fillText(cols[i], cx + 10, y + 9);
    cx += widths[i];
  }
  ctx.font = "16px Microsoft YaHei, Segoe UI, sans-serif";
  for (let r = 0; r < rows.length; r++) {
    const yy = y + rowH * (r + 1);
    ctx.fillStyle = r % 2 === 0 ? "#ffffff" : "#f3f6f9";
    ctx.fillRect(x, yy, totalW, rowH);
    cx = x;
    for (let i = 0; i < cols.length; i++) {
      ctx.strokeStyle = palette.line;
      ctx.strokeRect(cx, yy, widths[i], rowH);
      ctx.fillStyle = palette.ink;
      ctx.fillText(String(rows[r][i]), cx + 10, yy + 9);
      cx += widths[i];
    }
  }
  ctx.restore();
}

function wrapLines(ctx, text, maxWidth) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function renderPdfExcerptImages() {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjs.getDocument({ data, disableWorker: true }).promise;
  const pages = [
    [2065, "rm_excerpt_2065_ch51_start_channel_map.png", "RM Chapter 51 起始页与 ERM_0 channel mapping", 80, 1700],
    [2066, "rm_excerpt_2066_channel_notes.png", "RM Channel mapping 备注：S32K324 地址修正规则", 0, 1800],
    [2072, "rm_excerpt_2072_erm0_memory_map.png", "ERM_0 memory map：base address 与主要寄存器", 0, 1700],
    [2073, "rm_excerpt_2073_cr0_register.png", "CR0：每通道 interrupt enable 位", 0, 1600],
    [2084, "rm_excerpt_2084_sr0_status_bits.png", "SR0：SBC/NCE status 与 W1C 清除", 0, 1600],
    [2097, "rm_excerpt_2097_syn_register.png", "SYNn：ECC syndrome 寄存器说明", 0, 1500],
    [2098, "rm_excerpt_2098_corr_counter.png", "CORR_ERR_CNTn：correctable error 计数", 0, 1450],
    [2099, "rm_excerpt_2099_access_rules.png", "访问规则：supervisor + 32-bit word access", 0, 1500],
    [951, "rm_excerpt_0951_erm_clocking.png", "ERM clocking：AIPS_PLAT_CLK 与 MEM_CLK", 0, 1200],
    [762, "rm_excerpt_0762_memory_config_sram.png", "Memory configuration：SRAM0/SRAM1 ECC 由 ERM 报告", 0, 1500],
    [771, "rm_excerpt_0771_memory_config_tcm.png", "Memory configuration：CM7 TCM ECC 由 ERM 报告", 0, 1500],
  ];

  for (const [pageNum, name, title, start, length] of pages) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(" ").replace(/\s+/g, " ");
    const excerpt = text.slice(start, start + length);
    const { c, ctx } = makeCanvas(1500, 920);
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, 58, 86, 1384, 770, 16);
    ctx.fill();
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 2;
    ctx.stroke();
    label(ctx, title, 72, 34, 30, palette.ink, 700);
    label(ctx, `S32K3xx Reference Manual Rev.9, PDF page ${pageNum}`, 84, 112, 20, palette.blue, 700);
    ctx.font = "21px Consolas, Microsoft YaHei, monospace";
    ctx.fillStyle = palette.ink;
    const lines = wrapLines(ctx, excerpt, 1290).slice(0, 24);
    let y = 170;
    for (const line of lines) {
      ctx.fillText(line, 88, y);
      y += 30;
    }
    ctx.fillStyle = "#eef5fb";
    ctx.fillRect(58, 805, 1384, 51);
    label(ctx, "说明：该图为从本地 RM 页面抽取的关键文字截图式摘录，用于快速定位原文。", 84, 820, 20, palette.muted, 400);
    save(c, name);
  }
}

function drawArchitecture() {
  const { c, ctx } = makeCanvas(1500, 840);
  label(ctx, "S32K324 ERM 在安全链路中的位置", 48, 34, 34, palette.ink, 700);
  label(ctx, "ECC/parity 事件不是直接等于复位；ERM 负责记录，eMcem/FCCU 决定告警和反应。", 48, 82, 20, palette.muted);

  box(ctx, 60, 160, 300, 128, "ECC 来源", ["SRAM0 / SRAM1", "CM7_0 / CM7_1 cache", "ITCM / DTCM / DMA TCD", "Flash port p0/p1/p2"], palette.teal);
  box(ctx, 450, 150, 310, 150, "ERM_0", ["CR0/CR1/CR2: 中断使能", "SR0/SR1/SR2: 事件状态", "EARn: 错误地址", "SYNn: ECC syndrome", "CORR_ERR_CNTn: 可纠错计数"], palette.blue);
  box(ctx, 850, 160, 280, 128, "eMcem", ["读取 ERM 状态", "归类 memory error", "调用 alarm handler", "清除状态/计数"], palette.violet);
  box(ctx, 1220, 150, 280, 150, "FCCU / 系统反应", ["NCF2: RAM/TCM/DMA", "NCF3: Flash ECC", "NoReset / ShortReset", "EOUT / IRQ / NMI"], palette.red);
  arrow(ctx, 360, 224, 450, 224);
  arrow(ctx, 760, 224, 850, 224);
  arrow(ctx, 1130, 224, 1220, 224);

  box(ctx, 110, 410, 360, 120, "Correctable", ["典型：单 bit 可纠错", "ERM 记录状态 + 地址/综合信息", "计数器饱和到 0xFF，不回卷"], palette.green);
  box(ctx, 530, 410, 380, 120, "Non-correctable", ["典型：多 bit 不可纠错", "ERM 只记录状态/地址/综合信息", "不提供 NCE 计数，按严重故障处理"], palette.amber);
  box(ctx, 970, 410, 390, 120, "软件处理重点", ["先读 SRn 判断通道和类型", "再读 EARn/SYNn/CNTn", "最后 W1C 清 SRn，必要时清计数"], palette.blue);
  arrow(ctx, 470, 470, 530, 470);
  arrow(ctx, 910, 470, 970, 470);

  box(ctx, 160, 620, 1180, 110, "一句话记忆", ["ERM 是 ECC 事件的“记录员”；eMcem 是安全软件的“翻译器”；FCCU 是系统级安全反应的“执行入口”。"], palette.ink, {
    fill: "#fef7e8",
    titleFont: "700 26px Microsoft YaHei, Segoe UI, sans-serif",
    bodyFont: "22px Microsoft YaHei, Segoe UI, sans-serif",
  });
  save(c, "erm_architecture.png");
}

function drawChannelMap() {
  const { c, ctx } = makeCanvas(1500, 1180);
  label(ctx, "S32K324 ERM_0 Channel Mapping", 48, 30, 34, palette.ink, 700);
  label(ctx, "S32K324 只有 ERM_0，一个实例 20 个通道；ERM_1 不适用于 S32K324。", 48, 78, 20, palette.muted);
  const rows = [
    [0, "SRAM0", "SBC/NCE + syndrome + 64-bit 对齐地址", "地址直接可用"],
    [1, "SRAM1", "SBC/NCE + syndrome + 地址+0x18000", "需减 0x18000"],
    [2, "CM7_0 I-cache tag", "SBC/NCE", "无 EAR/SYN"],
    [3, "CM7_0 I-cache data", "SBC/NCE", "无 EAR/SYN"],
    [4, "CM7_0 D-cache tag", "SBC/NCE", "无 EAR/SYN"],
    [5, "CM7_0 D-cache data", "SBC/NCE", "无 EAR/SYN"],
    [6, "CM7_1 I-cache tag", "SBC/NCE", "无 EAR/SYN"],
    [7, "CM7_1 I-cache data", "SBC/NCE", "无 EAR/SYN"],
    [8, "CM7_1 D-cache tag", "SBC/NCE", "无 EAR/SYN"],
    [9, "CM7_1 D-cache data", "SBC/NCE", "无 EAR/SYN"],
    [10, "CM7_0 ITCM", "SBC/NCE + syndrome + offset address", "TCM 偏移地址"],
    [11, "CM7_0 D0TCM", "SBC/NCE + syndrome + offset address", "bit2 被屏蔽"],
    [12, "CM7_0 D1TCM", "SBC/NCE + syndrome + offset address", "bit2 被屏蔽"],
    [13, "CM7_1 ITCM", "SBC/NCE + syndrome + offset address", "TCM 偏移地址"],
    [14, "CM7_1 D0TCM", "SBC/NCE + syndrome + offset address", "bit2 被屏蔽"],
    [15, "CM7_1 D1TCM", "SBC/NCE + syndrome + offset address", "bit2 被屏蔽"],
    [16, "DMA TCD", "SBC/NCE + syndrome + offset address", "eDMA TCD RAM"],
    [17, "Flash port p0", "SBC/NCE + absolute address", "PFLASH/FMU 到 ERM"],
    [18, "Flash port p1", "SBC/NCE + absolute address", "PFLASH/FMU 到 ERM"],
    [19, "Flash port p2", "SBC/NCE + absolute address", "S32K324 可用"],
  ];
  drawTable(ctx, 48, 130, ["Ch", "模块", "ERM 捕获信息", "S32K324 备注"], rows, [90, 300, 520, 420], 42);
  box(ctx, 70, 1020, 620, 120, "SBC / NCE", ["SBC = Single-bit correction event", "NCE = Non-correctable error event"], palette.blue, { bodyFont: "20px Microsoft YaHei, Segoe UI, sans-serif" });
  box(ctx, 760, 1020, 620, 120, "地址与综合信息", ["Cache 通道通常只有状态和计数", "SRAM/TCM/DMA/Flash 才能进一步读 EAR/SYN"], palette.teal, { bodyFont: "20px Microsoft YaHei, Segoe UI, sans-serif" });
  save(c, "erm_channel_map_s32k324.png");
}

function drawRegisterLayout() {
  const { c, ctx } = makeCanvas(1500, 980);
  label(ctx, "ERM_0 Register Layout 与访问规则", 48, 34, 34, palette.ink, 700);
  label(ctx, "Base: 0x4025_C000。寄存器只能 supervisor + 32-bit word access。", 48, 82, 20, palette.muted);
  const regs = [
    ["0x000", "CR0", "通道 0..7 interrupt enable", "ESCIE / ENCIE"],
    ["0x004", "CR1", "通道 8..15 interrupt enable", "ESCIE / ENCIE"],
    ["0x008", "CR2", "通道 16..19 interrupt enable", "ESCIE / ENCIE"],
    ["0x010", "SR0", "通道 0..7 status", "SBC / NCE, W1C"],
    ["0x014", "SR1", "通道 8..15 status", "SBC / NCE, W1C"],
    ["0x018", "SR2", "通道 16..19 status", "SBC / NCE, W1C"],
    ["0x100 + n*0x10", "EARn", "最后一次错误地址", "只读，部分通道无意义"],
    ["0x104 + n*0x10", "SYNn", "最后一次 ECC syndrome", "只读，bits[31:24]"],
    ["0x108 + n*0x10", "CORR_ERR_CNTn", "可纠错错误计数", "8-bit，饱和到 0xFF"],
  ];
  drawTable(ctx, 64, 136, ["Offset", "Register", "作用", "注意点"], regs, [190, 260, 480, 440], 56);
  box(ctx, 120, 720, 360, 140, "CRn 位布局", ["每个通道占 4 bit", "bit+3: ESCIE", "bit+2: ENCIE", "bit+1..0: reserved"], palette.blue);
  box(ctx, 530, 720, 360, 140, "SRn 位布局", ["每个通道占 4 bit", "bit+3: SBC", "bit+2: NCE", "写 1 清除 W1C"], palette.green);
  box(ctx, 940, 720, 360, 140, "计数器", ["只统计 correctable", "NCE 不计数", "写 0 清计数", "写非 0 无效"], palette.amber);
  save(c, "erm_register_layout.png");
}

function drawEbConfig() {
  const { c, ctx } = makeCanvas(1500, 980);
  label(ctx, "EB tresos / eMcem 配置路径", 48, 34, 34, palette.ink, 700);
  label(ctx, "当前工程 ERM 通过 SafetyBase/eMcem 与 FCCU/DCM fault group 关联。", 48, 82, 20, palette.muted);
  box(ctx, 80, 160, 300, 112, "1. SafetyBase", ["SAFETY_BASE_S32K324 = 1", "启用 S32_SAF 基础组件"], palette.teal);
  box(ctx, 500, 160, 300, 112, "2. eMcem General", ["FaultStatisticsEnabled = true", "ExtendedDiagnostics = false"], palette.blue);
  box(ctx, 920, 160, 390, 132, "3. FccuConfig_0", ["FaultTimeout = 400000", "CfgToIrqEnabled = true", "Lock = NO_LOCK"], palette.violet);
  arrow(ctx, 380, 216, 500, 216);
  arrow(ctx, 800, 216, 920, 216);
  box(ctx, 140, 390, 520, 170, "FaultGroup_2: RAM_ERROR", ["GroupDesc = EMCEM_FCCU_NCF_2_RAM_ERROR", "FaultDisabled = false", "ReactionType = ShortResetReaction", "覆盖 PRAM/CM7 cache/TCM/DMA TCD/UNCORR ECC"], palette.red);
  box(ctx, 780, 390, 520, 170, "FaultGroup_3: FLASH_ERROR", ["GroupDesc = EMCEM_FCCU_NCF_3_FLASH_ERROR", "FaultDisabled = false", "ReactionType = ShortResetReaction", "覆盖 PF0/PF1/PF2 code/data ECC 等 flash fault"], palette.red);
  arrow(ctx, 1080, 272, 1020, 390);
  arrow(ctx, 1080, 272, 400, 390);
  box(ctx, 165, 680, 470, 150, "DCMFault 子项", ["DCMFaultDisabled = false", "AlarmHandlerName = eMcemDefaultAlarmHandler", "每个 DCM signal 可单独启停和指定 handler"], palette.green);
  box(ctx, 805, 680, 470, 150, "调试建议", ["先确认 NCF2/NCF3 是否启用", "再确认具体 DCMFault 是否 disabled", "最后确认 handler/reaction 是否符合项目安全策略"], palette.amber);
  save(c, "eb_configuration_path.png");
}

function drawEbScreens() {
  const { c: c1, ctx: ctx1 } = makeCanvas(1320, 760);
  label(ctx1, "当前工程 eMcem General 配置摘录", 40, 34, 32, palette.ink, 700);
  box(ctx1, 70, 115, 1180, 520, "BasicSoftware/integration/mcal/MCAL_Cfg/config/eMcem.xdm", [
    "IMPLEMENTATION_CONFIG_VARIANT = VariantPreCompile",
    "ExtendedDiagnosticsEnabled = false",
    "FaultStatisticsEnabled = true",
    "DebugModeEnabled = false",
    "FccuConfig_0:",
    "  FaultTimeout = 400000",
    "  ConfigTimeout = 6",
    "  CfgToIrqEnabled = true",
    "  eMcemLockConfiguration = NO_LOCK",
    "  EOUT_ControlMode = FSM"
  ], palette.blue, { bodyFont: "24px Consolas, Microsoft YaHei, monospace", lineGap: 38, titleFont: "700 22px Consolas, Microsoft YaHei, monospace" });
  save(c1, "eb_general_config_excerpt.png");

  const { c: c2, ctx: ctx2 } = makeCanvas(1320, 820);
  label(ctx2, "当前工程 RAM/TCM/DMA ECC FaultGroup 配置摘录", 40, 34, 32, palette.ink, 700);
  box(ctx2, 70, 115, 1180, 590, "FaultGroup_2", [
    "GroupDesc = EMCEM_FCCU_NCF_2_RAM_ERROR",
    "FaultDisabled = false",
    "ReactionType = ShortResetReaction",
    "DCMFault:",
    "  PRAM1_MULTI_ERR / PRAM0_MULTI_ERR",
    "  CM7_0_ERR / CM7_1_ERR / cache tag/data multi err",
    "  ITCM_MULTI_ERR / D0TCM_MULTI_ERR / D1TCM_MULTI_ERR",
    "  TCD_RAM_ERR / UNCORR_ECC",
    "AlarmHandlerName = eMcemDefaultAlarmHandler"
  ], palette.red, { bodyFont: "22px Consolas, Microsoft YaHei, monospace", lineGap: 36, titleFont: "700 24px Consolas, Microsoft YaHei, monospace" });
  save(c2, "eb_ncf2_ram_error_config.png");

  const { c: c3, ctx: ctx3 } = makeCanvas(1320, 760);
  label(ctx3, "当前工程 Flash ECC FaultGroup 配置摘录", 40, 34, 32, palette.ink, 700);
  box(ctx3, 70, 115, 1180, 520, "FaultGroup_3", [
    "GroupDesc = EMCEM_FCCU_NCF_3_FLASH_ERROR",
    "FaultDisabled = false",
    "ReactionType = ShortResetReaction",
    "DCMFault:",
    "  PF0_CODE_ERR / PF0_DATA_ERR",
    "  PF1_CODE_ERR / PF1_DATA_ERR",
    "  PF2_CODE_ERR / PF2_DATA_ERR",
    "  FLASH0_ERR_LATE / FLASH0_ENC_ERR / FLASH_FAULT",
    "AlarmHandlerName = eMcemDefaultAlarmHandler"
  ], palette.red, { bodyFont: "22px Consolas, Microsoft YaHei, monospace", lineGap: 36, titleFont: "700 24px Consolas, Microsoft YaHei, monospace" });
  save(c3, "eb_ncf3_flash_error_config.png");
}

function drawFlow() {
  const { c, ctx } = makeCanvas(1500, 820);
  label(ctx, "ERM 事件处理流程", 48, 34, 34, palette.ink, 700);
  label(ctx, "推荐按“状态 -> 信息 -> 反应 -> 清除”的顺序处理，避免清除太早导致诊断信息丢失。", 48, 82, 20, palette.muted);
  const steps = [
    ["ECC event", "内存控制器发现 SBC 或 NCE"],
    ["ERM latch", "置位 SRn，捕获 EARn/SYNn，SBC 计数+1"],
    ["eMcem/FCCU", "按 NCF2/NCF3 与 DCMFault 配置进入 handler"],
    ["Read info", "读 SRn -> EARn -> SYNn -> CNTn"],
    ["React", "记录 DTC/DEM、降级、复位或安全输出"],
    ["Clear", "SRn 写 1 清状态；按需清计数"]
  ];
  let x = 50;
  for (let i = 0; i < steps.length; i++) {
    const color = [palette.teal, palette.blue, palette.violet, palette.green, palette.amber, palette.red][i];
    box(ctx, x, 230, 205, 140, steps[i][0], [steps[i][1]], color, { bodyFont: "17px Microsoft YaHei, Segoe UI, sans-serif", lineGap: 25 });
    if (i < steps.length - 1) arrow(ctx, x + 205, 300, x + 245, 300);
    x += 245;
  }
  box(ctx, 140, 500, 520, 120, "Correctable 路径", ["可统计、可诊断；若地址可用，可通过读写回写修正存储单元。"], palette.green, { bodyFont: "22px Microsoft YaHei, Segoe UI, sans-serif" });
  box(ctx, 800, 500, 520, 120, "Non-correctable 路径", ["不可纠错、不计数；通常应作为严重故障，由 FCCU/eMcem 策略决定复位或安全输出。"], palette.red, { bodyFont: "22px Microsoft YaHei, Segoe UI, sans-serif" });
  save(c, "erm_handling_flow.png");
}

await renderPdfExcerptImages();
drawArchitecture();
drawChannelMap();
drawRegisterLayout();
drawEbConfig();
drawEbScreens();
drawFlow();

console.log(`Generated ERM assets in ${outDir}`);
