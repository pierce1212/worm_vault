---
title: S32K324 Real-time control 实时控制学习笔记
tags:
  - S32K324
  - S32K3xx
  - Real-time-control
  - PCMC
  - STM
  - PIT
  - RTC
  - SWT
  - GPT
  - EB-tresos
  - AUTOSAR
created: 2026-05-13
updated: 2026-05-13
source:
  - S32K3xx Reference Manual Rev.9, 07/2024, Chapters 59/66/67/68/69
  - E:/github/ECAS_RTA_S32K324GHS_Heating/BasicSoftware/integration/mcal/MCAL_Cfg/config
  - E:/github/ECAS_RTA_S32K324GHS_Heating/ECU/Time/Time.c
  - https://blog.csdn.net/Oushuwen/article/details/120968224
related:
  - "[[../S32K324 Clocking 时钟系统学习笔记]]"
---

# S32K324 Real-time control 实时控制学习笔记

## 目录

- [1. 资料定位与章节范围](S32K324%20Real-time%20control%20实时控制学习笔记.md#1-资料定位与章节范围)
- [2. Real-time control 总览：S32K3xx 的实时控制不是“一个 timer”](S32K324%20Real-time%20control%20实时控制学习笔记.md#2-real-time-control-总览s32k3xx-的实时控制不是一个-timer)
- [3. STM：System Timer Module](S32K324%20Real-time%20control%20实时控制学习笔记.md#3-stmsystem-timer-module)
- [4. PIT：Periodic Interrupt Timer](S32K324%20Real-time%20control%20实时控制学习笔记.md#4-pitperiodic-interrupt-timer)
- [5. RTC：Real Time Clock](S32K324%20Real-time%20control%20实时控制学习笔记.md#5-rtcreal-time-clock)
- [6. SWT：Software Watchdog Timer](S32K324%20Real-time%20control%20实时控制学习笔记.md#6-swtsoftware-watchdog-timer)
- [7. EB tresos 配置说明：从 GUI 到 xdm 的对应关系](S32K324%20Real-time%20control%20实时控制学习笔记.md#7-eb-tresos-配置说明从-gui-到-xdm-的对应关系)
- [8. 当前项目的实时控制链路画像](S32K324%20Real-time%20control%20实时控制学习笔记.md#8-当前项目的实时控制链路画像)
- [9. EB tresos 配置操作建议](S32K324%20Real-time%20control%20实时控制学习笔记.md#9-eb-tresos-配置操作建议)
- [10. 调试与验证清单](S32K324%20Real-time%20control%20实时控制学习笔记.md#10-调试与验证清单)
- [11. 常见问题速查](S32K324%20Real-time%20control%20实时控制学习笔记.md#11-常见问题速查)
- [12. 和 Clocking 笔记的连接](S32K324%20Real-time%20control%20实时控制学习笔记.md#12-和-clocking-笔记的连接)
- [13. 本项目当前配置摘要](S32K324%20Real-time%20control%20实时控制学习笔记.md#13-本项目当前配置摘要)
- [14. 后续深入建议](S32K324%20Real-time%20control%20实时控制学习笔记.md#14-后续深入建议)
- [2026-05-13 补强版：Chapter 59~65 + 两个项目 EB 配置](S32K324%20Real-time%20control%20实时控制学习笔记.md#2026-05-13-补强版按-reference-manual-chapter-5965--两个项目-eb-配置重新梳理)


> 这篇笔记是按照前面 `[[S32K324 Clocking 时钟系统学习笔记]]` 的方式写的：先从 Reference Manual 的功能视角理解模块，再落到 EB tresos / MCAL 配置，最后结合当前 S32K324 工程中的实际配置和调试检查点。
>
> 注意：S32K3xx Reference Manual 里 “Real-time control” 相关内容不是单独只讲一个 timer，而是一组实时控制外设和时间基准外设的组合。对 S32K324 项目最有用的主线是：
>
> - PCMC：ADC / BCTU / eMIOS / LCU / TRGMUX 这类“实时控制链路”；
> - SWT：软件看门狗，实时容错；
> - STM / PIT / RTC：系统时间基准、周期中断、唤醒与低功耗时间源；
> - AUTOSAR GPT / WDG / PWM / ADC / MCL：EB tresos 中对这些硬件的抽象和配置入口。

## 1. 资料定位与章节范围

### 1.1 Reference Manual 章节

本笔记主要参考 S32K3xx Reference Manual Rev.9, 07/2024 中以下章节：

| 章节 | 模块 | 重点 |
|---|---|---|
| Chapter 59 | Power Conversion and Motor Control (PCMC) | ADC、BCTU、eMIOS、LCU、TRGMUX 组成的实时控制子系统 |
| Chapter 66 | Software Watchdog Timer (SWT) | 32-bit window watchdog、超时复位/中断、服务窗口、调试冻结 |
| Chapter 67 | System Timer Module (STM) | 32-bit count-up timer、4 个 compare channel、系统软件时间基准 |
| Chapter 68 | Periodic Interrupt Timer (PIT) | 4 个 32-bit countdown timers、周期中断、trigger、timer chaining、lifetimer |
| Chapter 69 | Real Time Clock (RTC) | always-on 32-bit free-running counter、API、低功耗唤醒 |

### 1.2 工程配置来源

本项目 EB tresos / MCAL 配置来源：

```text
E:/github/ECAS_RTA_S32K324GHS_Heating/BasicSoftware/integration/mcal/MCAL_Cfg/config
```

重点文件：

| 文件 | 说明 |
|---|---|
| `Mcu.xdm` | 时钟源、clock mux、CORE_CLK、AIPS_SLOW_CLK、STM0_CLK、RTC clock 等 |
| `Gpt.xdm` | AUTOSAR GPT，对 PIT / STM / RTC / eMIOS 定时资源的抽象配置 |
| `Wdg.xdm` | AUTOSAR WDG，对 SWT 的配置以及外部 GPT trigger 关系 |
| `Pwm.xdm` | eMIOS PWM 输出配置 |
| `Mcl.xdm` | eMIOS common、master bus、DMA、TRGMUX/LCU 开关等公共低层配置 |
| `Adc.xdm` | ADC hw unit、ADC channel、group、触发方式等 |

工程中还存在手写/移植的时间模块：

```text
E:/github/ECAS_RTA_S32K324GHS_Heating/ECU/Time/Time.c
```

它直接使用 `IP_STM_0->CNT` 实现 ms/us/tick delay，并通过 `Mcu_GetClockFrequency(STM0_CLK)` 获取 STM0 时钟频率。

---

## 2. Real-time control 总览：S32K3xx 的实时控制不是“一个 timer”

Reference Manual 的 Chapter 59 把 PCMC 描述为一组可以互联、用于实时任务的模块，典型任务包括：

- motor control；
- power conversion；
- analog signal measurement；
- high-priority / injected ADC measurement；
- PWM generation；
- fault detection；
- programmable peripheral interconnection。

### 2.1 PCMC 子系统典型组成

PCMC 里最核心的模块可以这样理解：

| 模块     | 中文理解                           | 在实时控制链路里的作用                                   |
| ------ | ------------------------------ | --------------------------------------------- |
| ADC    | 模数转换器                          | 采样电压、电流、温度等模拟量                                |
| BCTU   | Body Cross Triggering Unit     | 接收 eMIOS/LCU/TRGMUX trigger，按硬件时序触发 ADC 转换    |
| eMIOS  | Enhanced Modular I/O Subsystem | 生成 PWM、捕获输入、提供 counter bus / reload / trigger |
| LCU    | Logic Control Unit             | 用硬件组合/时序逻辑实现换相、保护、门控等低延迟逻辑                    |
| LPCMP  | Low Power Comparator           | 过压/过流/温度等 fault 检测                            |
| TRGMUX | Trigger Mux                    | 把一个模块的 trigger 输出路由到另一个模块输入                   |

PCMC 的价值是：把 PWM、采样、触发、故障检测尽量放进硬件链路里，减少 CPU 抖动。例如：

```text
eMIOS PWM reload / compare event
        ↓
      TRGMUX
        ↓
      BCTU
        ↓
      ADC conversion
        ↓
  interrupt / DMA / control loop
```

这样 ADC 采样点可以锁定在 PWM 周期的固定相位，而不是由软件任务调度决定。

### 2.2 PCMC clocking 要点

Reference Manual Chapter 59.4.2 给出的摘要很关键：

- `CORE_CLK` clocks ADC, BCTU, eMIOS, and LCU.
- `AIPS_SLOW_CLK` clocks TRGMUX.
- 一般要求 `AIPS_SLOW_CLK` 是 `CORE_CLK` 的 1/4 或 1/2。

本项目 `Mcu.xdm` 中相关配置：

| 时钟 | EB 配置来源 | 当前值 |
|---|---|---|
| `CORE_CLK` / MUX0 DIV0 | `McuCgm0ClockMux0/McuClockMux0Divider0_Frequency` | 160 MHz |
| `AIPS_SLOW_CLK` / MUX0 DIV2 | `McuCgm0ClockMux0/McuClockMux0Divider2_Frequency` | 40 MHz |
| `STM0_CLK` | `GptClockReferencePoint_stm0 -> STM0_CLK`，项目 Time.c 也查询它 | 40 MHz |
| `RTC clock` | `McuRtcClockSelect/McuRtc_Source` | FIRC_CLK，48 MHz |
| `SIRC_CLK` | `WdgClockReferencePoint_0` | WDG 使用，配置值 32 kHz |

这里 `AIPS_SLOW_CLK = 40 MHz = CORE_CLK / 4`，满足 RM 建议。

![[../../attachments/fig59-1_pcmc_typical_configuration_page2297.png]]

图源：NXP S32K3xx Reference Manual Rev.9, Chapter 59, Figure 233 “Block diagram”, PDF page 2297。

---

## 3. STM：System Timer Module

### 3.1 STM 是什么

STM 是系统软件最常用的 free-running time base。Reference Manual Chapter 67 说明：

- 芯片最多有 4 个 STM instance，通常对应 Cortex-M7 core；
- STM counter 以 STM module clock / prescaler 的频率递增；
- 每个 STM 有一个 32-bit count-up timer；
- 每个 STM 有 4 个 32-bit compare channel；
- 每个 compare channel 有独立 interrupt source；
- 可配置 Debug mode 下是否 freeze。

一句话：STM 更适合做“全局递增时间戳”和“基于 compare 的软定时”，而不是 PIT 那种天然周期 down-counter。

### 3.2 STM 功能结构

![[../../attachments/fig67-1_stm_block_diagram_page2800.png]]

图源：NXP S32K3xx Reference Manual Rev.9, Chapter 67, Figure 381 “Block diagram”, PDF page 2800。

核心寄存器可以这样记：

| 寄存器 | 作用 |
|---|---|
| `CR` | control register，包含 prescaler、freeze、timer enable |
| `CNT` | 32-bit free-running counter |
| `CCR0..CCR3` | channel control，控制 compare channel enable |
| `CIR0..CIR3` | channel interrupt flag，W1C 清除中断标志 |
| `CMP0..CMP3` | channel compare value |

计数行为：

```text
STM tick frequency = STM module clock / prescaler
CNT: 0x00000000 → ... → 0xFFFFFFFF → 0x00000000
```

如果 channel enable 且 `CNT == CMPn`：

```text
CIRn[CIF] = 1
assert channel IRQ
```

### 3.3 STM 在本项目中的配置

`Gpt.xdm` 中配置了一个 STM GPT channel：

| 项目 | 配置值 |
|---|---|
| 容器 | `GptChannelConfiguration_0` |
| `GptChannelId` | 3 |
| `GptHwIp` | `STM` |
| `GptModuleRef` | `GptStm_0/GptStmChannels_0` |
| `GptChannelMode` | `GPT_CH_MODE_CONTINUOUS` |
| `GptChannelTickFrequency` | 40 MHz |
| `GptChannelClkSrcRef` | `GptClockReferencePoint_stm0` |
| `GptClockReferencePoint_stm0` | `McuClockSettingConfig_0/STM0_CLK` |
| `GptChannelTickValueMax` | `4294967295` |
| `GptNotification` | `NULL_PTR` |
| `GptStmModule` | `STM_0` |
| `GptStmPrescaler` | 1 |
| `GptStmChannel` | `CH_0` |
| `StmAbsoluteCounting` | false |
| `StmFreezeEnable` | true |

按照 40 MHz tick 计算：

```text
1 tick = 25 ns
32-bit rollover time = 2^32 / 40,000,000 = 107.3741824 s
```

这意味着如果直接用 32-bit `CNT` 做时间差，必须考虑大约 107.37 秒回绕一次。

### 3.4 工程 Time.c 的 STM 用法

工程中的 `E:/github/ECAS_RTA_S32K324GHS_Heating/ECU/Time/Time.c` 使用了裸寄存器方式：

```c
uint32 Get_Fstm()
{
  uint32 Fstm = 10;

  Fstm = Mcu_GetClockFrequency(STM0_CLK);

  return Fstm;
}
```

初始化时：

```c
void Test_InitTime(void)
{
  uwSysFreq =  Get_Fstm();
  uwPerFreq =  (uwSysFreq / 2);
}
```

ms/us delay 逻辑核心：

```c
Delay_Count = Get_Counter_Value(ReqTimeMs, MS);
ReadStm = IP_STM_0->CNT;
...
while( Delay_Compare_Count >= ReadStm)
{
  ReadStm = IP_STM_0->CNT;
}
```

换算函数：

```c
uint32 Get_Counter_Value(uint32 reqTime, TimeUnit unitOfReqTime)
{
  uint32 Fstm = Get_Fstm();
  if(unitOfReqTime == MS)
  {
    return (uint32)((float)(((((float)Fstm / (1000.0))) * (reqTime)) + 0.5));
  }
  else if(unitOfReqTime == US)
  {
    return (uint32)((float)(((((float)Fstm / (1000000.0))) * (reqTime))));
  }
  else
  {
    return (uint32)0;
  }
}
```

以当前 `STM0_CLK = 40 MHz`：

| 延时 | tick 数 |
|---|---:|
| 1 us | 40 ticks |
| 10 us | 400 ticks |
| 1 ms | 40000 ticks |
| 10 ms | 400000 ticks |
| 100 ms | 4000000 ticks |

### 3.5 STM 使用坑点

1. **回绕处理**
   
   `CNT` 是 32-bit，40 MHz 下约 107.37 s 回绕。推荐时间差写法是 unsigned subtraction：

   ```c
   uint32 start = IP_STM_0->CNT;
   while ((uint32)(IP_STM_0->CNT - start) < delay_ticks)
   {
       ;
   }
   ```

   这种写法天然支持 32-bit 回绕。当前 `Time.c` 的实现手动判断 `MAX_STM_VALUE - ReadStm`，可工作但更容易有边界细节。

2. **busy-wait 会阻塞 CPU**
   
   `Timer_DelayMs/Us` 是轮询 delay，适合 very short delay 或初始化阶段，不适合长时间实时任务调度。长周期任务建议使用 GPT notification / OS counter / schedule table。

3. **Debug Freeze**
   
   EB 中 `StmFreezeEnable = true`，debug halt 时 STM 可能停止。调试 timeout、delay、watchdog 相关问题时要先确认 freeze 行为。

4. **Clock source 必须一致**
   
   `Time.c` 查询 `Mcu_GetClockFrequency(STM0_CLK)`，EB 的 GPT channel 也引用 `STM0_CLK`。如果后续改 Mcu.xdm 时钟，必须同步确认 `Mcu_GetClockFrequency(STM0_CLK)` 生成值、`GptChannelTickFrequency`、实际寄存器 prescaler 是否一致。

---

## 4. PIT：Periodic Interrupt Timer

### 4.1 PIT 是什么

PIT 是周期中断定时器。Reference Manual Chapter 68 说明：

- 芯片最多有 4 个 PIT instance；
- 每个 PIT instance 有 4 个 32-bit timers/channels；
- timer 是 countdown timer；
- PIT 可产生 interrupt、DMA trigger；
- PIT trigger 可通过 TRGMUX 路由到 eMIOS、LCU、BCTU、ADC 等实时控制模块；
- 支持 timer chaining，用多个 32-bit timer 构成长周期；
- 支持 64-bit lifetimer：典型做法是 timer1 chain timer0，并把 start value 配成 `0xFFFFFFFF`。

### 4.2 PIT 功能结构

![[../../attachments/fig68-1_pit_block_diagram_page2809.png]]

图源：NXP S32K3xx Reference Manual Rev.9, Chapter 68, Figure 382 “Block diagram”, PDF page 2809。

核心寄存器理解：

| 寄存器 | 作用 |
|---|---|
| `MCR` | module control，控制 MDIS、FRZ 等 |
| `LDVALn` | timer n load value/start value |
| `CVALn` | timer n current value |
| `TCTRLn` | timer n control，包含 TEN/TIE/CHN 等 |
| `TFLGn` | timer interrupt flag，通常 W1C 清除 |
| `LTMR64H/LTMR64L` | 64-bit lifetimer 高/低 32 bit |

### 4.3 PIT timer 行为

Reference Manual 描述：

```text
Enable timer → 从 LDVALn[TSV] 开始倒计数
每个 clock cycle 减 1
CVALn 到 0 → period expires
产生 interrupt / trigger，然后重新加载 LDVALn
```

一般周期换算：

```text
LDVAL = desired_period_seconds * PIT_clock_hz - 1
```

但 AUTOSAR GPT 通常让上层传入 tick value，MCAL 负责寄存器细节；工程配置里更关心 tick frequency 和 max value。

### 4.4 PIT 在本项目中的 GPT 配置

`Gpt.xdm` 中有 3 个 PIT GPT channel：

| GPT channel | ID | HW IP | PIT instance/channel | tick frequency | mode | notification | freeze |
|---|---:|---|---|---:|---|---|---|
| `GptChannelConfiguration_Wdg` | 0 | PIT | `PIT_0/CH_0` | 40 MHz | continuous | `Wdg_Cbk_GptNotification0` | true |
| `GptChannelConfiguration_PIT1_0` | 1 | PIT | `PIT_1/CH_0` | 40 MHz | continuous | `Gpt_PIT1_0_Notification` | false |
| `GptChannelConfiguration_PIT2_0` | 2 | PIT | `PIT_2/CH_0` | 40 MHz | continuous | `Gpt_PIT2_0_Notification` | false |

共同点：

- `GptChannelTickFrequency = 4.0E7`；
- `GptChannelClkSrcRef = GptClockReferencePoint_0`；
- `GptClockReferencePoint_0 -> McuClockSettingConfig_0/AIPS_SLOW_CLK`；
- `GptChannelTickValueMax = 4294967295`；
- `ChainMode = false`。

因此当前 PIT tick 同样是：

```text
1 tick = 25 ns
max 32-bit interval ≈ 107.3741824 s
```

### 4.5 PIT 和 WDG 的关系

当前项目中 `Wdg.xdm`：

```text
WdgExternalTriggerCounterRef = ASPath:/Gpt/Gpt/GptChannelConfigSet/GptChannelConfiguration_Wdg
```

也就是 WDG 模块使用 GPT 的 `GptChannelConfiguration_Wdg` 作为 external trigger counter。

这类配置常见于 AUTOSAR WDG：

- WDG 驱动自身配置 SWT timeout；
- WdgM 或 WDG driver 需要周期性触发/服务；
- 通过 GPT channel 产生周期 notification；
- notification 调用 `Wdg_Cbk_GptNotification0`，再驱动 watchdog 服务流程。

当前配置要点：

| 项目 | 值 |
|---|---|
| WDG instance | `SWT0` |
| WDG default mode | `WDGIF_SLOW_MODE` |
| external GPT counter | `GptChannelConfiguration_Wdg` |
| GPT HW | `PIT_0/CH_0` |
| GPT notification | `Wdg_Cbk_GptNotification0` |
| PIT_0 freeze | true |

### 4.6 PIT 使用坑点

1. **PIT 是 down-counter，STM 是 up-counter**
   
   两者时间差写法不同。PIT 更适合周期 interrupt / trigger，STM 更适合 free-running timestamp。

2. **LDVAL 不是“毫秒值”**
   
   底层寄存器是 tick 数。EB/GPT 里显示 `GptChannelTickFrequency = 40 MHz`，上层必须按 tick 传值或由 GPT/OS 抽象换算。

3. **ChainMode 默认关闭**
   
   本项目所有 PIT channel `ChainMode=false`，所以单次最大周期仍受 32-bit 限制。

4. **Debug Freeze 不一致**
   
   `PIT_0` freeze = true；`PIT_1/PIT_2` freeze = false。调试时如果某些 GPT notification 停了、另一些仍在跑，要先看对应 PIT instance 的 freeze 配置。

5. **PIT trigger 到实时控制链路需要 TRGMUX/BCTU 配合**
   
   RM 说 PIT triggers 可以通过 TRGMUX 路由到 motor control IPs；但本项目 `Mcl.xdm` 中 `MclEnableTrgMux=false`，当前看起来没有启用复杂的 PIT→TRGMUX→BCTU 硬件触发链路。

---

## 5. RTC：Real Time Clock

### 5.1 RTC 是什么

RTC 是 always-on domain 的 free-running counter，用于 time keeping、低功耗唤醒、周期 interrupt。Reference Manual Chapter 69 说明：

- 芯片包含 1 个 RTC timer 和 API timer；
- RTC 和 API 都支持 32-bit compare；
- RTC 位于 always-on domain，RUN 和 STANDBY 都可用；
- RTC/API 可产生 interrupt，也可从低功耗模式 wakeup；
- RTC 可使用高频内部振荡器实现 1 us resolution，例如 `1/48 MHz * 48 = 1 us`；
- API 的 compare value 可在 timer 运行时独立修改，适合周期唤醒。

### 5.2 RTC 功能结构

![[../../attachments/fig69-1_rtc_block_diagram_page2834.png]]

图源：NXP S32K3xx Reference Manual Rev.9, Chapter 69, Figure 387 “Block diagram”, PDF page 2834。

核心寄存器/信号：

| 名称 | 作用 |
|---|---|
| `RTCCNT` | RTC 32-bit counter read value |
| `RTCVAL` | RTC compare value |
| `RTCF` | RTC compare flag |
| `RTCIE` | RTC interrupt enable |
| `APIVAL` | autonomous periodic interrupt compare value |
| `APIF` | API flag |
| `APIIE` | API interrupt enable |
| `CNTEN` | counter enable |
| `CLKSEL` | RTC/API clock source selection |

### 5.3 RTC clocking 与同步注意点

RM 中几个重要细节：

1. RTC counter 是 32-bit free-running counter。
2. 读 `RTCCNT` 由于 clock synchronization，可能读到之前的 counter value。
3. 读值和真实 counter 最大可能相差 6 个 count。
4. 切换 RTC/API clock source 时，应先 disable `CNTEN`。
5. disabling `CNTEN` 会异步 reset counter；disable 后 `RTCVAL/APIVAL` 需要重新写入。
6. RTC compare match 在低功耗模式下会先产生 wakeup，再置 flag / interrupt。

### 5.4 RTC 在本项目中的配置状态

`Mcu.xdm` 中：

| 项目 | 配置值 |
|---|---|
| `McuRtcClockSelect/McuClockMuxUnderMcuControl` | false |
| `McuRtc_Source` | `FIRC_CLK` |
| `McuRtc_Frequency` | 48 MHz |

`Gpt.xdm` 中：

```text
<d:lst name="GptRtc" type="MAP"/>
```

也就是说：当前 GPT 没有配置 RTC channel。RTC clock 在 MCU 配置中存在，但 AUTOSAR GPT 未使用 RTC 作为 timer channel。

当前若要通过 EB 使用 RTC 作为 GPT：一般需要在 GPT 模块中添加 `GptRtc` 容器，然后创建引用 RTC channel 的 `GptChannelConfiguration`，并设置对应 `GptChannelClkSrcRef`、tick frequency、interrupt/wakeup 参数。项目当前没有这么配。

### 5.5 RTC 和低功耗唤醒的使用建议

如果以后 ASU/ECAS 需要 sleep/standby 下周期唤醒，例如：

- 休眠中周期检测 KL15 / battery / pressure；
- standby 中周期唤醒做诊断；
- 独立于 Run-mode OS tick 的低功耗时间基准；

则 RTC/API 比 STM/PIT 更合适，因为：

| 模块 | Run mode | Standby / low power | 适合用途 |
|---|---|---|---|
| STM | 是 | 通常不是主要 always-on wakeup timer | 软件时间戳、短延时 |
| PIT | 是 | 取决于具体 RTI/clock/power 配置 | 周期 interrupt/trigger |
| RTC/API | 是 | 是，always-on domain | 低功耗唤醒、time keeping |

---

## 6. SWT：Software Watchdog Timer

### 6.1 SWT 是什么

SWT 是 32-bit window watchdog timer，用来让系统从软件跑飞中恢复。Reference Manual Chapter 66 描述的典型场景：

- 软件陷入死循环；
- 软件执行流异常；
- CPU 没能按预期周期 service watchdog。

SWT 可配置第一次 timeout 产生 interrupt 或 reset request；如果连续第二次 timeout，SWT 总是产生 reset request。

### 6.2 SWT 功能特点

RM 中列出的关键特性：

- 32-bit countdown timer；
- regular servicing 或 window servicing；
- timeout interrupt；
- timeout reset request；
- service key / pseudorandom key；
- master access protection；
- soft lock / hard lock；
- Debug mode freeze 控制；
- register interface clock 与 counter/reset clock 是两个 clock domain。

SWT 有两个关键 clock domain：

| clock domain | 作用 |
|---|---|
| IPS/register interface clock | 寄存器访问、invalid access abort 等 |
| counter clock | watchdog countdown、timeout/reset request |

RM 特别提醒：由于两个 clock domain 同步，service sequence 或配置变更可能需要若干 system clock + counter clock 周期才被识别。

### 6.3 SWT 在本项目中的 EB 配置

`Wdg.xdm` 当前配置：

| 项目 | 配置值 |
|---|---|
| `WdgInstance` | `SWT0` |
| `WdgDefaultMode` | `WDGIF_SLOW_MODE` |
| `WdgDisableAllowed` | false |
| `WdgDevErrorDetect` | false |
| `WdgInitialTimeout` | 7.0 s |
| `WdgMaxTimeout` | 7.0 s |
| `WdgClockReferencePoint_0` | `SIRC_CLK` |
| `WdgClockValue` | 32 |
| `WdgClockSelection` | `OscillatorClock` |
| `WdgInterruptContentEnable` | true |
| `WdgExternalTriggerCounterRef` | `GptChannelConfiguration_Wdg` |
| `WdgOperationMode` | `ResetOnTimeOut` |
| `WdgResetOnInvalidAccess` | `SystemReset` |
| `WdgRunsInStopMode` | false |
| `WdgRunsInDebugMode` | false |
| `WdgWindowMode` | false |
| `WdgKeyedService` | false |
| `WdgSoftLockConfiguration` | false |
| `WdgHardLockConfiguration` | false |

Fast/Slow mode timeout：

| WDG mode | timeout |
|---|---:|
| Fast | 0.25 s |
| Slow | 5.0 s |
| Default | `WDGIF_SLOW_MODE` |

按 `WdgClockValue=32` kHz 粗略换算：

| timeout | counter ticks |
|---|---:|
| 0.25 s | 8000 ticks |
| 5.0 s | 160000 ticks |

> 注意：EB 中 `WdgInitialTimeout=7.0`、`WdgMaxTimeout=7.0` 是 WDG driver 配置层面的 timeout 边界；Fast/Slow mode 里实际 SWT timeout period 分别配置为 0.25 s / 5.0 s。调试时需要区分 AUTOSAR WDG 配置层和底层 SWT mode 配置。

### 6.4 SWT / WDG 配置流程理解

EB tresos 中通常不是直接打开 “SWT 寄存器”，而是在 WDG 模块中配置。理解顺序：

```text
Mcu.xdm
  └─ SIRC_CLK / AIPS_SLOW_CLK / reset & clock gating

Gpt.xdm
  └─ GptChannelConfiguration_Wdg
       └─ PIT_0 CH_0, 40 MHz, notification = Wdg_Cbk_GptNotification0

Wdg.xdm
  └─ WdgInstance = SWT0
  └─ WdgClockReference = SIRC_CLK
  └─ WdgExternalTriggerCounterRef = GptChannelConfiguration_Wdg
  └─ WdgSettingsFast / Slow / Off
```

也就是说，WDG 既依赖自身 SWT counter clock，也依赖 GPT 周期触发服务逻辑。任何一个时钟或 callback 配错，都可能导致 watchdog reset。

### 6.5 SWT 调试坑点

1. **Debug 模式是否跑 watchdog**
   
   当前 `WdgRunsInDebugMode=false`，直觉上 debug halt 时 watchdog 不运行；但同时还要看底层 SWT CR[FRZ] 与 MCAL 实际生成代码。

2. **Invalid access 可导致 SystemReset**
   
   当前 `WdgResetOnInvalidAccess=SystemReset`。如果代码错误写 SWT register/service sequence，可能不是简单 DET，而是直接 reset。

3. **Window mode 当前关闭**
   
   `WdgWindowMode=false`，所以当前不是“只能在窗口后半段喂狗”的严格 window watchdog。以后打开 window mode 后，喂太早也会触发 invalid access/reset。

4. **外部 trigger counter 是 PIT_0 CH_0**
   
   如果 GPT 初始化顺序、PIT_0 clock、notification、中断优先级有问题，WDG 服务链会断。

---

## 7. EB tresos 配置说明：从 GUI 到 xdm 的对应关系

这一节按 EB tresos 里常见模块入口来整理。不同 MCAL 版本 GUI 名字可能略有差异，但 xdm 配置项是最可靠的定位方式。

### 7.1 Mcu 模块：所有实时控制定时的根

路径：`Mcu.xdm`

关键配置：

| EB/xdm 项 | 当前值 | 影响 |
|---|---:|---|
| `McuFIRC_Frequency` | 48 MHz | RTC 当前选择 FIRC；也是常用 fallback clock |
| `McuSIRC_Frequency` | 32 kHz | WDG/SWT 使用 SIRC clock reference |
| `McuClockMux0Divider0_Frequency` | 160 MHz | CORE_CLK，ADC/eMIOS/BCTU/LCU 的主要 clock |
| `McuClockMux0Divider2_Frequency` | 40 MHz | AIPS_SLOW_CLK，TRGMUX/GPT PIT 的 clock reference |
| `McuRtc_Source` | FIRC_CLK | RTC/API clock source |
| `McuRtc_Frequency` | 48 MHz | RTC clock source frequency |

配置理解：

```text
PLL_PHI0_CLK → McuCgm0ClockMux0
  DIV0 = 160 MHz → CORE_CLK
  DIV2 =  40 MHz → AIPS_SLOW_CLK
  ...

FIRC_CLK = 48 MHz → McuRtcClockSelect → RTC
SIRC_CLK = 32 kHz → WdgClockReferencePoint → SWT/WDG
```

修改实时控制配置前，建议先确认：

- CORE_CLK 是否符合 ADC/eMIOS/BCTU 频率限制；
- AIPS_SLOW_CLK 是否符合 CORE_CLK 的比例要求；
- STM0_CLK / AIPS_SLOW_CLK 与 GPT tick frequency 是否一致；
- WDG 选择的 SIRC 是否已稳定启用；
- RTC 选择 FIRC 后是否满足低功耗 always-on 需求。

### 7.2 Gpt 模块：PIT / STM / RTC / eMIOS 的 AUTOSAR timer 抽象

路径：`Gpt.xdm`

#### 7.2.1 GptDriverConfiguration

| 配置项 | 当前值 |
|---|---|
| `GptDevErrorDetect` | true |
| `GptPredefTimer100us32bitEnable` | false |
| `GptPredefTimer1usEnablingGrade` | `GPT_PREDEF_TIMER_1US_DISABLED` |
| `GptTimeoutMethod` | `OSIF_COUNTER_DUMMY` |
| `GptTimeoutDuration` | 3000 |
| `GptReportWakeupSource` | true |
| `GptClockReferencePoint_0` | `AIPS_SLOW_CLK` |
| `GptClockReferencePoint_stm0` | `STM0_CLK` |

当前 predefined timer 功能未启用。如果上层需要 AUTOSAR 标准 predefined timer（1us/100us），需要在这里打开并选择硬件 channel。

#### 7.2.2 GptChannelConfiguration

当前配置了 4 个 GPT channel：

| Channel | ID | 硬件 | 用途推断 |
|---|---:|---|---|
| `GptChannelConfiguration_Wdg` | 0 | PIT_0 CH_0 | WDG 外部触发/周期服务 |
| `GptChannelConfiguration_PIT1_0` | 1 | PIT_1 CH_0 | 应用周期 timer 1 |
| `GptChannelConfiguration_PIT2_0` | 2 | PIT_2 CH_0 | 应用周期 timer 2 |
| `GptChannelConfiguration_0` | 3 | STM_0 CH_0 | STM GPT channel / free-running compare |

#### 7.2.3 GptHwConfiguration

`Gpt.xdm` 中列出了硬件 ISR 资源使用情况。当前关键项：

| ISR HW ID | Enable | Used |
|---|---|---|
| `STM_0_CH_0` | true | true |
| `STM_1_CH_0` | true | true |
| `PIT_0_CH_0` | true | true |
| `PIT_1_CH_0` | true | true |
| `PIT_2_CH_0` | true | true |
| `RTC_0_CH_0` | false | false |
| `STM_0_PREDEF` | false | false |
| `STM_1_PREDEF` | false | false |

这里有个需要注意的点：虽然 `GptChannelConfiguration` 中只看到 `STM_0` channel，但 `GptHwConfiguration` 里 `STM_1_CH_0` 也标成 used=true。后续如果遇到 GPT ISR / interrupt vector 相关问题，建议进一步检查 generated code，确认是否是工具默认占用、另一个配置引用，还是旧配置残留。

### 7.3 Wdg 模块：SWT 的 AUTOSAR 配置入口

路径：`Wdg.xdm`

关键步骤：

1. 在 WdgGeneral 设置 WDG driver 行为：DET、disable allowed、timeout method、index、initial/max timeout。
2. 在 WdgClockReferencePoint 选择 watchdog clock reference，目前是 `SIRC_CLK`。
3. 在 WdgSettingsConfig 选择 `SWT0`。
4. 设置 `WdgDefaultMode = WDGIF_SLOW_MODE`。
5. 绑定 `WdgExternalTriggerCounterRef = GptChannelConfiguration_Wdg`。
6. 在 `WdgSettingsFast/Slow` 中分别设置 timeout、window mode、debug/stop 行为、reset on invalid access。

当前配置总结：

```text
WDG driver → SWT0
clock → SIRC_CLK / 32 kHz
mode → default slow
slow timeout → 5 s
fast timeout → 0.25 s
window mode → off
invalid access → system reset
external trigger → GPT PIT_0 CH_0
```

### 7.4 Pwm + Mcl：eMIOS PWM 实时输出配置

路径：`Pwm.xdm`、`Mcl.xdm`

当前项目有一个 heating PWM channel：

| 配置项 | 当前值 |
|---|---|
| `PwmChannel__Heating/PwmChannelId` | 0 |
| `PwmHwChannel` | `PwmEmios__Heating/PwmEmiosChannels__Heating` |
| `PwmChannelClass` | `PWM_FIXED_PERIOD` |
| `PwmPeriodInTicks` | true |
| `PwmPeriodDefault` | 8000 |
| `PwmDutycycleDefault` | 0 |
| `PwmMcuClockReferencePoint` | `CORE_CLK` |
| `PwmHwInstance` | `Emios_1` |
| `EmiosChId` | `CH_13` |
| `EmiosChMode` | `EMIOS_PWM_IP_MODE_OPWMB` |
| `EmiosChCounterBus` | `EMIOS_PWM_IP_BUS_A` |
| `EmiosChPrescaler` | `DIV_1` |
| `EmiosChFreeze` | true |
| `EmiosChPeriod` | 32768 |

`Mcl.xdm` 中 eMIOS common：

| 配置项 | 当前值 |
|---|---|
| `MclEnableEmiosCommon` | true |
| `MclEnableTrgMux` | false |
| `EmiosMclInstances` | `EMIOS_1` |
| `EmiosMclEnableFreezState` | true |
| `EmiosMclEnableGlobalTimeBase` | true |
| `EmiosMclClkDivVal` | 2 |
| master bus | `EMIOS_CH_23` |
| master bus mode | `MCB_UP_COUNTER` |
| master bus period | 8000 |
| master bus prescaler | `DIV_1` |
| debug allow | true |
| PWM exclusive access | true |

理解：

- eMIOS_1 CH_23 作为 master bus / time base；
- Heating PWM 使用 eMIOS_1 CH_13，counter bus 选择 BUS_A；
- PwmPeriodDefault = 8000，与 MCL master bus default period = 8000 一致；
- `MclEnableTrgMux=false`，说明当前 PWM 主要作为输出，不通过 TRGMUX 做复杂硬件触发链路。

按 CORE_CLK 160 MHz、period 8000 tick 粗略估算：

```text
PWM frequency ≈ 160 MHz / 8000 = 20 kHz
```

但实际 eMIOS 还要看 module clock divider、global prescaler、bus prescaler、MCAL 对 period tick 的定义。这里 20 kHz 是配置阅读时的第一层 sanity check，最终应以 generated code 和实测 PWM 为准。

### 7.5 Adc：当前主要是软件触发采样

路径：`Adc.xdm`

当前 ADC0 hw unit：

| 配置项 | 当前值 |
|---|---|
| `AdcHwUnitId` | ADC0 |
| `AdcLogicalUnitId` | 0 |
| `AdcTransferType` | `ADC_INTERRUPT` |
| `AdcDmaChannelId` | `Mcl/CHANNEL_FOR_ADC_0` |
| `AdcClockSource` | 当前 xdm 中有配置项，需结合生成代码确认具体 source |
| `AdcPrescale` | 2 |
| `AdcHwUnitResolution` | 14-bit |
| `AdcChannelSampTime` | 22 |

当前 groups 中能看到：

| Group | ID | Trigger | Channel | Notification |
|---|---:|---|---|---|
| `Adc0Group_Common` | 0 | `ADC_TRIGG_SRC_SW` | 多个通道 | `Notification_0` |
| `Adc0Group_Bat` | 1 | `ADC_TRIGG_SRC_SW` | `PTA0_VBAT` | `ADC_GroupNotification_Bat` |
| `Adc0Group_IGN` | 2 | `ADC_TRIGG_SRC_SW` | `PTA1_KL15` | `ADC_GroupNotification_IGN` |
| `Adc0Group_MotorPosVolt` | 3 | `ADC_TRIGG_SRC_SW` | `PTE15_V_M_Pos` | `ADC_GroupNotification_MotorPosVolt` |
| `Adc0Group_RTC` | 4 | `ADC_TRIGG_SRC_SW` | `PTC25_RTC` | `NULL_PTR` |

这里 `RTC` 是项目信号名/通道名 `PTC25_RTC`，不是 Real Time Clock 外设。不要把 ADC group `RTC` 和 Chapter 69 的 RTC timer 混淆。

当前 ADC groups 都是 software trigger，不是 BCTU hardware trigger。也就是说，虽然 RM 里的 PCMC 支持 eMIOS/TRGMUX/BCTU/ADC 硬件同步采样，但当前工程配置更像是软件发起 ADC conversion。

---

## 8. 当前项目的实时控制链路画像

综合 EB 配置，可以把当前项目实时控制资源画成这样：

```text
Mcu.xdm
├─ CORE_CLK = 160 MHz
│  ├─ PWM/eMIOS_1 Heating output
│  │  ├─ MCL eMIOS common enabled
│  │  ├─ eMIOS_1 CH_23 master bus, period 8000
│  │  └─ eMIOS_1 CH_13 OPWMB output, fixed period, duty default 0
│  └─ ADC0, software-trigger groups
│     ├─ Common/Bat/IGN/MotorPosVolt/RTC(signal)/...
│     └─ 14-bit, interrupt transfer
│
├─ AIPS_SLOW_CLK = 40 MHz
│  └─ GPT PIT channels
│     ├─ PIT_0 CH_0 → WDG external trigger callback
│     ├─ PIT_1 CH_0 → Gpt_PIT1_0_Notification
│     └─ PIT_2 CH_0 → Gpt_PIT2_0_Notification
│
├─ STM0_CLK = 40 MHz
│  ├─ GPT STM_0 CH_0 configured
│  └─ ECU/Time/Time.c direct IP_STM_0->CNT delay
│
├─ FIRC_CLK = 48 MHz
│  └─ RTC clock select configured, but GPT RTC channel unused
│
└─ SIRC_CLK = 32 kHz
   └─ WDG/SWT0 counter clock
      └─ slow timeout 5 s, fast timeout 0.25 s
```

### 8.1 与 RM “典型 PCMC 链路”的差异

RM 典型 PCMC 方案强调：

```text
eMIOS PWM → TRGMUX → BCTU → ADC hardware trigger
fault → LPCMP/LCU → fast hardware response
```

当前工程配置显示：

- `MclEnableTrgMux=false`；
- ADC groups 是 `ADC_TRIGG_SRC_SW`；
- 未看到 BCTU.xdm 或启用的 BCTU trigger 配置；
- Heating PWM 只配置了 eMIOS PWM 输出；
- GPT 主要使用 PIT/STM 做软件时间基准和 WDG trigger。

所以当前项目的实时控制更偏：

```text
software-scheduled ADC + PWM output + GPT/STM/PIT timing + WDG safety
```

而不是完整硬件闭环：

```text
PWM edge synchronized ADC sampling + hardware injected conversion + LCU fault chain
```

---

## 9. EB tresos 配置操作建议

### 9.1 配置 GPT + PIT 周期中断

典型步骤：

1. 打开 EB tresos → `Gpt` module。
2. 在 `GptDriverConfiguration` 中确认 clock reference：
   - PIT 通常选择 `AIPS_SLOW_CLK`；
   - 当前为 40 MHz。
3. 在 `GptChannelConfigSet/GptChannelConfiguration` 添加 channel。
4. 设置：
   - `GptHwIp = PIT`；
   - `GptModuleRef = GptPit_x/GptPitChannels_y`；
   - `GptChannelMode = GPT_CH_MODE_CONTINUOUS` 或 one-shot；
   - `GptChannelTickFrequency = 40000000`；
   - `GptChannelTickValueMax = 4294967295`；
   - `GptNotification = your_callback`。
5. 在 `GptPit` 下配置：
   - `GptPitModule = PIT_x`；
   - `PitFreezeEnable` 根据调试需求选择；
   - `GptPitChannel = CH_y`；
   - `ChainMode` 如果需要超过 32-bit 周期才打开。
6. 在 `GptHwConfiguration` 中确认对应 `PIT_x_CH_y`：
   - `GptIsrEnable = true`；
   - `GptChannelIsUsed = true`。
7. 重新 generate code。
8. 在应用初始化中调用 `Gpt_Init`，再 `Gpt_EnableNotification` / `Gpt_StartTimer`。

周期换算例子，40 MHz tick：

| 目标周期 | GPT ticks |
|---|---:|
| 100 us | 4000 |
| 1 ms | 40000 |
| 5 ms | 200000 |
| 10 ms | 400000 |
| 100 ms | 4000000 |
| 1 s | 40000000 |

### 9.2 配置 GPT + STM

如果使用 STM 做 GPT channel：

1. `GptHwIp = STM`。
2. `GptModuleRef = GptStm_x/GptStmChannels_y`。
3. Clock reference 选择 `STMx_CLK`。
4. 设置 `GptStmPrescaler`。
5. 根据需求设置 `StmAbsoluteCounting`：
   - false：常见相对计数/timeout；
   - true：更偏绝对 compare value。
6. 配置 `StmFreezeEnable`。
7. 确认 `GptHwConfiguration` 对应 `STM_x_CH_y` used/enable。

当前项目已配置 `STM_0/CH_0`，但 notification 是 `NULL_PTR`，说明不是用它做应用 callback 周期中断，更多可能是保留、底层时间或工具配置需要。

### 9.3 配置 WDG/SWT

典型步骤：

1. `Mcu` 中确认 `SIRC_CLK` 或其他 WDG clock 已启用。
2. `Gpt` 中准备 WDG external trigger counter，例如 PIT channel。
3. `Wdg` 中设置：
   - `WdgInstance = SWT0`；
   - `WdgDefaultMode`；
   - `WdgClockReferencePoint`；
   - `WdgExternalTriggerCounterRef`；
   - Fast/Slow timeout；
   - Window mode；
   - stop/debug mode；
   - reset on invalid access；
   - soft/hard lock。
4. 确认 `WdgIf` / `WdgM` / schedule 配置是否按期调用 trigger/service。
5. generate code 后检查 WDG 初始化顺序。

当前配置的核心风险点：

- WDG 外部 trigger 依赖 PIT_0 CH_0；
- invalid access 是 system reset；
- WDG disable 不允许；
- default 是 slow mode 5 s，而 fast mode 0.25 s 很短，切 fast mode 后服务周期必须足够快。

### 9.4 配置 RTC/API 低功耗唤醒

当前项目没有 GPT RTC channel。如果后续要做 RTC wakeup：

1. 在 `Mcu.xdm` 中确认 `McuRtcClockSelect`：
   - 当前 `McuRtc_Source = FIRC_CLK`，48 MHz；
   - 如果 standby 下 FIRC 不适合，需要结合芯片低功耗 clock tree 重新选择。
2. 在 GPT 或低层 RTC driver 中配置 RTC/API：
   - counter enable；
   - compare value `RTCVAL` 或 `APIVAL`；
   - interrupt enable；
   - wakeup source；
   - low-power mode 进入/退出流程。
3. 切换 RTC clock source 前 disable `CNTEN`。
4. disable RTC counter 后重新写 `RTCVAL/APIVAL`。
5. 读取 `RTCCNT` 时考虑最多 6 tick 的同步误差。

### 9.5 配置 eMIOS PWM + ADC hardware trigger

如果以后要把当前软件触发 ADC 升级为 PCMC 硬件同步采样，思路是：

1. `Mcl`：打开 `MclEnableTrgMux=true`，必要时启用 BCTU 相关模块。
2. `Pwm/Mcl`：选择 eMIOS master bus、PWM channel 和 reload/compare trigger 点。
3. `TRGMUX`：把 eMIOS trigger output 路由到 BCTU input。
4. `BCTU`：配置 trigger list、ADC target、conversion list、优先级。
5. `Adc`：group trigger 从 software trigger 改为 hardware trigger / BCTU flow。
6. `Interrupt/DMA`：配置 ADC EOC interrupt 或 DMA transfer。
7. 验证采样点：用示波器观察 PWM 和 ADC trigger/调试 GPIO 的相位关系。

---

## 10. 调试与验证清单

### 10.1 Clock sanity check

建议在初始化后打印或断点查看：

```c
Mcu_GetClockFrequency(CORE_CLK);
Mcu_GetClockFrequency(AIPS_SLOW_CLK);
Mcu_GetClockFrequency(STM0_CLK);
```

期望：

```text
CORE_CLK      = 160 MHz
AIPS_SLOW_CLK = 40 MHz
STM0_CLK      = 40 MHz
```

如果实际值不一致，后续 GPT tick、Time.c delay、PWM frequency 都会偏。

### 10.2 STM delay 验证

方法：

1. 在 `Timer_DelayUs(100)` 前后 toggle GPIO；
2. 示波器测高电平宽度；
3. 期望约 100 us；
4. 再测 `Timer_DelayMs(1)`，期望约 1 ms。

如果误差大：

- 查 `Mcu_GetClockFrequency(STM0_CLK)`；
- 查 STM prescaler；
- 查 compiler optimization 对 busy-wait 的影响；
- 查 debug freeze 是否改变观测结果。

### 10.3 GPT/PIT 周期中断验证

1. 在 `Gpt_PIT1_0_Notification` 中 toggle GPIO 或累加 counter。
2. 根据 `Gpt_StartTimer(channel, ticks)` 换算预期周期。
3. 40 MHz 下：

```text
period_seconds = ticks / 40000000
```

4. 检查 NVIC/interrupt priority、GptHwConfiguration 是否 enable/used。

### 10.4 WDG 验证

1. 正常喂狗：确认无 reset。
2. 故意停止 WDG service：应在 timeout 后 reset。
3. 切换 fast mode：确认服务周期小于 0.25 s timeout。
4. Debug halt：确认 WDG 是否停止，和 `WdgRunsInDebugMode=false` 预期一致。
5. 如果 reset 原因不明，读取 reset reason / MC_RGM，并区分：
   - SWT timeout；
   - invalid access；
   - functional reset；
   - destructive reset。

### 10.5 PWM/eMIOS 验证

1. 测 Heating PWM pin。
2. 若按 160 MHz / 8000 粗估，周期约 50 us，频率约 20 kHz。
3. 若实测不是 20 kHz，进一步检查：
   - eMIOS module clock；
   - `EmiosMclClkDivVal`；
   - master bus prescaler；
   - `PwmPeriodInTicks` 的 MCAL 解释；
   - generated `Pwm_PBcfg.c`。

### 10.6 ADC 触发验证

当前 ADC 是软件触发，验证重点：

- `Adc_StartGroupConversion` 调用周期；
- group notification 是否触发；
- conversion result 是否按 14-bit 解读；
- ADC clock/prescaler 是否满足 RM 频率范围；
- group `AdcWithoutInterrupts=true/false` 对调用方式的影响。

---

## 11. 常见问题速查

### Q1：STM 和 PIT 都是 timer，怎么选？

| 需求 | 推荐 |
|---|---|
| 读取当前时间戳、计算 elapsed time | STM |
| very short busy-wait delay | STM |
| 周期中断 callback | PIT/GPT |
| 需要硬件 trigger 到 ADC/BCTU | PIT/eMIOS + TRGMUX/BCTU |
| 超过 32-bit 的长周期 | PIT chaining / RTC/API |
| 低功耗 standby wakeup | RTC/API |

### Q2：为什么 GPT channel tick frequency 是 40 MHz？

因为当前 GPT 的 PIT clock reference 指向 `AIPS_SLOW_CLK`，而 Mcu.xdm 中 `AIPS_SLOW_CLK = 40 MHz`。STM GPT channel 指向 `STM0_CLK`，当前也为 40 MHz。

### Q3：为什么 ADC group 叫 RTC，但和 Real Time Clock 没关系？

`Adc0Group_RTC` 引用的是 `Adc0Channel_PTC25_RTC`，这里 `RTC` 是板级信号名或功能名。它属于 ADC 输入通道，不是 Chapter 69 的 RTC timer。

### Q4：WDG 为什么还引用 GPT？

AUTOSAR WDG 服务通常需要周期触发。当前 `WdgExternalTriggerCounterRef` 指向 `GptChannelConfiguration_Wdg`，这个 GPT channel 使用 `PIT_0/CH_0`，notification 为 `Wdg_Cbk_GptNotification0`。也就是说 PIT 给 WDG 服务逻辑提供节拍。

### Q5：为什么 RM 说 PCMC 支持硬件触发 ADC，但项目里没看到？

因为当前 `MclEnableTrgMux=false`，ADC group 是 `ADC_TRIGG_SRC_SW`。项目当前没有启用 eMIOS/TRGMUX/BCTU/ADC 这条完整硬件触发链。

### Q6：修改 Mcu clock 后最容易漏改什么？

- `GptChannelTickFrequency` 是否自动更新；
- `Time.c` 中依赖 `Mcu_GetClockFrequency(STM0_CLK)` 的 delay 是否还准确；
- PWM period tick 到实际频率是否变化；
- WDG clock source和 timeout 是否变化；
- RTC 的 1 us resolution 假设是否仍成立。

---

## 12. 和 Clocking 笔记的连接

Real-time control 的所有时间行为最终都回到 clock tree：

```text
Clocking 决定频率
  ↓
Timer tick / PWM period / ADC conversion time / WDG timeout 才有意义
  ↓
EB tresos 根据 Mcu.xdm 生成 MCAL 配置和频率字段
  ↓
应用代码使用 GPT/WDG/PWM/ADC/Time.c
```

所以修改实时控制相关配置时，推荐顺序是：

1. 先看 `[[S32K324 Clocking 时钟系统学习笔记]]`，确认 CORE/AIPS/STM/RTC/SIRC 等频率来源。
2. 再看对应 MCAL 模块配置：Gpt/Wdg/Pwm/Mcl/Adc。
3. 最后看 generated code 和应用调用。
4. 用 GPIO/示波器/调试寄存器验证实际周期。

---

## 13. 本项目当前配置摘要

| 类别 | 当前配置 | 结论 |
|---|---|---|
| CORE_CLK | 160 MHz | PCMC 主时钟，供 ADC/eMIOS/BCTU/LCU |
| AIPS_SLOW_CLK | 40 MHz | TRGMUX/GPT PIT clock reference；CORE/4 |
| STM0_CLK | 40 MHz | Time.c 和 GPT STM 使用 |
| RTC clock | FIRC 48 MHz | MCU 层配置了 RTC clock，但 GPT 未使用 RTC channel |
| GPT PIT | PIT_0/1/2 CH_0 | 40 MHz tick，continuous mode |
| GPT STM | STM_0 CH_0 | 40 MHz tick，notification NULL |
| WDG/SWT | SWT0 | SIRC 32 kHz，slow 5 s，fast 0.25 s，PIT_0 trigger |
| PWM | eMIOS_1 CH_13 | Heating PWM，OPWMB，fixed period |
| eMIOS master bus | eMIOS_1 CH_23 | MCB up counter，period 8000 |
| ADC | ADC0 software trigger | 多个 SW trigger groups，14-bit |
| TRGMUX/BCTU hardware chain | 未启用/未见配置 | 当前不是硬件同步采样链路 |

---

## 14. 后续深入建议

1. 读取 generated code：
   - `Gpt_PBcfg.c`
   - `Wdg_PBcfg.c`
   - `Pwm_PBcfg.c`
   - `Adc_PBcfg.c`
   - `Mcu_PBcfg.c`
2. 对照 xdm 和生成结构体，确认 EB GUI 中每个配置如何落到寄存器。
3. 用示波器验证：
   - STM delay；
   - PIT notification 周期；
   - Heating PWM 频率和占空比；
   - WDG timeout reset 时间。
4. 如果未来要做更严格实时控制，把 ADC 从 software trigger 升级到 eMIOS/TRGMUX/BCTU hardware trigger。
5. 如果未来要做 sleep/standby 周期唤醒，补充 RTC/API + wakeup source 配置笔记。


---

# 2026-05-13 补强版：按 Reference Manual Chapter 59~65 + 两个项目 EB 配置重新梳理

> 这次补强专门解决前一版漏掉的问题：Real-time control 不能只写 STM/PIT/RTC/SWT，也必须把 Reference Manual 左侧目录中 Real-time control 下的 Chapter 59~65 写清楚：PCMC、ADC、LPCMP、LCU、eMIOS、BCTU、TRGMUX。下面内容同时对照两个项目：
>
> - Heating 项目：`E:/github/ECAS_RTA_S32K324GHS_Heating`
> - TEL9471 项目：`E:/git_project/S32K324_TEL9471`
>
> 参考手册：`C:/Users/Administrator/Zotero/storage/GKPNECE2/S32K3xx Reference Manual.pdf`，S32K3xx Reference Manual Rev.9, 07/2024。
>
> 重要提醒：下面的“模块能力”来自 Reference Manual；“项目实际配置”来自两个项目的 EB `.xdm` 和生成代码。二者必须分开看：芯片支持，不代表当前项目已经启用；EB 有配置，不代表应用代码已经使用。

## 补强目录

- [A. Real-time control 在 Reference Manual 里的完整范围](S32K324%20Real-time%20control%20实时控制学习笔记.md#a-real-time-control-在-reference-manual-里的完整范围)
- [B. PCMC：实时控制子系统总览](S32K324%20Real-time%20control%20实时控制学习笔记.md#b-pcmc实时控制子系统总览)
- [C. ADC：模拟采样核心](S32K324%20Real-time%20control%20实时控制学习笔记.md#c-adc模拟采样核心)
- [D. LPCMP：低功耗比较器 / 快速故障判断](S32K324%20Real-time%20control%20实时控制学习笔记.md#d-lpcmp低功耗比较器--快速故障判断)
- [E. LCU：硬件逻辑控制单元](S32K324%20Real-time%20control%20实时控制学习笔记.md#e-lcu硬件逻辑控制单元)
- [F. eMIOS：PWM、输入捕获、计数总线](S32K324%20Real-time%20control%20实时控制学习笔记.md#f-emiospwm输入捕获计数总线)
- [G. BCTU：把触发变成 ADC 转换序列](S32K324%20Real-time%20control%20实时控制学习笔记.md#g-bctu把触发变成-adc-转换序列)
- [H. TRGMUX：触发路由矩阵](S32K324%20Real-time%20control%20实时控制学习笔记.md#h-trgmux触发路由矩阵)
- [I. EB 配置项总地图：Mcu / Mcl / Pwm / Adc / Gpt / Port / Icu](S32K324%20Real-time%20control%20实时控制学习笔记.md#i-eb-配置项总地图mcu--mcl--pwm--adc--gpt--port--icu)
- [J. 两个项目配置对照](S32K324%20Real-time%20control%20实时控制学习笔记.md#j-两个项目配置对照)
- [K. 200 kHz、50% PWM 应该怎么配](S32K324%20Real-time%20control%20实时控制学习笔记.md#k-200-khz50-pwm-应该怎么配)
- [L. 调试验证清单](S32K324%20Real-time%20control%20实时控制学习笔记.md#l-调试验证清单)

## A. Real-time control 在 Reference Manual 里的完整范围

截图里的左侧目录显示 Real-time control 下至少包含这些关键章节：

| RM 章节 | 名称 | 通俗理解 | EB/MCAL 中主要对应 |
|---|---|---|---|
| Chapter 59 | Power Conversion and Motor Control, PCMC | 实时控制“总说明书”，讲 ADC/eMIOS/BCTU/LCU/TRGMUX/LPCMP 如何组成闭环链路 | 多个模块组合，不是单独一个 EB 模块 |
| Chapter 60 | ADC | 模拟量采样，把电压/电流/温度变成数字量 | `Adc.xdm`, `Adc_PBcfg.c`, `Adc_Sar_Ip_PBcfg.c`, `Bctu_Ip_PBcfg.c` |
| Chapter 61 | LPCMP | 比较器，模拟电压超过阈值时快速给出数字结果，可用于保护 | 本项目未看到独立 EB 配置文件，通常由安全/底层配置或未使用 |
| Chapter 62 | LCU | 硬件 LUT 逻辑，可组合 PWM、故障、同步信号，做门控/互补/保护 | `Mcl.xdm` 中 `MclLcuConfig`, `lcuConfiguration`; 生成 `Lcu_Ip_*` |
| Chapter 63 | eMIOS | PWM 输出、输入捕获、周期测量、计数总线 | `Pwm.xdm`, `Mcl.xdm`, `Icu.xdm`, `Gpt.xdm`, 生成 `Emios_*` |
| Chapter 64 | BCTU | Body Cross-triggering Unit，把 eMIOS/TRGMUX/PIT 等触发转成 ADC 转换命令 | `Adc.xdm`, 生成 `Bctu_Ip_*` |
| Chapter 65 | TRGMUX | Trigger MUX，触发信号选择器，把 A 模块的 trigger 接到 B 模块 | `Mcl.xdm` 中 `MclTrgMux`, `trgmuxLogicGroup` |

一句话理解：

```text
PWM/Timer 事件源：eMIOS / PIT / STM / 软件
        ↓
触发路由：TRGMUX
        ↓
ADC 触发编排：BCTU
        ↓
ADC 采样：ADC0/ADC1/ADC2
        ↓
保护/逻辑联动：LPCMP / LCU / eMIOS output disable
        ↓
软件控制：中断 / DMA / 周期任务 / AUTOSAR MCAL API
```

## B. PCMC：实时控制子系统总览

PCMC 不是一个单独外设，而是 Reference Manual Chapter 59 对实时控制外设组合的总称。它重点解决的问题是：

1. PWM 必须稳定、相位可控；
2. ADC 采样点必须和 PWM 周期严格对齐；
3. 过流/过压等故障不能等软件任务慢慢处理，要尽量走硬件链路；
4. 多个外设之间要能不用 CPU 就互相触发。

典型电机/电源控制链路：

```text
eMIOS 产生 PWM
  ├─ PWM 输出到引脚，驱动 MOS/阀/电机
  ├─ PWM 周期中点或边沿产生 trigger
  ↓
TRGMUX 选择 trigger 来源和去向
  ↓
BCTU 根据 trigger 触发 ADC conversion list
  ↓
ADC 采样电流/电压/温度
  ↓
DMA/中断/控制任务读取结果并更新 PWM duty
```

PCMC 的设计考虑里特别强调：

- ADC accuracy：采样精度、输入噪声、采样时间、触发时刻都会影响结果；
- ADC triggering：硬件触发比软件触发抖动更小；
- BCTU data retrieval：结果可以通过中断/DMA/FIFO 等方式取；
- eMIOS PWM considerations：PWM 模式、counter bus、reload、trigger generation 要和 ADC 触发配套；
- fault detection：LPCMP/LCU/eMIOS output disable 可以形成快速保护链路。

## C. ADC：模拟采样核心

### C.1 ADC 在 RM 中的关键点

S32K3xx ADC 支持：

- 多个 ADC instance，例如 ADC0/ADC1/ADC2；
- normal conversion 和 injected conversion；
- 软件触发和硬件触发；
- BCTU trigger mode / BCTU control mode；
- DMA、interrupt；
- analog watchdog；
- calibration 和 self-test；
- 不同输入类型：precision、standard、external 等。

通俗理解：

```text
ADC channel = 具体某一路模拟输入，例如某个电压脚。
ADC group   = 一组要一起转换的 channel。
ADC HW unit = ADC0/ADC1/ADC2 这个硬件模块。
Trigger     = 谁来启动这组转换：软件 API、PIT、eMIOS、BCTU 等。
```

### C.2 EB Adc.xdm 关键配置项

| EB 配置项 | 作用 | 说明 |
|---|---|---|
| `AdcHwUnitId` | 选择 ADC0/ADC1/ADC2 | 对应硬件实例 |
| `AdcHwUnitResolution` | 分辨率 | Heating 是 14-bit；TEL9471 是 12-bit |
| `AdcChannelName` | 选择硬件 ADC 输入通道 | 注意它是硬件通道名，不是业务信号名 |
| `AdcChannelId` | MCAL channel id | 软件 API 用这个 id 间接访问 |
| `AdcChannelSampTime` | 采样时间 | 阻抗高的信号要更长采样时间 |
| `AdcGroupId` | group id | `Adc_StartGroupConversion()` / `Adc_EnableHardwareTrigger()` 使用 |
| `AdcGroupConversionMode` | ONESHOT/CONTINUOUS | 单次转换还是连续转换 |
| `AdcGroupAccessMode` | SINGLE/STREAMING | 结果缓冲访问方式 |
| `AdcGroupTriggSrc` | SW/HW | 软件触发还是硬件触发 |
| `AdcHwTriggerSignal` | 硬件触发边沿/信号 | HW group 才有意义 |
| `AdcHwTriggerTimer` | 触发源引用 | 常见是 BCTU/TRGMUX/PIT/eMIOS 相关路径 |

### C.3 项目代码怎么用 ADC

TEL9471 中应用代码路径：

```text
E:/git_project/S32K324_TEL9471/src/00BSW/04ComplexDrivers/CD002A_AdcCfgAndUse/src/CD002A_AdcCfgAndUse.c
```

关键逻辑：

- `AdcCfgAndUse_Init1()` 中对每个 group 调 `Adc_SetupResultBuffer()`；
- 每个 group 调 `Adc_EnableGroupNotification()`；
- 如果 group 类型是 `ADCCFGANDUSE_HWGROUP`，调用 `Adc_EnableHardwareTrigger()`；
- 如果是软件周期触发 group，则在 `AdcCfgAndUse_Per1_10ms()` 中按周期调用 `Adc_StartGroupConversion()`。

所以 TEL9471 是“软件触发 + 硬件触发混合”的项目，不是纯软件 ADC。

### C.4 参考文章补充：ADC 真正要看的是“完整链路”

这篇 CSDN 文章补充得比较实用，核心不是单讲 ADC 寄存器，而是把 ADC 放回整条实时控制链路里看。对 S32K3 / S32K324 来说，最值得记住的是：

- ADC 不是孤立模块，而是 PCMC 链路的一环；
- 采样时点通常要和 PWM 周期绑定，不然采到的波形位置不稳定；
- 硬件触发链路一般比软件轮询更适合实时控制；
- 结果读取方式会影响系统结构，常见有 interrupt、DMA、FIFO 等路径；
- 采样时间、分辨率、转换时间、触发源都会影响最终测量质量；
- calibration 和 self-test 不能跳过，尤其是上电初始化阶段。

可以把这篇文章的思路概括成一条链：

```text
PWM / 定时器 / 外部事件
  -> 触发 ADC
  -> ADC conversion
  -> result buffer / interrupt / DMA
  -> control loop
```

对照到本笔记里的项目现状，更接近的是：

- Heating：当前主要还是软件触发 ADC；
- TEL9471：已经有 PIT + TRGMUX + ADC 的硬件触发链路；
- 如果后续要把实时控制做得更“硬件闭环”，就要继续往 BCTU / eMIOS / TRGMUX 方向补齐。

### C.5 文章里最值得带走的几个点

1. **ADC group 的职责要先分清**

   group 不是“随便一组通道”，而是一次触发后要一起完成的转换集合。这样设计是为了适配控制环里的采样节拍。

2. **硬件触发优先于软件触发**

   在 PWM 控制、周期采样、过流检测这类场景里，硬件触发更容易保证相位稳定，也更容易压低 CPU 抖动。

3. **校准和自检要当成初始化流程的一部分**

   这类步骤不是“可选装饰”，而是让 ADC 结果可信的前置条件。

4. **DMA / 中断 / FIFO 是结果搬运方式，不是采样本身**

   真正的采样行为发生在触发和 conversion 阶段；后面的搬运方式决定的是系统吞吐和 CPU 占用。

5. **不要把业务名和硬件名混在一起**

   例如 group 里叫 `RTC`，不代表它一定和 Real Time Clock 有关，很多时候只是业务命名或通道名。

## D. LPCMP：低功耗比较器 / 快速故障判断

LPCMP 是 analog comparator。它不输出一个 12-bit/14-bit 采样值，而是回答一个问题：

```text
输入电压 是否 大于/小于 某个参考阈值？
```

RM Chapter 61 中 LPCMP 重点包括：

- continuous mode：连续比较；
- sampled mode：按采样时钟比较；
- filtered mode：比较结果做滤波，减少毛刺；
- windowed mode：只在窗口时间内比较；
- round-robin trigger mode：轮询多个输入；
- DAC reference：内部 DAC 产生比较阈值；
- interrupt / DMA；
- low power mode wakeup。

在实时控制中的作用：

| 场景 | LPCMP 价值 |
|---|---|
| 过流保护 | 电流采样电压超过阈值立即翻转 comparator 输出 |
| 过压保护 | 母线电压超过阈值触发 fault |
| 低功耗唤醒 | 某个模拟量越界时唤醒芯片 |
| 快速保护 | 不必等待 ADC 转换完成和软件处理 |

当前两个项目的 EB 配置里没有看到独立 `Lpcmp.xdm`，因此笔记里只能把 LPCMP 作为 RM 能力和后续扩展点说明；不能声称项目已经使用 LPCMP。

## E. LCU：硬件逻辑控制单元

LCU 可以理解成芯片内部的小型“可编程逻辑门阵列”。它把多个输入信号经过 LUT/filter/force/sync 后输出。

RM Chapter 62 中 LCU 重点包括：

- LC LUT：查表逻辑，类似硬件 if/else；
- output filter：输出滤波；
- force input：故障或软件强制时覆盖输出；
- sync control：同步更新输出；
- software override：软件覆盖输入/输出；
- interrupt / DMA；
- 典型应用：PWM 互补、死区、BLDC 换相、fault gating。

通俗例子：

```text
输入：PWM_A、PWM_B、过流Fault、Enable
逻辑：如果 Fault=1 或 Enable=0，则强制输出关断；否则输出 PWM_A/PWM_B
输出：安全后的 PWM 到驱动器
```

### E.1 EB Mcl.xdm 中 LCU 相关项

| 配置项 | 含义 |
|---|---|
| `MclEnableLcu` | 是否启用 LCU IP 配置 |
| `MclEnableLcuSyncFunc` | 是否启用同步相关功能 |
| `MclEnableLcuAsyncFunc` | 是否启用异步相关功能 |
| `lcuConfiguration` | LCU LUT、输入、输出、force、sync 详细配置 |
| 生成文件 `Lcu_Ip_PBcfg.c` | EB 生成的 LCU 配置结构 |

两个项目对照：

- Heating：`MclEnableLcu=false`，但 Mcu 中 LCU_0/LCU_1 gate 是 true；也就是说时钟门可能开了，但 MCL 层没有启用 LCU 配置。
- TEL9471：`MclEnableLcu=false`，Mcu 中 LCU_0/LCU_1 gate 是 false；当前项目明确没有用 LCU。

## F. eMIOS：PWM、输入捕获、计数总线

### F.1 eMIOS 是什么

eMIOS 是 Enhanced Modular I/O Subsystem。它由多个 Unified Channel, UC 组成。每个 UC 可以根据模式变成：PWM 输出、输入捕获、周期测量、边沿计数、counter bus 等。

每个 UC 里有：

- A/B 双缓冲寄存器；
- A/B 比较器；
- 内部 counter；
- output flip-flop；
- status/control register；
- input filter；
- counter bus select；
- output disable select。

### F.2 eMIOS channel type 和模式支持

你截图中的 Table 401 很关键。不同 channel type 支持的模式不同：

| 模式 | 名称 | 用途 | TypeX | TypeY | TypeG | TypeH |
|---|---|---|---|---|---|---|
| SAOC | Single Action Output Compare | 单比较输出动作 | 支持 | 支持 | 支持 | 支持 |
| MC | Modulus Counter | 计数基准 | 支持 | 不支持 | 不支持 | 不支持 |
| MCB | Modulus Counter Buffered | 带缓冲计数基准 | 支持 | 不支持 | 支持 | 不支持 |
| IPWM | Input Pulse Width Measurement | 测输入脉宽 | 不支持 | 不支持 | 支持 | 支持 |
| IPM | Input Period Measurement | 测输入周期 | 不支持 | 不支持 | 支持 | 支持 |
| DAOC | Double Action Output Compare | 双比较输出 | 不支持 | 不支持 | 支持 | 支持 |
| OPWFMB | Output Pulse Width and Frequency Modulation Buffered | 频率和占空比都可调的 PWM | 支持 | 不支持 | 支持 | 不支持 |
| OPWMCB | Center aligned Output PWM Buffered with dead time | 中心对齐、带死区 PWM | 不支持 | 不支持 | 支持 | 不支持 |
| OPWMB | Output Pulse Width Modulation Buffered | 普通带缓冲 PWM | 支持 | 支持 | 支持 | 支持 |
| OPWMT | Output PWM Trigger | PWM + trigger | 支持 | 支持 | 支持 | 支持 |
| PEC | Pulse Edge Counting | 边沿计数 | 不支持 | 不支持 | 支持 | 不支持 |

为什么这张表必须写进笔记？因为 EB 下拉框里显示的模式，不等于你的 channel 一定支持。你要先知道 CH_x 是 TypeX/Y/G/H，再选模式。

### F.3 Counter bus、channel 和 timebase source

你新截图里的 Table 403 也必须写清楚，因为 PWM 频率不是只由当前 channel 决定，还由 counter bus 决定。

从 RM Table 403 可得：

| Counter bus | 作用范围 | Timebase channel |
|---|---|---|
| Global bus A | All UCs | UC23 |
| Local bus B | UC0~UC7 | UC0 |
| Local bus C | UC8~UC15 | UC8 |
| Local bus D | UC16~UC23 | UC16 |
| Global bus F | All UCs | UC22 |

通俗理解：

```text
PWM channel 自己负责“输出什么时候翻转”；
Counter bus 负责“时间从哪里来”。
```

所以在 EB 里看到 `Counter Bus = EMIOS_PWM_IP_BUS_A`，就要继续去 Mcl 的 eMIOS master bus 看 bus A 的 timebase channel、周期、prescaler。

### F.4 EB Pwm.xdm 里的 eMIOS PWM 配置项

| EB 字段 | 作用 | 说明 |
|---|---|---|
| `PwmChannelId` | AUTOSAR PWM channel id | 应用调用 `Pwm_SetDutyCycle(chId, duty)` 使用 |
| `PwmHwChannel` | 指向底层 eMIOS/FlexPWM/FlexIO channel | 连接 AUTOSAR channel 和 IP channel |
| `PwmPeriodDefault` | 默认周期 | 如果 `PwmPeriodInTicks=true`，就是 tick 数 |
| `PwmDutycycleDefault` | 默认占空比 | AUTOSAR PWM duty 通常是 0x0000~0x8000 表示 0~100% |
| `PwmMcuClockReferencePoint` | 频率参考 | 用于 EB 计算 tick 和频率 |
| `EmiosChId` | eMIOS UC 编号 | 如 CH_13、CH_19 |
| `EmiosChMode` | eMIOS PWM 模式 | OPWMB/OPWFMB/OPWMT/OPWMCB 等 |
| `EmiosChCounterBus` | 选择 counter bus | A/F/BCDE/internal 等 |
| `PwmEmiosBusRef` | 指向 Mcl master bus | 如果用外部 bus，必须引用对应 master bus |
| `EmiosChPrescaler` | channel prescaler | 在模块时钟基础上再分频 |
| `EmiosChPrescalerSource` | prescaler clock source | 通常 module clock |
| `EmiosChPolarity` | 输出极性 | active high / active low |
| `EmiosChInterrupt` | flag event response | 是否中断/通知 |
| `EmiosChPeriod` | IP 层周期 tick | 实际 eMIOS 配置用 |
| `EmiosChDutyCycle` | IP 层 duty tick | 和 period 同一单位 |
| `EmiosChPhaseShift` | 相移 tick | 多路错相 PWM 用 |
| `EmiosChTrigger` | trigger tick | OPWMT/触发 ADC 时用 |
| `EmiosChDeadtime` | 死区 tick | OPWMCB/互补输出时用 |

### F.5 eMIOS 模式选择通俗说明

| EB 模式 | 适合什么 | 不适合什么 |
|---|---|---|
| `EMIOS_PWM_IP_MODE_OPWMB` | 普通固定频率 PWM，只调 duty；最通用，所有 channel type 支持 | 需要动态变频、中心对齐、ADC trigger 的场景 |
| `EMIOS_PWM_IP_MODE_OPWFMB` | 频率和 duty 都要运行中调整；TEL9471 多个阀 PWM 用它 | 只需要固定频率时配置稍复杂 |
| `EMIOS_PWM_IP_MODE_OPWMT` | PWM 同时产生 trigger，适合 PWM 同步 ADC | 不需要硬件 trigger 的普通输出 |
| `EMIOS_PWM_IP_MODE_OPWMCB_LEAD_EDGE/TRAIL_EDGE` | 中心对齐、互补、死区、电机/半桥/全桥 | 普通单路阀/加热 PWM；且只 TypeG 支持 |
| `EMIOS_PWM_IP_MODE_DAOC` | 自定义双比较输出波形 | 普通 PWM |

## G. BCTU：把触发变成 ADC 转换序列

BCTU 是 Body Cross-triggering Unit。它的作用不是产生 PWM，也不是直接采样，而是：

```text
收到某个 trigger → 按配置启动一个或多个 ADC conversion list → 管理结果/中断/DMA/FIFO
```

RM Chapter 64 中关键概念：

| 概念 | 含义 |
|---|---|
| Trigger | 外部事件源，如 eMIOS channel、TRGMUX 输入、PIT 等 |
| TRGCFG | 每个 trigger 的配置，决定触发哪个 conversion list 或 ADC |
| Conversion List, CL | ADC 转换列表，定义触发后要采哪些 channel |
| FIFO | 转换结果可进入 FIFO |
| MPC | Multiple Parallel Conversions，多 ADC 并行转换 |
| Busy management | ADC 忙时 trigger 如何处理 |
| DMA/Interrupt | 结果完成后通知 CPU 或 DMA |

RM Table 422 显示 BCTU trigger sources 包括大量 eMIOS channel，也包括 “Any of the TRGMUX input”。这意味着两条路线都可行：

```text
路线1：eMIOS channel → BCTU trigger → ADC
路线2：PIT/eMIOS/LCU 等 → TRGMUX → BCTU → ADC
```

当前项目状态：

- Heating：Mcu gate 中 BCTU=true，但 `MclEnableTrgMux=false`，ADC group 全是 `ADC_TRIGG_SRC_SW`，所以没有形成硬件触发 ADC 链路。
- TEL9471：Mcu gate 中 BCTU=true，Mcl 启用 TRGMUX，ADC1 group 是 `ADC_TRIGG_SRC_HW`，已经有硬件触发链路。

## H. TRGMUX：触发路由矩阵

TRGMUX 是 trigger mux。它做的事情非常像“硬件连线选择器”：

```text
选择输入 trigger source → 接到某个 peripheral trigger input
```

RM Chapter 65 中关键点：

- TRGMUX allows you to configure trigger inputs for various peripherals；
- TRGMUX 寄存器只能在 Supervisor mode 写；
- 有多个输出寄存器，如 ADC12_0、ADC12_1、ADC12_2、BCTU、eMIOS、LCU、SIUL_OUT 等；
- 每个输出通常有 SEL0/SEL1/SEL2/SEL3 选择字段；
- 有 lock bit，锁住后不能随便改。

EB Mcl.xdm 中关键项：

| EB 字段                       | 作用                                   |
| --------------------------- | ------------------------------------ |
| `MclEnableTrgMux`           | 是否启用 TRGMUX 配置                       |
| `trgmuxLogicGroup_Name`     | 选择 TRGMUX 输出组，例如 `TRGMUX_IP_ADC12_0` |
| `trgmuxLogicTrigger_Output` | 具体输出，例如 ADC normal/injected trigger  |
| `trgmuxLogicTrigger_Input`  | 输入触发源，例如 PIT0_CH1、eMIOS trigger      |
| `trgmuxLogicGroup_Lock`     | 是否锁定配置                               |

TEL9471 当前 TRGMUX 配置：

| 输出组                 | 输出                                             | 输入                         |
| ------------------- | ---------------------------------------------- | -------------------------- |
| `TRGMUX_IP_ADC12_0` | `TRGMUX_IP_OUTPUT_ADC12_0_EXTRG_NORMAL_CONV`   | `TRGMUX_IP_INPUT_PIT0_CH1` |
| `TRGMUX_IP_ADC12_1` | `TRGMUX_IP_OUTPUT_ADC12_1_EXTRG_NORMAL_CONV`   | `TRGMUX_IP_INPUT_PIT0_CH2` |
| `TRGMUX_IP_ADC12_2` | `TRGMUX_IP_OUTPUT_ADC12_2_EXTRG_INJECTED_CONV` | `TRGMUX_IP_INPUT_PIT0_CH3` |

这说明 TEL9471 的设计倾向是：用 PIT0 的不同 channel 产生 ADC0/ADC1/ADC2 的触发，而不是由 PWM 直接触发 ADC。

## I. EB 配置项总地图：Mcu / Mcl / Pwm / Adc / Gpt / Port / Icu

### I.1 Mcu.xdm：先开时钟和外设门控

必须先看 Mcu，因为外设没有 clock gate，后面 Pwm/Adc/Mcl 配了也可能不能工作。

| 配置 | 作用 |
|---|---|
| `McuClockReferencePoint_*` | EB 里给其他模块引用的时钟频率 |
| `McuPeripheralName=TRGMUX/BCTU/EMIOS_x/LCU_x/ADC_x` | 外设门控对象 |
| `McuPeripheralClockEnable` | 是否开该外设时钟 |
| `McuModeEntrySlot` | MC_ME partition/COFB gate 位置 |
| `McuEmiosConfigureGprenApi` | 是否允许通过 API 配置 eMIOS global prescaler enable |

### I.2 Mcl.xdm：实时控制底层公共配置

Mcl 不是只管 DMA，它还承载 NXP MCAL 中一些 IP common 配置：

- `MclEnableTrgMux`：TRGMUX；
- `MclEnableEmiosCommon`：eMIOS common/master bus；
- `MclEnableLcu`：LCU；
- `EmiosCommon`：哪个 EMIOS instance、global prescaler、freeze、global timebase；
- `EmiosMclMasterBus`：bus A/F/BCDE 的 master channel、period、prescaler。

### I.3 Pwm.xdm：PWM 输出通道

Pwm 层分两层：

```text
PwmChannel: AUTOSAR 抽象 channel，应用代码用 chId 调 API
PwmEmiosChannels: 底层 eMIOS UC，决定 CH_x、mode、bus、period、duty、trigger、deadtime
```

### I.4 Adc.xdm：ADC group 和触发方式

最重要看：

- group 是 SW 还是 HW；
- 如果 HW，触发来自哪个 TRGMUX/BCTU/硬件源；
- result buffer 怎么配置；
- resolution、sample time、conversion time 是否满足信号源阻抗和周期。

### I.5 Gpt.xdm：PIT/STM 作为触发源或系统 tick

Gpt 可以对应 PIT、STM、eMIOS timer 等。TEL9471 中 PIT0_CH1/2/3 被 TRGMUX 用来触发 ADC，所以 Gpt 不是单纯“软件定时器”，也可能是硬件触发源。

### I.6 Port.xdm：PWM 不是配了就出现在引脚上

PWM 输出还必须检查 Port pin mux：

- Heating：`PTE?` 对应 `EMIOS_1_EMIOS_1_CH_13_H_OUT`；
- TEL9471：可见多路 `eMIOS_0_CHx_G_OUT`、`eMIOS_1_CHx_H_OUT`、`eMIOS_2_CHx_H_OUT`。

如果 Pwm 配了但引脚 mux 没选 eMIOS 输出，示波器上不会有 PWM。

## J. 两个项目配置对照

### J.1 Heating 项目

来源：

```text
E:/github/ECAS_RTA_S32K324GHS_Heating/BasicSoftware/integration/mcal/MCAL_Cfg/config
```

| 模块 | 当前配置结论 |
|---|---|
| Mcu | TRGMUX/BCTU/EMIOS_0/1/2/LCU_0/1/ADC_0/1/2 gate 都是 true |
| Mcl | `MclEnableTrgMux=false`; `MclEnableEmiosCommon=true`; `MclEnableLcu=false` |
| eMIOS common | 使用 `EMIOS_1`; common clock div value = 2 |
| eMIOS master bus | `EMIOS_CH_23`; default period = 8000; prescaler = DIV_1 |
| Pwm | 1 路 Heating PWM：`CH_13`, `OPWMB`, `BUS_A`, prescaler DIV_1, period 32768, duty 16384 |
| Pwm AUTOSAR | `PwmChannelId=0`; `PwmPeriodDefault=8000.0`; `PwmDutycycleDefault=0`; clock ref 指向 `CORE_CLK` |
| Adc | ADC0/ADC1，14-bit，所有 group 均为 `ADC_TRIGG_SRC_SW` |
| Gpt | PIT/STM tick frequency 40 MHz |
| Port | 存在 eMIOS_1 CH13 输出复用 |

注意点：Heating 中 PwmChannel 默认周期 8000，但底层 EmiosChPeriod 为 32768；这类差异要以生成代码和实际 `Pwm_SetPeriodAndDuty`/初始化结果再核实，不能只看一个字段。

### J.2 TEL9471 项目

来源：

```text
E:/git_project/S32K324_TEL9471/EB_Configuration/config
```

| 模块               | 当前配置结论                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Mcu clock ref    | CORE 160 MHz；PIT 40 MHz；eMIOS 160 MHz；ADC 160 MHz；STM 80 MHz                                                                            |
| Mcu gate         | TRGMUX/BCTU/EMIOS_0/1/2/ADC_0/1/2=true；LCU_0/1=false                                                                                    |
| Mcl              | `MclEnableTrgMux=true`; `MclEnableEmiosCommon=true`; `MclEnableLcu=false`                                                               |
| eMIOS common     | EMIOS_0/1/2 均有 common 配置                                                                                                                |
| eMIOS master bus | EMIOS_0 master CH22 period 1；EMIOS_1 master CH23 period 3200；EMIOS_2 master CH0 period 3200                                             |
| PWM 阀/输出         | 多路 OPWFMB，period 3200，internal bus，推算 160MHz/3200=50kHz                                                                                 |
| SRC PWM          | 多路 OPWMT，BUS_A，period 40000，推算 160MHz/40000=4kHz                                                                                        |
| LC PWM           | 多路 OPWMB，BUS_BCDE，period 3200                                                                                                           |
| TRGMUX           | PIT0_CH1→ADC12_0 normal；PIT0_CH2→ADC12_1 normal；PIT0_CH3→ADC12_2 injected                                                               |
| ADC              | ADC0/1/2，12-bit；ADC1 group 为 HW trigger，其余主要 SW trigger                                                                                 |
| Gpt              | PIT 40 MHz；STM 80 MHz；存在 ADC0/1/2 10ms 相关 PIT channel                                                                                   |
| 应用代码             | `CD001A_PwmCfgAndUse.c` 使用 `Pwm_SetDutyCycle()`；`CD002A_AdcCfgAndUse.c` 使用 `Adc_EnableHardwareTrigger()` 和 `Adc_StartGroupConversion()` |

TEL9471 的实时控制链路可以画成：

```text
PIT0_CH1 ──TRGMUX──> ADC12_0 normal trigger
PIT0_CH2 ──TRGMUX──> ADC12_1 normal trigger
PIT0_CH3 ──TRGMUX──> ADC12_2 injected trigger

PWM 输出：
EMIOS_0/1/2 channels → Port pin mux → 阀/输出驱动
```

也就是说，TEL9471 当前主要是“PIT 同步 ADC + eMIOS 输出 PWM”，不是“eMIOS PWM 直接触发 ADC”。

## K. 200 kHz、50% PWM 应该怎么配

### K.1 模式选择

普通 200 kHz、50% 占空比 PWM，推荐：

```text
EMIOS_PWM_IP_MODE_OPWMB
```

原因：

- 固定频率、只调 duty，OPWMB 最直接；
- OPWMB 在 TypeX/TypeY/TypeG/TypeH 都支持；
- 带 buffered 更新，波形更稳定；
- 不需要 deadtime、center aligned、trigger 时，没必要选 OPWMCB/OPWMT。

如果你要 PWM 同步触发 ADC，才考虑：

```text
EMIOS_PWM_IP_MODE_OPWMT
```

如果你要频率也动态变化，才考虑：

```text
EMIOS_PWM_IP_MODE_OPWFMB
```

### K.2 tick 计算

公式：

```text
PWM频率 = eMIOS实际计数时钟 / period_ticks
period_ticks = eMIOS实际计数时钟 / PWM频率
duty_ticks = period_ticks * duty_ratio
```

已计算：

| eMIOS 实际计数时钟 | 200 kHz period_ticks | 50% duty_ticks |
|---|---:|---:|
| 160 MHz | 800 | 400 |
| 80 MHz | 400 | 200 |
| 40 MHz | 200 | 100 |

TEL9471 的 `McuClockReferencePoint_eMIOS=160MHz`，如果 channel prescaler 和 bus prescaler 都是 DIV_1，则 200 kHz 应配：

```text
EmiosChPeriod = 800
EmiosChDutyCycle = 400
PwmPeriodDefault = 800.0
PwmDutycycleDefault = 0x4000 或者按工具百分比填 50%
```

Heating 如果实际 eMIOS common div value=2 后是 80MHz 或 40MHz，需要先确认 EB 生成代码里最终 eMIOS clock，再按上表选 400/200 或 200/100。

### K.3 EB 配置步骤

1. Mcu.xdm
   - 确认 `EMIOS_x` gate = true；
   - 确认 `McuClockReferencePoint_eMIOS` 或对应 clock ref 频率；
   - 确认 MC_ME COFB gate 已启用。

2. Mcl.xdm
   - `MclEnableEmiosCommon=true`；
   - 选择对应 `EmiosCommon` instance；
   - 如果使用 global bus A/F，配置 master bus channel：A 通常 timebase UC23，F 通常 UC22；
   - 如果使用 local bus B/C/D，要确认 timebase channel 是 UC0/UC8/UC16；
   - 配置 master bus period/prescaler 与目标频率一致。

3. Pwm.xdm
   - `PwmChannelId` 分配软件 channel；
   - `PwmHwChannel` 指向 eMIOS channel；
   - `EmiosChId` 选实际输出 UC；
   - `EmiosChMode=EMIOS_PWM_IP_MODE_OPWMB`；
   - `EmiosChCounterBus` 选正确 bus；
   - `EmiosChPrescaler=DIV_1` 优先，除非频率算不过来；
   - `EmiosChPeriod` 和 `EmiosChDutyCycle` 填 tick；
   - `EmiosChPolarity` 按硬件驱动选择 active high/low；
   - `EmiosChTrigger=0`, `EmiosChDeadtime=0`, `PhaseShift=0`。

4. Port.xdm
   - 把对应引脚 mux 成 `eMIOS_x_CH_y_*_OUT`；
   - 检查 pad drive strength、pull、slew rate 是否适合 200 kHz。

5. 应用代码
   - 初始化后如果要默认 50%，确认 `PwmDutycycleDefault` 或初始化代码确实设成 50%；
   - AUTOSAR duty 常用 0x0000=0%，0x4000=50%，0x8000=100%。项目 `CD001A_PwmCfgAndUse.c` 中 `Debug_Lc_Pwm[vid] * 327.0f` 暗示某些业务层可能把 0~100 映射到约 0~32700 的 duty 标度。

配置TRGMUX触发链路
图中X代表可实现功能
![](assets/S32K324%20Real-time%20control%20实时控制学习笔记/file-20260526133522556.png)
counter bus
BUS_A 和 BUS_F 是全局 counter bus，所有通道都能引用。
Bus B：由 CH0 控制，供 CH0 ~ CH7 使用
Bus C：由 CH8 控制，供 CH8 ~ CH15 使用
Bus D：由 CH16 控制，供 CH16 ~ CH23 使用
Bus E：由 CH24 控制，供 CH24 ~ CH31 使用
![](assets/S32K324%20Real-time%20control%20实时控制学习笔记/file-20260526133522557.png)
eMIOS counter 输入时钟 = eMIOS 模块源时钟 / Clock Divider
PWM需要参考一个通道，而PWM本身需要一个eMIOS生成，eMIOS又需要有counter bus通道（选择公共时基或者BCDE），这两者有什么区别和联系吗？

## L. 调试验证清单

1. EB 静态检查
   - `McuPeripheralClockEnable` 是否 true；
   - `MclEnableEmiosCommon` 是否 true；
   - PWM channel type 是否支持所选 mode；
   - counter bus 的 timebase channel 是否已配置；
   - Port mux 是否选 eMIOS output。

2. 生成代码检查
   - `Emios_Pwm_Ip_PBcfg.c` 中 period/duty/mode 是否和 EB 一致；
   - `Emios_Mcl_Ip_PBcfg.c` 中 master bus period/prescaler 是否正确；
   - `Trgmux_Ip_PBcfg.c` 中 trigger input/output 是否正确；
   - `Adc_Sar_Ip_PBcfg.c` / `Bctu_Ip_PBcfg.c` 中 ADC group trigger 是否正确。

3. 运行时检查
   - 用 `Mcu_GetClockFrequency()` 读取 eMIOS/PIT/STM/ADC clock ref；
   - 示波器测 PWM：200 kHz 周期应为 5 us，高电平 2.5 us；
   - 如果 active low，要注意示波器看到的高低电平和 duty 语义相反；
   - 如果用 hardware trigger ADC，用 GPIO 翻转或 ADC notification 计数确认触发频率；
   - TRGMUX lock 之后不能随意改配置，调试时要确认初始化顺序。

4. 常见错误
   - 只配 Pwm.xdm，忘了 Mcl eMIOS master bus；
   - 只配 eMIOS，忘了 Port mux；
   - 选 OPWMCB 但 channel 不是 TypeG；
   - 选 OPWMT 但没有配置 trigger tick 或后级 TRGMUX/BCTU；
   - 以为 ADC group 名叫 RTC 就是 Real Time Clock，实际可能只是业务信号名；
   - Mcu gate 没开，访问外设寄存器可能 HardFault。
