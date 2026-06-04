import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";

const require = createRequire("E:/github/.codex_tools/siul2_notes/package.json");
const pdfjs = await import(pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href);
const { createCanvas } = require("@napi-rs/canvas");

const root = "E:/github/ECAS_RTA_S32K324GHS_Heating";
const pdfPath = "C:/Users/nvtc140/Zotero/storage/GKPNECE2/S32K3xx Reference Manual.pdf";
const outDir = `${root}/Doc/Chapter73_FlexCAN_Driver_StudyNotes/assets`;
fs.mkdirSync(outDir, { recursive: true });

const palette = {
  ink: "#16202a",
  muted: "#566678",
  line: "#d8e0e8",
  bg: "#f6f8fb",
  card: "#ffffff",
  blue: "#1f6f9f",
  navy: "#334e68",
  teal: "#0f766e",
  green: "#2f7d32",
  amber: "#a55a00",
  orange: "#b45309",
  red: "#b42318",
  violet: "#6b5ca5",
  gray: "#5f6c7b",
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

function roundRect(ctx, x, y, w, h, r = 12) {
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

function label(ctx, text, x, y, size = 22, color = palette.ink, weight = 400, font = "Microsoft YaHei, Segoe UI, sans-serif") {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillText(text, x, y);
}

function wrapText(ctx, text, maxWidth) {
  const tokens = text.includes(" ") ? text.replace(/\s+/g, " ").trim().split(" ") : Array.from(text);
  const lines = [];
  let line = "";
  for (const token of tokens) {
    const sep = text.includes(" ") ? " " : "";
    const next = line ? `${line}${sep}${token}` : token;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = token;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function box(ctx, x, y, w, h, title, lines = [], color = palette.blue, opts = {}) {
  ctx.save();
  roundRect(ctx, x, y, w, h, opts.radius ?? 10);
  ctx.fillStyle = opts.fill ?? palette.card;
  ctx.fill();
  ctx.lineWidth = opts.lineWidth ?? 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  label(ctx, title, x + 18, y + 16, opts.titleSize ?? 23, color, 700);
  ctx.font = `${opts.bodyWeight ?? 400} ${opts.bodySize ?? 17}px Microsoft YaHei, Segoe UI, sans-serif`;
  ctx.fillStyle = palette.ink;
  let ty = y + (opts.bodyTop ?? 52);
  for (const line of lines) {
    const wrapped = wrapText(ctx, String(line), w - 36);
    for (const piece of wrapped) {
      ctx.fillText(piece, x + 18, ty);
      ty += opts.lineGap ?? 25;
    }
  }
  ctx.restore();
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
  const len = 12;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - len * Math.cos(angle - Math.PI / 6), y2 - len * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - len * Math.cos(angle + Math.PI / 6), y2 - len * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTable(ctx, x, y, cols, rows, widths, rowH = 42, opts = {}) {
  ctx.save();
  const totalW = widths.reduce((a, b) => a + b, 0);
  ctx.font = `700 ${opts.headerSize ?? 17}px Microsoft YaHei, Segoe UI, sans-serif`;
  ctx.fillStyle = opts.headerFill ?? "#e7f0f8";
  ctx.fillRect(x, y, totalW, rowH);
  let cx = x;
  for (let i = 0; i < cols.length; i++) {
    ctx.strokeStyle = palette.line;
    ctx.strokeRect(cx, y, widths[i], rowH);
    ctx.fillStyle = palette.ink;
    ctx.fillText(cols[i], cx + 10, y + 10);
    cx += widths[i];
  }
  ctx.font = `${opts.bodySize ?? 16}px Microsoft YaHei, Segoe UI, sans-serif`;
  for (let r = 0; r < rows.length; r++) {
    const yy = y + rowH * (r + 1);
    ctx.fillStyle = r % 2 === 0 ? "#ffffff" : "#f2f5f8";
    ctx.fillRect(x, yy, totalW, rowH);
    cx = x;
    for (let i = 0; i < cols.length; i++) {
      ctx.strokeStyle = palette.line;
      ctx.strokeRect(cx, yy, widths[i], rowH);
      ctx.fillStyle = palette.ink;
      const cell = String(rows[r][i]);
      const lines = wrapText(ctx, cell, widths[i] - 20).slice(0, opts.maxCellLines ?? 2);
      for (let li = 0; li < lines.length; li++) {
        ctx.fillText(lines[li], cx + 10, yy + 8 + li * 20);
      }
      cx += widths[i];
    }
  }
  ctx.restore();
}

function drawCodeImage(name, title, subtitle, lines, width = 1500, height = 900) {
  const { c, ctx } = makeCanvas(width, height);
  label(ctx, title, 48, 34, 34, palette.ink, 700);
  label(ctx, subtitle, 48, 82, 20, palette.muted, 400);
  roundRect(ctx, 56, 126, width - 112, height - 180, 14);
  ctx.fillStyle = "#0f172a";
  ctx.fill();
  ctx.strokeStyle = "#24364f";
  ctx.stroke();
  ctx.font = "22px Consolas, Microsoft YaHei, monospace";
  let y = 154;
  for (const line of lines) {
    ctx.fillStyle = line.trim().startsWith("/*") || line.trim().startsWith("//") ? "#93c5fd" : "#e5edf5";
    const pieces = wrapText(ctx, line, width - 160);
    for (const piece of pieces) {
      if (y > height - 78) break;
      ctx.fillText(piece, 84, y);
      y += 29;
    }
    if (y > height - 78) break;
  }
  label(ctx, "说明：该图为从 EB xdm / 生成 C 配置中摘出的关键配置，便于学习时快速对照。", 68, height - 48, 18, palette.muted, 400);
  save(c, name);
}

async function renderPdfExcerptImages() {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjs.getDocument({ data, disableWorker: true }).promise;
  const pages = [
    [3043, "rm_excerpt_3043_ch73_start.png", "RM Chapter 73 首页：FlexCAN chip-specific 信息", "Chapter 73 CAN (FlexCAN)", 1500],
    [3044, "rm_excerpt_3044_s32k324_instances.png", "S32K324 FlexCAN 实例能力表", "S32K314, S32K324, S32K344", 1600],
    [3047, "rm_excerpt_3047_memory_init_mdis.png", "FlexCAN RAM 初始化与 MDIS 复位状态", "FlexCAN memory initialization", 1500],
    [3048, "rm_excerpt_3048_overview_block.png", "FlexCAN Overview 与 Block Diagram", "73.2 Overview", 1500],
    [3053, "rm_excerpt_3053_tx_process.png", "Transmit process：软件准备 TX MB 的顺序", "To transmit a CAN frame", 1700],
    [3057, "rm_excerpt_3057_rx_process.png", "Receive process：推荐读取 RX MB 的顺序", "The recommended way for the CPU", 1700],
    [3072, "rm_excerpt_3072_can_fd.png", "CAN FD frames：EDL/BRS/ESI 与 FD 模式", "73.3.10.2 CAN FD frames", 1500],
    [3081, "rm_excerpt_3081_bit_timing.png", "Bit timing：Tq、Sample Point 和段结构", "73.3.10.8.2 Bit time segments", 1500],
    [3089, "rm_excerpt_3089_clock_restrictions.png", "FlexCAN clocks：CHI/PE 时钟域与限制", "73.3.11 Clocks", 1500],
    [3094, "rm_excerpt_3094_interrupts.png", "Interrupts：MB、BusOff、Error、Warning", "73.3.13 Interrupts", 1600],
    [3106, "rm_excerpt_3106_memory_map.png", "CAN memory map 与 S32K324 base address", "73.6.2.1 CAN memory map", 1600],
    [3109, "rm_excerpt_3109_mcr.png", "MCR：MDIS/FRZ/RFEN/HALT/IRMQ/FDEN/MAXMB", "73.6.2.2 Module Configuration", 1600],
    [3116, "rm_excerpt_3116_ctrl1.png", "CTRL1：bit timing、Loopback、BusOff/Error mask", "73.6.2.3 Control 1", 1600],
    [3138, "rm_excerpt_3138_iflag1.png", "IFLAG1：MB interrupt flag 与 W1C", "73.6.2.13 Interrupt Flags 1", 1600],
    [3189, "rm_excerpt_3189_fdctrl.png", "FDCTRL：FDRATE、MBDSR、TDC", "73.6.2.37 CAN FD Control", 1600],
    [3214, "rm_excerpt_3214_mb_structure.png", "Message buffer structure：CS/ID/Data", "73.6.3 Message buffer structure", 1600],
    [3220, "rm_excerpt_3220_fd_partition.png", "CAN FD RAM partition：8/16/32/64 字节 payload", "73.6.4 FlexCAN memory partition", 1600],
  ];

  for (const [pageNum, name, title, pattern, length] of pages) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(" ").replace(/\s+/g, " ");
    const idx = pattern ? text.indexOf(pattern) : 0;
    const start = Math.max(0, (idx >= 0 ? idx : 0) - 90);
    const excerpt = text.slice(start, start + length);
    const { c, ctx } = makeCanvas(1500, 920);
    label(ctx, title, 56, 34, 31, palette.ink, 700);
    label(ctx, `S32K3xx Reference Manual Rev.9, PDF page ${pageNum}`, 58, 78, 19, palette.blue, 700);
    roundRect(ctx, 58, 118, 1384, 735, 14);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = "21px Consolas, Microsoft YaHei, monospace";
    ctx.fillStyle = palette.ink;
    let y = 148;
    for (const line of wrapText(ctx, excerpt, 1305).slice(0, 23)) {
      ctx.fillText(line, 88, y);
      y += 30;
    }
    ctx.fillStyle = "#eef5fb";
    ctx.fillRect(58, 803, 1384, 50);
    label(ctx, "说明：截图式摘录用于快速定位原文，学习时建议同时打开本地 RM 对照完整表格。", 84, 817, 19, palette.muted, 400);
    save(c, name);
  }
}

function drawArchitecture() {
  const { c, ctx } = makeCanvas(1500, 900);
  label(ctx, "FlexCAN 驱动视角总览", 48, 34, 34, palette.ink, 700);
  label(ctx, "这张图只覆盖 CAN Driver / FlexCAN IP，不展开 COM、PduR、CanIf 上层路由逻辑。", 48, 82, 20, palette.muted);

  box(ctx, 60, 155, 270, 120, "AUTOSAR 上边界", ["CanIf 调用 Can_Write", "CanIf 接收 RxIndication", "BusOff/Mode 回调"], palette.violet);
  box(ctx, 430, 145, 290, 140, "Can_43_FLEXCAN", ["Can_Init / SetControllerMode", "Can_SetBaudrate", "Can_Write", "MainFunction / IRQ callback"], palette.blue);
  box(ctx, 815, 145, 260, 140, "IPW + FlexCAN_Ip", ["配置 controller", "配置 RX/TX MB", "写 MCR/CTRL/FDCTRL", "收发 message buffer"], palette.teal);
  box(ctx, 1170, 145, 270, 140, "S32K324 FlexCAN", ["CAN_1: 0x40308000", "CAN_2: 0x4030C000", "MCR/CTRL1/IFLAG/MB RAM", "CAN1/CAN2 pins"], palette.green);
  arrow(ctx, 330, 215, 430, 215);
  arrow(ctx, 720, 215, 815, 215);
  arrow(ctx, 1075, 215, 1170, 215);

  box(ctx, 110, 410, 300, 140, "BIU", ["Peripheral bus access", "寄存器读写", "DMA / interrupt output"], palette.navy);
  box(ctx, 460, 390, 300, 180, "CHI", ["Controller Host Interface", "MB 选择", "TX arbitration", "RX matching", "move-in / move-out"], palette.orange);
  box(ctx, 810, 410, 300, 140, "PE", ["Protocol Engine", "CAN frame serial protocol", "error counter / bus off", "CAN FD / BRS / TDC"], palette.red);
  box(ctx, 1160, 400, 260, 160, "MB RAM", ["CS word", "ID word", "DATA 0..63", "RXIMR / FIFO / timestamp"], palette.green);
  arrow(ctx, 410, 480, 460, 480);
  arrow(ctx, 760, 480, 810, 480);
  arrow(ctx, 1110, 480, 1160, 480);

  box(ctx, 270, 690, 410, 110, "CAN TX / CAN RX", ["PTC8/PTC9 = CAN1 TX/RX", "PTC7/PTC6 = CAN2 TX/RX"], palette.blue);
  box(ctx, 830, 690, 410, 110, "CAN transceiver + bus", ["MCU 只输出逻辑 TX/RX", "实际总线电平由外部收发器完成"], palette.teal);
  arrow(ctx, 680, 745, 830, 745);
  save(c, "can_architecture.png");
}

function drawInstances() {
  const { c, ctx } = makeCanvas(1500, 880);
  label(ctx, "S32K324 FlexCAN 实例与当前工程使用情况", 48, 34, 34, palette.ink, 700);
  label(ctx, "手册 Chapter 73 的 chip-specific 表是判断某个 FlexCAN 实例能力的第一依据。", 48, 82, 20, palette.muted);
  drawTable(ctx, 58, 135, ["硬件实例", "Base address", "RM MB 数", "CAN FD", "Enhanced RX FIFO", "当前工程"], [
    ["FlexCAN_0", "0x4030_4000", "96", "Yes", "Yes (20)", "Mcu 时钟打开，Can Driver 未用"],
    ["FlexCAN_1", "0x4030_8000", "64", "Yes", "No", "CanController_0，CAN FD + BRS"],
    ["FlexCAN_2", "0x4030_C000", "64", "Yes", "No", "CanController_1，Classical CAN"],
    ["FlexCAN_3", "0x4031_0000", "32", "Yes", "No", "Mcu 时钟打开，Can Driver 未用"],
    ["FlexCAN_4", "0x4031_4000", "32", "Yes", "No", "Mcu 时钟打开，Can Driver 未用"],
    ["FlexCAN_5", "0x4031_8000", "32", "Yes", "No", "Mcu 时钟打开，Can Driver 未用"],
  ], [180, 220, 130, 120, 220, 530], 54, { bodySize: 17 });
  box(ctx, 92, 560, 600, 170, "学习重点", [
    "EB 里启用了两个 CanController，但 Mcu 里把 FlexCAN_0..5 的门控都打开了。",
    "判断驱动实际用哪个硬件实例，要看 CanController 的 CanHwChannel 和生成代码里的 Controller Offset。"
  ], palette.blue, { bodySize: 20, lineGap: 30 });
  box(ctx, 810, 560, 600, 170, "当前工程结论", [
    "CanController_0 -> FLEXCAN_1 -> CAN_1 base 0x4030_8000 -> PTC8/9。",
    "CanController_1 -> FLEXCAN_2 -> CAN_2 base 0x4030_C000 -> PTC7/6。"
  ], palette.green, { bodySize: 20, lineGap: 30 });
  save(c, "s32k324_flexcan_instances.png");
}

function drawDriverStack() {
  const { c, ctx } = makeCanvas(1500, 1000);
  label(ctx, "CAN Driver 调用链", 48, 34, 34, palette.ink, 700);
  label(ctx, "把 AUTOSAR API、NXP IPW、FlexCAN IP 和硬件寄存器对应起来。", 48, 82, 20, palette.muted);
  const x = 92;
  const w = 1310;
  const rows = [
    ["应用/BSW 上层", "CanIf_Transmit / CanIf_SetControllerMode", "请求发送或切换控制器状态"],
    ["CAN Driver API", "Can_43_FLEXCAN_Init / Write / SetBaudrate", "AUTOSAR Can module 对外接口"],
    ["IP Wrapper", "Can_43_FLEXCAN_Ipw_*", "把 HOH、Controller、Baudrate 转成 FlexCAN_Ip 参数"],
    ["FlexCAN IP", "FlexCAN_Ip_Init / Send / Receive / SetStartMode", "写 MCR、CTRL1、CBT/FDCBT、FDCTRL、IMASK/IFLAG、MB"],
    ["硬件", "CAN_1 / CAN_2 registers + MB RAM", "协议引擎收发 CAN/CAN FD frame"],
    ["回调边界", "CanIf_RxIndication / TxConfirmation / ControllerBusOff", "驱动把事件通知回 CanIf"],
  ];
  drawTable(ctx, x, 140, ["层级", "关键接口/文件", "作用"], rows, [230, 430, 650], 70, { bodySize: 18, maxCellLines: 3 });
  box(ctx, 150, 670, 520, 180, "初始化方向", ["Can_Init(&Can_43_FLEXCAN_Config)", "-> 每个 Controller 调 FlexCAN_Ip_Init", "-> 配置 baudrate / payload / MB / interrupt"], palette.blue, { bodySize: 20, lineGap: 30 });
  box(ctx, 830, 670, 520, 180, "运行方向", ["Can_Write(Hth, PduInfo)", "-> FlexCAN_Ip_Send 写 TX MB", "-> IRQ 回调 TxConfirmation / RxIndication"], palette.teal, { bodySize: 20, lineGap: 30 });
  arrow(ctx, 670, 760, 830, 760);
  save(c, "can_driver_stack.png");
}

function drawEbControllerOverview() {
  const { c, ctx } = makeCanvas(1500, 900);
  label(ctx, "EB CanController 配置总览", 48, 34, 34, palette.ink, 700);
  label(ctx, "来源：BasicSoftware/integration/mcal/MCAL_Cfg/config/Can_43_FLEXCAN.xdm 与生成代码。", 48, 82, 20, palette.muted);
  drawTable(ctx, 58, 130, ["EB Controller", "HW", "Base", "模式", "处理方式", "HOH"], [
    ["CanController_0", "FLEXCAN_1", "0x4030_8000", "CAN FD ISO + BRS", "Rx/Tx/BusOff = INTERRUPT", "15 Rx + 4 Tx"],
    ["CanController_1", "FLEXCAN_2", "0x4030_C000", "Classical CAN", "Rx/Tx/BusOff = INTERRUPT", "1 Rx + 1 Tx"],
  ], [230, 170, 210, 280, 350, 220], 62, { bodySize: 18 });
  box(ctx, 78, 330, 410, 180, "公共配置", ["PostBuild Variant", "CanAutoBusOffRecovery = true", "CanWakeupSupport = false", "Loopback = false", "CanClockFromBus = true"], palette.navy, { bodySize: 19 });
  box(ctx, 545, 330, 410, 180, "Controller_0 特点", ["CanControllerFdISO = true", "FD enable = true", "Tx Bit Rate Switch = true", "Payload blocks = 64 / 32 / 8"], palette.blue, { bodySize: 19 });
  box(ctx, 1010, 330, 410, 180, "Controller_1 特点", ["CanControllerFdISO = false", "FD enable = false", "Tx Bit Rate Switch = false", "Payload blocks = 8 / 8 / 8"], palette.green, { bodySize: 19 });
  box(ctx, 220, 630, 1060, 120, "一句话", ["这个工程把 CAN1 做成 500 kbit/s 仲裁段 + 2 Mbit/s 数据段的 CAN FD 通道；CAN2 是 500 kbit/s Classical CAN 通道。"], palette.orange, { bodySize: 22, lineGap: 30 });
  save(c, "eb_can_controller_overview.png");
}

function drawBitTiming() {
  const { c, ctx } = makeCanvas(1500, 1050);
  label(ctx, "EB Bit Timing 与生成代码对照", 48, 34, 34, palette.ink, 700);
  label(ctx, "当前两个控制器都引用 FLEXCAN_PE_CLK0_2 = 40 MHz。生成代码里的字段通常是寄存器编码值，比 EB 显示的实际段长小 1。", 48, 82, 19, palette.muted);
  drawTable(ctx, 58, 135, ["项目", "Controller_0 / CAN FD", "Controller_1 / Classical"], [
    ["Nominal rate", "500 kbit/s", "500 kbit/s"],
    ["EB 段值", "Presc=5, Prop=9, Seg1=3, Seg2=3, SJW=2", "Presc=5, Prop=7, Seg1=4, Seg2=4, SJW=2"],
    ["TQ / bit", "1 + 9 + 3 + 3 = 16", "1 + 7 + 4 + 4 = 16"],
    ["Bit time", "40 MHz / 5 / 16 = 500 kbit/s", "40 MHz / 5 / 16 = 500 kbit/s"],
    ["Sample point", "(1 + 9 + 3) / 16 = 81.25%", "(1 + 7 + 4) / 16 = 75%"],
    ["Data phase", "2 Mbit/s: Presc=1, Prop=11, Seg1=4, Seg2=4", "未启用 FD data phase"],
    ["Data sample point", "(1 + 11 + 4) / 20 = 80%", "-"],
    ["TDC", "Enable=true, Offset=17", "false"],
  ], [220, 620, 620], 58, { bodySize: 18, maxCellLines: 2 });
  box(ctx, 100, 690, 580, 180, "手册公式", [
    "Tq = (PRESDIV + 1) / fCANCLK",
    "BitRate = fCANCLK / Prescaler / TQ_per_bit",
    "CAN FD BRS 使用第二套 data phase bit timing"
  ], palette.blue, { bodySize: 21, lineGap: 32 });
  box(ctx, 820, 690, 580, 180, "调试提醒", [
    "500k 能通不代表 2M data phase 一定稳定。",
    "CAN FD + BRS 出错时重点看 data phase、TDC、收发器环路延迟和采样点。"
  ], palette.red, { bodySize: 21, lineGap: 32 });
  save(c, "eb_bit_timing.png");
}

function drawHohSummary() {
  const { c, ctx } = makeCanvas(1500, 1000);
  label(ctx, "EB Hardware Object / Mailbox 分配", 48, 34, 34, palette.ink, 700);
  label(ctx, "HOH 是 AUTOSAR Can Driver 的收发对象；在 FlexCAN 里最终落到具体 Message Buffer。", 48, 82, 20, palette.muted);
  drawTable(ctx, 58, 130, ["Controller", "Rx HOH", "Tx HTH", "Payload", "Polling", "实际 MB"], [
    ["CanController_0 / FLEXCAN_1", "15", "4", "Rx: 32/64, Tx: 32", "false", "Rx MB0..14, Tx MB15..18"],
    ["CanController_1 / FLEXCAN_2", "1", "1", "Rx/Tx: 8", "false", "Rx MB0, Tx MB1"],
  ], [330, 140, 140, 310, 170, 360], 62, { bodySize: 18 });
  drawTable(ctx, 78, 340, ["对象范围", "用途", "MB index", "Payload", "典型 ID/filter"], [
    ["Obj 0..2", "CAN1 Rx", "MB7..9", "32", "0x1D2, 0x3B5, 0x193"],
    ["Obj 3..5", "CAN1 Rx", "MB0..2", "64", "0x192, 0x191, 0x110"],
    ["Obj 6..14", "CAN1 Rx", "MB10, MB3..6, MB11..14", "32/64", "0x11A, 0x11F, 0x5E2, 0x341..."],
    ["Obj 15", "CAN2 Rx", "MB0", "8", "0x332"],
    ["Obj 16..19", "CAN1 Tx", "MB15..18", "32", "Tx HTH，无 Rx filter"],
    ["Obj 20", "CAN2 Tx", "MB1", "8", "Tx HTH，无 Rx filter"],
  ], [220, 180, 350, 130, 500], 62, { bodySize: 17, maxCellLines: 2 });
  box(ctx, 180, 795, 1140, 100, "为什么 CAN1 的 MB index 不是按 HOH 顺序连续？", [
    "因为 CAN FD payload 分区会改变每个 MB 占用的 RAM 大小；生成代码按实际地址和 payload block 排布 MB。学习时看 Can_aHwObjectConfig 的 Buffer Index 和 Can_au32HwBufferAddr。"
  ], palette.orange, { bodySize: 20, lineGap: 30 });
  save(c, "eb_hardware_objects.png");
}

function drawMailboxMap() {
  const { c, ctx } = makeCanvas(1500, 1160);
  label(ctx, "当前工程 Mailbox 明细速查", 48, 34, 34, palette.ink, 700);
  label(ctx, "来源：Can_43_FLEXCAN_PBcfg.c，过滤码为标准 ID，mask 为生成代码值。", 48, 82, 20, palette.muted);
  drawTable(ctx, 40, 130, ["Obj", "Controller", "Dir", "MB", "PL", "Filter/用途"], [
    ["0", "CAN1", "Rx", "7", "32", "0x1D2"],
    ["1", "CAN1", "Rx", "8", "32", "0x3B5"],
    ["2", "CAN1", "Rx", "9", "32", "0x193"],
    ["3", "CAN1", "Rx", "0", "64", "0x192"],
    ["4", "CAN1", "Rx", "1", "64", "0x191"],
    ["5", "CAN1", "Rx", "2", "64", "0x110"],
    ["6", "CAN1", "Rx", "10", "32", "0x11A"],
    ["7", "CAN1", "Rx", "3", "64", "0x11F"],
    ["8", "CAN1", "Rx", "11", "32", "0x5E2"],
    ["9", "CAN1", "Rx", "4", "64", "0x341"],
    ["10", "CAN1", "Rx", "5", "64", "0x11E"],
    ["11", "CAN1", "Rx", "6", "64", "0x117"],
    ["12", "CAN1", "Rx", "12", "32", "0x677"],
    ["13", "CAN1", "Rx", "13", "32", "0x7DF"],
    ["14", "CAN1", "Rx", "14", "32", "0x72B"],
    ["15", "CAN2", "Rx", "0", "8", "0x332"],
    ["16..19", "CAN1", "Tx", "15..18", "32", "HTH"],
    ["20", "CAN2", "Tx", "1", "8", "HTH"],
  ], [80, 140, 90, 90, 90, 1020], 48, { bodySize: 16, maxCellLines: 1 });
  save(c, "eb_mailbox_map.png");
}

function drawPortPins() {
  const { c, ctx } = makeCanvas(1500, 880);
  label(ctx, "EB Port 引脚配置：CAN1 / CAN2", 48, 34, 34, palette.ink, 700);
  label(ctx, "FlexCAN 驱动能否收发，除了 Can.xdm，还必须看 Port.xdm 的 SIUL2 pin mux。", 48, 82, 20, palette.muted);
  drawTable(ctx, 58, 130, ["信号", "Pin config", "PortPinId", "PCR", "方向", "PortPinMode"], [
    ["CAN2_RXD", "PTC6_CAN2_RXD", "20", "70", "IN", "CAN2_CAN2_RX_IN"],
    ["CAN2_TXD", "PTC7_CAN2_TXD", "21", "71", "OUT", "CAN2_CAN2_TX_OUT"],
    ["CAN1_TXD", "PTC8_CAN1_TXD", "22", "72", "OUT", "CAN1_CAN1_TX_OUT"],
    ["CAN1_RXD", "PTC9_CAN1_RXD", "23", "73", "IN", "CAN1_CAN1_RX_IN"],
  ], [170, 270, 150, 110, 110, 520], 62, { bodySize: 18 });
  box(ctx, 115, 460, 560, 160, "和 Controller 的对应关系", [
    "CanController_0 -> FLEXCAN_1 -> CAN1_TX/RX -> PTC8/PTC9",
    "CanController_1 -> FLEXCAN_2 -> CAN2_TX/RX -> PTC7/PTC6"
  ], palette.blue, { bodySize: 21, lineGap: 34 });
  box(ctx, 825, 460, 560, 160, "板级调试提醒", [
    "MCU pin mux 只到 TXD/RXD 逻辑脚。",
    "总线是否真的工作，还要检查外部 CAN transceiver、STB/EN、终端电阻和供电。"
  ], palette.green, { bodySize: 21, lineGap: 34 });
  save(c, "eb_port_pins.png");
}

function drawRegisterMap() {
  const { c, ctx } = makeCanvas(1500, 1000);
  label(ctx, "FlexCAN 寄存器学习地图", 48, 34, 34, palette.ink, 700);
  label(ctx, "不是背所有寄存器，而是知道调试时先看哪几类。", 48, 82, 20, palette.muted);
  drawTable(ctx, 58, 130, ["Offset", "Register", "驱动/调试意义"], [
    ["0x000", "MCR", "MDIS/FRZ/HALT/FDEN/MAXMB，进入配置模式、打开 FD、定义 MB 范围"],
    ["0x004", "CTRL1", "Nominal bit timing、Loopback、ListenOnly、BusOff/Error interrupt mask"],
    ["0x01C", "ECR", "TX/RX error counter，判断 Error Active/Passive/BusOff"],
    ["0x020", "ESR1", "BusOff、Error、ACK/CRC/Form/Stuff/Bit error 状态"],
    ["0x028/0x024", "IMASK1/2", "每个 MB 的 interrupt enable"],
    ["0x030/0x02C", "IFLAG1/2", "每个 MB 的 interrupt flag，W1C 清除"],
    ["0x050", "CBT", "扩展 nominal bit timing，CAN FD 时建议使用"],
    ["0x0C00", "FDCTRL", "FDRATE、MB payload partition、TDC"],
    ["0x0C04", "FDCBT", "CAN FD data phase bit timing"],
    ["0x080+", "Message Buffers", "CS/ID/Data，Tx/Rx 真正的数据结构"],
    ["0x880+", "RXIMR", "每个 Rx MB 的 individual mask"],
  ], [170, 220, 970], 58, { bodySize: 17, maxCellLines: 2 });
  box(ctx, 160, 830, 1180, 92, "调试顺序建议", ["先看 MCR 是否不在 Freeze/Disable，再看 ESR1/ECR 总线状态，最后看 IFLAG/IMASK/MB 是否有具体收发事件。"], palette.orange, { bodySize: 21 });
  save(c, "can_register_map.png");
}

function drawMbStructure() {
  const { c, ctx } = makeCanvas(1500, 920);
  label(ctx, "FlexCAN Message Buffer 结构", 48, 34, 34, palette.ink, 700);
  label(ctx, "每个 HOH 最终都落到一个 MB：Control/Status、ID、Data。CAN FD 时 MB 大小随 payload 改变。", 48, 82, 20, palette.muted);
  const x = 140;
  const y = 160;
  const w = 1220;
  const rowH = 78;
  const rows = [
    ["0x00", "CS word", "EDL / BRS / ESI / CODE / IDE / RTR / DLC / TIMESTAMP"],
    ["0x04", "ID word", "标准 ID 使用 ID[28:18]；扩展 ID 使用 29 bit"],
    ["0x08", "DATA[0..7]", "Classical CAN 最大 8 字节；FD 可继续扩展"],
    ["0x10+", "DATA[8..63]", "仅 payload 配置为 16/32/64 时存在"],
  ];
  drawTable(ctx, x, y, ["Offset", "区域", "含义"], rows, [160, 260, 800], rowH, { bodySize: 19, maxCellLines: 2 });
  box(ctx, 150, 575, 540, 180, "RX CODE", ["EMPTY: 可接收", "FULL: 已收到，CPU 可读", "OVERRUN: 未及时服务被覆盖", "BUSY: FlexCAN 正在更新，CPU 等待"], palette.green, { bodySize: 20, lineGap: 31 });
  box(ctx, 820, 575, 540, 180, "TX CODE", ["INACTIVE: 不参与仲裁", "DATA: 发送数据帧", "ABORT: 请求安全终止", "TANSWER: 远程应答相关"], palette.blue, { bodySize: 20, lineGap: 31 });
  save(c, "flexcan_mb_structure.png");
}

function drawTxFlow() {
  const { c, ctx } = makeCanvas(1500, 920);
  label(ctx, "CAN Driver 发送路径", 48, 34, 34, palette.ink, 700);
  label(ctx, "结合 RM Transmission process 和当前 NXP MCAL 调用链。", 48, 82, 20, palette.muted);
  const xs = [80, 350, 620, 890, 1160];
  const titles = ["CanIf", "Can Driver", "IPW", "FlexCAN_Ip", "Hardware"];
  const bodies = [
    ["CanIf_Transmit", "传入 HTH/PDU"],
    ["Can_43_FLEXCAN_Write", "检查 controller/HTH", "保存 TxPduId"],
    ["Can_43_FLEXCAN_Ipw_Write", "选择 HwObject", "构造 DataInfo"],
    ["FlexCAN_Ip_Send", "写 ID/DATA/CS", "激活 TX MB"],
    ["TX arbitration", "发送成功置 IFLAG", "触发 IRQ"]
  ];
  for (let i = 0; i < xs.length; i++) {
    box(ctx, xs[i], 170, 220, 185, titles[i], bodies[i], [palette.violet, palette.blue, palette.teal, palette.green, palette.orange][i], { bodySize: 18 });
    if (i < xs.length - 1) arrow(ctx, xs[i] + 220, 260, xs[i + 1], 260);
  }
  box(ctx, 260, 500, 390, 170, "RM 关键点", ["MB_CS[CODE] 必须最后写", "发送成功后 IFLAG 置位", "IFLAG 清除后 MB 才能复用"], palette.navy, { bodySize: 20, lineGap: 31 });
  box(ctx, 850, 500, 390, 170, "工程关键点", ["CanTxProcessing = INTERRUPT", "TxConfirmation 由 IRQ 路径回调", "Polling support = STD_OFF"], palette.red, { bodySize: 20, lineGap: 31 });
  save(c, "can_tx_flow.png");
}

function drawRxFlow() {
  const { c, ctx } = makeCanvas(1500, 960);
  label(ctx, "CAN Driver 接收路径", 48, 34, 34, palette.ink, 700);
  label(ctx, "当前工程使用 Rx message buffer，不使用 Legacy FIFO；CAN1 支持 FD payload，CAN2 为 8 字节 classical。", 48, 82, 20, palette.muted);
  const xs = [80, 350, 620, 890, 1160];
  const titles = ["CAN bus", "FlexCAN PE", "MB RAM", "IPW callback", "CanIf"];
  const bodies = [
    ["收到 frame", "ID/RTR/IDE 匹配"],
    ["RX matching", "move-in", "置 IFLAG"],
    ["CS/ID/DATA 更新", "CPU 读 CS 锁 MB", "读 TIMER 解锁"],
    ["Can_43_FLEXCAN_Ipw", "转换 Can_HwType", "拷贝 payload"],
    ["CanIf_RxIndication", "上报 HRH/PduInfo"]
  ];
  for (let i = 0; i < xs.length; i++) {
    box(ctx, xs[i], 160, 220, 200, titles[i], bodies[i], [palette.green, palette.teal, palette.blue, palette.orange, palette.violet][i], { bodySize: 18 });
    if (i < xs.length - 1) arrow(ctx, xs[i] + 220, 260, xs[i + 1], 260);
  }
  box(ctx, 140, 505, 560, 185, "RM 推荐读 RX MB 顺序", ["1. 读 Control/Status word", "2. 确认 BUSY = 0", "3. 读 ID + DATA", "4. 清 IFLAG", "5. 读 TIMER 解锁"], palette.blue, { bodySize: 20, lineGap: 30 });
  box(ctx, 825, 505, 560, 185, "不要这样做", ["不要靠轮询 CODE 判断是否收到", "不要读完后随手写 EMPTY", "不要长期锁住 RX MB，否则可能丢帧"], palette.red, { bodySize: 20, lineGap: 30 });
  save(c, "can_rx_flow.png");
}

function drawIrqFlow() {
  const { c, ctx } = makeCanvas(1500, 900);
  label(ctx, "FlexCAN 中断路径", 48, 34, 34, palette.ink, 700);
  label(ctx, "当前工程 Rx/Tx/BusOff 都配置为 INTERRUPT，因此 MainFunction_Read/Write 不是主路径。", 48, 82, 20, palette.muted);
  box(ctx, 80, 160, 310, 150, "硬件事件", ["MB IFLAG set", "ESR1 BusOff/Error", "Warning/Error Fast"], palette.orange);
  box(ctx, 500, 160, 310, 150, "FlexCAN_Ip IRQ", ["读取 IFLAG/ESR1", "识别 MB index", "清 W1C flag"], palette.teal);
  box(ctx, 920, 160, 310, 150, "Can_43_FLEXCAN IRQ", ["CommonIrqCallback", "ErrorIrqCallback", "映射 Controller/HOH"], palette.blue);
  box(ctx, 520, 445, 410, 150, "CanIf 回调", ["CanIf_RxIndication", "CanIf_TxConfirmation", "CanIf_ControllerBusOff"], palette.violet);
  arrow(ctx, 390, 235, 500, 235);
  arrow(ctx, 810, 235, 920, 235);
  arrow(ctx, 1075, 310, 800, 445);
  box(ctx, 135, 665, 1180, 110, "W1C 注意", ["RM 明确提醒：清 IFLAG 时只清本次处理的 bit，不要用会读改写整寄存器的方式误清其它新来的中断。"], palette.red, { bodySize: 22 });
  save(c, "can_irq_flow.png");
}

function drawCanFdBRS() {
  const { c, ctx } = makeCanvas(1500, 880);
  label(ctx, "CAN FD / BRS / TDC 在当前工程里的位置", 48, 34, 34, palette.ink, 700);
  label(ctx, "CanController_0 开启 CAN FD + BRS；CanController_1 没开 FD。", 48, 82, 20, palette.muted);
  const x = 100;
  const y = 190;
  const widths = [180, 260, 260, 260, 260];
  drawTable(ctx, x, y, ["帧阶段", "SOF~BRS", "BRS 后数据段", "CRC delimiter 后", "工程配置"], [
    ["速率", "Nominal 500k", "Data 2M", "回到 500k", "FDRATE/BRS=true"],
    ["寄存器", "CBT/CTRL1", "FDCBT", "CBT/CTRL1", "FDCTRL + FDCBT"],
    ["采样", "普通 sample point", "需要 TDC/SSP", "普通 sample point", "TDC offset=17"],
  ], widths, 62, { bodySize: 18 });
  box(ctx, 160, 500, 480, 160, "为什么需要 TDC", ["BRS 后数据位时间变短", "收发器环路延迟可能超过普通采样点", "TDC 用 secondary sample point 比较 TX/RX"], palette.red, { bodySize: 20, lineGap: 31 });
  box(ctx, 860, 500, 480, 160, "工程落点", ["FD enable = true", "Tx Bit Rate Switch = true", "Transceiver Delay Enable = true", "Offset = 17"], palette.green, { bodySize: 20, lineGap: 31 });
  save(c, "can_fd_brs_tdc.png");
}

function drawDebugFlow() {
  const { c, ctx } = makeCanvas(1500, 1020);
  label(ctx, "FlexCAN 驱动调试流程", 48, 34, 34, palette.ink, 700);
  label(ctx, "适合 CAN 不通、只能发不能收、CAN FD 数据段出错、BusOff 等问题。", 48, 82, 20, palette.muted);
  const steps = [
    ["1. 时钟", "Mcu clock: FLEXCAN_PE_CLK0_2 = 40 MHz；FlexCAN_1/2 peripheral gate = true"],
    ["2. 引脚", "Port.xdm: PTC8/9 = CAN1 TX/RX；PTC7/6 = CAN2 TX/RX"],
    ["3. 控制器状态", "Can_Init 后 SetControllerMode STARTED；MCR 不应停在 MDIS/FRZ/HALT"],
    ["4. 位时序", "500k nominal；CAN1 data phase 2M；采样点、SJW、TDC 与对端一致"],
    ["5. MB/HOH", "HTH/HRH 是否映射到正确 Controller；Rx filter/mask 是否允许目标 ID"],
    ["6. 中断", "IMASK/IFLAG、NVIC、Can_43_FLEXCAN_Irq 是否进来；CanIf 回调是否触发"],
    ["7. 错误状态", "读 ECR/ESR1：ACKERR 常见于无对端/收发器未使能/终端异常"],
  ];
  drawTable(ctx, 72, 130, ["步骤", "检查点"], steps, [160, 1190], 74, { bodySize: 19, maxCellLines: 3 });
  box(ctx, 180, 755, 1140, 130, "高频坑", ["CAN FD 通道用 Classical 工具收普通 8 字节帧可能能看到，但 BRS 数据段不一定能稳定；要确认分析仪和对端都支持同样的 FD ISO/BRS/bit timing。"], palette.orange, { bodySize: 21, lineGap: 32 });
  save(c, "can_debug_flow.png");
}

function drawEbConfigPath() {
  const { c, ctx } = makeCanvas(1500, 860);
  label(ctx, "EB 配置到生成代码的路径", 48, 34, 34, palette.ink, 700);
  label(ctx, "学习 CAN Driver 时，要同时看 xdm、生成 C、驱动源码三层。", 48, 82, 20, palette.muted);
  box(ctx, 80, 170, 360, 135, "EB 配置", ["Can_43_FLEXCAN.xdm", "Mcu.xdm", "Port.xdm"], palette.blue);
  box(ctx, 570, 155, 360, 165, "生成配置", ["Can_43_FLEXCAN_Cfg.h", "Can_43_FLEXCAN_PBcfg.c", "Can_43_FLEXCAN_Ipw_PBcfg.c", "FlexCAN_Ip_PBcfg.c"], palette.teal);
  box(ctx, 1060, 170, 360, 135, "驱动源码", ["Can_43_FLEXCAN.c", "Can_43_FLEXCAN_Ipw.c", "FlexCAN_Ip.c"], palette.green);
  arrow(ctx, 440, 238, 570, 238);
  arrow(ctx, 930, 238, 1060, 238);
  box(ctx, 160, 500, 1180, 110, "最短阅读路线", [
    "Can_43_FLEXCAN.xdm 看 EB 意图；Can_43_FLEXCAN_PBcfg.c 看真实 HOH/MB/baudrate；FlexCAN_Ip_PBcfg.c 看底层 IP 配置。"
  ], palette.orange, { bodySize: 22, lineGap: 32 });
  save(c, "eb_configuration_path.png");
}

function drawGeneratedCodeRelation() {
  const { c, ctx } = makeCanvas(1500, 920);
  label(ctx, "生成代码中的关键结构关系", 48, 34, 34, palette.ink, 700);
  label(ctx, "Can_43_FLEXCAN_Config 是 Can_Init 的入口，里面把 Controller、HOH 和 IP 配置串起来。", 48, 82, 20, palette.muted);
  box(ctx, 100, 155, 340, 135, "Can_43_FLEXCAN_Config", ["Controller array", "CtrlOffset map", "HwObject map"], palette.violet);
  box(ctx, 570, 135, 340, 175, "Can_aControllerConfig", ["Ctrl0: offset 1, FLEXCAN_1_BASE", "Ctrl1: offset 2, FLEXCAN_2_BASE", "Baudrate pointer", "HwObject pointer list"], palette.blue);
  box(ctx, 1040, 155, 340, 135, "Can_aHwObjectConfig", ["21 个 HOH", "Rx/Tx type", "Payload length", "MB index/address"], palette.green);
  arrow(ctx, 440, 220, 570, 220);
  arrow(ctx, 910, 220, 1040, 220);
  box(ctx, 330, 470, 360, 150, "Can_43_FLEXCANIpwHwChannelConfig0", ["-> Flexcan_aCtrlConfigPB[0]", "FLEXCAN_1 IP config"], palette.teal);
  box(ctx, 810, 470, 360, 150, "Can_43_FLEXCANIpwHwChannelConfig1", ["-> Flexcan_aCtrlConfigPB[1]", "FLEXCAN_2 IP config"], palette.teal);
  arrow(ctx, 745, 310, 510, 470);
  arrow(ctx, 745, 310, 990, 470);
  box(ctx, 180, 740, 1140, 100, "记忆点", ["AUTOSAR 的 Controller ID 是 0/1；硬件 offset 是 1/2；所以 Controller_0 不是 CAN_0，而是 FLEXCAN_1。"], palette.red, { bodySize: 22 });
  save(c, "generated_code_relation.png");
}

function drawEbCodeExcerpts() {
  drawCodeImage("eb_xdm_controller0_excerpt.png", "EB CanController_0 摘录", "Can_43_FLEXCAN.xdm：FLEXCAN_1 / CAN FD / 500k + 2M", [
    "<d:ctr name=\"CanController_0\">",
    "  CanControllerActivation = true",
    "  CanControllerId = 0",
    "  CanHwChannel = FLEXCAN_1",
    "  CanRxProcessing = INTERRUPT",
    "  CanTxProcessing = INTERRUPT",
    "  CanBusoffProcessing = INTERRUPT",
    "  CanCpuClockRef = FLEXCAN_PE_CLK0_2",
    "  CanControllerFdISO = true",
    "  CanControllerBaudRate = 500.0",
    "  Prescaler = 5, PropSeg = 9, Seg1 = 3, Seg2 = 3, SJW = 2",
    "  CanControllerFdBaudRate = 2000.0",
    "  FdPrescaler = 1, PropSeg = 11, Seg1 = 4, Seg2 = 4, SJW = 2",
    "  CanControllerTxBitRateSwitch = true",
    "  CanControllerSspOffset = 17",
    "</d:ctr>"
  ]);
  drawCodeImage("eb_xdm_controller1_excerpt.png", "EB CanController_1 摘录", "Can_43_FLEXCAN.xdm：FLEXCAN_2 / Classical CAN / 500k", [
    "<d:ctr name=\"CanController_1\">",
    "  CanControllerActivation = true",
    "  CanControllerId = 1",
    "  CanHwChannel = FLEXCAN_2",
    "  CanRxProcessing = INTERRUPT",
    "  CanTxProcessing = INTERRUPT",
    "  CanBusoffProcessing = INTERRUPT",
    "  CanCpuClockRef = FLEXCAN_PE_CLK0_2",
    "  CanControllerFdISO = false",
    "  CanControllerBaudRate = 500.0",
    "  Prescaler = 5, PropSeg = 7, Seg1 = 4, Seg2 = 4, SJW = 2",
    "  CanControllerFdBaudrateConfig ENABLE = false",
    "</d:ctr>"
  ]);
  drawCodeImage("eb_mcu_clock_excerpt.png", "EB Mcu 时钟摘录", "Mcu.xdm：FlexCAN clock reference 与 peripheral gate", [
    "FLEXCAN_PE_CLK0_2.frequency = 4.0E7  // 40 MHz",
    "FLEXCAN_PE_CLK3_5.frequency = 1.2E7  // 12 MHz",
    "",
    "FlexCAN_0 gate = true, slot = PRTN1_COFB2_REQ65",
    "FlexCAN_1 gate = true, slot = PRTN1_COFB2_REQ66",
    "FlexCAN_2 gate = true, slot = PRTN1_COFB2_REQ67",
    "FlexCAN_3 gate = true, slot = PRTN1_COFB2_REQ68",
    "FlexCAN_4 gate = true, slot = PRTN1_COFB2_REQ69",
    "FlexCAN_5 gate = true, slot = PRTN1_COFB2_REQ70",
    "",
    "当前 CanController_0/1 都引用 FLEXCAN_PE_CLK0_2。"
  ]);
  drawCodeImage("eb_port_pins_excerpt.png", "EB Port 引脚摘录", "Port.xdm：CAN1/CAN2 pin mux", [
    "PTC6_CAN2_RXD: PortPinId=20, PCR=70, Direction=IN,  Mode=CAN2_CAN2_RX_IN",
    "PTC7_CAN2_TXD: PortPinId=21, PCR=71, Direction=OUT, Mode=CAN2_CAN2_TX_OUT",
    "PTC8_CAN1_TXD: PortPinId=22, PCR=72, Direction=OUT, Mode=CAN1_CAN1_TX_OUT",
    "PTC9_CAN1_RXD: PortPinId=23, PCR=73, Direction=IN,  Mode=CAN1_CAN1_RX_IN",
    "",
    "Controller_0 -> FLEXCAN_1 -> CAN1_TXD/CAN1_RXD -> PTC8/PTC9",
    "Controller_1 -> FLEXCAN_2 -> CAN2_TXD/CAN2_RXD -> PTC7/PTC6"
  ]);
  drawCodeImage("generated_pb_config_excerpt.png", "生成代码摘录", "Can_43_FLEXCAN_PBcfg.c / FlexCAN_Ip_PBcfg.c：真实运行配置", [
    "Can_aControllerConfig[0]:",
    "  Controller Offset = 1, Base = FLEXCAN_1_BASE, HwObject count = 19",
    "  Baudrate: nominal {8,2,2,4,1}, data {11,3,3,0,1}, TDC offset 17",
    "",
    "Can_aControllerConfig[1]:",
    "  Controller Offset = 2, Base = FLEXCAN_2_BASE, HwObject count = 2",
    "  Baudrate: nominal {6,3,3,4,1}, FD disabled",
    "",
    "Flexcan_aCtrlConfigPB[0]: FLEXCAN_1, max_num_mb=19, fd_enable=TRUE, bitRateSwitch=TRUE",
    "Flexcan_aCtrlConfigPB[1]: FLEXCAN_2, max_num_mb=2,  fd_enable=FALSE, bitRateSwitch=FALSE"
  ]);
}

async function main() {
  await renderPdfExcerptImages();
  drawArchitecture();
  drawInstances();
  drawDriverStack();
  drawEbControllerOverview();
  drawBitTiming();
  drawHohSummary();
  drawMailboxMap();
  drawPortPins();
  drawRegisterMap();
  drawMbStructure();
  drawTxFlow();
  drawRxFlow();
  drawIrqFlow();
  drawCanFdBRS();
  drawDebugFlow();
  drawEbConfigPath();
  drawGeneratedCodeRelation();
  drawEbCodeExcerpts();
  console.log(`Generated assets in ${outDir}`);
}

await main();
