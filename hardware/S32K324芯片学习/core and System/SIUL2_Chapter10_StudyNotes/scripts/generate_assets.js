const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const outDir = path.resolve(__dirname, "../assets");
fs.mkdirSync(outDir, { recursive: true });

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

async function svgToPng(name, svg, width = 1600) {
  const svgPath = path.join(outDir, `${name}.svg`);
  const pngPath = path.join(outDir, `${name}.png`);
  fs.writeFileSync(svgPath, svg, "utf8");
  await sharp(Buffer.from(svg)).resize({ width }).png().toFile(pngPath);
}

function svgBase(w, h, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 Z" fill="#334155"/>
    </marker>
    <style>
      .title{font:700 34px Arial, sans-serif; fill:#111827}
      .sub{font:400 20px Arial, sans-serif; fill:#475569}
      .box{fill:#f8fafc; stroke:#334155; stroke-width:2; rx:8}
      .box2{fill:#eef6ff; stroke:#2563eb; stroke-width:2; rx:8}
      .box3{fill:#fff7ed; stroke:#ea580c; stroke-width:2; rx:8}
      .box4{fill:#f0fdf4; stroke:#16a34a; stroke-width:2; rx:8}
      .box5{fill:#fef2f2; stroke:#dc2626; stroke-width:2; rx:8}
      .label{font:600 20px Arial, sans-serif; fill:#111827}
      .small{font:400 16px Arial, sans-serif; fill:#334155}
      .tiny{font:400 13px Consolas, monospace; fill:#334155}
      .code{font:400 16px Consolas, monospace; fill:#0f172a}
      .wire{stroke:#334155; stroke-width:2.2; fill:none; marker-end:url(#arrow)}
      .dash{stroke:#64748b; stroke-width:2; fill:none; stroke-dasharray:8 6; marker-end:url(#arrow)}
    </style>
  </defs>
  <rect width="100%" height="100%" fill="#ffffff"/>
  ${body}
</svg>`;
}

function textBlock(lines, x, y, cls = "small", dy = 24) {
  return lines
    .map((line, i) => `<text x="${x}" y="${y + i * dy}" class="${cls}">${esc(line)}</text>`)
    .join("\n");
}

function box(x, y, w, h, title, lines, cls = "box") {
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" class="${cls}"/>
  <text x="${x + 18}" y="${y + 34}" class="label">${esc(title)}</text>
  ${textBlock(lines, x + 18, y + 64, "small", 24)}
  `;
}

function arrow(x1, y1, x2, y2, cls = "wire") {
  return `<path d="M${x1},${y1} L${x2},${y2}" class="${cls}"/>`;
}

function codeCard(name, title, lines) {
  const width = 1480;
  const lineH = 28;
  const h = 96 + lines.length * lineH;
  const code = lines
    .map((line, i) => `<text x="64" y="${116 + i * lineH}" class="code">${esc(line)}</text>`)
    .join("\n");
  const svg = svgBase(
    width,
    h,
    `
    <text x="48" y="48" class="title">${esc(title)}</text>
    <rect x="48" y="76" width="${width - 96}" height="${h - 116}" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2" rx="8"/>
    ${code}
    `
  );
  return svgToPng(name, svg, width);
}

async function main() {
  await svgToPng(
    "siul2_overview",
    svgBase(
      1600,
      850,
      `
      <text x="56" y="58" class="title">SIUL2 总体位置</text>
      <text x="56" y="92" class="sub">System Integration Unit Lite2 负责 pad 电气控制、复用、GPIO 数据、外部中断/DMA 请求。</text>
      ${box(80, 170, 280, 130, "Pad / Pin", ["芯片外部引脚", "PTA/PTB/PTC..."], "box3")}
      ${box(470, 120, 620, 500, "SIUL2", ["MSCR: 每个 pad 的输出复用和电气属性", "IMCR: 外设输入信号从哪个 pad 进来", "GPDO/GPDI: 单 bit GPIO 输出/输入", "PGPDO/PGPDI: 16-bit 端口访问", "MPGPDO: mask + data 原子写"], "box2")}
      ${box(1220, 160, 260, 120, "IP Modules", ["CAN / LPSPI / ADC", "eMIOS / LPI2C ..."], "box4")}
      ${box(1220, 360, 260, 120, "Interrupt / DMA", ["EIRQ0..31", "DIRER/DISR/DIRSR"], "box5")}
      ${box(1220, 560, 260, 120, "CPU / MCAL", ["Port_Init()", "Dio_Read/Write"], "box")}
      ${arrow(360,235,470,235)}
      ${arrow(1090,220,1220,220)}
      ${arrow(1090,420,1220,420)}
      ${arrow(1220,620,1090,520)}
      ${arrow(470,520,360,235)}
      <text x="98" y="705" class="small">一句话：SIUL2 是“引脚矩阵 + GPIO 寄存器 + 外部中断前端”。</text>
      `
    )
  );

  await svgToPng(
    "mscr_imcr_model",
    svgBase(
      1600,
      900,
      `
      <text x="56" y="58" class="title">MSCR 与 IMCR 的职责分工</text>
      <text x="56" y="92" class="sub">输出看 MSCR 的 SSS/OBE，输入外设还要配置 IMCR 的 SSS。</text>
      ${box(90, 210, 300, 130, "Pad PTC8", ["物理引脚", "MSCR[72]"], "box3")}
      ${box(520, 160, 440, 230, "MSCR[n]", ["SSS[3:0]: 选择输出源", "OBE: 输出缓冲使能", "IBE: 输入缓冲使能", "PUE/PUS/PKE: 上下拉/保持", "DSE/SRC: 驱动/边沿特性"], "box2")}
      ${box(1120, 140, 340, 120, "外设输出", ["CAN1_TX", "eMIOS_CHx", "LPSPI_SOUT"], "box4")}
      ${box(1120, 420, 340, 120, "外设输入", ["CAN1_RX", "LPSPI_SIN", "EIRQn"], "box4")}
      ${box(520, 500, 440, 180, "IMCR[m]", ["SSS[3:0]: 选择输入来源", "IMCR 编号在手册 memory map 中独立编号", "IOMUX/EB 常把 CR512+ 映射成 IMCR"], "box")}
      ${arrow(1120,200,960,235)}
      ${arrow(520,275,390,275)}
      ${arrow(390,275,520,560)}
      ${arrow(960,590,1120,480)}
      <text x="105" y="725" class="small">输出路径：外设输出 -> MSCR.SSS -> pad。</text>
      <text x="105" y="755" class="small">输入路径：pad -> MSCR.IBE -> IMCR.SSS -> 外设输入。</text>
      <text x="105" y="785" class="small">纯 GPIO：MSCR 配为 GPIO，Dio 访问 GPDO/GPDI/PGPDO/PGPDI。</text>
      `
    )
  );

  await svgToPng(
    "mscr_bits",
    svgBase(
      1600,
      760,
      `
      <text x="56" y="58" class="title">MSCR 关键位速记</text>
      <text x="56" y="92" class="sub">以下字段以 S32K324_SIUL2.h 中的 bit mask 为依据；具体支持性仍以 IOMUX 和芯片章节说明为准。</text>
      <rect x="70" y="160" width="1460" height="90" fill="#f8fafc" stroke="#334155" stroke-width="2" rx="8"/>
      ${["31","24","21","19","17","16","14","13","11","8","6","5","3..0"].map((v,i)=>`<text x="${110+i*108}" y="145" class="tiny">${v}</text>`).join("")}
      ${[
        ["21","OBE","输出缓冲"],
        ["19","IBE","输入缓冲"],
        ["17","INV","输入/输出反相"],
        ["16","PKE","pull keep"],
        ["14","SRC","slew/边沿控制"],
        ["13","PUE","pull 使能"],
        ["11","PUS","上拉/下拉选择"],
        ["8","DSE","驱动强度"],
        ["6","IFE","输入滤波"],
        ["5","SMC","Safe mode"],
        ["3..0","SSS","输出源选择"]
      ].map((r,i)=>box(85+(i%4)*370, 290+Math.floor(i/4)*135, 330, 100, r[1]+"  bit "+r[0], [r[2]], i%2 ? "box" : "box2")).join("")}
      `
    )
  );

  await svgToPng(
    "gpio_register_access",
    svgBase(
      1600,
      860,
      `
      <text x="56" y="58" class="title">GPIO 数据寄存器访问模型</text>
      <text x="56" y="92" class="sub">SIUL2 同时支持单 pad 字节访问、16-bit 端口访问，以及 mask 写。</text>
      ${box(90, 190, 310, 140, "GPDO[n]", ["单个 pad 输出", "8/16/32-bit access", "PDO_n 只占 bit0"], "box2")}
      ${box(90, 430, 310, 140, "GPDI[n]", ["单个 pad 输入", "read only", "PDI_n 只占 bit0"], "box2")}
      ${box(520, 170, 360, 180, "PGPDO[x]", ["16-bit parallel output", "一个寄存器覆盖一组 16 个 pad", "工程中 PTA_L_HALF -> PGPDO0", "PTA_H_HALF -> PGPDO1"], "box3")}
      ${box(520, 430, 360, 180, "PGPDI[x]", ["16-bit parallel input", "Dio_ReadPort 可走这里", "注意端口 bit 顺序可能反向"], "box3")}
      ${box(1020, 260, 420, 220, "MPGPDO[x]", ["32-bit write only", "低 16 bit: 要写的数据", "高 16 bit: mask", "适合只改某几个 bit", "避免 read-modify-write"], "box4")}
      ${arrow(400,260,520,260)}
      ${arrow(400,500,520,500)}
      ${arrow(880,260,1020,340)}
      <text x="96" y="715" class="small">本工程 Dio_Cfg.h 中 DIO_REVERSED_MAPPING_OF_PORT_BITS_OVER_PORT_PINS = STD_ON，读端口/写端口时要留意 bit 与 pin 的映射方向。</text>
      `
    )
  );

  await svgToPng(
    "external_irq_flow",
    svgBase(
      1600,
      900,
      `
      <text x="56" y="58" class="title">外部中断 / DMA 请求路径</text>
      <text x="56" y="92" class="sub">EIRQ0..31 由 pad 输入进入 SIUL2，可选择中断或 DMA 请求。</text>
      ${box(80, 230, 230, 110, "Pad 输入", ["MSCR: IBE=1", "OBE=0"], "box3")}
      ${box(420, 170, 270, 110, "边沿选择", ["IREER0: rising", "IFEER0: falling"], "box2")}
      ${box(420, 370, 270, 130, "数字滤波", ["IFER0 enable", "IFMCRn max count", "IFCPR prescaler"], "box2")}
      ${box(810, 260, 270, 120, "状态与使能", ["DISR0: flag", "DIRER0: enable"], "box")}
      ${box(1190, 170, 300, 120, "Interrupt", ["进入中断控制器", "0..31 分 4 组"], "box5")}
      ${box(1190, 430, 300, 120, "DMA request", ["DIRSR0 选择 DMA", "EIRQ0..15 可 DMA"], "box4")}
      ${arrow(310,285,420,225)}
      ${arrow(310,285,420,435)}
      ${arrow(690,225,810,320)}
      ${arrow(690,435,810,320)}
      ${arrow(1080,320,1190,230)}
      ${arrow(1080,320,1190,490)}
      <text x="96" y="700" class="small">初始化顺序重点：先配置滤波和边沿，mask 中断，配置 MSCR 输入属性，清 DISR0 flag，最后使能 DIRER0。</text>
      <text x="96" y="730" class="small">手册提醒：若打开 IBE，pad 必须被主动驱动，否则 IO 状态可能不确定。</text>
      `
    )
  );

  await svgToPng(
    "eb_to_code_flow",
    svgBase(
      1600,
      820,
      `
      <text x="56" y="58" class="title">EB tresos / MCAL 配置到代码的链路</text>
      <text x="56" y="92" class="sub">当前工程的配置源在 MCAL_Cfg/config，生成代码在 integration/mcal/src/gen。</text>
      ${box(90, 180, 340, 150, "Port.xdm", ["PortPinDirection", "PortPinInitialMode", "PortPinMode", "PUE/PUS/DSE/IFE 等"], "box3")}
      ${box(90, 450, 340, 130, "Dio.xdm", ["DioPort", "DioChannel", "DioChannelId"], "box3")}
      ${box(560, 150, 380, 190, "Port_Cfg.h / Port_PBcfg.c", ["PortConf_PortPin_*", "Port_ConfigType", "MSCR/IMCR init arrays", "Port_Init() 使用"], "box2")}
      ${box(560, 440, 380, 160, "Dio_Cfg.h / Dio_Cfg.c", ["DioConf_DioChannel_*", "Port/Channel mapping", "可读/可写 pin mask"], "box2")}
      ${box(1080, 260, 360, 200, "SIUL2 IP layer", ["Siul2_Port_Ip_PBcfg.c", "Siul2_Dio_Ip_Cfg.h", "IP_SIUL2->MSCR/IMCR", "IP_SIUL2->PGPDO/PGPDI"], "box4")}
      ${arrow(430,255,560,245)}
      ${arrow(430,515,560,520)}
      ${arrow(940,245,1080,330)}
      ${arrow(940,520,1080,390)}
      <text x="96" y="700" class="small">学习 SIUL2 时，推荐从 EB 的 PortPin/DioChannel 追到生成代码，再回看手册寄存器字段。</text>
      `
    )
  );

  await codeCard("code_port_xdm_pta30", "EB Port.xdm 示例：PTA30_O_GPIO", [
    '<d:ctr name="PTA30_O_GPIO" type="IDENTIFIABLE">',
    '  <d:var name="PortPinPcr" type="INTEGER" value="30"/>',
    '  <d:var name="PortPinDirection" value="PORT_PIN_OUT"/>',
    '  <d:var name="PortPinInitialMode" value="PORT_GPIO_MODE"/>',
    '  <d:var name="PortPinMode" value="EMIOS_1_EMIOS_1_CH_13_H_OUT"/>',
    '  <d:var name="PortPinLevelValue" value="PORT_PIN_LEVEL_LOW"/>',
    '  <d:var name="PortPinPue" value="false"/>',
    '  <d:var name="PortPinPus" value="false"/>',
    '</d:ctr>',
  ]);

  await codeCard("code_dio_xdm_pta30", "EB Dio.xdm 示例：PTA30_Heating_SwControl", [
    '<d:ctr name="PTA30_Heating_SwControl" type="IDENTIFIABLE">',
    '  <d:var name="DioChannelId" type="INTEGER" value="14"/>',
    '  <d:var name="PDACSlot" value="VIRTUAL_WRAPPER_PDAC0"/>',
    '</d:ctr>',
    "",
    "生成后：DioConf_DioChannel_PTA30_Heating_SwControl = 0x001e",
    "含义：PTA high half port + pin index 14，对应 PTA30。",
  ]);

  await codeCard("code_generated_port_cfg", "生成代码示例：Port_Cfg.h / Siul2_Port_Ip_Cfg.h", [
    "#define PORT_NUM_SIUL2_INSTANCES_U8   ((uint8)1)",
    "#define PORT_SIUL2_0_NUM_IMCRS_U16    ((uint16)379)",
    "#define NUM_OF_CONFIGURED_PINS        97",
    "#define PORT_SET_PIN_DIRECTION_API    (STD_ON)",
    "#define PORT_SET_PIN_MODE_API         (STD_ON)",
    "#define PortConf_PortPin_PTA30_O_GPIO 54",
    "#define PortConf_PortPin_PTC8_CAN1_TXD 21",
    "#define PortConf_PortPin_PTC9_CAN1_RXD 22",
    "#define PortConf_PortPin_PTE4_O_GPIO  45",
  ]);

  await codeCard("code_siul2_pinmux_array", "生成代码示例：g_pin_mux_InitConfigArr", [
    "const Siul2_Port_Ip_PinSettingsConfig g_pin_mux_InitConfigArr[NUM_OF_CONFIGURED_PINS] =",
    "{",
    "  {",
    "    .base          = IP_SIUL2,",
    "    .pinPortIdx    = 2,",
    "    .mux           = PORT_MUX_AS_GPIO,",
    "    .inputBuffer   = PORT_INPUT_BUFFER_ENABLED,",
    "    .outputBuffer  = PORT_OUTPUT_BUFFER_DISABLED,",
    "    .inputMuxReg   = { 239 },",
    "    .inputMux      = { PORT_INPUT_MUX_ALT2, ... },",
    "  },",
    "};",
  ]);

  await codeCard("code_siul2_header_bits", "S32K324_SIUL2.h：MSCR/IMCR 字段", [
    "#define SIUL2_MSCR_SMC_MASK  (0x20U)",
    "#define SIUL2_MSCR_IFE_MASK  (0x40U)",
    "#define SIUL2_MSCR_DSE_MASK  (0x100U)",
    "#define SIUL2_MSCR_PUS_MASK  (0x800U)",
    "#define SIUL2_MSCR_PUE_MASK  (0x2000U)",
    "#define SIUL2_MSCR_SRC_MASK  (0x4000U)",
    "#define SIUL2_MSCR_PKE_MASK  (0x10000U)",
    "#define SIUL2_MSCR_INV_MASK  (0x20000U)",
    "#define SIUL2_MSCR_IBE_MASK  (0x80000U)",
    "#define SIUL2_MSCR_OBE_MASK  (0x200000U)",
    "#define SIUL2_IMCR_SSS_MASK  (0xFU)",
  ]);

  await codeCard("code_dio_cfg_mapping", "生成代码示例：Dio_Cfg.h / Siul2_Dio_Ip_Cfg.h", [
    "#define DIO_REVERSED_MAPPING_OF_PORT_BITS_OVER_PORT_PINS (STD_ON)",
    "#define DIO_NUM_PORTS_U16 ((uint16)0xe)",
    "#define DioConf_DioPort_PTAH ((uint8)0x01U)",
    "#define DioConf_DioChannel_PTA30_Heating_SwControl ((uint16)0x001eU)",
    "#define DioConf_DioChannel_PTC8_CAN1_TXD ((uint16)0x0048U)",
    "#define DioConf_DioChannel_PTC9_CAN1_RXD ((uint16)0x0049U)",
    "#define PTA_L_HALF ((Siul2_Dio_Ip_GpioType *)(&(IP_SIUL2->PGPDO0)))",
    "#define PTA_H_HALF ((Siul2_Dio_Ip_GpioType *)(&(IP_SIUL2->PGPDO1)))",
  ]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
