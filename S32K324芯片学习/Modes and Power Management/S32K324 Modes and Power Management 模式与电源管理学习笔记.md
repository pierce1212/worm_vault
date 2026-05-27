---
title: S32K324 Modes and Power Management 模式与电源管理学习笔记
tags:
  - S32K324
  - S32K3xx
  - Modes-and-Power-Management
  - MC_ME
  - PMC
  - MC_RGM
  - EB-tresos
  - AUTOSAR-MCAL
  - S32K324_TEL9471
created: 2026-05-13
updated: 2026-05-13
sources:
  - NXP S32K3xx Reference Manual Rev.9, 07/2024, Chapter 31 Reset Overview, Chapter 41 Power Management, Chapter 42 PMC, Chapter 46 MC_ME
  - E:/github/ECAS_RTA_S32K324GHS_Heating/BasicSoftware/integration/mcal/MCAL_Cfg/config/Mcu.xdm
  - E:/github/ECAS_RTA_S32K324GHS_Heating/BasicSoftware/integration/mcal/src/gen/src/Power_Ip_PBcfg.c
  - E:/github/ECAS_RTA_S32K324GHS_Heating/BasicSoftware/integration/mcal/src/gen/include/Mcu_Cfg.h
  - E:/github/ECAS_RTA_S32K324GHS_Heating/BasicSoftware/integration/mcal/src/integration/src/Mcu_Integration.c
  - E:/github/ECAS_RTA_S32K324GHS_Heating/BasicSoftware/integration/src/target/src/Target.c
related:
  - "[[../S32K324 Clocking 时钟系统学习笔记]]"
  - "[[../Real-time control/S32K324 Real-time control 实时控制学习笔记]]"
---

# S32K324 Modes and Power Management 模式与电源管理学习笔记

> 这篇笔记继续按 clocking 笔记的方式写：先用 Reference Manual 建立概念，再映射到 EB tresos / MCAL 的配置项，最后结合当前 E:/github 与 E:/git_project 里的 S32K324 工程代码说明实际生效路径。
>
> 重要修正：`S32K324_TEL9471` 工程确实在 `E:/git_project/S32K324_TEL9471`。之前我只在 `E:/github` 下搜索，漏掉了 `E:/git_project`，这是我的疏忽。下面笔记已补充 TEL9471 工程的 EB 配置与代码路径，并把它和 `E:/github/ECAS_RTA_S32K324GHS_Heating` 做对照。

## 1. 这个章节到底在讲什么

在 S32K3xx Reference Manual 里，“Modes and Power Management” 不是单独一个寄存器模块，而是一条系统级主线：

1. 芯片有哪些运行/低功耗模式；
2. Reset / Run / Standby 之间怎么切换；
3. 哪些电源域在 Run / Standby 中保持；
4. PMC 如何管理内部 regulator、电压监控、last-mile regulator；
5. MC_ME 如何控制 mode entry、core clock gating、peripheral clock gating；
6. MC_RGM 如何管理 reset 源、reset sequence、functional/destructive reset；
7. 应用软件、EcuM、MCAL Mcu 模块如何把这些硬件机制串起来。

对 S32K324 项目最实用的理解方式是：

```text
电源是否稳定 / 哪个电源域上电
        ↓ PMC / PCU
Reset 是否释放、属于哪类 reset
        ↓ MC_RGM
当前要处于 Reset / Run / Standby 哪种模式
        ↓ MC_ME
哪些 core、partition、peripheral clock 打开
        ↓ MC_ME PRTN/COFB + MC_CGM clock tree
AUTOSAR Mcu_Init / Mcu_SetMode / Mcu_InitClock / EcuM reset callout
        ↓
项目中 CAN/LIN/SPI/ADC/PIT/STM/WDG 等外设能否工作
```

## 2. 资料来源和章节范围

| 章节 | 名称 | 本笔记关注点 |
|---|---|---|
| Chapter 31 | Reset Overview | POR、destructive reset、functional reset、RESET_B、reset reason |
| Chapter 41 | Power Management | Run/Standby 模式、电源域、Standby entry/exit 流程 |
| Chapter 42 | Power Management Controller, PMC | regulator、电压监控、last-mile regulator、PMC.CONFIG |
| Chapter 46 | Mode Entry Module, MC_ME | Reset/Run/Standby 模式、partition/core/peripheral clock gating |

当前工程重点文件：

| 文件 | 作用 |
|---|---|
| `Mcu.xdm` | EB tresos 的 Mcu 配置源，包含 mode、power、reset、PMC、peripheral clock gating |
| `Power_Ip_PBcfg.c` | EB 生成的底层 Power IP 配置，Mcu_SetMode/Mcu_Init/Mcu_PerformReset 最终会用到 |
| `Mcu_PBcfg.c` | Mcu_Config 总表，连接 clock config、mode config、RAM config、Power_Ip_HwIPsConfigPB |
| `Mcu_Cfg.h` | 生成的开关宏，例如低功耗、reset API、power mode state API |
| `Mcu_Integration.c` | 集成层初始化顺序示例：先 SetMode，再 InitClock/PLL |
| `Target.c` | 项目 Target 初始化中实际调用 clock 初始化、GPT/PIT 初始化 |
| `EcuM_Callout_Stubs.c` | EcuM reset callout，调用 Mcu_PerformReset 或板级睡眠/硬件 reset |
| `Diag_McuResetReason.c` | 诊断侧读取 Mcu_GetResetReason / Mcu_GetResetRawValue |

TEL9471 工程补充来源：

| 文件 | 作用 |
|---|---|
| `E:/git_project/S32K324_TEL9471/EB_Configuration/config/Mcu.xdm` | TEL9471 的 EB Mcu 配置源 |
| `E:/git_project/S32K324_TEL9471/src/00BSW/MCAL_Dynamic/src/Power_Ip_PBcfg.c` | TEL9471 EB 生成的 Power IP 配置 |
| `E:/git_project/S32K324_TEL9471/src/00BSW/MCAL_Dynamic/include/Mcu_Cfg.h` | TEL9471 Mcu 宏开关与 callout 配置 |
| `E:/git_project/S32K324_TEL9471/src/02SWC/00Main/src/Target.c` | TEL9471 实际 Target 初始化路径，包含 Mcu_Init、Mcu_SetMode、Mcu_InitClock |
| `E:/git_project/S32K324_TEL9471/BasicSoftware/integration/src/bsw/EcuM/integration/EcuM_Callout_Stubs.c` | TEL9471 EcuM reset/wakeup callout |
| `E:/git_project/S32K324_TEL9471/CDD/SafetyPack/Pmc/src/MC_Pmc.c` | TEL9471 reset/PMC/CMU notification callout 实现位置 |

---

## 3. 先看手册：S32K324 的运行模式

### 3.1 MC_ME 支持的模式

Reference Manual Chapter 46 明确：S32K3xx 芯片实现这些 MC_ME modes：Reset、Run、Standby。

![[../../attachments/fig46-1_mc_me_modes_page1726.png]]

图源：NXP S32K3xx Reference Manual Rev.9, Chapter 46 Mode Entry Module, PDF page 1726。

### 3.2 Reset mode

Reset mode 是芯片复位序列中的状态，不是应用软件正常长时间运行的模式。进入 reset 可能来自：

- 上电 POR；
- destructive reset；
- functional reset；
- 外部 RESET_B；
- watchdog reset；
- FCCU / clock fail / PLL loss-of-lock 等安全相关 reset；
- software reset。

应用软件一般看到的是 reset 之后的结果：

- boot flow 重新开始；
- MC_RGM/FES/DES 等寄存器记录 reset reason；
- AUTOSAR `Mcu_GetResetReason()` 读取并映射成 `Mcu_ResetType`；
- 项目诊断模块把 reset reason 上报或存储。

### 3.3 Run mode

Run mode 是项目正常工作模式。手册对 Run mode 的描述重点是：

- 芯片保持 fully powered；
- Run entry 后 boot core 是唯一默认 enabled 的 core；
- 软件可以按需求打开 application cores 和 peripherals；
- pin/self-test 可以按需求配置；
- 外设使用前必须打开对应 clock，否则访问外设寄存器可能 HardFault。

结合本工程，Run mode 就是当前实际使用的唯一 Mcu mode：

- `Mcu.xdm` 中 `McuNumberOfMcuModes = 1`；
- 唯一的 `McuModeSettingConf` 配置为 `McuPowerMode = RUN`；
- 生成代码 `Power_Ip_aModeConfigPB[0]` 的 power mode 是 `POWER_IP_RUN_MODE`；
- 项目初始化调用 `Mcu_SetMode(McuModeSettingConf)` 让 MC_ME partition / COFB 配置生效。

### 3.4 Standby mode

Standby 是 S32K3 的低功耗模式。手册 Chapter 41 说芯片有两个 power modes：

1. Run mode：正常高性能运行，Run domain 供电；
2. Standby mode / LPM：低性能、低功耗模式，Run domain 关闭，cores 和大部分模块不可用。

Standby mode 下支持的能力包括：

- STANDBY_RAM 内容保持；
- WKPU 数字输入唤醒；
- CMP analog trigger 唤醒；
- on-chip timer 唤醒：RTI，也就是 PIT0 function；SWT0；RTC；
- FIRC、SIRC、SXOSC、FXOSC 等 clocking modules 可以按配置选择在 Standby 中 enable/disable。

![[../../attachments/fig41-1_power_architecture_page1645.png]]

图源：NXP S32K3xx Reference Manual Rev.9, Chapter 41 Power Management, PDF page 1645。

当前工程虽然把 `McuEnterLowPowerMode` 配成 `true`，但是没有配置第二个 Standby mode。也就是说：驱动能力支持低功耗入口，但当前 EB 配置只生成了 Run mode，因此应用层还不能直接用 `Mcu_SetMode(x)` 进入 Standby，除非后续新增一个 `McuModeSettingConf_Standby`。

---

## 4. Power Management：电源域与 Standby 流程

### 4.1 PMC / PCU / MC_ME / MC_RGM 的分工

| 模块 | 主要职责 | 对软件的意义 |
|---|---|---|
| PMC | 管理 regulator、电压监控、last-mile regulator、低功耗 regulator | 决定芯片电源是否满足 Run/Standby 要求 |
| MC_PCU / PCU | 电源控制 FSM，执行硬件低功耗握手 | 软件触发 Standby 后由硬件完成部分时序 |
| MC_ME | mode entry、partition/core/peripheral clock gating | EB Mcu mode 配置主要落到这里 |
| MC_RGM | reset generation、reset reason、functional/destructive reset | `Mcu_PerformReset`、`Mcu_GetResetReason` 主要相关 |
| DCM_GPR | boot/padkeeping/Standby bypass 等配置 | Standby IO/padkeeping、fast standby exit 会涉及 |

### 4.2 S32K324 的 Standby entry 三阶段

手册 Chapter 41.5 说明 Standby entry sequence 包含三大阶段：

1. Standby mode entry configuration phase，也就是 software Standby mode entry sequence；
2. Standby mode entry handshake phase，也就是 hardware Standby mode entry sequence；
3. PMC Standby mode entry。

![[../../attachments/fig41-2_power_up_standby_sequence_page1654.png]]

图源：NXP S32K3xx Reference Manual Rev.9, Chapter 41 Power Management, Figure 176, PDF page 1654。

### 4.3 软件 Standby entry 的四步

| 步骤 | 名称 | 主要动作 |
|---|---|---|
| SW1 | Module shutdown process | 关闭不需要的通信/外设，配置 MC_ME COFB clock gating，配置 Standby IO/padkeeping/wakeup |
| SW2 | Application core shutdown process | application cores 执行 WFI，main core 配置 standby entry 与 wakeup source |
| SW3 | Flash low-power handshake and PMC last-mile regulator control | flash low-power handshake、关闭 PLLDIG、配置 FIRC/SIRC/FXOSC/SXOSC standby、配置 regulator |
| SW4 | Main core shutdown process | WKPU 先配置好，disable interrupts，最后 main core 执行 WFI |

手册特别强调：进入 Standby 前，system clock source 必须切到 FIRC 48 MHz，因为 PLLDIG 在 Standby mode 不可用。当前工程正常 Run 使用 PLL 分发后的高频系统时钟。如果未来要做 Standby，需要增加“进入前切 FIRC、退出后重新初始化 PLL/clock tree”的路径。

![[../../attachments/fig41-3_standby_io_module_config_page1657.png]]

图源：NXP S32K3xx Reference Manual Rev.9, Chapter 41 Power Management, Figure 177, PDF page 1657。

### 4.4 Standby 中什么还活着

Standby entry 完成后：

- Standby domain peripherals 按 SW1 配置保留；
- pad keeping 生效；
- 除 Standby RAM 外，大部分 memory power down；
- Standby domain 和 Run domain 隔离；
- Run domain held in reset；
- cores off；
- 等待 wakeup event。

可以作为唤醒源的典型模块：WKPU、CMP analog trigger、RTI(PIT0 的相关功能)、SWT0、RTC。

结合本项目：`RTC`、`PIT_0`、`SWT_0`、`WKPU` 在 Mcu peripheral clock gating 表中都被配置为 enable。但“clock gating enable”不等价于“低功耗唤醒已经完整配置”。还需要：

1. 具体模块自身的 Standby/wakeup 配置；
2. 中断或 wakeup event 选择；
3. padkeeping / IO 配置；
4. EcuM wakeup source 配置和 callout；
5. Standby mode 本身在 `McuModeSettingConf` 中存在。

---

## 5. EB tresos：Mcu 模块里应该怎么看 Modes and Power

### 5.1 EB 中的配置入口

在 EB tresos 里，这一章的内容主要分散在 Mcu 模块下：

```text
Mcu
 ├─ McuGeneralConfiguration
 │   ├─ McuEnterLowPowerMode
 │   ├─ McuPerformResetApi
 │   ├─ McuGetPowerModeStateApi
 │   ├─ McuGetPowerDomainApi
 │   └─ McuPmcNotification / McuPmcAeNotification
 ├─ McuModuleConfiguration
 │   ├─ McuClockSettingConfig
 │   │   ├─ McuFIRC / McuSIRC / McuFXOSC / McuSXOSC standby options
 │   │   └─ MC_CGM / PLL / clock mux settings
 │   ├─ McuModeSettingConf
 │   │   ├─ McuPowerMode
 │   │   ├─ McuMainCoreSelect
 │   │   ├─ McuEnableSleepOnExit
 │   │   ├─ McuPartitionConfiguration
 │   │   └─ McuPeripheral clock enable map
 │   ├─ McuRamSectorSettingConf
 │   ├─ McuResetConfig
 │   └─ McuPowerControl
 │       ├─ McuDCM_GPR_Config
 │       ├─ McuPMC_Config
 │       └─ McuPMC_AE_Config
```

### 5.2 General configuration 当前值

来自 `Mcu.xdm`：

| EB 字段 | 当前值 | 说明 |
|---|---:|---|
| `McuNoPll` | `false` | 工程使用 PLL |
| `McuEnterLowPowerMode` | `true` | 生成低功耗相关支持宏：`MCU_ENTER_LOW_POWER_MODE = POWER_IP_ENTER_LOW_POWER_MODE` |
| `McuTimeout` | `50000` | Power/clock 操作超时，生成 `POWER_IP_TIMEOUT_VALUE_US = 50000U` |
| `McuEnableUserModeSupport` | `false` | Mcu/Power IP 不支持 user mode 调用 |
| `McuPerformResetApi` | `true` | 生成 `Mcu_PerformReset()` API |
| `McuCalloutBeforePerformReset` | `false` | reset 前不调用用户 callout |
| `McuPmcNotification` | `NULL_PTR` 且 disabled | PMC notification 未启用 |
| `McuPmcAeNotification` | `NULL_PTR` 且 disabled | PMC AE notification 未启用 |
| `McuGetPowerModeStateApi` | `false` | 不生成 `Mcu_GetPowerMode_State()` |
| `McuGetPowerDomainApi` | `false` | 不生成 PMU domain status 查询 API |
| `McuGetClockFrequencyApi` | `true` | 允许 `Mcu_GetClockFrequency()`，项目 Time.c 已使用 |

生成代码交叉验证：

```c
/* Mcu_Cfg.h */
#define MCU_ENTER_LOW_POWER_MODE           POWER_IP_ENTER_LOW_POWER_MODE
#define MCU_PERFORM_RESET_API              POWER_IP_PERFORM_RESET_API
#define MCU_POWERMODE_STATE_API            (STD_OFF)
#define MCU_GET_POWER_DOMAIN_API           (STD_OFF)
```

### 5.3 Mode Setting 当前值

来自 `Mcu.xdm` 的 `McuModeSettingConf`：

| EB 字段 | 当前值 | 工程意义 |
|---|---:|---|
| `McuNumberOfMcuModes` | `1` | 只配置了一个 Mcu mode |
| `McuMode` | `0` | Mode ID 为 0 |
| `McuPowerMode` | `RUN` | 唯一 mode 是 Run，不是 Standby |
| `McuMainCoreSelect` | `CM7_0` | main core 选择 CM7_0 |
| `McuCoreLockStepEnable` | `false` | 不启用 lockstep |
| `McuEnableSleepOnExit` | `false` | 中断退出后不自动 sleep |
| `McuPartition0/1/2/3 UnderMcuControl` | `true` | 分区由 MCU 配置控制 |
| `McuPartitionPowerUnderMcuControl` | `true` | 分区电源管理由 MCU 控制 |
| `McuPartitionClockEnable` | `true` | 分区时钟启用 |

生成代码对应关系：

```c
/* Power_Ip_PBcfg.c */
const Power_Ip_ModeConfigType Power_Ip_aModeConfigPB[1U] =
{
    (Power_Ip_ModeType)0U,
    POWER_IP_RUN_MODE,
    (boolean)FALSE,
    &Power_Ip_MC_ME_ModeConfigPB_0,
    &Power_Ip_DCM_GPR_ConfigPB_0
};
```

所以本工程的 `Mcu_SetMode(McuModeSettingConf)` 不是进入低功耗，而是把 Run mode 下的 MC_ME partition/core/peripheral gating 配置落到硬件。

### 5.4 Clock source 的 Standby 配置

在 `McuClockSettingConfig_0` 里，跟 Standby 相关的字段如下：

| EB 字段 | 当前值 | 说明 |
|---|---:|---|
| `McuFircStandbyEnable` | `false` | FIRC 不配置为 Standby 保持 |
| `McuSircStandbyEnable` | `true` | SIRC 配置为 Standby 保持 |
| `McuFxoscPowerDownCtr` | `true` | FXOSC 支持/配置 power down 控制 |
| `McuSxoscPowerDownCtr` | `true` | SXOSC 支持/配置 power down 控制 |
| `McuFIRC_Frequency` | `48 MHz` | Run/切换前 fallback clock |
| `McuSIRC_Frequency` | `32 kHz` | WDG/SWT 和低功耗相关常用慢时钟 |
| `McuFXOSC_Frequency` | `16 MHz` | 外部高速晶振/PLL 参考 |
| `McuSXOSC_Frequency` | `32768 Hz` | 低速晶振，RTC/低功耗常见来源 |

注意：手册说进入 Standby 前系统时钟必须切到 FIRC 48 MHz，但当前 `McuFircStandbyEnable=false`。这并不冲突：切 FIRC 是 Standby entry 过程前的软件条件；Standby 期间 FIRC 是否保持，是另外一个低功耗策略。如果要 RTC/SIRC/SXOSC 唤醒，需要结合具体唤醒源重新确认 clock source 是否保持。

### 5.5 McuPowerControl 当前值

`McuPowerControl` 下的 PMC 配置对 regulator 和低功耗行为很关键。当前工程：

| EB 字段 | 当前值 | 含义 |
|---|---:|---|
| `McuPMICPGOODBypasses` | `false` | 不 bypass PMIC PGOOD handshake |
| `McuLMAUTOENEnable` | `false` | last-mile regulator auto-enable 关闭 |
| `McuLVDIEEnable` | `false` | low-voltage detect interrupt 关闭 |
| `McuHVDIEEnable` | `false` | high-voltage detect interrupt 关闭 |
| `McuLMSMPSENEnable` | `true` | last-mile SMPS enable |
| `McuLVRBLPENEnable` | `false` | LVR boot/low-power 相关使能关闭 |
| `McuLPM25ENEnable` | `false` | Standby 中 2.5 V regulator 不保持 |
| `McuFASTRECEnable` | `false` | fast standby recovery 关闭 |
| `McuLMBCTLENEnable` | `false` | last-mile BJT collector 相关控制关闭 |
| `McuLMENEnable` | `true` | last-mile regulator enable |
| `McuSMPSConfSelect` | `15` | SMPS 配置选择 |
| `McuLinphySupplyEnable` | `true` | LIN PHY supply enable |
| `McuLinphySupplySelect` | `VSUP_PIN` | LIN PHY 供电选择 VSUP_PIN |
| `McuVddVoltageLevelSelect` | `VDD_3_3V` | VDD 电压等级 3.3 V |

生成代码中对应 PMC.CONFIG：

```c
static const Power_Ip_PMC_ConfigType Power_Ip_PMC_ConfigPB =
{
    ((uint32)0x00000000U) | PMC_CONFIG_LMEN_MASK
};
```

也就是说 EB 当前实际只生成了 `PMC_CONFIG_LMEN_MASK` 这个关键位。它与 `McuLMENEnable=true` 对应。

### 5.6 Reset 配置当前值

`McuResetConfig` 当前值：

| EB 字段 | 当前值 | 说明 |
|---|---:|---|
| `McuResetType` | `FunctionalReset` | `Mcu_PerformReset()` 执行 functional reset |
| `McuFuncResetEscThreshold` | `15` | functional reset escalation threshold |
| `McuDestResetEscThreshold` | `0` | destructive reset escalation threshold |
| `McuEnableResetEntryTimer` | `false` | reset entry timer 关闭 |
| `McuResetEntryTimerValue` | `0` | 未使用 |
| `McuFCCU_RST_ResetSource/McuDisableReset` | `false` | 不屏蔽 FCCU reset |
| `McuSWT0/1/2/3_RST_ResetSource/McuDisableReset` | `false` | 不屏蔽 watchdog reset |
| `McuJTAG_RST_ResetSource/McuDisableReset` | `false` | 不屏蔽 JTAG reset |
| `McuDEBUG_FUNC_ResetSource/McuDisableReset` | `false` | 不屏蔽 debug functional reset |

生成代码对应：

```c
static const Power_Ip_MC_RGM_ConfigType Power_Ip_MC_RGM_ConfigPB =
{
    (MCU_FUNC_RESET),
    MC_RGM_FRET_FRET((uint32)15U),
    MC_RGM_DRET_DRET((uint32)0U)
};
```

项目 EcuM reset callout 里也用到了：

```c
case ECUM_RESET_MCU:
    Mcu_PerformReset();
    break;
case ECUM_RESET_WDGM:
    Mcu_PerformReset();
    break;
```

所以当前软件 reset / WdgM reset 走的是 Mcu driver 配置的 functional reset。

### 5.7 TEL9471 工程 EB 配置补充

`E:/git_project/S32K324_TEL9471` 的 Mcu 配置路径是：

```text
E:/git_project/S32K324_TEL9471/EB_Configuration/config/Mcu.xdm
E:/git_project/S32K324_TEL9471/src/00BSW/MCAL_Dynamic/src/Power_Ip_PBcfg.c
E:/git_project/S32K324_TEL9471/src/00BSW/MCAL_Dynamic/include/Mcu_Cfg.h
```

TEL9471 和 `ECAS_RTA_S32K324GHS_Heating` 的整体模式配置很像：同样只有一个 Run mode，没有真正新增 Standby mode。

| 配置项 | TEL9471 当前值 | 说明 |
|---|---:|---|
| `McuEnterLowPowerMode` | `true` | 驱动生成低功耗能力支持 |
| `McuNumberOfMcuModes` | `1` | 仍然只有一个 Mcu mode |
| `McuModeSettingConf_Run/McuMode` | `0` | Run mode ID 为 0 |
| `McuPowerMode` | `RUN` | 唯一 mode 是 RUN |
| `McuMainCoreSelect` | `CM7_0` | main core 选择 CM7_0 |
| `McuEnableSleepOnExit` | `false` | 不使用 sleep-on-exit |
| `McuPerformResetApi` | `true` | 生成 `Mcu_PerformReset()` |
| `McuCalloutBeforePerformReset` | `true` | TEL9471 启用了 reset 前 callout，这点和 Heating 工程不同 |
| `McuGetPowerModeStateApi` | `false` | 不生成 power mode state 查询 |
| `McuGetPowerDomainApi` | `false` | 不生成 power domain 查询 |
| `McuGetClockFrequencyApi` | `false` | TEL9471 没开 `Mcu_GetClockFrequency()` |

生成代码确认：

```c
/* E:/git_project/S32K324_TEL9471/src/00BSW/MCAL_Dynamic/src/Power_Ip_PBcfg.c */
const Power_Ip_ModeConfigType Power_Ip_aModeConfigPB[1U] =
{
    {
        (Power_Ip_ModeType)0U,
        POWER_IP_RUN_MODE,
        (boolean)FALSE,
        &Power_Ip_MC_ME_ModeConfigPB_0,
        &Power_Ip_DCM_GPR_ConfigPB_0
    }
};
```

TEL9471 的 Standby clock 配置和 Heating 工程有一个关键差异：

| EB 字段 | TEL9471 | Heating 工程 | 影响 |
|---|---:|---:|---|
| `McuFircStandbyEnable` | `false` | `false` | 两者都不保持 FIRC standby |
| `McuSircStandbyEnable` | `false` | `true` | TEL9471 没让 SIRC 在 Standby 保持；如果未来要低功耗 watchdog/慢时钟唤醒，要重点复查 |
| `McuFxoscPowerDownCtr` | `true` | `true` | 都配置 FXOSC power down 控制 |
| `McuSxoscPowerDownCtr` | `true` | `true` | 都配置 SXOSC power down 控制 |
| `McuFIRC_Frequency` | 48 MHz | 48 MHz | 一致 |
| `McuSIRC_Frequency` | 32 kHz | 32 kHz | 一致 |
| `McuFXOSC_Frequency` | 16 MHz | 16 MHz | 一致 |
| `McuSXOSC_Frequency` | 32768 Hz | 32768 Hz | 一致 |

TEL9471 的 PMC 配置也不同：

| EB 字段 | TEL9471 当前值 | 说明 |
|---|---:|---|
| `McuLMENEnable` | `true` | last-mile regulator enable |
| `McuLVDIEEnable` | `true` | low-voltage detect interrupt enable |
| `McuHVDIEEnable` | `true` | high-voltage detect interrupt enable |
| `McuLMSMPSENEnable` | `false` | last-mile SMPS 没开 |
| `McuLPM25ENEnable` | `false` | Standby 中 2.5 V regulator 不保持 |
| `McuFASTRECEnable` | `false` | fast recovery 不开 |

生成代码确认：

```c
static const Power_Ip_PMC_ConfigType Power_Ip_PMC_ConfigPB =
{
    ((uint32)0x00000000U) | PMC_CONFIG_LMEN_MASK | PMC_CONFIG_HVDIE_MASK | PMC_CONFIG_LVDIE_MASK
};
```

这说明 TEL9471 在 PMC 上比 Heating 工程多打开了 HVD/LVD interrupt。`Mcu_Cfg.h` 中也能看到相关 notification 宏：

```c
#define MCU_RESET_CALLOUT   (McuPerformResetCallout)
#define MCU_CMU_FCCU_NOTIFICATION(ClockName) (McuCmuNotification(ClockName))
#define MCU_ERROR_ISR_NOTIFICATION(u8ErrorCode) (McuErrorIsrNotification(u8ErrorCode))
#define MCU_PMC_NOTIFICATION(ePowerEvent) (McuPmcNotification(ePowerEvent))
#define MCU_CMU_ERROR_ISR_USED (STD_ON)
```

对应 callout 在：

```text
E:/git_project/S32K324_TEL9471/CDD/SafetyPack/Pmc/src/MC_Pmc.c
```

其中 `McuPerformResetCallout()` 当前还是空壳：

```c
void McuPerformResetCallout(void)
{
    /* when you call Mcu_PerformReset() this function will be called */
    /* do your reset here */
}
```

因此，虽然 TEL9471 配置了 `McuCalloutBeforePerformReset=true`，但目前 callout 没做实质动作。以后如果要在 reset 前关闭外部电源、记录 reset 原因、通知 PMIC 或保存 NVM 标志，可以放在这里。

---

## 6. MC_ME peripheral clock gating：当前工程具体打开了什么

### 6.1 为什么 Modes 章节会影响外设能不能访问

MC_ME 的 peripheral clock gating 是本章节最容易和外设调试关联的点。手册 Chapter 46 提醒：

> Before accessing the registers of a peripheral to start using it, its clock must be turned on, otherwise, a Hard-Fault event will occur.

所以如果某个外设寄存器访问 HardFault，不只要看该外设 MCAL 配置，还要看：

1. MC_CGM 有没有给这个外设提供 clock source；
2. MC_ME COFB clock gating 是否 enable；
3. 对应 partition 是否 enable；
4. 外设自身模块是否 release reset / enable。

### 6.2 当前工程 McuPeripheral 关键配置表

当前 `Mcu.xdm` 中 `McuPeripheral` 共配置了 111 个外设 clock gating 条目，下面列出项目最相关的部分：

| 外设 | MC_ME mode entry slot | Clock enable |
|---|---|---|
| `TRGMUX` | `PRTN0_COFB1_REQ32` | `true` |
| `BCTU` | `PRTN0_COFB1_REQ33` | `true` |
| `EMIOS_0` | `PRTN0_COFB1_REQ34` | `true` |
| `EMIOS_1` | `PRTN0_COFB1_REQ35` | `true` |
| `EMIOS_2` | `PRTN0_COFB1_REQ36` | `true` |
| `LCU_0` | `PRTN0_COFB1_REQ38` | `true` |
| `LCU_1` | `PRTN0_COFB1_REQ39` | `true` |
| `ADC_0` | `PRTN0_COFB1_REQ40` | `true` |
| `ADC_1` | `PRTN0_COFB1_REQ41` | `true` |
| `ADC_2` | `PRTN0_COFB1_REQ42` | `true` |
| `PIT_0` | `PRTN0_COFB1_REQ44` | `true` |
| `PIT_1` | `PRTN0_COFB1_REQ45` | `true` |
| `EDMA` | `PRTN1_COFB0_REQ3` | `true` |
| `SWT_0` | `PRTN1_COFB0_REQ28` | `true` |
| `STM_0` | `PRTN1_COFB0_REQ29` | `true` |
| `DMAMUX_0` | `PRTN1_COFB1_REQ32` | `true` |
| `DMAMUX_1` | `PRTN1_COFB1_REQ33` | `true` |
| `RTC` | `PRTN1_COFB1_REQ34` | `true` |
| `WKPU` | `PRTN1_COFB1_REQ45` | `true` |
| `CMUs` | `PRTN1_COFB1_REQ47` | `true` |
| `SXOSC` | `PRTN1_COFB1_REQ51` | `true` |
| `FXOSC` | `PRTN1_COFB1_REQ53` | `true` |
| `PLL` | `PRTN1_COFB1_REQ56` | `true` |
| `PIT_2` | `PRTN1_COFB1_REQ63` | `true` |
| `FlexCAN_0` | `PRTN1_COFB2_REQ65` | `true` |
| `FlexCAN_1` | `PRTN1_COFB2_REQ66` | `true` |
| `FlexCAN_2` | `PRTN1_COFB2_REQ67` | `true` |
| `FlexCAN_3` | `PRTN1_COFB2_REQ68` | `true` |
| `FlexCAN_4` | `PRTN1_COFB2_REQ69` | `true` |
| `FlexCAN_5` | `PRTN1_COFB2_REQ70` | `true` |
| `LPUART_0` | `PRTN1_COFB2_REQ74` | `true` |
| `LPUART_1` | `PRTN1_COFB2_REQ75` | `true` |
| `LPUART_2` | `PRTN1_COFB2_REQ76` | `true` |
| `LPI2C_0` | `PRTN1_COFB2_REQ84` | `true` |
| `LPI2C_1` | `PRTN1_COFB2_REQ85` | `true` |
| `LPSPI_0` | `PRTN1_COFB2_REQ86` | `true` |
| `LPSPI_1` | `PRTN1_COFB2_REQ87` | `true` |
| `LPSPI_2` | `PRTN1_COFB2_REQ88` | `true` |
| `LPSPI_3` | `PRTN1_COFB2_REQ89` | `true` |
| `TEMPSENSE` | `PRTN1_COFB2_REQ95` | `true` |
| `CRC` | `PRTN1_COFB3_REQ96` | `true` |
| `SWT_1` | `PRTN2_COFB0_REQ27` | `true` |
| `STM_1` | `PRTN2_COFB0_REQ29` | `true` |
| `EMAC` | `PRTN2_COFB1_REQ32` | `true` |
| `QuadSPI` | `PRTN2_COFB1_REQ51` | `true` |
| `CM7_0_TCM` | `PRTN2_COFB1_REQ62` | `true` |
| `CM7_1_TCM` | `PRTN2_COFB1_REQ63` | `true` |

这张表说明：当前 Run mode 初始化时，EB 会让 MC_ME 使能这些外设的 COFB clock gate。它和前面 Real-time control 笔记里的 GPT/PIT/STM/RTC/WDG 是同一条链路：

```text
Mcu_SetMode(McuModeSettingConf)
  -> Power_Ip_SetMode / MC_ME config
  -> PRTNn_COFBm_CLKEN[REQp] = 1
  -> 外设 register interface clock 可访问
  -> Gpt/Wdg/Adc/Pwm/Mcl 等模块初始化才不会因为 clock gate 关闭而失败
```

### 6.3 和 S32K324 工程功能的对应关系

| 项目功能/模块 | 依赖的 MC_ME clock gating | 当前状态 |
|---|---|---|
| ADC / BCTU 实时采样链路 | `ADC_0/1/2`、`BCTU`、`TRGMUX` | enabled |
| eMIOS PWM | `EMIOS_0/1/2` | enabled |
| LCU 逻辑控制 | `LCU_0/1` | enabled |
| OS/GPT 1ms tick | `PIT_2`，项目 Target.c 启动 `GptChannelConfiguration_PIT2_0` | enabled |
| STM 软件时间基 | `STM_0`，Target/Time 读取 STM counter | enabled |
| Watchdog | `SWT_0` / `SWT_1`，另有 Wdg.xdm 配置 | enabled |
| RTC | `RTC` | enabled，但 GPT 当前未配置 RTC channel |
| CAN 通信 | `FlexCAN_0..5` | enabled |
| LIN/UART | `LPUART_0..15` 中多个实例 | enabled |
| SPI | `LPSPI_0..5` | enabled |
| I2C | `LPI2C_0/1` | enabled |
| 低功耗唤醒 | `WKPU`、`RTC`、`PIT_0`、`SWT_0` | clock gate enabled，但还需 wakeup/EcuM/Standby mode 配置 |

### 6.4 TEL9471 工程的 MC_ME clock gating 差异

TEL9471 也配置了 111 个 `McuPeripheral` 条目，但只启用了 47 个，明显比 Heating 工程更收敛。关键差异如下：

| 外设 | TEL9471 slot | TEL9471 Clock enable | 对项目的意义 |
|---|---|---:|---|
| `TRGMUX` | `PRTN0_COFB1_REQ32` | `true` | 触发路由开启 |
| `BCTU` | `PRTN0_COFB1_REQ33` | `true` | ADC 触发链路开启 |
| `EMIOS_0/1/2` | `REQ34/35/36` | `true` | PWM/eMIOS 可用 |
| `LCU_0/1` | `REQ38/39` | `false` | TEL9471 未打开 LCU，若后续用 LCU 逻辑控制会 HardFault 或初始化失败 |
| `ADC_0/1/2` | `REQ40/41/42` | `true` | ADC 可用 |
| `PIT_0` | `PRTN0_COFB1_REQ44` | `true` | PIT0 可用，适合 RTI/低功耗相关分析 |
| `PIT_1` | `PRTN0_COFB1_REQ45` | `false` | PIT1 未开 |
| `PIT_2` | `PRTN1_COFB1_REQ63` | `false` | TEL9471 未开 PIT2；不同于 Heating 工程中用 PIT2 做 GPT tick |
| `SWT_0` | `PRTN1_COFB0_REQ28` | `true` | 主 watchdog 可用 |
| `SWT_1` | `PRTN2_COFB0_REQ27` | `false` | SWT1 未开 |
| `STM_0` | `PRTN1_COFB0_REQ29` | `true` | STM0 可用 |
| `STM_1` | `PRTN2_COFB0_REQ29` | `false` | STM1 未开 |
| `RTC` | `PRTN1_COFB1_REQ34` | `true` | RTC register clock gate 开启 |
| `WKPU` | `PRTN1_COFB1_REQ45` | `true` | wakeup unit register clock gate 开启 |
| `FlexCAN_0/1/2` | `REQ65/66/67` | `true` | CAN0~2 可用 |
| `FlexCAN_3/4/5` | `REQ68/69/70` | `false` | CAN3~5 未开 |
| `LPUART_0/1/2` | `REQ74/75/76` | `false` | UART0~2 未开 |
| `LPSPI_0/1/2/3` | `REQ86/87/88/89` | `true` | SPI0~3 可用 |
| `LPI2C_0/1` | `REQ84/85` | `false` | I2C 未开 |
| `EMAC` | `PRTN2_COFB1_REQ32` | `false` | 以太网未开 |
| `QuadSPI` | `PRTN2_COFB1_REQ51` | `false` | QSPI 未开 |

这对调试非常重要：TEL9471 的 Target 初始化使用 `Mcu_SetMode(McuModeSettingConf_Run)` 后，只有上表 enable=true 的外设能正常访问。比如 Heating 工程中 `Target_TimerInit()` 启动的是 `GptChannelConfiguration_PIT2_0`，而 TEL9471 的 `PIT_2` gate 是 false；如果在 TEL9471 中照搬 PIT2 GPT 通道，就要先去 EB Mcu 里把 `PIT_2` 对应的 `McuPeripheralClockEnable` 打开，或者改用已打开的 PIT0。

---

## 7. 当前代码工程中的初始化和 reset 路径

### 7.1 Mcu_SetMode / Mcu_InitClock 路径

在 `Mcu_Integration.c` 中：

```c
void Mcu_Integration_InitClock(void)
{
    Mcu_SetMode(McuModeSettingConf);

    Mcu_InitClock(McuClockSettingConfig_0);
#if(MCU_NO_PLL==STD_OFF)
    while ( MCU_PLL_LOCKED != Mcu_GetPllStatus() )
    {
        /* wait until all enabled PLLs are locked */
    }
    Mcu_DistributePllClock();
#endif
}
```

这里有一个非常重要的顺序：

1. `Mcu_SetMode(McuModeSettingConf)`：先让 MC_ME 的 Run mode 配置生效，打开 partition/peripheral clock gating；
2. `Mcu_InitClock(McuClockSettingConfig_0)`：初始化 clock tree；
3. 等 PLL lock；
4. `Mcu_DistributePllClock()`：把 PLL clock 分发到系统。

在 `Target.c` 中还存在一个 `Mcu_InitializeClock()`，它只做 clock 初始化和 PLL 分发，没有显式 `Mcu_SetMode()`。因此需要确认实际启动路径中 `Mcu_Init()` / `Mcu_SetMode()` 是否已经在 EcuM 或集成层执行。否则可能出现：clock tree 配好了，但某些外设 MC_ME gate 没开。

### 7.2 EcuM reset 路径

`EcuM_Callout_Stubs.c` 的 `EcuM_AL_Reset()`：

```c
case ECUM_RESET_MCU:
    Mcu_PerformReset();    /* Software reset */
    break;
case ECUM_RESET_IO:
    CddBE13_L2_NormalToSleepMode();     /* Hardware reset */
    break;
case ECUM_RESET_WDGM:
    Mcu_PerformReset();
    break;
```

结合 EB 配置：`Mcu_PerformReset()` 会按 `McuResetType = FunctionalReset` 触发 functional reset。`ECUM_RESET_IO` 走 `CddBE13_L2_NormalToSleepMode()`，这看起来是板级/电源芯片路径，不是 MCU 内部 MC_RGM 软件 reset。

### 7.3 Reset reason 诊断路径

项目中 `Diag_McuResetReason.c` 使用：

```c
Mcu_ResetType dataMcuResetReason_e = MCU_RESET_UNDEFINED;
dataMcuResetReason_e = Mcu_GetResetReason();

Mcu_RawResetType RawResetValue = MCU_RAW_RESET_DEFAULT;
RawResetValue = Mcu_GetResetRawValue();
```

这和 Modes/Power Management 的调试很相关：

- 如果系统是 watchdog reset，要看 `MCU_SWT0_RST_RESET` / `MCU_SWT1_RST_RESET` 等映射；
- 如果是 clock fail，要看 `MCU_FXOSC_FAIL_RESET`、`MCU_PLL_LOL_RESET`、`MCU_CORE_CLK_FAIL_RESET` 等；
- 如果是 software reset，要看 `MCU_SW_FUNC_RESET` 或 `MCU_SW_DEST_RESET`；
- 如果上电或电源跌落，要看 `MCU_POWER_ON_RESET`、PMC/LVR/POR 相关状态。

---

## 8. 如果以后要在 EB 里真正配置 Standby，需要改哪些地方

当前工程只配置 Run。要做真正低功耗 Standby，不能只把 `McuEnterLowPowerMode` 改成 true，因为它现在已经是 true。还需要新增一个 mode configuration，并补齐 EcuM/wakeup/clock/padkeeping/module shutdown。

### 8.1 EB Mcu 侧建议配置路径

1. 在 `McuModuleConfiguration/McuModeSettingConf` 下新增一个 mode，例如：
   - `McuMode = 1`
   - `McuPowerMode = STANDBY`
   - `McuMainCoreSelect = CM7_0`
   - `McuEnableSleepOnExit` 根据策略选择，一般先保持 false，显式 WFI 更容易调试。
2. 配置 `McuPartitionConfiguration`：
   - Run mode 下需要的 partition/peripheral enable；
   - Standby mode 下只保留必要的 Standby domain/wakeup 相关模块。
3. 配置 `McuPeripheral`：
   - 关闭通信和不需要外设：CAN、SPI、UART、ADC/eMIOS 等；
   - 保留唤醒需要模块：WKPU、RTC、RTI(PIT0)、SWT0 等；
   - 每次关/开后检查 `MC_ME.PRTNn_COFBm_STAT`。
4. 配置 clock source Standby：
   - 进入 Standby 前切 FIRC 48 MHz；
   - 根据 wakeup source 决定 `SIRC/SXOSC/FIRC/FXOSC` 是否 Standby enable；
   - 如果使用 RTC，确认 RTC clock source 和 Standby 保持策略。
5. 配置 `McuPowerControl/McuPMC_Config`：
   - 是否 `LPM25EN` 保持 2.5 V；
   - 是否 `FASTREC` 做快速恢复；
   - `LMEN/LMBCTLEN/LMAUTOEN` 与外部供电方案匹配；
   - PMIC PGOOD handshake 是否 bypass 必须和硬件设计一致。
6. 配置 DCM_GPR / padkeeping：
   - 不需要的 IO 清 OBE/IBE；
   - 需要保持或唤醒的 IO 配置 padkeeping；
   - Standby IO_CONFIG 相关位按手册流程设置。

### 8.2 AUTOSAR / EcuM 侧还要做什么

1. EcuM sleep/shutdown target 配置：需要有 sleep mode、wakeup source、validation timeout。
2. `EcuM_StartWakeupSources()` / `EcuM_StopWakeupSources()` / `EcuM_CheckValidation()` 当前还是空实现，需要补 wakeup source 处理。
3. WdgM / Wdg 低功耗策略：进入 Standby 前 watchdog 是暂停、保持 SWT0 唤醒，还是切模式，需要明确。
4. OS / SchM / interrupts：进入 Standby 前关闭通信栈/应用任务，确保没有 pending interrupt 干扰。
5. 退出 Standby 后恢复：重新初始化 clock tree、外设、通信、诊断状态；因为 Run domain reset deassert 后类似 functional reset exit。

### 8.3 进入 Standby 前的软件 checklist

| 检查项 | 为什么重要 |
|---|---|
| 关闭 CAN/LIN/SPI/ETH 等通信 | 防止外设还在 transaction 中就被 clock gate/power down |
| 清 pending interrupt | 防止 WFI 立即被普通中断唤醒或流程冲突 |
| 配置 WKPU/RTC/PIT/SWT wakeup | wakeup source 必须先准备好 |
| 切系统时钟到 FIRC 48 MHz | 手册要求，PLLDIG Standby 不可用 |
| 关闭 PLLDIG / 配置 oscillator standby | 降低功耗并满足 Standby 电源条件 |
| 配置 MC_ME COFB clock gating | 只保留 Standby 需要的模块 |
| 检查 MC_ME COFB STAT | 确认 clock gate 状态真的变化 |
| 配置 padkeeping | 防止 IO 漏电或错误电平 |
| 执行 application core WFI | 多核场景必须先关 application core |
| main core 最后 WFI | SW4 阶段只做 main core WFI |

---

## 9. 调试和验证方法

### 9.1 验证 Run mode 初始化

1. 断点停在 `Mcu_SetMode(McuModeSettingConf)` 后。
2. 检查 MC_ME partition 状态：`MC_ME.PRTN0_STAT`、`MC_ME.PRTN1_STAT`、`MC_ME.PRTN2_STAT`。
3. 检查关键 COFB 状态：
   - `PRTN0_COFB1_STAT`：TRGMUX/BCTU/eMIOS/ADC/PIT0/1；
   - `PRTN1_COFB0_STAT`：SWT0/STM0；
   - `PRTN1_COFB1_STAT`：RTC/WKPU/CMU/SXOSC/FXOSC/PLL/PIT2；
   - `PRTN1_COFB2_STAT`：FlexCAN/LPUART/LPI2C/LPSPI；
   - `PRTN2_COFB0/1_STAT`：SWT1/STM1/EMAC/LPUART8+/LPSPI4/5/QuadSPI。
4. 访问外设寄存器前确认对应 clock gate 为 enabled。

### 9.2 验证 reset path

1. 调用 `EcuM_AL_Reset(ECUM_RESET_MCU)` 或触发软件 reset。
2. reset 后在早期启动阶段读取：
   - `Mcu_GetResetReason()`；
   - `Mcu_GetResetRawValue()`；
   - MC_RGM FES/DES raw bits。
3. 预期应匹配 functional software reset，而不是 power-on reset。
4. 触发 WDG reset 时，应能区分 `MCU_SWT0_RST_RESET` / `MCU_SWT1_RST_RESET` 等。

### 9.3 验证低功耗前置条件

如果未来新增 Standby mode，建议分阶段验证：

1. 只新增 Standby mode，但不真正 WFI：检查生成代码是否有 `Power_Ip_aModeConfigPB[2]` 或至少两个 mode entries。
2. 检查 `Mcu_Cfg.h` 中 `MCU_ENTER_LOW_POWER_MODE == STD_ON`。
3. 检查 `Power_Ip_PBcfg.c` 中第二个 mode 是否 `POWER_IP_STANDBY_MODE` 或类似枚举。
4. 手动调用前先关闭通信，示波器/电流表看电流变化。
5. 进入前读取 clock：确认系统已经切 FIRC。
6. 进入前读取 COFB STAT：确认不需要外设 clock 已关。
7. 用 WKPU 或 RTC 唤醒，看 reset reason / previous mode / wakeup source 是否正确。
8. 退出后重新初始化 clock tree 和必要 MCAL 模块。

### 9.4 常见问题定位

| 现象 | 可能原因 | 检查点 |
|---|---|---|
| 访问外设寄存器 HardFault | MC_ME COFB clock gate 没开 | `Mcu_SetMode` 是否执行；`PRTNn_COFBm_STAT` |
| `Mcu_SetMode` 后外设仍不可用 | partition 未 enable 或 slot 配错 | `McuPartitionClockEnable`、`McuModeEntrySlot` |
| Standby 进不去 | 未按四步流程，普通 interrupt pending，wakeup 未配置 | pending IRQ、WKPU、EcuM wakeup callout |
| Standby 后唤不醒 | 唤醒源 clock/IO/padkeeping 未保持 | RTC/SIRC/SXOSC/WKPU/padkeeping |
| Standby 退出后 clock 异常 | 未重新初始化 PLL/MC_CGM | `Mcu_InitClock`、`Mcu_DistributePllClock` |
| software reset 后 reason 不对 | reset reason 读取太晚或被清除 | 早期读取 MC_RGM raw value |
| 低功耗电流偏高 | 外设/IO/FXOSC/FIRC/2.5V regulator 未关闭 | COFB STAT、PMC.CONFIG、padkeeping |

---

## 10. 和 Clocking / Real-time control 笔记的连接

### 10.1 和 Clocking 的关系

Clocking 笔记讲“时钟源、MUX、PLL、分频器”。Modes and Power Management 讲“这些时钟什么时候允许给 core/peripheral，以及低功耗时哪些源保留”。

```text
MC_CGM 决定：给什么频率、从哪个源来
MC_ME 决定：这个模块有没有资格拿到 clock
PMC 决定：支撑这些 clock/logic 的电源是否存在
MC_RGM 决定：异常时怎么 reset，以及 reset reason 怎么记录
```

### 10.2 和 Real-time control 的关系

Real-time control 笔记里的模块，例如 ADC/BCTU/eMIOS/LCU/PIT/STM/RTC/SWT，都需要 MC_ME gate 打开：

- ADC/BCTU/eMIOS/LCU 在 `PRTN0_COFB1`；
- PIT0/1 在 `PRTN0_COFB1`，PIT2 在 `PRTN1_COFB1`；
- STM0/SWT0 在 `PRTN1_COFB0`；
- RTC/WKPU/clocking modules 在 `PRTN1_COFB1`；
- FlexCAN/LPUART/LPI2C/LPSPI 在 `PRTN1_COFB2`。

因此，调试实时控制链路时，不要只看 Adc.xdm/Gpt.xdm/Pwm.xdm/Wdg.xdm，还要确认 Mcu.xdm 的 mode/peripheral gate。

---

## 11. 本工程当前结论

1. 当前工程只配置了一个 Mcu mode：`McuModeSettingConf = 0`，`McuPowerMode = RUN`。
2. `McuEnterLowPowerMode = true` 表示驱动生成低功耗支持，但不代表已经配置了 Standby mode。
3. 当前 `Mcu_SetMode(McuModeSettingConf)` 的核心作用是配置 Run mode 下的 MC_ME partition/core/peripheral clock gating。
4. 关键外设 clock gating 基本都启用，包括 ADC/BCTU/eMIOS/LCU/PIT/STM/RTC/SWT/CAN/LPUART/LPI2C/LPSPI/EDMA/WKPU。
5. 当前 PMC 配置实际生成 `PMC_CONFIG_LMEN_MASK`，last-mile regulator enabled；fast recovery、LPM25、LVD/HVD interrupts 没有启用。
6. 当前 `Mcu_PerformReset()` 配置为 functional reset，EcuM 的 MCU reset / WdgM reset 都走它。
7. 项目已有 reset reason 诊断读取 `Mcu_GetResetReason()` 和 raw reset value，适合定位 WDG reset、software reset、clock fail reset 等。
8. 若后续要做真正 Standby，需要新增 Standby mode 配置，并补齐 EcuM wakeup callouts、WKPU/RTC/PIT/SWT 唤醒、FIRC 切换、PLL 关闭、padkeeping、退出后 clock restore。

---

## 12. 快速索引：EB 字段到生成代码

| EB xdm 字段 | 生成代码/宏 | 说明 |
|---|---|---|
| `McuEnterLowPowerMode` | `MCU_ENTER_LOW_POWER_MODE` / `POWER_IP_ENTER_LOW_POWER_MODE` | 低功耗支持开关 |
| `McuPerformResetApi` | `MCU_PERFORM_RESET_API` / `Mcu_PerformReset()` | software reset API |
| `McuGetPowerModeStateApi` | `MCU_POWERMODE_STATE_API` | 当前 STD_OFF |
| `McuNumberOfMcuModes` | `Mcu_Config` 中 Number of Power Modes | 当前 1 |
| `McuModeSettingConf/McuPowerMode` | `Power_Ip_aModeConfigPB[0].PowerMode` | 当前 `POWER_IP_RUN_MODE` |
| `McuEnableSleepOnExit` | `Power_Ip_aModeConfigPB[0]` sleep on exit | 当前 false |
| `McuPartitionConfiguration` | `Power_Ip_MC_ME_aPartitionConfigPB_0` | partition PCE/COFB/core 配置 |
| `McuPeripheral/McuModeEntrySlot` | `MC_ME_PRTNn_COFBm_CLKEN_REQx_MASK` | 外设 clock gate slot |
| `McuPowerControl/McuPMC_Config` | `Power_Ip_PMC_ConfigPB` | PMC.CONFIG |
| `McuResetConfig/McuResetType` | `Power_Ip_MC_RGM_ConfigPB` | 当前 `MCU_FUNC_RESET` |
| `McuRamSectorSettingConf` | `Mcu_Config` RAM section pointer | 当前 1 个 RAM sector |
