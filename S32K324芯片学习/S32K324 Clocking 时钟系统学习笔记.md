---
title: S32K324 Clocking 时钟系统学习笔记
tags:
  - S32K324
  - S32K3
  - Clocking
  - EB-tresos
  - AUTOSAR-MCAL
created: 2026-05-12 17:35:10 +0800
sources:
  - NXP S32K3xx Reference Manual, Rev. 9, 07/2024, Chapter 24 Clocking, Chapter 25 MC_CGM, Chapter 26 FIRC, Chapter 27 SIRC, Chapter 28 FXOSC, Chapter 29 SXOSC, Chapter 30 PLLDIG
  - E:/github/ECAS_RTA_S32K324GHS_Heating/BasicSoftware/integration/mcal/MCAL_Cfg/config/Mcu.xdm
  - C:/Users/Administrator/Downloads/S32K3常见问题检查列表(Check list)-V1.3-20260104.docx
---

# S32K324 Clocking 时钟系统学习笔记

> 目标：把 S32K324 的 Clocking 章节讲清楚，并把芯片手册里的概念和 EB tresos / AUTOSAR MCAL 的 Mcu 配置对应起来。
>
> 这份笔记以 S32K324 为主。S32K324 属于 NXP S32K3 系列，很多时钟章节同时覆盖 S32K344、S32K324、S32K314、S32K322、S32K341、S32K342，所以手册图名中会同时出现这些型号。

## 0. 资料来源和截图说明

### 0.1 本笔记使用的主要资料

1. 芯片手册：
   - 文件：`C:/Users/Administrator/Zotero/storage/GKPNECE2/S32K3xx Reference Manual.pdf`
   - 文档标识：`S32K3XXRM Rev. 9, 07/2024`
   - 重点章节：
     - Chapter 24 Clocking
     - Chapter 25 Clock Generation Module，MC_CGM
     - Chapter 26 Fast Internal RC Oscillator，FIRC
     - Chapter 27 Slow Internal RC Oscillator，SIRC
     - Chapter 28 Fast Crystal Oscillator Digital Controller，FXOSC
     - Chapter 29 Slow Crystal Oscillator Digital Controller，SXOSC
     - Chapter 30 PLL Digital Interface，PLLDIG
2. EB tresos 工程配置：
   - `E:/github/ECAS_RTA_S32K324GHS_Heating/BasicSoftware/integration/mcal/MCAL_Cfg/config/Mcu.xdm`
3. 本地 S32K3 检查清单 / 有道云相关导出资料：
   - `C:/Users/Administrator/Downloads/S32K3常见问题检查列表(Check list)-V1.3-20260104.docx`
   - 已用 `docx2txt` 抽取出文本：`C:/Users/Administrator/Downloads/S32K3常见问题检查列表(Check list)-V1.3-20260104.txt`
4. 本地项目初始化代码：
   - `E:/github/ECAS_RTA_S32K324GHS_Heating/BasicSoftware/integration/src/target/src/Target.c`

### 0.2 图片附件

下面图片已放入当前 Obsidian vault：

- `S32K3/attachments/fig24-1_clock_source_generation_page908.png`
- `S32K3/attachments/fig24-4_other_clocks_page939.png`
- `S32K3/attachments/fig28-1_fxosc_block_page1147.png`
- `S32K3/attachments/fig30-1_plldig_block_page1157.png`
- `S32K3/attachments/eb_tresos_mcu_clock_config_map.png`
- `S32K3/attachments/s32k324_clock_learning_path.png`

> 注意：手册页码是 PDF 页码，不一定等于章节内部页码。截图出处都在图下方单独标注。

---

# 1. 先用一句话理解 S32K324 时钟系统

S32K324 的时钟系统可以理解成一套“水厂供水系统”：

1. 时钟源就是水源：FIRC、SIRC、FXOSC、SXOSC、PLL。
2. MC_CGM 就是分水阀和减压阀：选择哪路时钟源，再通过分频器分给 CPU、总线、HSE、CAN、SPI、I2C、ADC、STM、eMIOS 等模块。
3. MC_ME / 外设门控就是水龙头开关：即使管道里有水，如果对应外设的门控没打开，外设还是不能工作。
4. EB tresos 的 Mcu 模块就是配置界面：把这些源、MUX、分频器、门控、参考频率点写成 MCAL 配置，最后生成代码。
5. 应用代码通过 `Mcu_InitClock()`、`Mcu_GetPllStatus()`、`Mcu_DistributePllClock()` 等 API 让配置真正生效。

![[../attachments/s32k324_clock_learning_path.png]]

图源：根据 NXP S32K3xx Reference Manual Rev.9 Chapter 24-30 和本工程 `Mcu.xdm` 摘要绘制。

---

# 2. S32K324 时钟系统总览

## 2.1 手册中的 Clocking 章节结构

Clocking 章节并不是只讲一个寄存器，而是从系统架构角度解释“时钟从哪里来、怎么选、怎么分、怎么给外设”。大致结构如下：

1. 24.1 Introduction：介绍时钟系统的目的。
2. 24.2 Features：列出功能特性。
3. 24.3 Clocking overview：总览时钟路径，包括 clock source generation、MC_CGM mux、clockout、other clocks、不同芯片型号的 clock system diagram。
4. 24.4 Clock sources：详细解释 FIRC、SIRC、FXOSC、SXOSC、PLL 等时钟源。
5. 24.5 MC_CGM：介绍 Clock Generation Module 的 mux 和 clock sources mapping。
6. 24.6 Peripheral clocking：解释各外设模块怎么接时钟，例如 FlexCAN、LPI2C、LPSPI、LPUART、ADC、eMIOS、BCTU、PIT、STM、SWT、RTC 等。
7. 25 MC_CGM：寄存器级说明。
8. 26-30：各时钟源模块的寄存器级说明。

## 2.2 S32K324 适用的 clock system diagram

S32K324 使用手册 24.3.11 的图：

- 标题：`S32K344, S32K324, S32K314, S32K322, S32K341 and S32K342 clock system diagram`
- 图号：Figure 68
- 来源：NXP S32K3xx Reference Manual Rev.9, Chapter 24 Clocking, 24.3.11, PDF page 908

![[../attachments/fig24-1_clock_source_generation_page908.png]]

这张图非常重要。建议第一次看不要急着追每一根线，而是先抓住 5 类东西：

1. 左侧或上游：时钟源。
   - FIRC 48 MHz
   - SIRC 32 kHz
   - FXOSC，一般接外部高速晶振或有源晶振
   - SXOSC，一般接 32.768 kHz 低速晶振
   - PLL，由 FXOSC 等参考源倍频得到高频时钟
2. 中间：PLL 和 MC_CGM。
   - PLL 负责把低频参考源变成高频、低抖动的时钟。
   - MC_CGM 负责选源和分频。
3. 右侧：最终输出的时钟。
   - CORE_CLK
   - AIPS_PLAT_CLK
   - AIPS_SLOW_CLK
   - HSE_CLK
   - DCM_CLK
   - LBIST_CLK
   - FLEXCAN_PE_CLK
   - EMAC / QSPI / TRACE / CLKOUT 等
4. 小 MUX：选择器。
   - 例如 MUX_0 是系统主 mux。
   - MUX_1、MUX_2、MUX_3 等给不同外设或功能域选源。
5. 分频器 DC_x：把选出来的时钟降到目标频率。
   - 典型公式：输出频率 = 输入频率 / (DIV + 1)。
   - EB 里常看到 divisor 值为 0、1、3、5 等，实际含义通常对应除以 1、2、4、6。

---

# 3. 核心概念：时钟源 Clock Source

S32K324 上电之后不可能立刻跑到 160 MHz 或 240 MHz。它必须先有一个稳定的基础时钟，然后再逐步启用外部晶振和 PLL。下面按常见时钟源说明。

## 3.1 FIRC：Fast Internal RC Oscillator

FIRC 是快速内部 RC 振荡器。S32K3 手册中 FIRC 频率为 48 MHz。

通俗理解：FIRC 是芯片内部自带的高速“备用电池表”。不用外部晶振，也能让芯片先跑起来。

特点：

1. 频率：48 MHz。
2. 来自芯片内部，不依赖外部晶振硬件。
3. 上电早期、调试、备用路径、某些 clockout 或外设默认时钟常会用到。
4. 精度和抖动通常不如外部晶振 + PLL，所以高性能主频或通信协议最终往往不用 FIRC 直接作为核心主时钟。
5. 如果系统时钟切 PLL 失败，FIRC 是很重要的 fallback 选择。

在本工程 EB 配置中：

```xml
<d:ctr name="McuFIRC" type="IDENTIFIABLE">
  <d:var name="McuFircUnderMcuControl" type="BOOLEAN" value="true"/>
  <d:var name="McuFircDivSel" type="ENUMERATION" value="Div_by_1"/>
  <d:var name="McuFIRC_Frequency" type="FLOAT" value="4.8E7"/>
  <d:var name="McuFircStandbyEnable" type="BOOLEAN" value="false"/>
</d:ctr>
```

解释：

- `McuFircUnderMcuControl = true`：FIRC 由 MCAL Mcu 模块控制。
- `McuFircDivSel = Div_by_1`：不分频。
- `McuFIRC_Frequency = 4.8E7`：48 MHz。
- `McuFircStandbyEnable = false`：Standby 下不保持 FIRC。

## 3.2 SIRC：Slow Internal RC Oscillator

SIRC 是慢速内部 RC 振荡器，频率 32 kHz。

通俗理解：SIRC 是芯片内部的“低功耗小闹钟”。它不快，但省电，适合低功耗和唤醒相关场景。

特点：

1. 频率：32 kHz。
2. 内部 RC，不依赖外部晶振。
3. 可用于低功耗模式、唤醒、部分安全或监控逻辑。
4. 精度有限，不适合作为高速通信的基础时钟。

本工程 EB 配置：

```xml
<d:ctr name="McuSIRC" type="IDENTIFIABLE">
  <d:var name="McuSircUnderMcuControl" type="BOOLEAN" value="true"/>
  <d:var name="McuSIRC_Frequency" type="FLOAT" value="32000.0"/>
  <d:var name="McuSircStandbyEnable" type="BOOLEAN" value="true"/>
</d:ctr>
```

解释：

- `McuSIRC_Frequency = 32000.0`：32 kHz。
- `McuSircStandbyEnable = true`：Standby 下保留 SIRC，这很符合它作为低功耗时钟的定位。

## 3.3 FXOSC：Fast Crystal Oscillator

FXOSC 是高速外部晶振控制器。它可以接晶体，也可以配合外部有源晶振使用。

通俗理解：FXOSC 是“外部高精度时钟入口”。PLL 通常需要一个稳定、准确的参考源，FXOSC 就是最常见的参考源。

手册相关截图：

- 来源：NXP S32K3xx Reference Manual Rev.9, Chapter 28 FXOSC, 28.2.1 Block diagram, PDF page 1147

![[../attachments/fig28-1_fxosc_block_page1147.png]]

本工程 EB 配置：

```xml
<d:ctr name="McuFXOSC" type="IDENTIFIABLE">
  <d:var name="McuFxoscUnderMcuControl" type="BOOLEAN" value="true"/>
  <d:var name="McuFxoscPowerDownCtr" type="BOOLEAN" value="true"/>
  <d:var name="McuFxoscBypass" type="BOOLEAN" value="false"/>
  <d:var name="McuFxoscMainComparator" type="BOOLEAN" value="true"/>
  <d:var name="McuFxoscCounter" type="INTEGER" value="49"/>
  <d:var name="McuFxoscOverdriveProtection" type="INTEGER" value="12"/>
  <d:var name="McuFXOSC_Frequency" type="FLOAT" value="1.6E7"/>
</d:ctr>
```

解释：

- `McuFXOSC_Frequency = 1.6E7`：本工程外部高速晶振配置为 16 MHz。
- `McuFxoscBypass = false`：不是 bypass 模式，通常表示按晶体振荡器模式理解。如果硬件是有源晶振，要特别核对 bypass / EXTAL 输入要求。
- `McuFxoscCounter = 49`：稳定计数或启动等待相关配置，避免 FXOSC 尚未稳定就切给 PLL。
- `McuFxoscMainComparator = true`：使能主比较器相关检测。

### 3.3.1 FXOSC 自动增益和 EMC / ESD 风险

本地 S32K3 检查清单中有一条非常实用的经验：

- 检查是否禁止快速外部晶振 FXOSC 的自动增益。
- 如果 EMC 试验，例如静电试验，出现 PLL 失锁导致 MCU 复位，可以尝试禁止 FXOSC 自动增益。
- RTD5.0.0 可直接通过 EB 配置；更早 RTD 版本可能需要修改生成配置文件或直接设置对应寄存器位。

这条经验来自：`C:/Users/Administrator/Downloads/S32K3常见问题检查列表(Check list)-V1.3-20260104.docx`，时钟章节 3.2.3。

我的理解：

- FXOSC 是 PLL 的参考源。
- 如果 FXOSC 在干扰下波形幅度、增益、稳定性出现问题，PLL 可能 loss of lock。
- PLL 一旦失锁，可能触发复位或错误反应。
- 所以 EMC/ESD 问题排查时，不能只盯软件，要检查晶振布局、负载电容、驱动强度、自动增益、PLL unlock range、时钟监控反应策略。

## 3.4 SXOSC：Slow Crystal Oscillator

SXOSC 是低速外部晶振控制器，一般接 32.768 kHz 晶振。

通俗理解：SXOSC 是“外部高精度低速闹钟”，常用于 RTC、低功耗计时。

本工程 EB 配置：

```xml
<d:ctr name="McuSXOSC" type="IDENTIFIABLE">
  <d:var name="McuSxoscUnderMcuControl" type="BOOLEAN" value="true"/>
  <d:var name="McuSxoscCounter" type="INTEGER" value="125"/>
  <d:var name="McuSxoscPowerDownCtr" type="BOOLEAN" value="true"/>
  <d:var name="McuSXOSC_Frequency" type="FLOAT" value="32768.0"/>
</d:ctr>
```

解释：

- `McuSXOSC_Frequency = 32768.0`：32.768 kHz。
- 常用于 RTC 计时更合适，但本工程 `McuRtc_Source` 当前配置为 FIRC_CLK，见后文。

## 3.5 PLL：Phase Locked Loop

PLL 是锁相环。它的作用是把低频参考时钟倍频成高频系统时钟。

通俗理解：外部晶振像一个稳定节拍器，PLL 像一个“倍速器”，根据节拍器生成更高频的节拍。

手册相关截图：

- 来源：NXP S32K3xx Reference Manual Rev.9, Chapter 30 PLLDIG, 30.2.1 Block diagram, PDF page 1157

![[../attachments/fig30-1_plldig_block_page1157.png]]

手册中的关键点：

1. PLL 启用前必须先启用 FXOSC，并等待 FXOSC 稳定。
2. FXOSC 稳定可通过 `FXOSC.STAT[OSC_STAT]` 等状态位确认。
3. PLL 配置后要等待 lock。
4. PLL lock 后再把 PLL 时钟分发给系统。
5. 若需要关闭 PLL，要先关 PLL，再考虑关 FXOSC。
6. PLL 可输出多个后分频时钟，例如 `PLL_PHI0_CLK`、`PLL_PHI1_CLK`。

本工程 EB 配置中启用的是 `McuPll_0`，禁用 `McuPll_1`：

```xml
<d:ctr name="McuPll_0" type="IDENTIFIABLE">
  <d:var name="McuPLLEnabled" type="BOOLEAN" value="true"/>
  <d:var name="McuPllClockSelection" type="ENUMERATION" value="FXOSC_CLK"/>
  <d:var name="McuPllDvRdiv" type="INTEGER" value="2"/>
  <d:var name="McuPllDvMfi" type="INTEGER" value="120"/>
  <d:var name="McuPllDvOdiv2" type="INTEGER" value="1"/>
  <d:var name="McuPllOdiv0_Div" type="INTEGER" value="5"/>
  <d:var name="McuPllOdiv1_Div" type="INTEGER" value="3"/>
  <d:var name="PLL_PHI0_Frequency" type="FLOAT" value="1.6E8"/>
  <d:var name="PLL_PHI1_Frequency" type="FLOAT" value="2.4E8"/>
  <d:var name="PLL_VCO_Frequency" type="FLOAT" value="9.6E8"/>
</d:ctr>
```

本工程频率链路可以这样理解：

```text
FXOSC = 16 MHz
PLL reference = FXOSC / RDIV = 16 MHz / 2 = 8 MHz
PLL VCO = 8 MHz * MFI = 8 MHz * 120 = 960 MHz
PLL_PHI0 = 960 MHz / (ODIV0 + 1) = 960 / (5 + 1) = 160 MHz
PLL_PHI1 = 960 MHz / (ODIV1 + 1) = 960 / (3 + 1) = 240 MHz
```

> 注意：这里按本工程生成出来的频率反推，ODIV 字段的实际含义在 EB 中表现为 `Div` 值，输出频率对应 `Div + 1`。实际项目中以 NXP RTD/MCAL 生成值和参考手册寄存器定义为准。

---

# 4. MC_CGM：时钟生成模块

MC_CGM，全称 Clock Generation Module，是 S32K324 时钟分配的核心。

如果把时钟源比作水源，MC_CGM 就是“总分水器”：

1. 选择哪个输入源。
2. 对输入源分频。
3. 输出给系统主时钟、总线时钟、HSE、外设协议时钟、CLKOUT 等。

## 4.1 Clock source generation

手册 24.3.1 先给出 clock source generation 概览。重点是看清：FIRC、SIRC、FXOSC、SXOSC、PLL 如何产生不同基础时钟。

- 来源：NXP S32K3xx Reference Manual Rev.9, Chapter 24 Clocking, 24.3.1 Clock source generation

![[../attachments/fig24-1_clock_source_generation_page908.png]]

> 这张截图同时包含 S32K324 clock system diagram，所以也可作为总览图使用。

## 4.2 MC_CGM mux 0：系统主干时钟

S32K324 里最重要的是 MUX_0。它通常负责系统主时钟树，输出很多关键时钟。

在本工程 EB 中：

```xml
<d:ctr name="McuCgm0ClockMux0" type="IDENTIFIABLE">
  <d:var name="McuClkMux0_Source" type="ENUMERATION" value="PLL_PHI0_CLK"/>
  <d:var name="McuClkMux0Div0_Divisor" type="INTEGER" value="0"/>
  <d:var name="McuClockMux0Divider0_Frequency" type="FLOAT" value="1.6E8"/>
  <d:var name="McuClkMux0Div1_Divisor" type="INTEGER" value="1"/>
  <d:var name="McuClockMux0Divider1_Frequency" type="FLOAT" value="8.0E7"/>
  <d:var name="McuClkMux0Div2_Divisor" type="INTEGER" value="3"/>
  <d:var name="McuClockMux0Divider2_Frequency" type="FLOAT" value="4.0E7"/>
  ...
</d:ctr>
```

解释：

- MUX_0 选择 `PLL_PHI0_CLK`，也就是 160 MHz。
- Divider0 divisor=0，输出 160 MHz。
- Divider1 divisor=1，输出 80 MHz。
- Divider2 divisor=3，输出 40 MHz。
- 后面还有多个 divider 输出 80 MHz、40 MHz、160 MHz 等。

在 `McuClockReferencePoint` 里可看到这些最终频率：

```xml
CORE_CLK       = 160 MHz
AIPS_PLAT_CLK  = 80 MHz
AIPS_SLOW_CLK  = 40 MHz
HSE_CLK        = 80 MHz
DCM_CLK        = 40 MHz
LBIST_CLK      = 40 MHz
QSPI_MEM_CLK   = 160 MHz
STM0_CLK       = 40 MHz
STM1_CLK       = 40 MHz
```

这就是从 PLL_PHI0_CLK 一路分出来的系统主干频率。

## 4.3 其它 MUX：外设和专用时钟

手册的 other clocks 图展示了很多非 MUX_0 的时钟路径。

- 来源：NXP S32K3xx Reference Manual Rev.9, Chapter 24 Clocking, 24.3.4 Other clocks, PDF page 939

![[../attachments/fig24-4_other_clocks_page939.png]]

本工程 Mcu.xdm 中几个典型 MUX：

```text
McuCgm0ClockMux1  Source = AIPS_PLAT_CLK, Div0 = 1, Frequency = 40 MHz
McuCgm0ClockMux2  Source = AIPS_PLAT_CLK, Div0 = 1, Frequency = 40 MHz
McuCgm0ClockMux3  Source = AIPS_PLAT_CLK, Div0 = 1, Frequency = 40 MHz
McuCgm0ClockMux4  Source = FIRC_CLK,      Div0 = 3, Frequency = 12 MHz
McuCgm0ClockMux5  Source = FIRC_CLK,      Div0 = 3, Frequency = 12 MHz
McuCgm0ClockMux6  Source = FIRC_CLK,      Div0 = 1, Frequency = 24 MHz
McuCgm0ClockMux7  Source = EMAC_MII_RMII_TX_CLK, Div0 = 1, Frequency = 25 MHz
McuCgm0ClockMux8  Source = EMAC_MII_RMII_TX_CLK, Div0 = 1, Frequency = 25 MHz
McuCgm0ClockMux9  Source = EMAC_MII_RMII_TX_CLK, Div0 = 0, Frequency = 50 MHz
McuCgm0ClockMux10 Source = PLL_PHI1_CLK,  Div0 = 1, Frequency = 120 MHz
McuCgm0ClockMux11 Source = PLL_PHI1_CLK,  Div0 = 1, Frequency = 120 MHz
McuCgm0ClockMux12 Source = FIRC_CLK,      Div0 = 0, Frequency = 48 MHz
McuCgm0ClockMux13 Source = FIRC_CLK,      Div0 = 0, Frequency = 48 MHz
McuCgm0ClockMux15 Source = FIRC_CLK,      Div0 = 2, Frequency = 16 MHz
```

这里要注意：

1. 不是所有 MUX 都服务同一个外设。
2. 同一个外设可能有 `MODULE_CLK`、`REG_INTF_CLK`、`PROTOCOL_CLK` 等不同意义的时钟。
3. 外设驱动配置里选择的 baudrate、采样点、分频参数，最终都依赖这里给出的源频率。
4. 如果 Mcu 里的时钟频率和外设模块里假设的时钟频率不一致，就会出现 CAN 波特率错误、SPI 速度不对、I2C 异常、ADC 超频等问题。

---

# 5. Peripheral clocking：外设时钟怎么理解

S32K324 的外设时钟不能简单理解成“所有外设都跑 80 MHz”。不同外设有不同的时钟输入。

## 5.1 MODULE_CLK 与 REG_INTF_CLK

手册中很多外设图都会出现：

- `MODULE_CLK`
- `REG_INTF_CLK`

通俗解释：

1. `REG_INTF_CLK`：寄存器接口时钟。CPU 访问外设寄存器，需要这个时钟。
2. `MODULE_CLK`：外设内部功能时钟。比如定时器计数、通信协议状态机、ADC 转换逻辑等。

有些模块这两个时钟一样，有些模块不一样。若寄存器接口时钟没开，访问寄存器可能 HardFault；若模块时钟不对，外设可能初始化成功但功能异常。

## 5.2 FlexCAN 时钟

手册 24.6.1.1.1 介绍 FlexCAN clocking。

关键点：

1. FlexCAN 有协议引擎时钟，用于 CAN bit timing。
2. CAN 波特率、采样点配置依赖 FlexCAN PE clock。
3. 本工程 `McuClockReferencePoint` 中：
   - `FLEXCAN_PE_CLK0_2 = 40 MHz`
   - `FLEXCAN_PE_CLK3_5 = 12 MHz`
4. 因此配置 CAN0-CAN2 和 CAN3-CAN5 时，要确认它们使用的 PE clock 不是同一个频率。

本地检查清单中有经验：

- 时钟配置必须严格遵循参考手册列出的几种配置，否则可能导致 CAN 通讯异常。
- 提高 CAN 协议时钟频率，可以改善 CAN 采样点。

## 5.3 LPSPI / LPI2C / LPUART 时钟

这些通信外设一般都有：

1. 寄存器接口时钟。
2. 模块功能时钟。
3. 协议波特率分频。

常见错误：

- Mcu 中源时钟改了，但外设模块的 baudrate 分频没重新计算。
- EB 里某个 clock reference point 频率填错，导致生成代码按错误频率算分频。
- 外设门控没开，初始化访问寄存器 HardFault。
- 低功耗模式下没有打开对应时钟，唤醒后外设不工作。

本地检查清单中有经验：

- SPI/I2C/CAN 都有“时钟配置错误导致的问题”。
- 结论一致：时钟配置必须严格遵循参考手册推荐配置，否则通信可能异常。

## 5.4 ADC 时钟

ADC 对时钟特别敏感，不是越快越好。

本地检查清单中提到：

- 例如 K324，ADC 转换时钟最高 80 MHz，校准时钟最高 40 MHz。
- 超过这些时钟频率，可能导致校准失败、数据采集异常，甚至损坏 MCU。
- 如果 ADC 校准失败，可检查板卡电源或时钟是否稳定，必要时降低 ADC 模块时钟频率。

这点非常重要。ADC 配置时要同时看：

1. Mcu 给 ADC 的 module clock 是多少。
2. Adc 模块内部又如何分频到 conversion clock / calibration clock。
3. 是否满足 S32K324 数据手册/参考手册限制。
4. 是否满足硬件模拟前端采样时间要求。

## 5.5 STM / PIT / GPT 时钟

本工程代码里有一处很典型：

```c
Fstm = Mcu_GetClockFrequency(STM0_CLK);
```

位置：`E:/github/ECAS_RTA_S32K324GHS_Heating/ECU/Time/Time.c`

本工程 Mcu.xdm 中：

```xml
STM0_CLK = 40 MHz
STM1_CLK = 40 MHz
```

因此如果时间基准、调度节拍、GPT 周期不准，要检查：

1. `STM0_CLK` / `STM1_CLK` 的 reference point 是否正确。
2. GPT / STM 模块配置是否引用了正确 clock reference。
3. 初始化顺序中 Mcu 时钟是否已经初始化完成。

---

# 6. EB tresos 中如何配置 S32K324 时钟

## 6.1 EB 配置和芯片手册的对应关系

![[../attachments/eb_tresos_mcu_clock_config_map.png]]

图源：根据本工程 `E:/github/ECAS_RTA_S32K324GHS_Heating/BasicSoftware/integration/mcal/MCAL_Cfg/config/Mcu.xdm` 摘要绘制。

在 EB tresos 里，S32K324 时钟主要在 Mcu 模块中配置。保存后会落到 `Mcu.xdm`，生成代码后会变成 `Mcu_PBcfg.c`、`Mcu_Cfg.c`、`Mcu_Cfg.h` 等。

从概念对应关系看：

```text
芯片手册概念                         EB / Mcu.xdm 配置
----------------------------------------------------------
FIRC                                McuFIRC
SIRC                                McuSIRC
FXOSC                               McuFXOSC
SXOSC                               McuSXOSC
PLL / PLLDIG                         McuPll_0 / McuPll_1
MC_CGM MUX_0                         McuCgm0ClockMux0
MC_CGM MUX_1...19                    McuCgm0ClockMux1...19
最终可查询时钟频率                    McuClockReferencePoint
时钟监控 CMU                         McuClkMonitor
是否由 Mcu 模块控制某时钟源            McuXXXUnderMcuControl
RUN / Standby 下外设门控               MC_ME / Power / 外设 clock enable 相关配置
```

## 6.2 本工程时钟配置摘要

工程：`ECAS_RTA_S32K324GHS_Heating`

Mcu 配置文件：

`E:/github/ECAS_RTA_S32K324GHS_Heating/BasicSoftware/integration/mcal/MCAL_Cfg/config/Mcu.xdm`

### 6.2.1 基础时钟源

```text
FIRC  = 48 MHz, Div_by_1, Standby disabled
SIRC  = 32 kHz, Standby enabled
FXOSC = 16 MHz
SXOSC = 32.768 kHz
```

### 6.2.2 PLL0

```text
PLL0 enabled = true
PLL0 reference = FXOSC_CLK = 16 MHz
RDIV = 2
MFI = 120
ODIV2 = 1
ODIV0 = 5
ODIV1 = 3
VCO = 960 MHz
PLL_PHI0 = 160 MHz
PLL_PHI1 = 240 MHz
```

计算过程：

```text
16 MHz / 2 = 8 MHz
8 MHz * 120 = 960 MHz
960 MHz / (5 + 1) = 160 MHz
960 MHz / (3 + 1) = 240 MHz
```

### 6.2.3 PLL1 / PLL_AUX

本工程 `McuPll_1`：

```text
McuPLLEnabled = false
PLL_PHI0_Frequency = 0
PLL_PHI1_Frequency = 0
PLL_PHI2_Frequency = 0
PLL_VCO_Frequency = 0
```

说明：S32K324 当前项目没有启用第二 PLL。S32K3 某些型号或场景会用 PLL_AUX，但本工程不用。

### 6.2.4 系统主时钟 MUX_0

```text
MUX_0 source = PLL_PHI0_CLK = 160 MHz
Div0 = 0 -> 160 MHz
Div1 = 1 -> 80 MHz
Div2 = 3 -> 40 MHz
Div3 = 1 -> 80 MHz
Div4 = 3 -> 40 MHz
Div5 = 3 -> 40 MHz
Div6 = 0 -> 160 MHz
Div7 disabled
```

对应 reference point：

```text
CORE_CLK       = 160 MHz
AIPS_PLAT_CLK  = 80 MHz
AIPS_SLOW_CLK  = 40 MHz
HSE_CLK        = 80 MHz
DCM_CLK        = 40 MHz
LBIST_CLK      = 40 MHz
QSPI_MEM_CLK   = 160 MHz
```

## 6.3 EB 配置步骤：从 0 到可用时钟

下面按实际配置思路讲，不严格等同于 EB 界面菜单名，因为不同 RTD/MCAL 版本界面文字可能略有差异。

### 6.3.0 EB tresos 界面图解：McuClockSettingConfig / General

![[../attachments/eb_tresos_mcu_clock_general_annotated_source.png]]

图源：用户提供的 EB tresos 工程截图，工程 `ECAS_RTA_S32K324GHS_Heating`，Mcu 模块 `McuClockSettingConfig -> General` 页面，截图保存于 `C:/Users/Administrator/AppData/Local/hermes/images/clip_20260513_091742_1.png`。

这张图对应的是 EB tresos 左侧 `Mcu (V4.0.0, AS4.7.0) -> Mcu`，右侧打开 `McuClockSettingConfig`。可以按下面这些标号理解：

```text
[1] 左侧 Mcu 模块
    这里是 AUTOSAR MCAL 的 Mcu 驱动配置入口。S32K324 的 FIRC、SIRC、FXOSC、SXOSC、PLL、MC_CGM MUX、Clock Reference Point、Clock Monitor 等，基本都在这个模块下配置。

[2] McuClockSettingConfig_0
    这是一个“时钟方案实例”。AUTOSAR Mcu 允许配置多个 clock setting，代码初始化时通过 Clock Setting Id 选择其中一个。
    本工程初始化代码里使用的是：
        McuConf_McuClockSettingConfig_McuClockSettingConfig_0
    所以这张图里的 `McuClockSettingConfig_0` 就是当前工程上电初始化实际使用的时钟方案。

[3] General 页签
    General 页主要放当前 clock setting 的总体信息，以及 CGM0 切换时钟时的全局参数。
    真正的时钟源和 MUX 细节在旁边页签：
        McuFIRC / McuSIRC / McuFXOSC / McuSXOSC / McuCgm0PcfsConfig / McuCgm0ClockMux0...n
[4] Mcu Clock Setting Id = 0
    含义：这个时钟方案的 ID。
    代码调用 `Mcu_InitClock(ClockID)` 时，ClockID 就是根据这里生成的枚举/宏来选择的。
    本工程只有一个主时钟方案时，配置为 0 是最常见、也最清晰的做法。
    为什么这么配：
        - 与 `McuClockSettingConfig_0` 名称一致，方便读代码和查配置。
        - 初始化代码使用 ID 0，不需要运行时切换多个 clock setting。
        - 如果后续增加低功耗/测试用时钟方案，可以再增加 ID 1、ID 2。

[5] McuCgm0SettingConfig
    CGM = Clock Generation Module。S32K3 的 MC_CGM 负责把 FIRC / FXOSC / PLL 等源时钟通过 MUX 和分频器分配给 core、bus、HSE、外设等。
    这个容器是 CGM0 相关的全局配置。下面的 PCFS 参数影响“渐进式时钟切换/分频切换”的速度。

[6] PCFS Time Per Step (µs) = 1
    PCFS 可理解为 Progressive Clock Frequency Switching，即时钟频率切换时不要一步跳到目标频率，而是按步进方式变化，降低瞬态冲击。
    这个字段表示每一步持续多少微秒，范围是 1 到 1365 µs。
    本工程配置为 1 µs，表示每一步时间取最小值。
    为什么这么配：
        - 时钟切换更快，启动时间更短。
        - 对当前 160 MHz 主频方案，通常可以满足启动速度需求。
        - 如果项目出现 EMC、供电瞬态、PLL/时钟切换不稳定问题，可以考虑适当增大该值，让切换更平缓。

[7] PCFS Step Duration = 48
    这个字段是 PCFS 步进持续参数，范围 0 到 65535。
    它通常和 Time Per Step 一起决定一次频率切换的总过渡时间。
    粗略理解：
        总过渡时间 ≈ PCFS Time Per Step × PCFS Step Duration
    当前配置：
        1 µs × 48 = 约 48 µs
    为什么这么配：
        - 48 µs 对启动阶段来说很短，不会明显拖慢上电初始化。
        - 相比完全瞬时切换，它仍然给 MC_CGM 一个受控过渡过程。
        - 如果硬件对频率跃迁敏感，可增大 Step Duration；如果追求极限启动速度且验证通过，可保持较小值。
```

对应到本工程时钟链路，这一页不是直接填写 `160 MHz`、`80 MHz`、`40 MHz` 的地方，而是定义“使用哪个时钟方案”和“CGM0 切换时怎么过渡”。实际频率主要在后续页签中形成：

```text
McuFXOSC        -> 外部 16 MHz 晶振
McuPll_0        -> 16 MHz 经 PLL 得到 PLL_PHI0 = 160 MHz, PLL_PHI1 = 240 MHz
McuCgm0ClockMux0 -> 选择 PLL_PHI0_CLK，并分出 CORE/AIPS/HSE/DCM/LBIST/QSPI 等时钟
McuClockReferencePoint -> 把最终频率登记给 MCAL 和其它模块使用
```

配置建议：

1. 如果项目只有一个运行时钟方案，`Mcu Clock Setting Id` 保持 0。
2. `Name` 不建议随意改，保持 `McuClockSettingConfig_0` 方便和生成代码、初始化代码互相搜索。
3. `PCFS Time Per Step = 1`、`PCFS Step Duration = 48` 可以作为当前工程的基线配置。
4. 如果后续调试中出现时钟切换相关复位、PLL lock 后切主频异常、EMC 瞬态问题，再回到这里调大 PCFS 过渡时间，并结合示波器/CLKOUT/复位源寄存器验证。
5. 修改这里后要重新生成 MCAL 代码，并检查 `Mcu_PBcfg.c` 中 CGM/PCFS 相关结构体是否同步变化。

### 步骤 1：确认芯片型号和目标频率

先回答这些问题：

1. 芯片是否确认为 S32K324？
2. 外部高速晶振是多少？本工程是 16 MHz。
3. 目标 core clock 是多少？本工程是 160 MHz。
4. HSE clock 是否有要求？本工程 reference point 为 80 MHz。
5. AIPS / slow bus 目标是多少？本工程为 80 MHz / 40 MHz。
6. CAN、ADC、SPI、I2C、PWM、STM 等外设各自需要多少时钟？

不要先打开 EB 乱点。先在纸上画出目标链路：

```text
FXOSC 16 MHz -> PLL0 VCO 960 MHz -> PLL_PHI0 160 MHz -> CORE 160 MHz / AIPS 80 MHz / AIPS_SLOW 40 MHz
                                      -> PLL_PHI1 240 MHz -> 某些高速外设 mux 再分频
```

### 步骤 2：配置 FIRC / SIRC

建议：

1. FIRC 作为基础内部高速时钟，保持 48 MHz。
2. SIRC 作为低功耗慢速时钟，必要时 Standby enable。
3. 若项目有低功耗唤醒，重点检查 SIRC/SXOSC/RTC/GPT 的关系。

本工程：

```text
FIRC under MCU control = true
FIRC div = /1
SIRC under MCU control = true
SIRC standby enable = true
```

### 步骤 3：配置 FXOSC

需要结合硬件：

1. 如果是普通晶体：一般不是 bypass。
2. 如果是有源晶振：要特别核对 EXTAL 输入、bypass、FXOSC 使能顺序。
3. 配置 FXOSC frequency 为实际硬件频率。
4. 配置稳定等待计数。
5. EMC/ESD 风险较高的项目，关注自动增益和 PLL loss of lock。

本工程：

```text
FXOSC frequency = 16 MHz
FXOSC bypass = false
FXOSC main comparator = true
FXOSC counter = 49
```

### 步骤 4：配置 PLL0

以本工程为例：

```text
PLL reference source = FXOSC_CLK
RDIV = 2
MFI = 120
ODIV0 = 5
ODIV1 = 3
```

得到：

```text
PLL_VCO = 960 MHz
PLL_PHI0 = 160 MHz
PLL_PHI1 = 240 MHz
```

检查项：

1. PLL 输入频率是否在手册允许范围内。
2. VCO 频率是否在手册允许范围内。
3. PHI 输出是否超过目标域最大频率。
4. 是否需要 spread spectrum / PLLFM 来改善 EMC。
5. 是否需要配置 PLL loss-of-lock 反应。

### 步骤 5：配置 MC_CGM MUX_0

本工程：

```text
MUX_0 source = PLL_PHI0_CLK
```

然后把 160 MHz 分给多个系统域：

```text
CORE_CLK      = 160 MHz
AIPS_PLAT_CLK = 80 MHz
AIPS_SLOW_CLK = 40 MHz
HSE_CLK       = 80 MHz
```

注意：

- Core 能跑不代表外设时钟都正确。
- AIPS_PLAT_CLK / AIPS_SLOW_CLK 是很多寄存器接口和低速外设的基础。
- 如果 AIPS 频率配置错误，可能出现外设访问异常、超时或 HardFault。

### 步骤 6：配置外设 MUX

例如：

```text
CAN0-2 PE clock = 40 MHz
CAN3-5 PE clock = 12 MHz
STM0/STM1 = 40 MHz
CLKOUT_RUN = 24 MHz
CLKOUT_STANDBY = 12 MHz
```

这里一定要和对应外设模块联动检查。

举例：CAN bit timing 配置中如果假设 PE clock 是 40 MHz，但 Mcu 里实际给了 12 MHz，最终 CAN 波特率会错。

### 步骤 7：配置 McuClockReferencePoint

`McuClockReferencePoint` 的意义不是“产生时钟”，而是告诉 MCAL：这些最终时钟点的频率是多少，供其它模块引用或供 `Mcu_GetClockFrequency()` 查询。

本工程例子：

```xml
<d:ctr name="STM0_CLK" type="IDENTIFIABLE">
  <d:var name="McuClockReferencePointFrequency" type="FLOAT" value="4.0E7"/>
  <d:var name="McuClockFrequencySelect" type="ENUMERATION" value="STM0_CLK"/>
</d:ctr>
```

应用代码里：

```c
Fstm = Mcu_GetClockFrequency(STM0_CLK);
```

所以 reference point 错了，应用拿到的频率也会错。

### 步骤 8：配置外设门控

本地检查清单强调：

- 外设门控时钟未使能时，对外设初始化可能进入 HardFault。
- RUN 模式的外设使能配置页面，需要勾选 FXOSC、PLL、PLLAUX，K3x8 才有 PLLAUX。
- 低功耗模式的外设使能配置页面中，不需要勾选 FXOSC、PLL、PLLAUX。
- 若 EB/S32DS CT 中未勾选 FXOSC/PLL/PLLAUX，并且在调用 `Mcu_SetMode()` 后调用功能复位，该复位可能变成破坏性复位，Standby RAM 数据丢失，复位源是 POR。

这条很关键，因为很多人只看 Mcu clock frequency，不看 mode/partition/clock gating。

### 步骤 9：生成代码并检查生成结果

生成后重点看：

```text
BasicSoftware/integration/mcal/src/gen/src/Mcu_PBcfg.c
BasicSoftware/integration/mcal/src/gen/src/Mcu_Cfg.c
BasicSoftware/integration/mcal/src/gen/include/Mcu_Cfg.h
BasicSoftware/integration/mcal/src/gen/include/Mcu_PBcfg.h
```

检查项：

1. PLL 参数是否与 EB 一致。
2. MUX source 是否正确。
3. Divider 是否正确。
4. Clock reference point 是否正确。
5. 是否启用了需要的外设门控。
6. 编译是否通过。

---

# 7. 初始化顺序：代码里真正发生了什么

本工程 Target 初始化代码中有如下逻辑：

文件：`E:/github/ECAS_RTA_S32K324GHS_Heating/BasicSoftware/integration/src/target/src/Target.c`

```c
static void Mcu_InitializeClock(void)
{
    volatile Mcu_ClockType ClockID = McuConf_McuClockSettingConfig_McuClockSettingConfig_0;
    Std_ReturnType InitClockRetVal;
    Mcu_PllStatusType Mcu_GetPllStatusRetVal = MCU_PLL_STATUS_UNDEFINED;

    InitClockRetVal = Mcu_InitClock(ClockID);

    if(InitClockRetVal == E_OK)
    {
        do
        {
            Mcu_GetPllStatusRetVal = Mcu_GetPllStatus();
        } while(Mcu_GetPllStatusRetVal != MCU_PLL_LOCKED);

        Mcu_DistributePllClock();
    }
}
```

这段代码非常标准，理解如下：

1. `ClockID` 选择 EB 里的 `McuClockSettingConfig_0`。
2. `Mcu_InitClock(ClockID)` 按 EB 配置初始化 FIRC/SIRC/FXOSC/PLL/MC_CGM 等。
3. 如果初始化返回 E_OK，就循环查询 PLL 状态。
4. 只有 `Mcu_GetPllStatus() == MCU_PLL_LOCKED` 后，才调用 `Mcu_DistributePllClock()`。
5. `Mcu_DistributePllClock()` 通常用于把 PLL 时钟真正切换/分发给系统。

为什么要等 PLL locked？

因为 PLL 未锁定时输出频率不稳定。如果此时切系统主频，可能导致 CPU、Flash、总线、外设进入不稳定状态，轻则外设异常，重则 HardFault 或复位。

---

# 8. 常见问题和排查清单

## 8.1 时钟配置没有严格遵守参考手册推荐选项

本地检查清单原文要点：

- 检查时钟配置是否严格遵守参考手册的几种推荐选项。
- 若使用非参考手册推荐的时钟选项，可能出现异常。
- 包括参考手册该选项的各个时钟部分设置，不仅仅是系统时钟。
- 不遵守可能出现各种异常问题，例如 Fee_write 不能写数据到 FLASH。

我的补充：

很多人以为只要 core clock 没超频就可以，但 S32K3 的时钟选项是一个组合：PLL、CORE、AIPS、HSE、Flash wait state、外设时钟、低功耗门控都要一起满足推荐配置。

## 8.2 外设门控没有打开导致 HardFault

现象：

- 外设初始化时 HardFault。
- 某个模块寄存器访问异常。
- Mcu_SetMode 后再复位，复位源异常或 Standby RAM 丢失。

检查：

1. RUN 模式下对应外设 clock gate 是否使能。
2. 对应 partition / COFB clock enable 是否打开。
3. 低功耗模式是否误勾选或漏勾选。
4. 是否在访问外设前已经完成 Mcu 初始化和 mode transition。

## 8.3 PLL loss of lock 导致复位

可能原因：

1. FXOSC 不稳定。
2. 晶振布局、电容、地参考不好。
3. EMC/ESD 干扰导致 FXOSC 或 PLL 失锁。
4. PLL unlock range 配置过窄。
5. 自动增益策略不适合当前硬件。

本地检查清单建议：

- 禁止 FXOSC 自动增益，特别是 EMC/ESD 触发 PLL 失锁时。
- 配置 PLL 中 ULKCTL 的 Unlock Range，例如尝试 +/-33。
- 对未使用 HSE 的产品，可尝试把 PLL loss of lock 从复位改成中断，在中断中切到 FIRC，再有限次数尝试恢复 PLL。
- 使用 HSE 的产品不能简单套用这种方法，因为 HSE 有时钟监控，PLL 失锁后 HSE 可能产生复位。

## 8.4 有源晶振使用注意事项

本地检查清单要点：

- 根据 K3 参考手册，FXOSC 使能前，有源晶振不能通过 EXTAL 引脚输入，EXTAL 应为低电平。
- 可以通过 MCU GPIO 控制有源晶振输出。
- 需要判断 `MUX_3_CSS` 是否已成功切换到时钟。
- 若未成功，需要再次操作 `MUX_3_CSC` 进行时钟切换，直到 `MUX_3_CSS` 指示切换完成，再继续后续配置。
- 如果有源晶振输出未稳定就切换，可能导致时钟切换失败。

## 8.5 HSE 相关等待

本地检查清单中有多条 HSE 与时钟初始化相关经验：

1. 未安装 HSE 固件时，时钟初始化前需要检查 / 等待 HSE 核进入 WFI。
2. 安装 HSE 固件时，Bootloader 和 APP 的时钟初始化前都需要等待 `HSE_STATUS_INIT_OK`。
3. 如果 HSE 还在初始化，M7 直接初始化时钟并启用 PLL，可能导致 HSE 工作频率变化，进而 HSE 初始化异常、HSE watchdog 动作、芯片复位。
4. 安全启动中使用 PLL 时，可能需要写 FXOSC 配置和 DCF 时钟配置。具体要按 HSE 参考手册和项目安全启动方案确认。

这部分在做 Bootloader、HSE firmware、secure boot 时尤其重要。

## 8.6 ADC 超频

对 S32K324：

- ADC 转换时钟最高 80 MHz。
- ADC 校准时钟最高 40 MHz。

如果超过，可能：

1. 校准失败。
2. 数据采集异常。
3. 严重时损坏 MCU。

所以 ADC 问题不要只看 Adc.xdm，还要回头看 Mcu.xdm 给 ADC 的源频率。

## 8.7 CLKOUT / Trace / BIST

本地检查清单提到：

- Trace 时钟和 CLKOUT 需要设置成 FIRC。
- 若 Trace 时钟和 CLKOUT 时钟未设置成 FIRC，进行 BIST 后，时钟初始化时间会增加。

本工程：

```text
CLKOUT_RUN = 24 MHz
CLKOUT_STANDBY = 12 MHz
```

若需要外部测量时钟，可将 CLKOUT 映射到引脚，用示波器确认频率是否与 EB 配置一致。

---

# 9. 实战验证方法

## 9.1 软件验证

1. 查看 `Mcu.xdm`：确认源、PLL、MUX、divider、reference point。
2. 查看生成代码：确认 EB 生成值没有被手改或生成失败。
3. 编译：确认 Mcu 配置和外设配置没有冲突。
4. 运行时调用：

```c
Mcu_GetClockFrequency(CORE_CLK);
Mcu_GetClockFrequency(AIPS_PLAT_CLK);
Mcu_GetClockFrequency(AIPS_SLOW_CLK);
Mcu_GetClockFrequency(STM0_CLK);
Mcu_GetClockFrequency(FLEXCAN_PE_CLK0_2);
```

5. 对照 EB reference point 频率。

## 9.2 寄存器验证

重点寄存器方向：

```text
FXOSC.STAT[OSC_STAT]       // FXOSC 是否稳定
PLLDIG.PLLSR[LOCK]         // PLL 是否 lock
MC_CGM_MUX_x_CSS           // MUX 当前选择状态
MC_CGM_MUX_x_DC_y          // Divider 配置
MC_ME partition clock gate // 外设门控
RGM reset source           // 是否发生 PLL/clock 相关复位
```

## 9.3 硬件验证

1. 用 CLKOUT 输出某个时钟，用示波器测。
2. 测 EXTAL/XTAL 波形，确认晶振稳定性。
3. EMC/ESD 问题时，配合复位源记录判断是否 PLL loss of lock。
4. CAN/SPI/I2C 用协议分析仪确认实际速率。
5. ADC 用固定输入电压验证采样稳定性。

---

# 10. 本工程配置速查表

| 项目 | 本工程配置 | 说明 |
|---|---:|---|
| FIRC | 48 MHz | 内部快速 RC |
| SIRC | 32 kHz | 内部慢速 RC，Standby enabled |
| FXOSC | 16 MHz | 外部高速晶振，PLL 参考源 |
| SXOSC | 32.768 kHz | 外部低速晶振 |
| PLL0 VCO | 960 MHz | 16/2*120 |
| PLL_PHI0 | 160 MHz | MUX_0 source |
| PLL_PHI1 | 240 MHz | MUX10/11 source |
| CORE_CLK | 160 MHz | CPU 主时钟 |
| AIPS_PLAT_CLK | 80 MHz | 平台/总线相关 |
| AIPS_SLOW_CLK | 40 MHz | 慢速总线/部分外设 |
| HSE_CLK | 80 MHz | HSE 时钟 |
| DCM_CLK | 40 MHz | DCM |
| LBIST_CLK | 40 MHz | LBIST |
| QSPI_MEM_CLK | 160 MHz | QSPI memory clock |
| STM0_CLK | 40 MHz | STM0 |
| STM1_CLK | 40 MHz | STM1 |
| FLEXCAN_PE_CLK0_2 | 40 MHz | CAN0-2 协议时钟 |
| FLEXCAN_PE_CLK3_5 | 12 MHz | CAN3-5 协议时钟 |
| CLKOUT_RUN | 24 MHz | 运行模式 CLKOUT |
| CLKOUT_STANDBY | 12 MHz | Standby CLKOUT |

---

# 11. 记忆口诀

```text
先源头，后倍频；
先稳定，后切换；
先 MUX，后分频；
先门控，后访问；
先 Mcu，后外设；
先 reference point，后 baudrate；
先看手册推荐组合，再谈自定义频率。
```

---

# 12. 后续建议

1. 如果要继续深入，下一篇可以专门写：`S32K324 MC_ME / 外设门控 / 低功耗模式`。
2. 如果要结合项目排查，可以从 `Mcu.xdm` 自动生成一张完整的项目时钟树图。
3. 如果要做培训材料，可以把这篇拆成：基础时钟源、PLL 计算、MC_CGM、EB 配置、故障排查五个章节。
4. 如果你能导出有道云笔记的原始 `.md/.docx/.html`，还可以把更多案例继续合并到本笔记的“常见问题和排查清单”章节。
