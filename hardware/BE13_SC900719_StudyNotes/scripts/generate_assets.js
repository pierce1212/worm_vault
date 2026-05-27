const fs = require("fs");
const path = require("path");
const sharp = require("E:/github/.codex_tools/siul2_notes/node_modules/sharp");

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
      <path d="M0,0 L10,4 L0,8 Z" fill="#1f2937"/>
    </marker>
    <style>
      .title{font:700 34px Arial, "Microsoft YaHei", sans-serif; fill:#111827}
      .sub{font:400 20px Arial, "Microsoft YaHei", sans-serif; fill:#475569}
      .box{fill:#f8fafc; stroke:#334155; stroke-width:2; rx:8}
      .blue{fill:#eff6ff; stroke:#2563eb; stroke-width:2; rx:8}
      .green{fill:#ecfdf5; stroke:#059669; stroke-width:2; rx:8}
      .amber{fill:#fffbeb; stroke:#d97706; stroke-width:2; rx:8}
      .red{fill:#fef2f2; stroke:#dc2626; stroke-width:2; rx:8}
      .violet{fill:#f5f3ff; stroke:#7c3aed; stroke-width:2; rx:8}
      .label{font:700 20px Arial, "Microsoft YaHei", sans-serif; fill:#111827}
      .small{font:400 16px Arial, "Microsoft YaHei", sans-serif; fill:#334155}
      .tiny{font:400 13px Consolas, "Microsoft YaHei", monospace; fill:#334155}
      .code{font:400 16px Consolas, "Microsoft YaHei", monospace; fill:#0f172a}
      .wire{stroke:#1f2937; stroke-width:2.2; fill:none; marker-end:url(#arrow)}
      .dash{stroke:#64748b; stroke-width:2; fill:none; stroke-dasharray:7 6; marker-end:url(#arrow)}
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

function codeCard(name, title, lines, width = 1600) {
  const lineH = 27;
  const h = 104 + lines.length * lineH;
  const code = lines
    .map((line, i) => `<text x="64" y="${112 + i * lineH}" class="code">${esc(line)}</text>`)
    .join("\n");
  const svg = svgBase(
    width,
    h,
    `
    <text x="48" y="48" class="title">${esc(title)}</text>
    <rect x="48" y="76" width="${width - 96}" height="${h - 108}" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2" rx="8"/>
    ${code}
    `
  );
  return svgToPng(name, svg, width);
}

async function main() {
  await svgToPng(
    "be13_system_overview",
    svgBase(
      1600,
      900,
      `
      <text x="56" y="58" class="title">BE13 / SC900719 在制动 ECU 中的位置</text>
      <text x="56" y="92" class="sub">它不是 MCU 外设，而是一颗通过 SPI 管理电源、阀、泵、CAN、轮速和安全诊断的制动系统混合信号芯片。</text>
      ${box(80, 235, 300, 170, "S32K324 MCU", ["AUTOSAR CDD", "SPI master", "DIO: BIST/EN", "DEM/RTE 接口"], "blue")}
      ${box(520, 140, 560, 560, "BE13 / SC900719", ["SPI 32-bit register interface", "VREG: VPRE / VCC5 / VCC3P3 / VCCA", "Dual CAN transceiver", "Pump motor pre-driver", "High-side safe switch driver", "Low-side valve drivers LSD1..LSD12", "Wheel speed sensor interfaces", "ADC / die temperature / watchdog / BIST"], "green")}
      ${box(1220, 110, 280, 105, "Power", ["VBAT / VPWR", "外部电源网络"], "amber")}
      ${box(1220, 245, 280, 105, "CAN bus", ["CAN1 / CAN2", "wake / fault"], "box")}
      ${box(1220, 380, 280, 105, "Hydraulic actuators", ["solenoid valves", "pump motor"], "red")}
      ${box(1220, 515, 280, 105, "Sensors / loads", ["wheel speed", "warning lamp / VSO"], "violet")}
      ${arrow(380,305,520,305)}
      ${arrow(520,345,380,345)}
      ${arrow(1080,190,1220,160)}
      ${arrow(1080,305,1220,300)}
      ${arrow(1080,450,1220,430)}
      ${arrow(1080,575,1220,565)}
      <text x="92" y="780" class="small">学习主线：数据手册功能块 -> SPI 寄存器 -> 当前工程 CDD 配置 -> ASW/RTE/DEM 交互。</text>
      `
    )
  );

  await svgToPng(
    "be13_spi_frame",
    svgBase(
      1600,
      760,
      `
      <text x="56" y="58" class="title">BE13 SPI 32-bit 报文格式</text>
      <text x="56" y="92" class="sub">工程中的发送报文使用 WR + 7-bit 地址 + 16-bit 数据 + CRC8；接收报文使用 ERR + 7-bit 地址 + 16-bit 数据 + CRC8。</text>
      <rect x="90" y="180" width="1420" height="110" fill="#f8fafc" stroke="#334155" stroke-width="2" rx="8"/>
      <rect x="90" y="180" width="120" height="110" class="red"/>
      <rect x="210" y="180" width="300" height="110" class="blue"/>
      <rect x="510" y="180" width="650" height="110" class="green"/>
      <rect x="1160" y="180" width="350" height="110" class="amber"/>
      <text x="132" y="238" class="label">bit31</text>
      <text x="288" y="228" class="label">bit30..24</text>
      <text x="772" y="228" class="label">bit23..8</text>
      <text x="1292" y="228" class="label">bit7..0</text>
      <text x="130" y="264" class="small">WR/ERR</text>
      <text x="320" y="264" class="small">Addr[6:0]</text>
      <text x="795" y="264" class="small">Data[15:0]</text>
      <text x="1300" y="264" class="small">CRC8</text>
      ${box(120, 390, 395, 170, "发送 merge", ["READ_BE13=0 时直接查预计算读命令", "WRITE_BE13=1 时重新计算 CRC", "cmd = wr<<31 | addr<<24 | data<<8 | crc"], "blue")}
      ${box(610, 390, 395, 170, "接收 split/check", ["union: Crc / Data / Addr / Err", "Err=0 后再校验 CRC", "地址小于 74 才写入状态数组"], "green")}
      ${box(1100, 390, 330, 170, "工程依赖", ["Spi_SetupEB()", "Spi_AsyncTransmit()", "SpiSequence_BE13"], "amber")}
      ${arrow(515,475,610,475)}
      ${arrow(1005,475,1100,475)}
      `
    )
  );

  await svgToPng(
    "be13_state_machine",
    svgBase(
      1600,
      920,
      `
      <text x="56" y="58" class="title">当前工程 BE13 CDD 状态机</text>
      <text x="56" y="92" class="sub">L2_Cdd_BE13.c 初始进入 STARTSELFCHECK_STATE，自检结束后分三段初始化，最后进入 NORMAL_STATE 周期控制。</text>
      ${box(90, 180, 310, 125, "STARTSELFCHECK", ["写 SVCFG_BIST", "LBIST_RUN/ABIST_RUN = 2", "启动自检"], "violet")}
      ${box(500, 180, 310, 125, "JUDGESELFCHECK", ["读 DIO PTE22_BIST_BE13", "10 次中 >=3 次高电平认为 OK"], "violet")}
      ${box(910, 180, 310, 125, "ENDSELFCHECK", ["停止 BIST", "LBIST_RUN/ABIST_RUN = 1"], "violet")}
      ${box(90, 430, 310, 155, "INIT_STATE1", ["清故障寄存器", "配置 VCCA / PMDCLK / VLVCLK", "关闭再准备 VLVEN", "配置 WSCFG"], "blue")}
      ${box(500, 430, 310, 155, "INIT_STATE2", ["配置 LSD Kp/Ki", "配置 HSD / CAN / PMD", "写 WDSEED", "VLVEN=0x1000"], "blue")}
      ${box(910, 430, 310, 155, "INIT_STATE3", ["回读关键配置", "保持 VLVEN=0x1000", "进入正常态"], "blue")}
      ${box(500, 695, 410, 145, "NORMAL_STATE", ["读 ASW 指令", "阀/泵/HSD 控制", "轮询 0x00..0x49 状态", "喂 watchdog", "反馈/诊断"], "green")}
      ${box(1270, 430, 250, 145, "FAILURE_STATE1", ["当前为空", "可扩展降级策略"], "red")}
      ${arrow(400,242,500,242)}
      ${arrow(810,242,910,242)}
      ${arrow(1065,305,245,430)}
      ${arrow(400,508,500,508)}
      ${arrow(810,508,910,508)}
      ${arrow(1065,585,705,695)}
      ${arrow(910,768,1270,500, "dash")}
      <text x="90" y="875" class="small">注意：FAILURE_STATE1/CALI_STATE1 目前几乎没有实际处理逻辑，排故时主要看 NORMAL_STATE 下的寄存器读取、CRC/ERR、诊断标志和 DEM 上报。</text>
      `
    )
  );

  await svgToPng(
    "be13_valve_mapping",
    svgBase(
      1600,
      900,
      `
      <text x="56" y="58" class="title">工程中电磁阀与 BE13 LSD 寄存器映射</text>
      <text x="56" y="92" class="sub">VV 使用占空比控制寄存器，ASV/RV 使用电流/占空比二选一的 LSDxI 寄存器。</text>
      ${box(90, 175, 260, 100, "VV", ["d_VV -> LSD1DC", "PWM only"], "amber")}
      ${box(90, 315, 260, 100, "ASVFL / AV1", ["d_ASVFL -> LSD2I"], "blue")}
      ${box(90, 455, 260, 100, "ASVFR / AV2", ["d_ASVFR -> LSD5I"], "blue")}
      ${box(90, 595, 260, 100, "ASVRL / AV3", ["d_ASVRL -> LSD3I"], "blue")}
      ${box(90, 735, 260, 100, "ASVRR / AV4", ["d_ASVRR -> LSD4I"], "blue")}
      ${box(500, 245, 280, 100, "RV1", ["d_RV1 -> LSD10I"], "green")}
      ${box(500, 385, 280, 100, "RV2", ["d_RV2 -> LSD8I"], "green")}
      ${box(500, 525, 280, 100, "RV3", ["d_RV3 -> LSD11I"], "green")}
      ${box(500, 665, 280, 100, "RV4", ["d_RV4 -> LSD9I"], "green")}
      ${box(975, 250, 430, 150, "CddBE13_L2_ValveCurrentCtl", ["current <= 225: LSD_FDC=0", "LSD_I = current * 1023 / 225", "否则进入 duty mode"], "violet")}
      ${box(975, 500, 430, 150, "CddBE13_L2_ValvePwmCtl", ["LSD_DC = pwm * 1023 / 1000", "pwm 单位按 0.1% 理解", "写入 SPI TX buffer"], "violet")}
      ${arrow(350,365,975,315)}
      ${arrow(350,505,975,315)}
      ${arrow(350,645,975,315)}
      ${arrow(350,785,975,315)}
      ${arrow(780,295,975,315)}
      ${arrow(780,435,975,315)}
      ${arrow(780,575,975,315)}
      ${arrow(780,715,975,315)}
      ${arrow(350,225,975,575)}
      `
    )
  );

  await svgToPng(
    "be13_register_map",
    svgBase(
      1600,
      940,
      `
      <text x="56" y="58" class="title">BE13 寄存器地图：按工程关注点分组</text>
      <text x="56" y="92" class="sub">工程里定义最大状态寄存器数 74，对应 0x00..0x49，周期读取时逐个地址轮询。</text>
      ${box(70, 150, 350, 150, "0x00..0x0F 配置/启动", ["CHIPID, SVCFG_BIST", "VCCA_CLCK, WSCFG1/2", "VLVCLK, LSDxK, HSDCFG", "PMDCLK, CAN_CFG, BIST flags"], "blue")}
      ${box(470, 150, 350, 150, "0x10..0x23 控制", ["WS_COUNT, WS_S2S", "VLVEN", "LSD1DC/LSD6DC/LSD7DC/LSD12DC", "LSD2/3/4/5/8/9/10/11I", "PMDCFG, WDCFG/WDSEED/WDMR/WDAR"], "green")}
      ${box(870, 150, 350, 150, "0x24..0x34 ADC/测量", ["AD_VPWR1 / AD_VPWR2", "AD_VPRE / AD_VCC5", "AD_VCC5EXT / AD_VCCA", "AD_VCC3P3 / AD_LSDx", "AD_DIETMP"], "amber")}
      ${box(270, 405, 350, 150, "0x35..0x3B 故障主区", ["INT1", "LSD1_6_7_12F", "LSD3_4_9_10F", "LSD2_5_8_11F", "VLV_PMDF", "SVFLT / VREG_FLG"], "red")}
      ${box(680, 405, 350, 150, "0x3C..0x42 传感/CAN/灯", ["WSS12FLT / WSS34FLT", "CAN_FLG", "WLD12", "ISOKVSO12", "LVSAFEFLT"], "violet")}
      ${box(1090, 405, 350, 150, "0x43..0x49 电压/电流反馈", ["LSD1_6_7_12_VDS", "LSD2_5_8_11_VDS", "LSD3_4_9_10_VDS", "PMD_VDS / HSD_VDS", "VLV_VDS"], "box")}
      <text x="92" y="680" class="label">读取链路</text>
      <text x="92" y="718" class="small">CddBE13_L2_ReadState() 每次处理上一帧返回值，校验 Err/CRC/地址范围后，把 Data 写入对应输入寄存器指针，并给 L2_S_BE13RegState_Uls_G_aUni_CMP[addr].B.Flg 置 1。</text>
      <text x="92" y="755" class="small">诊断函数只在对应 Flg=1 时消费一次，这样 SPI 轮询和诊断处理解耦。</text>
      `
    )
  );

  await svgToPng(
    "be13_diag_flow",
    svgBase(
      1600,
      920,
      `
      <text x="56" y="58" class="title">BE13 诊断处理流</text>
      <text x="56" y="92" class="sub">诊断不是简单把故障位原样上报，而是经过 Enable、Recover、DemEnable 三层开关。</text>
      ${box(90, 170, 300, 125, "SPI 轮询状态寄存器", ["INT1 / LSDxF / VLV_PMDF", "SVFLT / VREG_FLG / AD_DIETMP", "寄存器 Flg=1"], "blue")}
      ${box(505, 170, 300, 125, "DiagTask", ["每次先 DiagINT1()", "再 0..5 分片处理", "降低单周期负载"], "green")}
      ${box(920, 130, 430, 115, "Enable mask", ["L2_S_EnDiagBE13Reg*", "决定该 bit 是否参与诊断"], "amber")}
      ${box(920, 290, 430, 115, "Recover mask", ["L2_S_RecoverDiagBE13Reg*", "决定故障消失后是否清除诊断状态"], "amber")}
      ${box(920, 450, 430, 115, "DEM enable mask", ["L2_S_DemEnDiagBE13Reg*", "决定是否调用 Dem_SetEventStatus"], "amber")}
      ${box(505, 665, 300, 125, "诊断状态", ["L2_S_DiagBE13Reg*", "FAILED/PASSED", "DTC table 映射"], "red")}
      ${box(920, 665, 430, 125, "ASW/维修视角", ["DTC: 0x4140xx", "温度/电源/阀/泵/HSD 故障", "反馈变量用于上层策略"], "violet")}
      ${arrow(390,235,505,235)}
      ${arrow(805,235,920,190)}
      ${arrow(805,235,920,350)}
      ${arrow(805,235,920,510)}
      ${arrow(650,295,650,665)}
      ${arrow(805,728,920,728)}
      `
    )
  );

  await svgToPng(
    "be13_autosar_integration",
    svgBase(
      1600,
      840,
      `
      <text x="56" y="58" class="title">当前工程的 AUTOSAR / CDD 集成关系</text>
      <text x="56" y="92" class="sub">BE13 不是标准 MCAL 模块，配置主要落在 CDD、RTE/SWC arxml、SPI/DIO/DEM 依赖上。</text>
      ${box(90, 170, 360, 150, "CDD_BE13 SWC arxml", ["RE_CDD_BE13_Init", "RE_CDD_BE13_1ms", "RE_CDD_BE13_10ms", "TimingEvent: 1ms / 10ms"], "blue")}
      ${box(560, 170, 360, 150, "ASW SWC wrapper", ["ASW/SWC/CDD_SWC/CDD_BE13", "当前 runnable 里用户逻辑为空", "实际调用需检查 OS/RTE 集成"], "green")}
      ${box(1030, 170, 360, 150, "L2_Cdd_BE13", ["Init/MainFunction", "SPI 报文和状态机", "阀/泵/反馈/诊断"], "violet")}
      ${box(250, 455, 330, 150, "MCAL 依赖", ["SpiChannel_BE13", "SpiSequence_BE13", "DioChannel_PTE22_BIST_BE13", "Port/clock/pin mux"], "amber")}
      ${box(700, 455, 330, 150, "DEM/RTE 依赖", ["Dem_SetEventStatus", "DTC_0x4140xx", "Rte_CDD_BE13.h", "Interface_ASample.h"], "red")}
      ${arrow(450,245,560,245)}
      ${arrow(920,245,1030,245)}
      ${arrow(1190,320,415,455)}
      ${arrow(1190,320,865,455)}
      <text x="92" y="720" class="small">配置检查顺序：CDD 寄存器参数 -> SPI 外部缓冲/序列 -> BIST/控制 DIO -> DEM event -> RTE runnable 是否真正调用 CddBE13_L2_*。</text>
      `
    )
  );

  await codeCard("code_register_defines", "工程寄存器地址定义节选：L2_Cdd_BE13_Reg.h", [
    "#define CHIPID      0x00U",
    "#define SVCFG_BIST  0x01U",
    "#define VCCA_CLCK   0x02U",
    "#define WSCFG1      0x03U",
    "#define VLVCLK      0x05U",
    "#define HSDCFG      0x0AU",
    "#define PMDCLK      0x0BU",
    "#define CAN_CFG     0x0CU",
    "#define VLVEN       0x12U",
    "#define PMDCFG      0x1FU",
    "#define WDCFG       0x20U",
    "#define INT1        0x35U",
    "#define VREG_FLG    0x3BU",
    "#define VLV_VDS     0x49U",
  ]);

  await codeCard("code_spi_union", "工程 SPI 接收帧 union：L2_Cdd_BE13_Reg.h", [
    "typedef union{",
    "    uint32_t R;",
    "    struct{",
    "        uint32_t Crc  : 8;",
    "        uint32_t Data : 16;",
    "        uint32_t Addr : 7;",
    "        uint32_t Err  : 1;",
    "    }B;",
    "} RECBE13REG_Uni;",
  ]);

  await codeCard("code_cfg_macros", "工程配置宏节选：L2_Cdd_BE13_Cfg.h", [
    "#define READ_BE13        0U",
    "#define WRITE_BE13       1U",
    "#define d_S_MAXBE13TXBUFF_Cnt_u8_CMP  16U",
    "#define d_S_MAXBE13REG_Cnt_u8_CMP     74U",
    "#define d_S_MAXBE13VALVECURRENT_Amp_u16_CMP 225U",
    "#define d_S_MAXBE13VALVEDUTY_Uls_u16_CMP    1000U",
    "#define d_S_MAXBE13PMDDUTY_Uls_u16_CMP      1000U",
    "#define d_S_BE13DIETEMPOT_Uls_u16_CMP       1500U",
    "#define d_S_BE13DIETEMPOTRECOVER_Uls_u16_CMP 1400U",
  ]);

  await codeCard("code_valve_mapping", "工程阀映射节选：L2_Cdd_BE13_Cfg.h", [
    "#define d_VV_BE13REGADDR      LSD1DC",
    "#define d_ASVFL_BE13REGADDR   LSD2I   /* AV1 */",
    "#define d_ASVFR_BE13REGADDR   LSD5I   /* AV2 */",
    "#define d_ASVRL_BE13REGADDR   LSD3I   /* AV3 */",
    "#define d_ASVRR_BE13REGADDR   LSD4I   /* AV4 */",
    "#define d_RV1_BE13REGADDR     LSD10I",
    "#define d_RV2_BE13REGADDR     LSD8I",
    "#define d_RV3_BE13REGADDR     LSD11I",
    "#define d_RV4_BE13REGADDR     LSD9I",
    "#define d_PMDCFG_BE13REGADDR  PMDCFG",
  ]);

  await codeCard("code_state_machine", "工程状态机节选：L2_Cdd_BE13.c", [
    "typedef enum {",
    "    INIT_STATE1 = 0,",
    "    INIT_STATE2 = 1,",
    "    INIT_STATE3 = 2,",
    "    NORMAL_STATE = 5,",
    "    FAILURE_STATE1 = 10,",
    "    CALI_STATE1 = 20,",
    "    STARTSELFCHECK_STATE = 30,",
    "    JUDGESELFCHECK_STATE = 31,",
    "    ENDSELFCHECK_STATE = 32,",
    "    NO_STATE = 255",
    "} BE13State_Enu;",
    "static BE13State_Enu L2_S_BE13State_Uls_G_Eun_CMS = STARTSELFCHECK_STATE;",
  ]);

  await codeCard("code_diag_task", "工程诊断任务节选：L2_Cdd_BE13Diag.c", [
    "static void CddBE13_L2_DiagTask(void)",
    "{",
    "    CddBE13_L2_DiagINT1();",
    "    if (taskCnt == 0)      CddBE13_L2_DiagLSD1_6_7_12F();",
    "    else if (taskCnt == 1) CddBE13_L2_DiagLSD3_4_9_10F();",
    "    else if (taskCnt == 2) CddBE13_L2_DiagLSD2_5_8_11F();",
    "    else if (taskCnt == 3) CddBE13_L2_DiagVLV_PMDF();",
    "    else if (taskCnt == 4) CddBE13_L2_DiagSVFLT();",
    "    else if (taskCnt == 5) CddBE13_L2_DiagVREG_FLG();",
    "}",
  ]);

  await codeCard("code_arxml_runnables", "SWC 配置节选：CDD_BE13.arxml", [
    "<SHORT-NAME>CDD_BE13</SHORT-NAME>",
    "<TIMING-EVENT>",
    "  <SHORT-NAME>TE_CDD_BE13_1ms</SHORT-NAME>",
    "  <PERIOD>0.001</PERIOD>",
    "</TIMING-EVENT>",
    "<TIMING-EVENT>",
    "  <SHORT-NAME>TE_CDD_BE13_10ms</SHORT-NAME>",
    "  <PERIOD>0.01</PERIOD>",
    "</TIMING-EVENT>",
    "<INIT-EVENT>",
    "  <SHORT-NAME>IE_CDD_BE13_Init</SHORT-NAME>",
    "</INIT-EVENT>",
  ]);

  await codeCard("code_init_sequence", "初始化发送序列节选：L2_Cdd_BE13.c", [
    "InitState1: clear INT1/LSDxF/VLV_PMDF/SVFLT/VREG_FLG",
    "InitState1: write VCCA_CLCK, PMDCLK, WSCFG1, VLVCLK, VLVEN=0",
    "InitState2: write LSD3_4K/LSD9_10K/LSD2_11K/LSD5_8K",
    "InitState2: write HSDCFG, CAN_CFG, PMDCFG, SVCFG_BIST, ABIST_DIS",
    "InitState2: write VLVEN=0x1000 and WDSEED=0x5A5A",
    "InitState3: read back key configuration and keep VLVEN=0x1000",
  ]);

  await codeCard("code_spi_eb_config", "EB Spi.xdm 配置节选：BE13 SPI 通道", [
    '<d:ctr name="SpiChannel_BE13" type="IDENTIFIABLE">',
    '  <d:var name="SpiChannelId" value="0"/>',
    '  <d:var name="SpiChannelType" value="EB"/>',
    '  <d:var name="SpiDataWidth" value="32"/>',
    '  <d:var name="SpiEbMaxLength" value="1024"/>',
    '  <d:var name="SpiTransferStart" value="MSB"/>',
    '</d:ctr>',
    '<d:ctr name="Spi0_BE13" type="IDENTIFIABLE">',
    '  <d:var name="SpiBaudrate" value="5000000.0"/>',
    '  <d:var name="SpiCsIdentifier" value="PCS2"/>',
    '  <d:var name="SpiCsPolarity" value="LOW"/>',
    '</d:ctr>',
  ]);

  await codeCard("code_lpspi_generated", "生成代码节选：Lpspi_Ip_PBcfg.c", [
    "const Lpspi_Ip_ExternalDeviceType Lpspi_Ip_DeviceAttributes_Spi0_BE13 =",
    "{",
    "    0U,  /* Instance */",
    "    LPSPI_CCR_SCKPCS(79U) | LPSPI_CCR_PCSSCK(79U)",
    "      | LPSPI_CCR_SCKDIV(14U) | LPSPI_CCR_DBT(78U),",
    "    LPSPI_TCR_CPOL(0U) | LPSPI_TCR_CPHA(0U)",
    "      | LPSPI_TCR_PCS(2U) | LPSPI_TCR_CONT(0U)",
    "};",
  ]);

  await codeCard("code_core1_call", "实际周期入口节选：Core1_Swc.c", [
    "/* RE_Core1_Swc_Bsw_10ms */",
    "CddDryHeating_L2_MainFunction();",
    "Rtm_ProcessStart(Rtm_Mon_Cfg_ProcessId_CddBE13_L2_MainFunction);",
    "Dio_WriteChannel(DioConf_DioChannel_PTE8_GPIO_TP316, STD_HIGH);",
    "CddBE13_L2_MainFunction();",
    "CddBE13_L2_DiagMainFunction();",
    "Dio_WriteChannel(DioConf_DioChannel_PTE8_GPIO_TP316, STD_LOW);",
    "Rtm_ProcessEnd(Rtm_Mon_Cfg_ProcessId_CddBE13_L2_MainFunction);",
  ]);

  await codeCard("code_lcfg_defaults", "BE13 Lcfg 默认参数节选：L2_Cdd_BE13_Lcfg.c", [
    "VLVCLK: LF_PWM10_0KHZ, FM_LSD_DIS, AVD enabled",
    "LSD PI: LSD2/3/4/5/8/9/10/11 -> KI0_1250, KP1_0000",
    "HSDCFG: OC_VDS0_79V, HSD_OC_TIME147_0MS, HSD_OC_EN",
    "PMDCLK: F_PMD16_0KHZ, FM_PMD_EN, FM_PMD_MP_32",
    "PMDCFG: PMD_OC_VDS0_69V, PMD_OC_TIME_9us",
    "CAN_CFG: CAN1/CAN2 normal mode, TX/RX enabled",
    "WDCFG: watchdog enabled, T_WD_512MS",
  ]);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
