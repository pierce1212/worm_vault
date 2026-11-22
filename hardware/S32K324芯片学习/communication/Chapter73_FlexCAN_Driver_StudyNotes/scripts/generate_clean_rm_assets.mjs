import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire("E:/github/.codex_tools/siul2_notes/package.json");
const { createCanvas } = require("@napi-rs/canvas");

const outDir = "E:/github/worm_vault/S32K324芯片学习/communication/Chapter73_FlexCAN_Driver_StudyNotes/assets";
fs.mkdirSync(outDir, { recursive: true });

const palette = {
  bg: "#f6f8fb",
  card: "#ffffff",
  ink: "#17212b",
  muted: "#566678",
  line: "#d8e0e8",
  blue: "#1f6f9f",
  teal: "#0f766e",
  green: "#2f7d32",
  orange: "#b45309",
  red: "#b42318",
  violet: "#6b5ca5",
  navy: "#334e68",
  paleBlue: "#e8f2fb",
  paleGreen: "#e8f5ee",
  paleAmber: "#fff3df",
  paleRed: "#fdebea",
};

const font = "Microsoft YaHei, Segoe UI, Arial, sans-serif";
const mono = "Consolas, Microsoft YaHei, monospace";

function canvas(width = 1500, height = 920) {
  const c = createCanvas(width, height);
  const ctx = c.getContext("2d");
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  return { c, ctx, width, height };
}

function save(c, name) {
  fs.writeFileSync(path.join(outDir, name), c.toBuffer("image/png"));
}

function text(ctx, value, x, y, size = 22, color = palette.ink, weight = 400, family = font) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillText(value, x, y);
}

function wrap(ctx, value, maxWidth) {
  const raw = String(value);
  const hasAsciiSpace = /\s/.test(raw);
  const tokens = hasAsciiSpace ? raw.replace(/\s+/g, " ").trim().split(" ") : Array.from(raw);
  const lines = [];
  let line = "";
  for (const token of tokens) {
    const sep = hasAsciiSpace ? " " : "";
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

function roundRect(ctx, x, y, w, h, r = 10) {
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

function card(ctx, x, y, w, h, title, lines = [], color = palette.blue, opts = {}) {
  ctx.save();
  roundRect(ctx, x, y, w, h, opts.radius ?? 8);
  ctx.fillStyle = opts.fill ?? palette.card;
  ctx.fill();
  ctx.lineWidth = opts.lineWidth ?? 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  text(ctx, title, x + 18, y + 16, opts.titleSize ?? 23, color, 700);
  ctx.font = `${opts.bodySize ?? 18}px ${font}`;
  ctx.fillStyle = palette.ink;
  let ty = y + (opts.bodyTop ?? 54);
  for (const line of lines) {
    for (const part of wrap(ctx, line, w - 36).slice(0, opts.maxLinesPerItem ?? 4)) {
      ctx.fillText(part, x + 18, ty);
      ty += opts.lineGap ?? 26;
    }
  }
  ctx.restore();
}

function header(ctx, title, page, subtitle = "结构化整理图，原文请对照 S32K3xx Reference Manual Rev.9") {
  text(ctx, title, 54, 34, 34, palette.ink, 700);
  text(ctx, `RM PDF page ${page}`, 56, 82, 20, palette.blue, 700);
  text(ctx, subtitle, 365, 82, 20, palette.muted, 400);
}

function footer(ctx, width, height, note = "说明：本图已替换原 OCR 摘录块，只保留学习需要的关键结论、页码和字段关系。") {
  ctx.fillStyle = "#eaf1f7";
  ctx.fillRect(54, height - 72, width - 108, 42);
  text(ctx, note, 76, height - 61, 18, palette.muted, 400);
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
  const a = Math.atan2(y2 - y1, x2 - x1);
  const len = 12;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - len * Math.cos(a - Math.PI / 6), y2 - len * Math.sin(a - Math.PI / 6));
  ctx.lineTo(x2 - len * Math.cos(a + Math.PI / 6), y2 - len * Math.sin(a + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function table(ctx, x, y, cols, rows, widths, rowH = 48, opts = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  ctx.save();
  ctx.font = `700 ${opts.headerSize ?? 18}px ${font}`;
  ctx.fillStyle = opts.headerFill ?? palette.paleBlue;
  ctx.fillRect(x, y, total, rowH);
  let cx = x;
  for (let i = 0; i < cols.length; i++) {
    ctx.strokeStyle = palette.line;
    ctx.strokeRect(cx, y, widths[i], rowH);
    text(ctx, cols[i], cx + 10, y + 13, opts.headerSize ?? 18, palette.ink, 700);
    cx += widths[i];
  }
  ctx.font = `${opts.bodySize ?? 17}px ${font}`;
  for (let r = 0; r < rows.length; r++) {
    const yy = y + rowH * (r + 1);
    ctx.fillStyle = r % 2 === 0 ? "#ffffff" : "#f2f5f8";
    ctx.fillRect(x, yy, total, rowH);
    cx = x;
    for (let i = 0; i < cols.length; i++) {
      ctx.strokeStyle = palette.line;
      ctx.strokeRect(cx, yy, widths[i], rowH);
      ctx.fillStyle = palette.ink;
      const parts = wrap(ctx, rows[r][i], widths[i] - 20).slice(0, opts.maxLines ?? 2);
      const startY = yy + Math.max(8, (rowH - parts.length * 21) / 2);
      for (let p = 0; p < parts.length; p++) {
        ctx.fillText(parts[p], cx + 10, startY + p * 21);
      }
      cx += widths[i];
    }
  }
  ctx.restore();
}

function timeline(ctx, items, x, y, w, h, colors = [palette.blue, palette.teal, palette.green, palette.orange]) {
  const gap = 24;
  const itemW = (w - gap * (items.length - 1)) / items.length;
  items.forEach((item, i) => {
    const ix = x + i * (itemW + gap);
    card(ctx, ix, y, itemW, h, item.title, item.lines, colors[i % colors.length], { bodySize: 17, titleSize: 22 });
    if (i < items.length - 1) arrow(ctx, ix + itemW, y + h / 2, ix + itemW + gap - 4, y + h / 2);
  });
}

function image3043() {
  const { c, ctx, width, height } = canvas();
  header(ctx, "Chapter 73 CAN (FlexCAN) 阅读地图", 3043);
  card(ctx, 60, 132, 410, 190, "这一章回答什么", [
    "S32K3xx FlexCAN 有哪些实例、能力和限制",
    "FlexCAN 怎么进入 Normal / Freeze / Disable",
    "CAN FD、bit timing、TDC、interrupt 怎么工作",
    "MCR / CTRL1 / FDCTRL / IFLAG / MB RAM 怎么理解",
  ], palette.blue);
  card(ctx, 545, 132, 410, 190, "学习 CAN Driver 时先看", [
    "实例能力表：确认 CAN_1/CAN_2 能力",
    "Clocks：确认 FlexCAN PE clock",
    "Message Buffer：理解 HOH/HTH/HRH",
    "Interrupt：对应 Rx/Tx/BusOff 回调",
  ], palette.teal);
  card(ctx, 1030, 132, 410, 190, "当前工程重点", [
    "CanController_0 -> FLEXCAN_1 / CAN_1",
    "CanController_1 -> FLEXCAN_2 / CAN_2",
    "CAN1: FD+BRS，500k + 2M",
    "CAN2: Classic CAN，500k",
  ], palette.green);
  table(ctx, 88, 392, ["RM 页码", "建议阅读内容", "和 EB/代码的对应关系"], [
    ["3044", "S32K324 FlexCAN 实例能力", "CanHwChannel、base address、MB 数"],
    ["3047", "RAM 初始化、MDIS 复位状态", "FlexCAN_Ip_Init、MCR[MDIS]"],
    ["3053/3057", "Tx/Rx message buffer 流程", "Can_Write、FlexCAN_Ip_Send/Receive"],
    ["3072/3189", "CAN FD、BRS、TDC", "FD enable、BRS、SspOffset"],
    ["3081", "Bit timing 公式和段结构", "Prescaler、PropSeg、Seg1、Seg2、SJW"],
    ["3094/3138", "Interrupt 和 IFLAG", "Rx/Tx/BusOff interrupt callback"],
  ], [140, 440, 700], 58, { bodySize: 18 });
  footer(ctx, width, height);
  save(c, "rm_excerpt_3043_ch73_start.png");
}

function image3044() {
  const { c, ctx, width, height } = canvas();
  header(ctx, "S32K324 FlexCAN 实例能力表", 3044);
  table(ctx, 70, 138, ["实例", "Base address", "最大 MB", "CAN FD", "Enhanced Rx FIFO", "当前工程"], [
    ["CAN_0", "0x4030_4000", "96", "支持", "支持，20 filter", "未作为 CanController"],
    ["CAN_1", "0x4030_8000", "64", "支持", "不支持", "CanController_0"],
    ["CAN_2", "0x4030_C000", "64", "支持", "不支持", "CanController_1"],
    ["CAN_3", "0x4031_0000", "32", "支持", "不支持", "未作为 CanController"],
    ["CAN_4", "0x4031_4000", "32", "支持", "不支持", "未作为 CanController"],
    ["CAN_5", "0x4031_8000", "32", "支持", "不支持", "未作为 CanController"],
  ], [150, 230, 150, 150, 260, 360], 64, { bodySize: 18 });
  card(ctx, 90, 610, 620, 155, "关键提醒", [
    "AUTOSAR 的 CanController_0 不是硬件 CAN_0。",
    "当前工程 CanController_0 映射到 FLEXCAN_1，CanController_1 映射到 FLEXCAN_2。",
  ], palette.red, { fill: palette.paleRed });
  card(ctx, 790, 610, 620, 155, "为什么要看这张表", [
    "MB 数和 FIFO 能力决定 EB 里 mailbox 能怎么分。",
    "CAN FD 支持能力决定能否配置 64-byte payload、BRS 和 TDC。",
  ], palette.blue, { fill: palette.paleBlue });
  footer(ctx, width, height);
  save(c, "rm_excerpt_3044_s32k324_instances.png");
}

function image3047() {
  const { c, ctx, width, height } = canvas();
  header(ctx, "FlexCAN RAM 初始化与 MDIS 复位状态", 3047);
  timeline(ctx, [
    { title: "Reset 后", lines: ["MCR[MDIS] = 1", "FlexCAN module disabled", "不能直接收发"] },
    { title: "初始化入口", lines: ["Can_Init", "FlexCAN_Ip_Init", "进入配置窗口"] },
    { title: "RAM 初始化", lines: ["初始化 MB RAM", "更新 parity bits", "避免未初始化 RAM 错误"] },
    { title: "启动通信", lines: ["配置 MCR/CTRL/FDCTRL", "配置 MB/filter/IMASK", "SetControllerMode START"] },
  ], 70, 155, 1360, 180, [palette.red, palette.blue, palette.teal, palette.green]);
  card(ctx, 85, 420, 635, 230, "手册页 3047 的学习结论", [
    "All FlexCAN memory must be initialized before starting operation。",
    "MDIS bit reset value is 1，所以复位后模块处于 disabled。",
    "CAN_CTRL2[WRMFRZ] 允许在 freeze 相关场景写需要初始化的 RAM 位置。",
    "用 MCAL 时不要绕过 FlexCAN_Ip_Init 自己直接 START。",
  ], palette.blue);
  card(ctx, 780, 420, 635, 230, "调试时怎么用", [
    "如果裸写寄存器或异常跳过初始化，优先怀疑 MB RAM 没初始化。",
    "如果 MCR[MDIS] 仍为 1，外设不会真正工作。",
    "如果 controller 无法 START，检查 clock gate、MDIS、FRZACK、NOTRDY。",
  ], palette.orange, { fill: palette.paleAmber });
  footer(ctx, width, height);
  save(c, "rm_excerpt_3047_memory_init_mdis.png");
}

function image3048() {
  const { c, ctx, width, height } = canvas();
  header(ctx, "FlexCAN Overview：硬件内部怎么分工", 3048);
  card(ctx, 90, 190, 300, 170, "BIU", ["Bus Interface Unit", "CPU/DMA 访问寄存器和 RAM", "输出 interrupt / DMA request"], palette.navy);
  card(ctx, 470, 170, 330, 210, "CHI", ["Controller Host Interface", "选择 Message Buffer", "处理 RX matching", "处理 TX arbitration"], palette.orange);
  card(ctx, 880, 190, 280, 170, "PE", ["Protocol Engine", "CAN/CAN FD 协议状态机", "error counter / bus off", "serial frame handling"], palette.red);
  card(ctx, 1220, 190, 220, 170, "MB RAM", ["CS word", "ID word", "DATA words", "RXIMR / timestamp"], palette.green);
  arrow(ctx, 390, 275, 470, 275);
  arrow(ctx, 800, 275, 880, 275);
  arrow(ctx, 1160, 275, 1220, 275);
  table(ctx, 100, 470, ["Driver 动作", "落到硬件哪里", "学习重点"], [
    ["Can_Write", "Tx MB + CHI", "写 ID/Data/CS，硬件仲裁发送"],
    ["RxIndication", "Rx MB + IFLAG", "读 MB，清 IFLAG，回调 CanIf"],
    ["SetControllerMode", "MCR/CTRL", "Normal / Freeze / Disable 状态切换"],
    ["SetBaudrate", "CTRL1/CBT/FDCTRL", "bit timing 必须在允许配置的状态写"],
  ], [290, 320, 650], 60, { bodySize: 18 });
  footer(ctx, width, height);
  save(c, "rm_excerpt_3048_overview_block.png");
}

function image3053() {
  const { c, ctx, width, height } = canvas();
  header(ctx, "TX Message Buffer 发送流程", 3053);
  timeline(ctx, [
    { title: "1. 上层请求", lines: ["CanIf 调 Can_Write", "传入 HTH + PDU"] },
    { title: "2. Driver 找邮箱", lines: ["HTH -> Tx HOH", "确定 controller / MB index"] },
    { title: "3. 写 Tx MB", lines: ["写 ID / DLC / DATA", "设置 CODE = transmit active"] },
    { title: "4. 硬件发送", lines: ["参与 CAN arbitration", "成功后置 IFLAG"] },
    { title: "5. 完成回调", lines: ["Tx interrupt", "CanIf_TxConfirmation"] },
  ], 58, 150, 1384, 165, [palette.violet, palette.blue, palette.teal, palette.orange, palette.green]);
  card(ctx, 100, 405, 600, 210, "TX 调试看什么", [
    "Can_Write 返回 E_OK / CAN_BUSY / E_NOT_OK。",
    "Tx MB CODE 是否进入 active。",
    "IFLAG 对应 bit 是否置位并被清除。",
    "CAN_TX 引脚是否有波形，CAN_RX 是否能回读 ACK。",
  ], palette.blue);
  card(ctx, 800, 405, 600, 210, "当前工程特征", [
    "CanTxProcessing = INTERRUPT。",
    "CAN1 有 4 个 Tx MB：MB15..MB18，payload 32。",
    "CAN2 有 1 个 Tx MB：MB1，payload 8。",
  ], palette.green);
  footer(ctx, width, height);
  save(c, "rm_excerpt_3053_tx_process.png");
}

function image3057() {
  const { c, ctx, width, height } = canvas();
  header(ctx, "RX Message Buffer 推荐读取顺序", 3057);
  timeline(ctx, [
    { title: "1. 读 CS", lines: ["锁定 Rx MB", "确认 BUSY = 0"] },
    { title: "2. 读 ID", lines: ["取得 Standard/Extended ID", "判断 IDE/RTR/FD"] },
    { title: "3. 读 DATA", lines: ["按 DLC / payload 读数据", "Classic 8B，FD 最高 64B"] },
    { title: "4. 清 IFLAG", lines: ["对应 bit 写 1 清", "W1C，不是写 0"] },
    { title: "5. 读 TIMER", lines: ["释放 MB lock", "允许硬件写下一帧"] },
  ], 58, 145, 1384, 170, [palette.blue, palette.teal, palette.green, palette.orange, palette.violet]);
  card(ctx, 95, 400, 630, 230, "不要这样做", [
    "不要只轮询 CODE 当作接收流程。",
    "不要没读 TIMER 就退出接收处理。",
    "不要把 IFLAG 当普通 R/W 位写 0 清。",
  ], palette.red, { fill: palette.paleRed });
  card(ctx, 785, 400, 630, 230, "Driver 里的对应结果", [
    "中断进入后由 FlexCAN_Ip/Ipw 读取 MB。",
    "组装 CanIf_Mailbox 和 CanIf_PduInfo。",
    "最后调用 CanIf_RxIndication。",
  ], palette.green, { fill: palette.paleGreen });
  footer(ctx, width, height);
  save(c, "rm_excerpt_3057_rx_process.png");
}

function image3072() {
  const { c, ctx, width, height } = canvas();
  header(ctx, "CAN FD Frame：EDL/FDF、BRS、ESI", 3072);
  table(ctx, 90, 145, ["项目", "Classic CAN", "CAN FD"], [
    ["Payload", "0..8 bytes", "0..64 bytes"],
    ["数据段速率", "与仲裁段相同", "BRS=1 时可切到 data bitrate"],
    ["关键控制位", "IDE / RTR / DLC", "FDF/EDL / BRS / ESI / DLC"],
    ["当前工程例子", "CanController_1", "CanController_0"],
  ], [250, 500, 610], 70, { bodySize: 20 });
  card(ctx, 110, 530, 380, 150, "FDF / EDL", ["表示 CAN FD frame", "Driver 需配置 FD enable"], palette.blue);
  card(ctx, 560, 530, 380, 150, "BRS", ["Bit Rate Switch", "仲裁段 500k，数据段 2M"], palette.orange);
  card(ctx, 1010, 530, 380, 150, "ESI", ["Error State Indicator", "反映发送节点 error state"], palette.teal);
  footer(ctx, width, height);
  save(c, "rm_excerpt_3072_can_fd.png");
}

function image3081() {
  const { c, ctx, width, height } = canvas();
  header(ctx, "CAN Bit Timing：Tq、Sample Point、Segments", 3081);
  card(ctx, 70, 140, 580, 210, "核心公式", [
    "bitrate = FlexCAN_PE_CLK / Prescaler / (1 + PropSeg + Seg1 + Seg2)",
    "Sample Point = (1 + PropSeg + Seg1) / Total Tq",
    "SJW 用于重新同步时允许调整的最大 Tq 数",
  ], palette.blue);
  card(ctx, 720, 140, 690, 210, "当前工程计算", [
    "CAN1 nominal: 40MHz / 5 / 16 = 500k，SP = 81.25%",
    "CAN1 data: 40MHz / 1 / 20 = 2M，SP = 80%",
    "CAN2 nominal: 40MHz / 5 / 16 = 500k，SP = 75%",
  ], palette.green);
  const y = 475;
  const x = 130;
  const parts = [
    ["SyncSeg", 120, palette.navy],
    ["PropSeg", 360, palette.blue],
    ["PhaseSeg1", 300, palette.teal],
    ["Sample", 24, palette.red],
    ["PhaseSeg2", 260, palette.orange],
  ];
  let cx = x;
  for (const [name, w, color] of parts) {
    ctx.fillStyle = color;
    ctx.fillRect(cx, y, w, 82);
    text(ctx, name, cx + 14, y + 25, 22, "#ffffff", 700);
    cx += w;
  }
  text(ctx, "一个 bit time = 多个 Time Quantum (Tq)", x, y - 50, 24, palette.ink, 700);
  text(ctx, "Sample Point 位于 PhaseSeg1 结束处，通常 75%..87.5% 左右按网络调。", x, y + 120, 22, palette.muted);
  footer(ctx, width, height);
  save(c, "rm_excerpt_3081_bit_timing.png");
}

function image3089() {
  const { c, ctx, width, height } = canvas();
  header(ctx, "FlexCAN Clocks：CHI/PE 时钟和 EB 对应", 3089);
  table(ctx, 95, 140, ["Clock reference", "频率", "覆盖实例", "当前工程"], [
    ["FLEXCAN_PE_CLK0_2", "40 MHz", "FlexCAN_0..2", "CAN1/CAN2 都引用"],
    ["FLEXCAN_PE_CLK3_5", "12 MHz", "FlexCAN_3..5", "当前未作为 CanController"],
    ["Peripheral clock gate", "MC_ME slot", "FlexCAN_0..5", "McuPeripheral 均 enable"],
  ], [310, 180, 300, 520], 70, { bodySize: 20 });
  card(ctx, 110, 500, 590, 185, "为什么时钟最先查", [
    "bit timing 全部基于 FlexCAN PE clock 计算。",
    "EB 里 prescaler/segments 正确，不代表时钟一定正确。",
    "改波特率前先确认 Mcu clock reference。",
  ], palette.blue);
  card(ctx, 800, 500, 590, 185, "调试判断", [
    "波特率偏一倍或固定比例偏差，优先怀疑 clock。",
    "寄存器配置没生效，检查 clock gate 和 module mode。",
    "CAN_1/CAN_2 当前都应按 40 MHz 算。",
  ], palette.orange, { fill: palette.paleAmber });
  footer(ctx, width, height);
  save(c, "rm_excerpt_3089_clock_restrictions.png");
}

function image3094() {
  const { c, ctx, width, height } = canvas();
  header(ctx, "FlexCAN Interrupt：MB、BusOff、Error、Warning", 3094);
  table(ctx, 90, 140, ["中断来源", "硬件标志/概念", "CAN Driver 结果"], [
    ["Rx MB complete", "IFLAG 对应 Rx MB bit", "读取 MB 后 CanIf_RxIndication"],
    ["Tx MB complete", "IFLAG 对应 Tx MB bit", "CanIf_TxConfirmation"],
    ["Bus Off", "Error counter 进入 bus-off", "CanIf_ControllerBusOff"],
    ["Error / Warning", "ESR、warning flag、error status", "Error callback 或状态处理"],
    ["Wakeup", "Wakeup flag", "当前工程不是重点"],
  ], [280, 450, 610], 62, { bodySize: 19 });
  card(ctx, 120, 570, 560, 150, "当前工程", [
    "CanRxProcessing = INTERRUPT",
    "CanTxProcessing = INTERRUPT",
    "CanBusoffProcessing = INTERRUPT",
  ], palette.green);
  card(ctx, 810, 570, 560, 150, "排查入口", [
    "进不了 ISR：看 IMASK、NVIC、routing。",
    "反复进 ISR：看 IFLAG 是否 W1C 清掉。",
  ], palette.red, { fill: palette.paleRed });
  footer(ctx, width, height);
  save(c, "rm_excerpt_3094_interrupts.png");
}

function image3106() {
  const { c, ctx, width, height } = canvas();
  header(ctx, "CAN Memory Map：S32K324 Base Address", 3106);
  table(ctx, 120, 145, ["实例", "Base address", "工程映射"], [
    ["CAN_0", "0x4030_4000", "未作为 AUTOSAR controller"],
    ["CAN_1", "0x4030_8000", "CanController_0 / FLEXCAN_1"],
    ["CAN_2", "0x4030_C000", "CanController_1 / FLEXCAN_2"],
    ["CAN_3", "0x4031_0000", "未使用"],
    ["CAN_4", "0x4031_4000", "未使用"],
    ["CAN_5", "0x4031_8000", "未使用"],
  ], [220, 360, 670], 64, { bodySize: 20 });
  card(ctx, 190, 640, 1120, 120, "记忆点", [
    "调试寄存器时先把 AUTOSAR Controller ID 转成硬件 offset：0 -> FLEXCAN_1，1 -> FLEXCAN_2。",
  ], palette.blue, { bodySize: 20 });
  footer(ctx, width, height);
  save(c, "rm_excerpt_3106_memory_map.png");
}

function image3109() {
  const { c, ctx, width, height } = canvas();
  header(ctx, "MCR：Module Configuration Register 速查", 3109);
  table(ctx, 80, 138, ["字段", "作用", "CAN Driver 学习重点"], [
    ["MDIS", "Module Disable", "复位后为 1，模块 disabled"],
    ["FRZ / HALT", "Freeze / halt 控制", "配置 bit timing、MB 前要进入合适状态"],
    ["FRZACK / NOTRDY", "状态反馈", "判断模式切换是否完成"],
    ["RFEN / IRMQ", "Rx FIFO / individual mask", "当前工程主要用 MB，不用 legacy FIFO"],
    ["FDEN", "CAN FD enable", "CAN1 需要开启，CAN2 不开启"],
    ["MAXMB", "最高使用 MB 编号", "和 EB max_num_mb / HOH 分配相关"],
  ], [220, 360, 760], 64, { bodySize: 19 });
  card(ctx, 160, 640, 1180, 110, "调试提示", [
    "如果 controller START 后仍不工作，先看 MDIS、HALT、FRZACK、NOTRDY，再看 CTRL1/FDCTRL。",
  ], palette.orange, { fill: palette.paleAmber, bodySize: 20 });
  footer(ctx, width, height);
  save(c, "rm_excerpt_3109_mcr.png");
}

function image3116() {
  const { c, ctx, width, height } = canvas();
  header(ctx, "CTRL1：Nominal Bit Timing 和基础控制位", 3116);
  table(ctx, 80, 140, ["字段", "含义", "EB 对应"], [
    ["PRESDIV", "分频得到 Time Quantum", "CanControllerPrescaller"],
    ["PROPSEG", "传播延迟补偿段", "CanControllerPropSeg"],
    ["PSEG1", "采样点前相位段", "CanControllerSeg1"],
    ["PSEG2", "采样点后相位段", "CanControllerSeg2"],
    ["RJW", "重同步跳转宽度", "CanControllerSyncJumpWidth"],
    ["LPB / LOM", "Loopback / Listen-only", "CanLoopBackMode、ListenOnly"],
    ["BOFFMSK / ERRMSK", "BusOff/Error interrupt mask", "BusOff/Error processing"],
  ], [230, 480, 610], 56, { bodySize: 18 });
  card(ctx, 135, 640, 1230, 110, "注意", [
    "生成代码里的字段通常是寄存器编码值，常见为实际 EB 值减 1；计算波特率时用 EB UI 的物理值。",
  ], palette.blue, { fill: palette.paleBlue, bodySize: 20 });
  footer(ctx, width, height);
  save(c, "rm_excerpt_3116_ctrl1.png");
}

function image3138() {
  const { c, ctx, width, height } = canvas();
  header(ctx, "IFLAG1：Message Buffer Interrupt Flag", 3138);
  card(ctx, 90, 145, 390, 190, "IFLAG1 是什么", [
    "每个 MB 有对应 interrupt flag bit。",
    "Rx complete / Tx complete 都会置位。",
    "配合 IMASK1 决定是否触发中断。",
  ], palette.blue);
  card(ctx, 555, 145, 390, 190, "W1C 规则", [
    "Write 1 Clear。",
    "要清某个 flag，就向对应 bit 写 1。",
    "写 0 不能清除该 flag。",
  ], palette.red, { fill: palette.paleRed });
  card(ctx, 1020, 145, 390, 190, "Rx 特别注意", [
    "先按顺序读取 MB。",
    "清 IFLAG。",
    "最后读 TIMER 释放锁。",
  ], palette.green, { fill: palette.paleGreen });
  timeline(ctx, [
    { title: "硬件置位", lines: ["MBn 完成收/发", "IFLAG1[n] = 1"] },
    { title: "中断处理", lines: ["Driver 判断 MB index", "读取或确认 PDU"] },
    { title: "清标志", lines: ["IFLAG1[n] 写 1", "避免重复进中断"] },
  ], 170, 465, 1160, 150, [palette.blue, palette.teal, palette.orange]);
  footer(ctx, width, height);
  save(c, "rm_excerpt_3138_iflag1.png");
}

function image3189() {
  const { c, ctx, width, height } = canvas();
  header(ctx, "FDCTRL：CAN FD、BRS、Payload、TDC", 3189);
  table(ctx, 80, 140, ["字段", "作用", "当前工程理解"], [
    ["FDRATE", "启用 data phase 更高速率", "CAN1 BRS=true，CAN2=false"],
    ["MBDSR", "定义 MB RAM block payload size", "CAN1: 64 / 32 / 8"],
    ["TDCEN", "Transceiver Delay Compensation enable", "CAN1 enabled"],
    ["TDCOFF", "TDC offset", "CAN1 offset = 17"],
    ["TDCVAL", "测得的 delay value", "调 FD 稳定性时关注"],
  ], [220, 470, 650], 66, { bodySize: 19 });
  card(ctx, 140, 570, 560, 145, "CAN FD 调试", [
    "仲裁段正常、数据段报错时，重点查 BRS/TDC/线束/transceiver。",
  ], palette.orange, { fill: palette.paleAmber });
  card(ctx, 800, 570, 560, 145, "EB 对应", [
    "CanControllerTxBitRateSwitch、CanControllerSspOffset、payload block。",
  ], palette.blue, { fill: palette.paleBlue });
  footer(ctx, width, height);
  save(c, "rm_excerpt_3189_fdctrl.png");
}

function image3214() {
  const { c, ctx, width, height } = canvas();
  header(ctx, "Message Buffer Structure：CS / ID / DATA", 3214);
  table(ctx, 120, 145, ["MB 区域", "保存内容", "Driver 使用场景"], [
    ["CS word", "CODE、DLC、IDE、RTR、FDF/EDL、BRS、timestamp", "判断邮箱状态，配置 Tx/Rx"],
    ["ID word", "Standard ID 或 Extended ID", "filter 匹配和 PDU id"],
    ["DATA words", "payload，Classic 最高 8B，FD 最高 64B", "PduInfo.sdu"],
    ["RXIMR / mask", "individual Rx mask", "控制 Rx filter 匹配"],
  ], [220, 620, 470], 78, { bodySize: 18, maxLines: 3 });
  card(ctx, 165, 600, 1170, 120, "读写方向", [
    "Tx：Driver 写 ID/DATA/CS，硬件发送；Rx：硬件写 MB，Driver 按推荐顺序读出并上报 CanIf。",
  ], palette.green, { fill: palette.paleGreen, bodySize: 20 });
  footer(ctx, width, height);
  save(c, "rm_excerpt_3214_mb_structure.png");
}

function image3220() {
  const { c, ctx, width, height } = canvas();
  header(ctx, "CAN FD RAM Partition：Payload 越大，MB 占用越多", 3220);
  table(ctx, 80, 135, ["Payload block", "含义", "当前 FLEXCAN_1 使用"], [
    ["Block 0", "每个 MB 可配置为 8/16/32/64 bytes", "64 bytes，当前 MB0..MB6"],
    ["Block 1", "第二段 MB RAM 的 payload size", "32 bytes，当前 MB7..MB18"],
    ["Block 2", "第三段 MB RAM 的 payload size", "8 bytes，当前未实际分配 HOH"],
  ], [250, 520, 590], 76, { bodySize: 19 });
  card(ctx, 110, 460, 590, 190, "为什么重要", [
    "CAN FD payload 不是只改 DLC。",
    "payload size 影响每个 MB 占用的 RAM 空间。",
    "payload 越大，可用 MB 数越少。",
  ], palette.red, { fill: palette.paleRed });
  card(ctx, 800, 460, 590, 190, "当前工程", [
    "CAN1: fd_enable TRUE，payload 64/32/8。",
    "CAN2: fd_enable FALSE，payload 8/8/8。",
    "HOH payload 要和上层 PDU DLC 匹配。",
  ], palette.blue, { fill: palette.paleBlue });
  footer(ctx, width, height);
  save(c, "rm_excerpt_3220_fd_partition.png");
}

[
  image3043,
  image3044,
  image3047,
  image3048,
  image3053,
  image3057,
  image3072,
  image3081,
  image3089,
  image3094,
  image3106,
  image3109,
  image3116,
  image3138,
  image3189,
  image3214,
  image3220,
].forEach((fn) => fn());

console.log(`Generated clean RM assets into ${outDir}`);
