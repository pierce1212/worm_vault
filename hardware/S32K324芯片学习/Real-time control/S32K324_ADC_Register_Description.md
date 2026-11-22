# S32K324 ADC 寄存器说明

本文整理 S32K324 工程中 SAR ADC 外设寄存器。内容参考：

- `C:/Users/nvtc140/Zotero/storage/GKPNECE2/S32K3xx Reference Manual.pdf`，第 60 章 `Analog-to-Digital Converter (ADC)`，Rev. 9，07/2024。
- `BasicSoftware/integration/mcal/src/modules/BaseNXP/header/S32K324_ADC.h`，外设寄存器结构、偏移、位域宏。
- `BasicSoftware/integration/mcal/src/modules/Adc/include/Adc_Sar_Ip_HeaderWrapper_S32K3.h`，S32K324 实例和通道可用性。

> 说明：本文覆盖 `ADC_Type` 中的 SAR ADC 寄存器，不覆盖独立 BCTU、SDADC、TEMPSENSE 等其他模块寄存器。

## 1. ADC 实例和地址

S32K324 有 3 个 ADC 实例：

| 实例 | 基地址 | 说明 |
|---|---:|---|
| `ADC_0` | `0x400A_0000` | 支持 PI、SI、EI 三组输入 |
| `ADC_1` | `0x400A_4000` | 支持 PI、SI、EI 三组输入 |
| `ADC_2` | `0x400A_8000` | RTD 包装头标记为 2 组输入，不支持 EI 外部输入组 |

通道按 3 组组织：

| 组 | 寄存器后缀 | 通道范围 | 数据寄存器 | 数量 |
|---|---|---:|---|---:|
| Precision Inputs | `0` / `PI` | `0..7` | `PCDR0..PCDR7` | 8 |
| Standard Inputs | `1` / `SI` | `32..55` | `ICDR0..ICDR23` | 24 |
| External Inputs | `2` / `EI` | `64..95` | `ECDR0..ECDR31` | 32 |

对 `CEOCFRx`、`CIMRx`、`DMARx`、`PSRx`、`NCMRx`、`JCMRx`、`CWENRx`、`AWORRx` 这类寄存器，bit `n` 通常对应本组第 `n` 个输入。换算关系：

- PI：bit `n` -> 通道 `n`。
- SI：bit `n` -> 通道 `32 + n`。
- EI：bit `n` -> 通道 `64 + n`。

## 2. 使用规则

- ADC 配置建议在空闲状态修改，即 `MSR[ADCSTATUS] = 000b`。`MCR[ABORT]` 和 `MCR[ABORTCHAIN]` 是例外，可用于终止转换。
- 部分字段只能在 Power Down 状态写入，例如 `MCR[ADCLKSEL]`、`MCR[BCTU_MODE]`。默认复位后 `MCR[PWDN] = 1`。
- 标志位很多是 W1C，即写 `1` 清除，写 `0` 无影响。典型寄存器：`ISR`、`CEOCFRx`、`WTISR`。
- 保留位保持复位值，不要写 `1`。
- 对未实现地址、只读寄存器写访问、或某实例不支持的寄存器访问，手册说明可能产生 transfer error。
- `ADC_2` 在 RTD 中无 EI 组，`CTR2/NCMR2/JCMR2/CEOCFR2/CIMR2/DMAR2/PSR2/ECDR/CWSELREI/CWENR2/AWORR2` 这类 EI 相关寄存器不要用于 `ADC_2`。

## 3. 寄存器总览

| 偏移 | 寄存器 | 访问 | 复位值 | 说明 |
|---:|---|---|---|---|
| `0x000` | `MCR` | RW | `0000_0001h` | 主配置 |
| `0x004` | `MSR` | R | `0000_0001h` | 主状态 |
| `0x010` | `ISR` | RW/W1C | `0000_0000h` | 中断状态 |
| `0x014` | `CEOCFR0` | RW/W1C | `0000_0000h` | PI 通道 EOC 标志 |
| `0x018` | `CEOCFR1` | RW/W1C | `0000_0000h` | SI 通道 EOC 标志 |
| `0x01C` | `CEOCFR2` | RW/W1C | `0000_0000h` | EI 通道 EOC 标志 |
| `0x020` | `IMR` | RW | `0000_0000h` | 中断屏蔽/使能 |
| `0x024` | `CIMR0` | RW | `0000_0000h` | PI EOC 中断使能 |
| `0x028` | `CIMR1` | RW | `0000_0000h` | SI EOC 中断使能 |
| `0x02C` | `CIMR2` | RW | `0000_0000h` | EI EOC 中断使能 |
| `0x030` | `WTISR` | RW/W1C | `0000_0000h` | 模拟看门狗阈值中断状态 |
| `0x034` | `WTIMR` | RW | `0000_0000h` | 模拟看门狗阈值中断使能 |
| `0x040` | `DMAE` | RW | `0000_0000h` | DMA 总配置 |
| `0x044` | `DMAR0` | RW | `0000_0000h` | PI DMA 请求使能 |
| `0x048` | `DMAR1` | RW | `0000_0000h` | SI DMA 请求使能 |
| `0x04C` | `DMAR2` | RW | `0000_0000h` | EI DMA 请求使能 |
| `0x060..0x06C` | `THRHLR0..3` | RW | `7FFF_0000h` | 模拟看门狗阈值 |
| `0x080` | `PSCR` | RW | `0000_0000h` | 预采样控制 |
| `0x084` | `PSR0` | RW | `0000_0000h` | PI 预采样使能 |
| `0x088` | `PSR1` | RW | `0000_0000h` | SI 预采样使能 |
| `0x08C` | `PSR2` | RW | `0000_0000h` | EI 预采样使能 |
| `0x094` | `CTR0` | RW | `0000_0016h` | PI 采样时间 |
| `0x098` | `CTR1` | RW | `0000_0016h` | SI 采样时间 |
| `0x09C` | `CTR2` | RW | `0000_0016h` | EI 采样时间 |
| `0x0A4` | `NCMR0` | RW | `0000_0000h` | PI 普通转换通道选择 |
| `0x0A8` | `NCMR1` | RW | `0000_0000h` | SI 普通转换通道选择 |
| `0x0AC` | `NCMR2` | RW | `0000_0000h` | EI 普通转换通道选择 |
| `0x0B4` | `JCMR0` | RW | `0000_0000h` | PI 注入转换通道选择 |
| `0x0B8` | `JCMR1` | RW | `0000_0000h` | SI 注入转换通道选择 |
| `0x0BC` | `JCMR2` | RW | `0000_0000h` | EI 注入转换通道选择 |
| `0x0C4` | `DSDR` | RW | `0000_0000h` | 数据转换启动延时 |
| `0x0C8` | `PDEDR` | RW | `0000_0000h` | 退出 Power Down 延时 |
| `0x100..0x11C` | `PCDR0..7` | R | `0000_0000h` | PI 转换结果 |
| `0x180..0x1DC` | `ICDR0..23` | R | `0000_0000h` | SI 转换结果 |
| `0x200..0x27C` | `ECDR0..31` | R | `0000_0000h` | EI 转换结果 |
| `0x2B0..0x2B4` | `CWSELRPI0..1` | RW/R | `0000_0000h` | PI 看门狗阈值选择 |
| `0x2C0..0x2C8` | `CWSELRSI0..2` | RW | `0000_0000h` | SI 看门狗阈值选择 |
| `0x2D0..0x2DC` | `CWSELREI0..3` | RW | `0000_0000h` | EI 看门狗阈值选择 |
| `0x2E0` | `CWENR0` | RW | `0000_0000h` | PI 看门狗使能 |
| `0x2E4` | `CWENR1` | RW | `0000_0000h` | SI 看门狗使能 |
| `0x2E8` | `CWENR2` | RW | `0000_0000h` | EI 看门狗使能 |
| `0x2F0` | `AWORR0` | RW | `0000_0000h` | PI 看门狗越界结果 |
| `0x2F4` | `AWORR1` | RW | `0000_0000h` | SI 看门狗越界结果 |
| `0x2F8` | `AWORR2` | RW | `0000_0000h` | EI 看门狗越界结果 |
| `0x340` | `STCR1` | RW | `1818_2507h` | 自检配置 1 |
| `0x344` | `STCR2` | RW | `0000_0005h` | 自检配置 2 |
| `0x348` | `STCR3` | RW | `0000_0300h` | 自检配置 3 |
| `0x34C` | `STBRR` | RW | `0005_0000h` | 自检波特率/等待配置 |
| `0x350` | `STSR1` | RW | `0000_0000h` | 自检状态 1 |
| `0x354` | `STSR2` | R | `0000_0000h` | 自检状态 2 |
| `0x358` | `STSR3` | R | `0000_0000h` | 自检状态 3 |
| `0x35C` | `STSR4` | R | `0000_0000h` | 自检状态 4 |
| `0x370` | `STDR1` | R | `0000_0000h` | 自检转换数据 |
| `0x380` | `STAW0R` | RW | `0727_04C5h` | 自检 S0 看门狗 |
| `0x388` | `STAW1R` | RW | `0000_3FF9h` | 自检 S1 看门狗 |
| `0x38C` | `STAW2R` | RW | `0000_3FF9h` | 自检 S2 看门狗 |
| `0x394` | `STAW4R` | RW | `0010_3FF0h` | 自检 C0 看门狗 |
| `0x398` | `STAW5R` | RW | `0010_3FF0h` | 自检 C 看门狗 |
| `0x39C` | `AMSIO` | RW | `0000_0811h` | 模拟杂项输入输出 |
| `0x3A0` | `CALBISTREG` | RW | 见手册本节 | 控制与校准状态 |
| `0x3A8` | `OFSGNUSR` | RW | `0004_0000h` | 用户 offset/gain |
| `0x3B4` | `CAL2` | RW | `4300_8243h` | 校准值 2 |

## 4. 详细说明

### 4.1 `MCR` - Main Configuration

`MCR` 是 ADC 主配置寄存器。多数配置字段应在 Idle 状态修改；`ADCLKSEL`、`BCTU_MODE` 等字段还要求在 Power Down 状态写入。

| 位 | 字段 | 说明 |
|---:|---|---|
| 31 | `OWREN` | 转换数据覆盖使能。`0`：旧数据未读时不覆盖；`1`：新结果可覆盖旧结果，并置位数据寄存器的 `OVERW`。 |
| 30 | `WLSIDE` | 转换结果写入对齐方式。`0`：右对齐；`1`：左对齐。 |
| 29 | `MODE` | 普通转换模式。`0`：单次转换，完成后停止；`1`：连续转换，需写 `NSTART=0` 停止循环。 |
| 28 | Reserved | 保留。 |
| 27 | `TRGEN` | 普通外部触发使能。 |
| 26 | `EDGE` | 普通外部触发边沿。`0`：下降沿；`1`：上升沿。 |
| 25 | `XSTRTEN` | 辅助普通外部启动使能，可用于同步两个 ADC 实例启动。 |
| 24 | `NSTART` | 启动普通转换。单次模式下写 `1` 后硬件自动清零；连续模式下保持为 `1`，写 `0` 表示当前链完成后停止。 |
| 23 | Reserved | 保留。 |
| 22 | `JTRGEN` | 注入触发输入使能。 |
| 21 | `JEDGE` | 注入触发边沿。`0`：下降沿；`1`：上升沿。 |
| 20 | `JSTART` | 启动注入转换，会打断正在进行的普通转换。此字段只能写 `1` 启动。 |
| 19:18 | Reserved | 保留。 |
| 17 | `BCTUEN` | BCTU 触发源使能。 |
| 16 | `BCTU_MODE` | BCTU 模式选择。`0`：仅 BCTU 可触发；`1`：BCTU 使能时其他触发源仍可触发。通常只在 Power Down 状态写。 |
| 15 | `STCL` | 自检配置锁。置 `1` 后 `STCR1/2/3`、`STBRR`、`STAWxR` 等自检配置寄存器变为只读。 |
| 14:12 | Reserved | 保留。 |
| 11 | `AVGEN` | 硬件平均使能。 |
| 10:9 | `AVGS` | 平均次数选择：`00`=4 次，`01`=8 次，`10`=16 次，`11`=32 次。 |
| 8 | Reserved | 保留。 |
| 7 | `ABORTCHAIN` | 中止当前转换链。当前正在采样/转换的通道会先完成；W1C/命令型字段，读值恒为 0。BCTU 转换期间不可写。 |
| 6 | `ABORT` | 中止当前转换。W1C/命令型字段，读值恒为 0。BCTU 转换期间不可写。 |
| 5 | `ACKO` | Auto Clock Off。`0`：模拟部分时钟常开；`1`：Idle 时门控模拟部分时钟以降功耗。 |
| 4:3 | Reserved | 保留。 |
| 2:1 | `ADCLKSEL` | 转换时钟分频：`00`=模块时钟，`01`=1/2，`10`=1/4，`11`=1/8。此字段需在 Power Down 状态配置。 |
| 0 | `PWDN` | Power Down。`0`：ADC 进入功能状态；`1`：关闭模拟部分电源。 |

注意：

- 不要在同一个总线周期同时写 `PWDN=0` 和 `NSTART/JSTART=1`。
- 若通过 `PWDN=1` 进入 Power Down，退出后需重新启动转换流程。

### 4.2 `MSR` - Main Status

`MSR` 为只读状态寄存器，用于判断 ADC 当前状态、转换来源和当前通道。

| 位 | 字段 | 说明 |
|---:|---|---|
| 31 | `CALIBRTD` | 校准状态。`0`：未校准或校准失败；`1`：已校准。 |
| 30:25 | Reserved | 保留。 |
| 24 | `NSTART` | 普通转换正在进行。 |
| 23 | `JABORT` | 注入转换链被中止。新的注入转换启动后清零。 |
| 22:21 | Reserved | 保留。 |
| 20 | `JSTART` | 当前正在进行的是注入转换。 |
| 19 | Reserved | 保留。 |
| 18 | `SELF_TEST_S` | 当前转换是否属于自检。 |
| 17 | Reserved | 保留。 |
| 16 | `BCTUSTART` | 当前转换由 BCTU 触发。 |
| 15:9 | `CHADDR` | 当前正在转换的输入号。 |
| 8:6 | Reserved | 保留。 |
| 5 | `ACKO` | Auto Clock-Off 当前是否生效。 |
| 4:3 | Reserved | 保留。 |
| 2:0 | `ADCSTATUS` | ADC FSM 状态：`000` Idle，`001` Power Down，`010` Wait，`011` Calibrate，`100` Convert，`110` Done。 |

### 4.3 `ISR` - Interrupt Status

`ISR` 包含链结束、单通道结束、注入转换、BCTU 转换相关中断标志。所有有效标志均为 W1C。

| 位 | 字段 | 说明 |
|---:|---|---|
| 31:5 | Reserved | 保留。 |
| 4 | `EOBCTU` | BCTU 转换完成标志。读 `1` 表示已产生，写 `1` 清除。 |
| 3 | `JEOC` | 注入单次转换完成标志。读 `1` 表示已产生，写 `1` 清除。 |
| 2 | `JECH` | 注入转换链完成标志。读 `1` 表示已产生，写 `1` 清除。 |
| 1 | `EOC` | 普通单次转换完成标志。读 `1` 表示已产生，写 `1` 清除。 |
| 0 | `ECH` | 普通转换链完成标志。读 `1` 表示已产生，写 `1` 清除。 |

### 4.4 `CEOCFR0/1/2` - Channel End Of Conversion Flag

这些寄存器记录每个输入通道的转换完成标志。有效字段均为 W1C。

| 寄存器 | 偏移 | 范围 | 有效位 | 字段规则 |
|---|---:|---|---|---|
| `CEOCFR0` | `0x014` | PI0..PI7 | bit `0..7` | `PIEOCF[n]` |
| `CEOCFR1` | `0x018` | SI0..SI23 | bit `0..23` | `SIEOCF[n]` |
| `CEOCFR2` | `0x01C` | EI0..EI31 | bit `0..31` | `EIEOCF[n]` |

读值含义：`0` 表示对应输入转换未完成，`1` 表示已完成。写 `1` 清除对应通道完成标志，写 `0` 无影响。

### 4.5 `IMR` - Interrupt Mask

`IMR` 控制全局转换事件是否能够置位对应中断标志。

| 位 | 字段 | 说明 |
|---:|---|---|
| 31:5 | Reserved | 保留。 |
| 4 | `MSKEOBCTU` | BCTU 转换完成中断屏蔽/使能。 |
| 3 | `MSKJEOC` | 注入单次转换完成中断屏蔽/使能。 |
| 2 | `MSKJECH` | 注入转换链完成中断屏蔽/使能。 |
| 1 | `MSKEOC` | 普通单次转换完成中断屏蔽/使能。 |
| 0 | `MSKECH` | 普通转换链完成中断屏蔽/使能。 |

字段取值：`0` 不标记对应中断，`1` 允许标记对应中断。

### 4.6 `CIMR0/1/2` - Channel EOC Interrupt Enable

这些寄存器控制“单通道转换完成”是否触发 EOC 中断。

| 寄存器 | 偏移 | 范围 | 有效位 | 字段规则 |
|---|---:|---|---|---|
| `CIMR0` | `0x024` | PI0..PI7 | bit `0..7` | `PIEOCIEN[n]` |
| `CIMR1` | `0x028` | SI0..SI23 | bit `0..23` | `SIEOCIEN[n]` |
| `CIMR2` | `0x02C` | EI0..EI31 | bit `0..31` | `EIEOCIEN[n]` |

字段取值：`0` 对应通道完成时不触发 EOC 中断，`1` 对应通道完成时触发 EOC 中断。

### 4.7 `WTISR` - Analog Watchdog Threshold Interrupt Status

`WTISR` 保存模拟看门狗阈值比较结果。低阈值和高阈值分别占一个 bit，字段均为 W1C。

| 位 | 字段 | 说明 |
|---:|---|---|
| `2n-2` | `LAWIF[n]` | 低阈值越界标志，`n=1..16`。读 `1` 表示结果低于低阈值；写 `1` 清除。 |
| `2n-1` | `HAWIF[n]` | 高阈值越界标志，`n=1..16`。读 `1` 表示结果高于高阈值；写 `1` 清除。 |

示例：`LAWIF1` 在 bit0，`HAWIF1` 在 bit1；`LAWIF16` 在 bit30，`HAWIF16` 在 bit31。

### 4.8 `WTIMR` - Analog Watchdog Threshold Interrupt Enable

`WTIMR` 使能模拟看门狗阈值越界中断。S32K324 头文件中定义了前 4 组阈值的中断使能位：

| 位 | 字段 | 说明 |
|---:|---|---|
| 0 | `LAWIFEN1` | Watchdog 1 低阈值中断使能。 |
| 1 | `HDWIFEN1` | Watchdog 1 高阈值中断使能。 |
| 2 | `LAWIFEN2` | Watchdog 2 低阈值中断使能。 |
| 3 | `HDWIFEN2` | Watchdog 2 高阈值中断使能。 |
| 4 | `LAWIFEN3` | Watchdog 3 低阈值中断使能。 |
| 5 | `HDWIFEN3` | Watchdog 3 高阈值中断使能。 |
| 6 | `LAWIFEN4` | Watchdog 4 低阈值中断使能。 |
| 7 | `HDWIFEN4` | Watchdog 4 高阈值中断使能。 |

字段取值：`0` 不触发中断，`1` 触发中断。

### 4.9 `DMAE` - Direct Memory Access Configuration

| 位 | 字段 | 说明 |
|---:|---|---|
| 31:2 | Reserved | 保留。 |
| 1 | `DCLR` | DMA 请求清除方式。`0`：DMA 控制器应答后清除；`1`：读取转换数据寄存器后清除。 |
| 0 | `DMAEN` | DMA 总使能。`0`：关闭；`1`：开启。 |

### 4.10 `DMAR0/1/2` - DMA Request Enable

这些寄存器控制每个通道转换完成后是否产生 DMA 请求。

| 寄存器 | 偏移 | 范围 | 有效位 | 字段规则 |
|---|---:|---|---|---|
| `DMAR0` | `0x044` | PI0..PI7 | bit `0..7` | `PIDMAREN[n]` |
| `DMAR1` | `0x048` | SI0..SI23 | bit `0..23` | `SIDMAREN[n]` |
| `DMAR2` | `0x04C` | EI0..EI31 | bit `0..31` | `EIDMAREN[n]` |

字段取值：`0` 不触发 DMA 请求，`1` 转换完成后触发 DMA 请求。使用前还需设置 `DMAE[DMAEN]=1`。

### 4.11 `THRHLR0..3` - Analog Watchdog Threshold Values

每个 `THRHLR[n]` 保存一组模拟看门狗阈值，可由 `CWSELR*` 选择给不同通道使用。

| 位 | 字段 | 说明 |
|---:|---|---|
| 31 | Reserved | 保留。 |
| 30:16 | `THRH` | 高阈值。转换结果高于该阈值时置高阈值越界标志。 |
| 15 | Reserved | 保留。 |
| 14:0 | `THRL` | 低阈值。转换结果低于该阈值时置低阈值越界标志。 |

复位值 `7FFF_0000h` 表示高阈值为最大值、低阈值为 0。

### 4.12 `PSCR` - Presampling Control

`PSCR` 配置预采样功能。预采样用于在正式采样前将采样网络预充到指定参考电压，改善某些通道切换或源阻抗条件下的采样稳定性。

| 位 | 字段 | 说明 |
|---:|---|---|
| 31:6 | Reserved | 保留。 |
| 5 | `PREVAL2` | EI 组预采样源选择。 |
| 4 | Reserved | 保留。 |
| 3 | `PREVAL1` | SI 组预采样源选择。 |
| 2 | Reserved | 保留。 |
| 1 | `PREVAL0` | PI 组预采样源选择。 |
| 0 | `PRECONV` | 预采样/预转换总控制。 |

本工程 RTD 枚举中可见的源值为 `VREFL` 和 `VREFH`；实际可选值以手册和芯片配置为准。

### 4.13 `PSR0/1/2` - Presampling Enable

这些寄存器按通道使能预采样。

| 寄存器 | 偏移 | 范围 | 有效位 | 字段规则 |
|---|---:|---|---|---|
| `PSR0` | `0x084` | PI0..PI7 | bit `0..7` | `PRES[n]` |
| `PSR1` | `0x088` | SI0..SI23 | bit `0..23` | `PRES[n]` |
| `PSR2` | `0x08C` | EI0..EI31 | bit `0..31` | `PRES[n]` |

字段取值：`0` 关闭该通道预采样，`1` 开启该通道预采样。

### 4.14 `CTR0/1/2` - Conversion Timing

`CTR*` 配置各输入组采样持续时间。转换时钟来自 `MCR[ADCLKSEL]` 分频后的 AD_clk。

| 寄存器 | 偏移 | 范围 | 位 | 字段 | 说明 |
|---|---:|---|---:|---|---|
| `CTR0` | `0x094` | PI | 7:0 | `INPSAMP` | PI 输入采样周期数 |
| `CTR1` | `0x098` | SI | 7:0 | `INPSAMP` | SI 输入采样周期数 |
| `CTR2` | `0x09C` | EI | 7:0 | `INPSAMP` | EI 输入采样周期数 |

手册说明 `INPSAMP` 最小有效值为 8；写入更小值时硬件按最小值处理。工程默认生成值为 `ADC_SAR_IP_DEF_SAMPLE_TIME = 22`。

### 4.15 `NCMR0/1/2` - Normal Conversion Enable

普通转换通道选择寄存器。启动普通转换前配置；转换进行中不要重配。

| 寄存器 | 偏移 | 范围 | 有效位 | 字段规则 |
|---|---:|---|---|---|
| `NCMR0` | `0x0A4` | PI0..PI7 | bit `0..7` | `CH0..CH7` |
| `NCMR1` | `0x0A8` | SI0..SI23 | bit `0..23` | `CH32..CH55` |
| `NCMR2` | `0x0AC` | EI0..EI31 | bit `0..31` | `CH64..CH95` |

字段取值：`0` 不参与普通转换链，`1` 参与普通转换链。

### 4.16 `JCMR0/1/2` - Injected Conversion Enable

注入转换通道选择寄存器。注入转换可由 `MCR[JSTART]` 或注入触发源启动，并可打断普通转换。

| 寄存器 | 偏移 | 范围 | 有效位 | 字段规则 |
|---|---:|---|---|---|
| `JCMR0` | `0x0B4` | PI0..PI7 | bit `0..7` | `CH0..CH7` |
| `JCMR1` | `0x0B8` | SI0..SI23 | bit `0..23` | `CH32..CH55` |
| `JCMR2` | `0x0BC` | EI0..EI31 | bit `0..31` | `CH64..CH95` |

字段取值：`0` 不参与注入转换链，`1` 参与注入转换链。

### 4.17 `DSDR` - Delay Start Of Data Conversion

| 位 | 字段 | 说明 |
|---:|---|---|
| 31:16 | Reserved | 保留。 |
| 15:0 | `DSD` | 从触发/启动到正式开始数据转换之间的延时配置。 |

注意：RTD feature bitmap 标记 `ADC_2` 不支持 `DSDR`，不要在 `ADC_2` 上使用。

### 4.18 `PDEDR` - Power Down Exit Delay

| 位 | 字段 | 说明 |
|---:|---|---|
| 31:8 | Reserved | 保留。 |
| 7:0 | `PDED` | ADC 退出 Power Down 后进入可用状态前的延时配置。 |

### 4.19 `PCDR/ICDR/ECDR` - Conversion Data

数据寄存器为只读寄存器，保存各通道最新转换结果和状态。

| 寄存器 | 偏移范围 | 对应输入 | 数量 |
|---|---:|---|---:|
| `PCDR0..7` | `0x100..0x11C` | PI0..PI7 | 8 |
| `ICDR0..23` | `0x180..0x1DC` | SI0..SI23 | 24 |
| `ECDR0..31` | `0x200..0x27C` | EI0..EI31 | 32 |

位域：

| 位 | 字段 | 说明 |
|---:|---|---|
| 31:20 | Reserved | 保留。 |
| 19 | `VALID` | 数据有效标志。`1` 表示该寄存器有未读的新转换结果；读取数据寄存器通常会影响该状态。 |
| 18 | `OVERW` | 覆盖标志。若 `MCR[OWREN]=1` 且旧结果未读，新结果覆盖旧结果时置位。 |
| 17:16 | `RESULT` | 比较/结果状态位，用于指示阈值比较等附加状态。 |
| 15:0 | `CDATA` | 转换数据。手册中结果有效精度最高 15 bit；右对齐时数据在低位，左对齐时数据左移。 |

建议读取顺序：先判断 `VALID`，再取 `CDATA`；若关心丢样，检查 `OVERW`。

### 4.20 `CWSELRPI/CWSELRSI/CWSELREI` - Channel Analog Watchdog Select

这些寄存器为每个输入选择使用哪组 `THRHLR` 阈值。

阈值选择编码：

| 编码 | 阈值寄存器 |
|---|---|
| `00b` | `THRHLR0` |
| `01b` | `THRHLR1` |
| `10b` | `THRHLR2` |
| `11b` | `THRHLR3` |

寄存器分组：

| 寄存器 | 偏移 | 覆盖输入 | 说明 |
|---|---:|---|---|
| `CWSELRPI0` | `0x2B0` | PI0..PI7 | 每个输入 2 bit，位位置为 `[4n+1:4n]`。 |
| `CWSELRPI1` | `0x2B4` | 保留/只读 | S32K324 只有 8 个 PI 输入，手册列出该地址但为只读。 |
| `CWSELRSI0` | `0x2C0` | SI0..SI7 | 每个输入 2 bit。 |
| `CWSELRSI1` | `0x2C4` | SI8..SI15 | 每个输入 2 bit。 |
| `CWSELRSI2` | `0x2C8` | SI16..SI23 | 每个输入 2 bit。 |
| `CWSELREI0` | `0x2D0` | EI0..EI7 | 每个输入 2 bit。 |
| `CWSELREI1` | `0x2D4` | EI8..EI15 | 每个输入 2 bit。 |
| `CWSELREI2` | `0x2D8` | EI16..EI23 | 每个输入 2 bit。 |
| `CWSELREI3` | `0x2DC` | EI24..EI31 | 每个输入 2 bit。 |

### 4.21 `CWENR0/1/2` - Channel Watchdog Enable

按通道使能模拟看门狗。使能后，转换结果与 `CWSELR*` 选定的 `THRHLR` 阈值比较。

| 寄存器 | 偏移 | 范围 | 有效位 |
|---|---:|---|---|
| `CWENR0` | `0x2E0` | PI0..PI7 | bit `0..7` |
| `CWENR1` | `0x2E4` | SI0..SI23 | bit `0..23` |
| `CWENR2` | `0x2E8` | EI0..EI31 | bit `0..31` |

字段取值：`0` 关闭该通道看门狗比较，`1` 开启该通道看门狗比较。

### 4.22 `AWORR0/1/2` - Analog Watchdog Out Of Range

按通道保存模拟看门狗越界状态。

| 寄存器 | 偏移 | 范围 | 有效位 |
|---|---:|---|---|
| `AWORR0` | `0x2F0` | PI0..PI7 | bit `0..7` |
| `AWORR1` | `0x2F4` | SI0..SI23 | bit `0..23` |
| `AWORR2` | `0x2F8` | EI0..EI31 | bit `0..31` |

读 `1` 表示对应通道最近比较结果越界。实际越界方向可结合 `WTISR` 的 `LAWIF/HAWIF` 判断。

### 4.23 `STCR1` - Self-Test Configuration 1

| 位 | 字段 | 说明 |
|---:|---|---|
| 31:24 | `INPSAMP_C` | 自检算法 C 的采样周期配置。 |
| 23:16 | Reserved | 保留。 |
| 15:8 | `INPSAMP_S` | 自检算法 S 的采样周期配置。 |
| 7:0 | Reserved | 保留。 |

若 `MCR[STCL]=1`，该寄存器被锁定为只读。

### 4.24 `STCR2` - Self-Test Configuration 2

`STCR2` 控制自检使能、错误屏蔽和故障注入。

| 位 | 字段 | 说明 |
|---:|---|---|
| 27 | `MSKWDSERR` | 屏蔽/允许 WDSERR 相关自检错误上报。 |
| 26 | `SERR` | 自检错误状态/控制位。 |
| 25 | `MSKWDTERR` | 屏蔽/允许 WDTERR 相关错误上报。 |
| 24 | Reserved | 保留。 |
| 23 | `MSKST_EOC` | 屏蔽/允许自检 EOC 事件。 |
| 22:19 | Reserved | 保留。 |
| 18 | `MSKWDG_EOA_C` | 屏蔽/允许算法 C 的 watchdog end-of-algorithm 事件。 |
| 17 | Reserved | 保留。 |
| 16 | `MSKWDG_EOA_S` | 屏蔽/允许算法 S 的 watchdog end-of-algorithm 事件。 |
| 15 | `MSKERR_C` | 屏蔽/允许算法 C 错误。 |
| 14 | Reserved | 保留。 |
| 13 | `MSKERR_S2` | 屏蔽/允许算法 S step2 错误。 |
| 12 | `MSKERR_S1` | 屏蔽/允许算法 S step1 错误。 |
| 11 | `MSKERR_S0` | 屏蔽/允许算法 S step0 错误。 |
| 10:8 | Reserved | 保留。 |
| 7 | `EN` | 自检功能使能。 |
| 6:5 | Reserved | 保留。 |
| 4 | `FMA_WDSERR` | 故障注入：WDSERR。 |
| 3 | `FMA_WDTERR` | 故障注入：WDTERR。 |
| 2 | `FMA_C` | 故障注入：算法 C。 |
| 1 | Reserved | 保留。 |
| 0 | `FMA_S` | 故障注入：算法 S。 |

### 4.25 `STCR3` - Self-Test Configuration 3

| 位 | 字段 | 说明 |
|---:|---|---|
| 31:10 | Reserved | 保留。 |
| 9:8 | `ALG` | 自检算法选择。 |
| 7:5 | Reserved | 保留。 |
| 4:0 | `MSTEP` | 自检步骤选择/控制。 |

### 4.26 `STBRR` - Self-Test Baud Rate

| 位 | 字段 | 说明 |
|---:|---|---|
| 31:19 | Reserved | 保留。 |
| 18:16 | `WDT` | 自检 watchdog/等待相关定时配置。 |
| 15:8 | Reserved | 保留。 |
| 7:0 | `BR` | 自检波特率/节拍分频配置。 |

### 4.27 `STSR1` - Self-Test Status 1

| 位 | 字段 | 说明 |
|---:|---|---|
| 31:28 | Reserved | 保留。 |
| 27 | `WDSERR` | 自检 WDS 错误状态。 |
| 26 | Reserved | 保留。 |
| 25 | `WDTERR` | 自检 watchdog timeout 错误状态。 |
| 24 | `OVERWR` | 自检结果覆盖状态。 |
| 23 | `ST_EOC` | 自检转换完成状态。 |
| 22:19 | Reserved | 保留。 |
| 18 | `WDG_EOA_C` | 算法 C watchdog end-of-algorithm 状态。 |
| 17 | Reserved | 保留。 |
| 16 | `WDG_EOA_S` | 算法 S watchdog end-of-algorithm 状态。 |
| 15 | `ERR_C` | 算法 C 错误。 |
| 14 | Reserved | 保留。 |
| 13 | `ERR_S2` | 算法 S step2 错误。 |
| 12 | `ERR_S1` | 算法 S step1 错误。 |
| 11 | `ERR_S0` | 算法 S step0 错误。 |
| 10 | Reserved | 保留。 |
| 9:5 | `STEP_C` | 算法 C 当前/错误步骤信息。 |
| 4:0 | Reserved | 保留。 |

### 4.28 `STSR2/STSR3/STSR4` - Self-Test Status Data

这些寄存器保存自检错误发生时的转换数据。

| 寄存器 | 位 | 字段 | 说明 |
|---|---:|---|---|
| `STSR2` | 14:0 | `DATA0` | 算法 S step1 等错误场景的数据 0。 |
| `STSR3` | 14:0 | `DATA0` | 算法 S step2 或 step0 的数据 0。 |
| `STSR3` | 30:16 | `DATA1` | 算法 S step2 或 step0 的数据 1。 |
| `STSR4` | 30:16 | `DATA1` | 自检相关数据 1。 |

其余位保留。

### 4.29 `STDR1` - Self-Test Conversion Data 1

| 位 | 字段 | 说明 |
|---:|---|---|
| 31:20 | Reserved | 保留。 |
| 19 | `VALID` | 自检转换数据有效。 |
| 18 | `OWERWR` | 自检转换数据被覆盖。 |
| 17:15 | Reserved | 保留。 |
| 14:0 | `TCDATA` | 自检转换数据。 |

### 4.30 `STAW0R/STAW1R/STAW2R/STAW4R/STAW5R` - Self-Test Analog Watchdog

这些寄存器配置自检流程使用的阈值和使能。

| 寄存器 | 位 | 字段 | 说明 |
|---|---:|---|---|
| `STAW0R` | 31 | `AWDE` | 自检 S0 analog watchdog 使能。 |
| `STAW0R` | 30 | `WDTE` | 自检 S0 watchdog timeout 使能。 |
| `STAW0R` | 29:16 | `THRH` | S0 高阈值。 |
| `STAW0R` | 14:0 | `THRL` | S0 低阈值。 |
| `STAW1R` | 31 | `AWDE` | S1 analog watchdog 使能。 |
| `STAW1R` | 14:0 | `THRL` | S1 低阈值。 |
| `STAW2R` | 31 | `AWDE` | S2 analog watchdog 使能。 |
| `STAW2R` | 14:0 | `THRL` | S2 低阈值。 |
| `STAW4R` | 31 | `AWDE` | C0 analog watchdog 使能。 |
| `STAW4R` | 30 | `WDTE` | C0 watchdog timeout 使能。 |
| `STAW4R` | 29:16 | `THRH` | C0 高阈值。 |
| `STAW4R` | 14:0 | `THRL` | C0 低阈值。 |
| `STAW5R` | 30:16 | `THRH` | C 高阈值。 |
| `STAW5R` | 14:0 | `THRL` | C 低阈值。 |

其余位保留。若 `MCR[STCL]=1`，这些寄存器锁定。

### 4.31 `AMSIO` - Analog Miscellaneous In/Out

| 位 | 字段 | 说明 |
|---:|---|---|
| 31:19 | Reserved | 保留。 |
| 18:17 | `HSEN` | 高速模式/高性能模拟路径相关控制。RTD 的 `Adc_Sar_EnableHighSpeed()` 会设置该字段。 |
| 16 | `CMPCTRL0` | 比较器/模拟控制相关位。RTD 高速使能时也会设置。 |
| 15:0 | Reserved | 保留。 |

### 4.32 `CALBISTREG` - Control And Calibration Status

`CALBISTREG` 用于校准和 BIST/测试流程控制。工程 RTD 会在 ADC 初始化/校准流程中使用该寄存器。

| 位 | 字段 | 说明 |
|---:|---|---|
| 31:29 | `RESN` | 校准/测试分辨率选择。 |
| 28:27 | `TSAMP` | 校准/测试采样时间选择。 |
| 26:16 | Reserved | 保留。 |
| 15 | `C_T_BUSY` | 校准/测试忙状态。 |
| 14 | `CALSTFUL` | 校准状态/完成相关标志。 |
| 13:7 | Reserved | 保留。 |
| 6:5 | `NR_SMPL` | 平均/采样次数选择。 |
| 4 | `AVG_EN` | 校准/测试平均使能。 |
| 3 | `TEST_FAIL` | 测试失败标志。 |
| 2:1 | Reserved | 保留。 |
| 0 | `TEST_EN` | 测试/校准流程使能。 |

使用注意：

- 写入前确认 ADC 不在普通转换或注入转换中。
- `C_T_BUSY=1` 时不要修改相关校准字段。

### 4.33 `OFSGNUSR` - Offset And Gain User

用户校准修正寄存器。

| 位 | 字段 | 说明 |
|---:|---|---|
| 31:26 | Reserved | 保留。 |
| 25:16 | `GAIN_USER` | 用户增益修正值。复位值中该字段为 `0x004`。 |
| 15:8 | Reserved | 保留。 |
| 7:0 | `OFFSET_USER` | 用户 offset 修正值。 |

### 4.34 `CAL2` - Calibration Value 2

| 位 | 字段 | 说明 |
|---:|---|---|
| 31:16 | Reserved/校准值 | 由硬件/校准流程使用，按手册保持推荐值。 |
| 15 | `ENX` | 校准扩展/补偿相关使能位。 |
| 14:0 | Reserved/校准值 | 由硬件/校准流程使用，按手册保持推荐值。 |

`CAL2` 复位值为 `4300_8243h`。除非执行明确的校准流程或 NXP RTD 已封装，应用层不建议直接改写。

## 5. 常见配置流程参考

一个典型的软件触发普通转换流程：

1. 确认 ADC 处于 Power Down 或 Idle。
2. 配置 `MCR[ADCLKSEL]`、`CTR0/1/2`、`PDEDR`、必要的 `PSCR/PSR*`。
3. 配置通道选择 `NCMR0/1/2`。
4. 如需中断，配置 `IMR`、`CIMR0/1/2`，并清理 `ISR/CEOCFR*` 旧标志。
5. 如需 DMA，配置 `DMAE`、`DMAR0/1/2`。
6. 如需模拟看门狗，配置 `THRHLR*`、`CWSELR*`、`CWENR*`、`WTIMR`。
7. 清 `MCR[PWDN]` 退出 Power Down，等待 `MSR[ADCSTATUS]` 进入可用状态。
8. 写 `MCR[NSTART]=1` 启动普通转换。
9. 轮询/中断读取 `ISR`、`CEOCFR*` 或数据寄存器 `PCDR/ICDR/ECDR`。

注入转换流程类似，但通道选择使用 `JCMR0/1/2`，启动位使用 `MCR[JSTART]` 或注入外部触发相关字段。
