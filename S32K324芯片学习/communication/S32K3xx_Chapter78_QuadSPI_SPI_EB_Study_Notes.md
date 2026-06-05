---
date: 2026-06-04
related_task: S32K324 QuadSPI / SPI / EB tresos 配置学习
progress: 5%
timeline: "true"
---

# Chapter 78 Quad Serial Peripheral Interface (QuadSPI) 学习笔记

> 适用背景：S32K324 / S32K3xx，面向外部串行 Flash、XIP、QSPI 存储扩展、普通 SPI 外设通信、AUTOSAR MCAL Spi 配置和 EB tresos 配置理解。  
> 参考资料：用户提供的 `S32K3xx Reference Manual.pdf` Chapter 78，本工程 `Spi.xdm`、`Spi_PBcfg.c`、`Spi_Ipw_PBcfg.c`、`Lpspi_Ip_PBcfg.c`、`S32K324_QUADSPI.h`、`system.c`、CDD 调用代码，以及 NXP Data Sheet、NXP Community、NXP S32K1 to S32K3 Migration Guidelines。  
> 先说一句最重要的话：**==本章的 QuadSPI 和 EB 里的 AUTOSAR `Spi` 不是同一个外设模块。QuadSPI 主要服务外部串行 Flash；EB 的 `Spi` 当前工程实际走的是 LPSPI，用于 BE13、Level/Psi5、CAN Transceiver 等普通 SPI 设备。==**

---

## 1. 先把 SPI 讲明白

学习 QuadSPI 之前，一定要先把普通 SPI 搞清楚。QuadSPI 不是凭空冒出来的新协议，它是在 SPI 思想上，为了更快访问串行 Flash 而扩展出来的。

SPI 全称是 **Serial Peripheral Interface**，串行外设接口。它最典型的形态是：

```text
MCU 作为 Master
外部芯片作为 Slave
MCU 输出时钟
MCU 控制片选
双方在时钟边沿同步交换数据
```

SPI 常见有四根信号线：

| 信号 | 常见名字 | 方向 | 含义 |
|---|---|---|---|
| `SCLK` / `SCK` | Serial Clock | Master -> Slave | 串行时钟，由主机产生 |
| `MOSI` / `SDO` | Master Out Slave In | Master -> Slave | 主机发给从机的数据 |
| `MISO` / `SDI` | Master In Slave Out | Slave -> Master | 从机返回给主机的数据 |
| `CS` / `SS` / `PCS` | Chip Select | Master -> Slave | 片选，告诉某个从机“现在轮到你” |

可以这样理解：

```text
SCLK 是节拍器
MOSI 是主机说话
MISO 是从机回答
CS 是点名
```

SPI 不是像 UART 那样双方各自靠波特率默契通信，SPI 是主机拿着时钟线带节奏。只要 `SCLK` 不跳，数据一般就不移动。

---

## 2. SPI 一次传输到底发生了什么

一次最普通的 SPI 传输可以拆成 5 步：

```text
1. Master 拉低某个 CS
2. Master 输出 SCLK
3. Master 在 MOSI 上移出数据
4. Slave 在 MISO 上移出数据
5. Master 释放 CS
```

注意一个容易被忽略的点：**SPI 常常是全双工的。**

也就是说，你发 1 个 bit 的同时，也会收 1 个 bit。哪怕你只是想读从机，主机也通常要发送 dummy data 来产生时钟；哪怕你只是想写从机，接收 FIFO 里也可能会收到一些无意义数据。

例子：

```text
主机要读寄存器 0x10:

Frame 1: 主机发 read command + address，从机可能回 dummy
Frame 2: 主机发 dummy，用这个 dummy 产生时钟，从机回真正数据
```

这就是很多 SPI 驱动 API 都要求同时传入 Tx buffer 和 Rx buffer 的原因。

---

## 3. SPI 的 4 种模式

SPI 最容易让新手迷糊的是 `CPOL` 和 `CPHA`。

| 参数 | 全称 | 通俗解释 |
|---|---|---|
| `CPOL` | Clock Polarity | SCLK 空闲时是低电平还是高电平 |
| `CPHA` | Clock Phase | 在第几个边沿采样数据 |

`CPOL` 决定时钟没动时躺在哪里：

```text
CPOL = 0: SCLK 空闲为 LOW
CPOL = 1: SCLK 空闲为 HIGH
```

`CPHA` 决定数据在哪个边沿被采样：

```text
CPHA = 0: 第一个有效边沿采样
CPHA = 1: 第二个有效边沿采样
```

组合后就是常说的 SPI Mode 0/1/2/3：

| SPI Mode | CPOL | CPHA | 常见理解 |
|---|---:|---:|---|
| Mode 0 | 0 | 0 | 时钟空闲低，第一个边沿采样 |
| Mode 1 | 0 | 1 | 时钟空闲低，第二个边沿采样 |
| Mode 2 | 1 | 0 | 时钟空闲高，第一个边沿采样 |
| Mode 3 | 1 | 1 | 时钟空闲高，第二个边沿采样 |

**重点：配置 SPI 时，必须先看外部芯片 datasheet 的 SPI timing。**

不能凭感觉选 Mode 0。很多芯片确实用 Mode 0，但不是全部。错一个 CPHA，逻辑分析仪上可能还能看到波形，却读出来全是错位数据。

---

## 4. SPI 的数据单位、位序和片选

### 4.1 数据宽度

SPI 的数据单位不一定是 8 bit，也可以是 16 bit、32 bit，甚至某些控制器支持更多灵活长度。

本工程当前 EB 配置：

| Channel | `SpiDataWidth` |
|---|---:|
| `SpiChannel_BE13` | 32 |
| `SpiChannel_Level` | 16 |
| `SpiChannel_CAN` | 16 |

这意味着驱动认为一个“数据元素”分别是 32 bit 或 16 bit。

**易错点：`Spi_SetupEB(..., Length)` 里的 Length 是数据元素个数，不是永远表示 byte 个数。**

在本工程里，`BE13` 调用：

```c
Spi_SetupEB(SpiConf_SpiChannel_SpiChannel_BE13,
            (Spi_DataBufferType*)L2_S_BE13TxBuff_Uls_G_au32_CMT,
            (Spi_DataBufferType*)L2_S_BE13RxBuff_Uls_G_au32_CMT,
            L2_S_BE13SpiTransNum_Cnt_u16_CMP << 2);
```

这里配置的帧宽是 32 bit，但长度又左移 2。这个地方复查时要特别小心：上层到底想表达“4 倍 frame 数”，还是把 byte 数误当成 element 数，要结合 `Spi_DataBufferType`、MCAL 实现和 BE13 协议一起确认。

### 4.2 MSB first / LSB first

`MSB` 表示最高位先发，`LSB` 表示最低位先发。

大多数外设协议默认是 MSB first，本工程三个 channel 都是：

```text
SpiTransferStart = MSB
```

如果这个配置错了，现象通常不是“完全没波形”，而是“波形有，值不对”。逻辑分析仪如果 decoder 的 bit order 也设错，会进一步误导你。

### 4.3 Chip Select 行为

SPI 的 `CS` 不只是“选中芯片”，它还常常代表一笔命令的边界。

有些外设要求：

```text
CS 拉低
发 command
发 address
收/发 data
CS 拉高
```

如果中间 CS 抖了一下，从机可能认为一笔命令结束了。

所以 EB 里的 `SpiCsBehavior` 很重要：

| 配置 | 含义 |
|---|---|
| `CS_TOGGLE` | 每个 frame 或 channel 间可能释放/重新拉低 CS |
| `CS_KEEP_ASSERTED` | 在 job 期间保持 CS 有效 |

本工程当前：

| ExternalDevice | `SpiCsBehavior` |
|---|---|
| `Spi0_BE13` | `CS_TOGGLE` |
| `Spi1_Level` | `CS_KEEP_ASSERTED` |
| `Spi3_CAN` | `CS_KEEP_ASSERTED` |

**重点：如果一个外设命令由多个 frame 组成，通常需要保持 CS，不然外设会把它拆成多笔命令。**

---

## 5. 普通 SPI、Dual SPI、QuadSPI 的关系

普通 SPI 常见是：

```text
1 根 MOSI + 1 根 MISO
```

QuadSPI 面向串行 Flash 时，把数据线扩展成最多 4 根双向线：

```text
IO0
IO1
IO2
IO3
```

不同阶段可以用不同线宽：

| 模式 | 数据线数量 | 典型用途 |
|---|---:|---|
| Single | 1 | 发送传统 command，例如 `0x03`、`0x0B` |
| Dual | 2 | 更快读数据 |
| Quad | 4 | 高速读写串行 Flash |

一个 QuadSPI 读 Flash 的命令常常长这样：

```text
CS active
Instruction phase: 发命令码，比如 0xEB
Address phase: 发 24-bit 或 32-bit 地址
Mode phase: 某些 Flash 需要 mode bits
Dummy phase: 空等若干 cycle，让 Flash 准备数据
Data phase: 用 1/2/4 根线收数据
CS inactive
```

这和普通 SPI 最大区别是：**QuadSPI 不是只在乎一串固定长度 frame，而是在乎一整条 Flash command sequence。**

---

## 6. 一句话抓住 Chapter 78 QuadSPI

Chapter 78 的 QuadSPI 可以这样理解：

```text
QuadSPI 是一个专门服务外部串行 Flash 的可编程 SPI 序列执行器。
它一边连着 MCU 的 AHB/IP 总线，一边连着外部 Flash 的 SCK/CS/IO[3:0]。
软件通过 LUT 告诉它：读、写、擦、读状态寄存器这些 Flash 命令该怎么发。
```

更口语一点：

```text
普通 LPSPI 像“逐帧收发工具”。
QuadSPI 像“会照着脚本访问 Flash 的小控制器”。
```

这个“脚本”就是 LUT，也就是 Look-Up Table。

---

## 7. S32K324 上 QuadSPI 支持什么、不支持什么

参考手册 Chapter 78 是给这些器件的：

```text
S32K322
S32K342
S32K341
S32K314
S32K324
S32K344
```

对 S32K324，重要能力如下：

| 项目 | S32K324 情况 | 开发含义 |
|---|---|---|
| QuadSPI instance | 1 个 | 工程只有一个 QuadSPI 控制器 |
| Tx FIFO | 32 words | 写 Flash 时要避免 TX underrun |
| Rx FIFO | 4 words | IP read 时要及时读出 |
| LUT size | 256 bytes，头文件体现为 20 个 32-bit LUT 寄存器 | 可放 4 条 sequence，每条最多 10 个 instruction-operand pair |
| Boot from QuadSPI | 不支持 | 不能直接从外部 QSPI Flash 启动 |
| Execute from external memory | 支持 | 初始化后可以 XIP/从外部 memory 执行 |
| AHB write | 不支持 | AHB memory mapped 区域主要用于读，不要直接写 AHB buffer |
| Data learning | 不支持 | 不要按 K358 那类功能设计 |
| DLL | 不支持 | 不做 DLL tuning |
| OTFAD | 不支持 | 没有片上 on-the-fly AES 解密 |
| DDR | 不支持 | SDR 模式 |
| HyperRAM/HyperFlash | 不支持 | 不要把它当 HyperBus 控制器用 |
| External DQS | 不支持 | 使用内部 dummy pad loopback 相关采样方式 |

NXP `S32K3xx Data Sheet` Rev.14（2026-04-10）里也给出 QuadSPI 配置表：S32K344/S32K324/S32K314 这一组 QuadSPI 频率为 120 MHz，SDR，DQS alignment 为 internal DQS dummy pad loopback。

NXP Community 里有一个关于 QSPI 最大数据率的回答也很有价值：实际数据率要从 SCK 频率和线宽去理解。Quad 模式 4 根数据线，理论数据吞吐按 4bit/clock 估算；但真实可用速率还要看 datasheet 最大频率和 PCB 设计约束。

---

## 8. QuadSPI 外部信号

Chapter 78 给出的主要外部信号：

| 信号 | 方向 | 含义 |
|---|---|---|
| `PCSFA1` | Output | Flash A1 的片选 |
| `PCSFA2` | Output | Flash A2 的片选，但 S32K3xx 不支持 dual die flash，PCSFA2 不使用 |
| `SCKFA` | Output | Flash A 的串行时钟 |
| `IOFA[3:0]` | Input/Output | Flash A 的 4 根数据线 |

普通 single SPI 时：

```text
IOFA[0] 类似 MOSI
IOFA[1] 类似 MISO
IOFA[3:2] 可被驱动到固定电平，满足 Flash WP#/HOLD# 等脚的要求
```

Quad 模式时：

```text
IOFA[3:0] 一起传输数据
```

**易错点：IOFA[3:2] 在 single/dual 模式下并不是“随便悬空”。很多 Flash 会把它们当 WP#、HOLD# 或 RESET# 相关功能脚，必须按外部 Flash datasheet 配好 inactive level。**

---

## 9. QuadSPI 内部结构

从开发角度看，QuadSPI 主要由这些部分组成：

| 模块 | 通俗解释 |
|---|---|
| IP register interface | CPU 直接写寄存器，发 IP command |
| AHB interface | CPU 像读内存一样读外部 Flash |
| LUT | 告诉 QuadSPI 一条 Flash 命令怎么执行 |
| Programmable sequence engine | 按 LUT 执行命令脚本 |
| TX buffer | 写 Flash 时，暂存要发出去的数据 |
| RX buffer | IP read 时，暂存从 Flash 读回来的数据 |
| AHB buffer | memory-mapped read 时缓存读回数据 |
| DMA/interrupt control | RX/TX buffer 达到水位或完成时触发 DMA/中断 |

一条访问链大概是：

```text
CPU/DMA/AHB master
    -> QuadSPI register 或 AHB mapped address
    -> QuadSPI 查 LUT
    -> sequence engine 控制 SCK/CS/IO
    -> 外部串行 Flash
```

---

## 10. IP command 和 AHB read 两条路径

QuadSPI 有两种非常重要的访问路径。

### 10.1 IP command

IP command 是 CPU 通过 QuadSPI 寄存器显式发命令：

```text
写 SFAR  = 目标 Flash 地址
写 TBDR  = 要写的数据，若是 program 类命令
写 IPCR  = 数据长度 + SEQID
等待 FR/SR 状态
从 RBDR 读回数据，若是 read 类命令
```

适合：

| 场景 | 为什么 |
|---|---|
| 写使能 Write Enable | Flash 命令，不是普通内存读 |
| Page Program | 要把数据送进 TX buffer |
| Sector Erase | 要发 erase command |
| Read Status Register | 读 Flash 状态位 |
| 配置 QE bit | 进入 Quad mode 前必须配置某些 Flash |

### 10.2 AHB memory-mapped read

AHB read 是 CPU 像读一段内存一样读外部 Flash：

```c
value = *(volatile uint32_t *)(0x68000000u + offset);
```

QuadSPI 在背后自动：

```text
看到 AHB 读地址
    -> 判断映射到哪个 Flash 区间
    -> 使用 BFGENCR 指定的 LUT sequence
    -> 去外部 Flash 取数据
    -> 把数据返回给 AHB master
```

适合：

| 场景 | 为什么 |
|---|---|
| XIP | CPU 按地址取指 |
| 读外部 Flash 常量表 | 像读内存 |
| 大块只读资源 | AHB + cache 性能更好 |

**重点：S32K324 的 QuadSPI AHB 逻辑是为读外部 Flash 设计的，不支持 AHB write。写 Flash 要走 IP command + TX buffer。**

---

## 11. LUT：QuadSPI 最核心的概念

LUT 是 Look-Up Table。不要把它理解成普通数组，它是 QuadSPI 的“命令脚本表”。

每条 LUT 指令包含：

```text
INSTR  = 做什么动作
PAD    = 用几根线
OPRND  = 参数，比如命令码、地址位数、dummy cycle 数、读写字节数
```

常见 instruction：

| Instruction | 含义 |
|---|---|
| `CMD` | 发命令码 |
| `ADDR` | 发地址 |
| `MODE` | 发 mode bits |
| `DUMMY` | 空跑若干 clock |
| `READ` | 从 Flash 读数据 |
| `WRITE` | 向 Flash 写数据 |
| `STOP` | sequence 结束 |
| `JMP_ON_CS` | CS 保持时跳回 sequence 开头，常用于连续 AHB read |

Chapter 78 对 S32K324 这组器件的 LUT 限制：

```text
LUT registers: 20 个
每 5 个 LUT register 组成 1 条有效 sequence
有效起点: LUT[0], LUT[5], LUT[10], LUT[15]
最多 4 条 sequence
每条 sequence 最多 10 个 instruction-operand pair
```

本工程头文件也能印证：

```c
#define QuadSPI_LUT_COUNT (20u)
```

### 11.1 一个 fast read LUT 怎么读

手册给了常见 serial Flash 的示例，例如 fast read：

```text
CMD    0x0B   single pad
ADDR   24 bit single pad
DUMMY  8 cycles
READ   4 bytes single pad
JMP_ON_CS 或 STOP
```

如果是 Quad output read，数据阶段可能变成：

```text
READ   quad pad
```

如果是 4 x I/O read，地址阶段也可能使用 quad pad。

**重点：QuadSPI 的速度不是只靠 SCK 高，还靠 command/address/data 阶段到底用了几根 IO 线。**

---

## 12. RX buffer、TX buffer 和 AHB buffer

### 12.1 RX buffer

RX buffer 用于 IP read。Flash 数据读回来后，先放到 RX buffer，再由 CPU 或 DMA 读出。

相关寄存器：

| 寄存器 | 含义 |
|---|---|
| `RBSR[RDBFL]` | RX buffer 当前有多少有效 entry |
| `RBCT[WMRK]` | RX buffer 水位 |
| `RBDR[n]` | RX buffer data register |
| `FR[RBDF]` | RX buffer drain flag |

手册提到 RX buffer push/pop：

```text
push: QuadSPI 从 Flash 收到数据，放入 RX buffer
pop : CPU/DMA 从 RX buffer 取走数据
```

### 12.2 TX buffer

TX buffer 用于 program/write 类命令。CPU 或 DMA 先写 `TBDR`，QuadSPI 再把数据按 LUT 脚本送给外部 Flash。

相关寄存器：

| 寄存器 | 含义 |
|---|---|
| `TBSR[TRBFL]` | TX buffer 填充水平 |
| `TBCT[WMRK]` | TX buffer 水位 |
| `TBDR` | TX buffer data register |
| `FR[TBFF]` | TX buffer fill flag |
| `FR[TBUF]` | TX buffer underrun flag |

**难点：TX underrun。**

如果外部 Flash 侧消耗数据太快，而 IP/DMA 往 TX buffer 填数据太慢，就会 underrun。手册专门用 DMA bandwidth 例子说明这一点。开发时不能只看“SPI 时钟能跑多快”，还要看总线、DMA minor loop、水位、Flash program command 的数据消耗速度。

### 12.3 AHB buffer

AHB buffer 服务 memory-mapped read。CPU 读外部 Flash 映射地址时，QuadSPI 把外部 Flash 数据取回来放在 AHB buffer，再返回给 AHB master。

手册还提醒：当 core 访问 QuadSPI memory 且 cache enabled 时，prefetch size 要与 cache line size 对齐配置，否则性能或行为可能不理想。

---

## 13. 地址映射

QuadSPI 通过这些寄存器定义外部 Flash 映射区间：

| 寄存器 | 含义 |
|---|---|
| `SFA1AD` | Flash A1 top address |
| `SFA2AD` | Flash A2 top address |
| `SFB1AD` | Flash B1 top address |
| `SFB2AD` | Flash B2 top address |

虽然寄存器名还带 B，但对 S32K3 当前这组器件，重点看 Flash A。手册说 S32K3xx SoCs 不支持 dual die flashes，`PCSFA2` 不使用。

工程头文件给出的关键地址：

```c
#define IP_QUADSPI_BASE      (0x404CC000u)
#define IP_QUADSPI_ARDB_BASE (0x68000000u)
```

当前工程 `system.c` MPU 表里也预留了 QSPI 相关区域：

```text
QSPI Rx   0x67000000 - 0x670003FF   Strongly ordered
QSPI AHB  0x68000000 - 0x6FFFFFFF   Normal, Write-Back/Allocate, executable
```

这里要注意一个工程实践点：**外部 Flash 不是只配 QuadSPI 寄存器就完事，还要同时看 MPU、XRDC、cache、clock、port pin 和 linker。**

---

## 14. Byte ordering：别被 32-bit/64-bit 读法绕晕

手册专门讲了 endianness。S32K3 是 little-endian，QuadSPI TX/RX buffer 和 AHB buffer 读出来时，寄存器里看到的 32-bit 值可能和你脑子里“线上的字节顺序”不完全一样。

例子：

```text
写 TBDR = 0x04030201
实际发到 Flash 的字节顺序是:
01 02 03 04
```

读回来也类似：

```text
RBDR0 看到 0x04030201
表示 Flash byte stream 是 01 02 03 04
```

**易错点：不要只盯寄存器 32-bit 十六进制显示，要换成 byte stream 去和 Flash datasheet、烧录文件、逻辑分析仪对齐。**

---

## 15. QuadSPI 初始化顺序

参考手册给了 chip-specific 初始化顺序，开发时可以记成这条线：

```text
1. 通过 MC_ME 打开 QuadSPI 外设时钟
2. 配置 SIUL2，让 QuadSPI_SCKFA pin 输出使能
3. 对 SCKFA pin 的 GPDO 写 1010 序列
4. 再把相关 pin 的 OBE 配回 0
5. 发起一次 dummy flash read，让 DQS 相关触发器复位/稳定
6. 通过 MCR 发起 QuadSPI controller 软件复位
7. 再进入正常 QuadSPI 配置和使用
```

手册明确提醒：**每次 functional reset 后，使用 QuadSPI 前都要做这个初始化。**

这段很像“上电后先把采样路径和时钟路径叫醒并摆正”。如果跳过，可能出现偶发、温度相关或复位后第一次访问异常。

---

## 16. Pad clock loopback 和 SOCCR

S32K324 支持 pad clock loopback。意思是：QuadSPI 可以把输出到 SCK pin 的时钟经过 pad 路径再绕回来，用这个回来的时钟采样输入数据。

为什么要这样？

因为外部 Flash 的数据相对于板上 SCK 有延迟。如果 MCU 只用内部理想时钟采样，频率高时 setup/hold margin 可能不够。用 pad loopback 可以把输出 pad 延迟、输入 pad 延迟考虑进去，改善采样时序。

相关配置：

| 配置 | 含义 |
|---|---|
| `MCR[DQS_FA_SEL]` | 选择 Flash A 采样时钟来源 |
| `SOCCR[SOCCFG]` | 控制 dummy loopback pad |
| `SMPR` | 采样相关配置 |

手册给出 dummy PAD loopback 的典型设置思路：

```text
MCR[DQS_FA_SEL] = 0x2
SOCCR[SOCCFG]   = 0x0000000E
```

这不是说所有板子都机械照抄，而是告诉你：S32K324 这类器件的高速 QuadSPI 读更偏向 dummy pad loopback，而不是外部 DQS/DLL。

---

## 17. Module Disable mode

`MCR[MDIS]` 用来让 QuadSPI 进入 Module Disable mode。

进入后：

```text
serial flash memory clock 关闭
AHB command 到 QuadSPI 的路径关闭
non-memory mapped 逻辑的 clock 可停止
```

手册还特别提醒一个坑：

```text
如果 MCR[MDIS] = 1 时还写 QuadSPI AHB buffer，
QuadSPI 可能出现 unexpected behavior。
如果要 disabled QuadSPI，应配合 XRDC 阻止对 QSPI AHB buffer 的访问，并返回 error response。
```

这和之前 XRDC 笔记能接上：外设 disabled 时，不只是关 clock，还要防止其他 master 继续访问它的 memory mapped 区域。

---

## 18. 中断、DMA 和错误标志

QuadSPI 的中断和 DMA 主要围绕 TX/RX buffer、IP/AHB 错误和传输完成。

工程头文件里可见 `QSPI_IRQn`：

```c
QSPI_IRQn = 173
```

描述包括：

```text
TX Buffer Fill
Transfer Complete / Transaction Finished
RX Buffer Drain
Buffer Overflow / Underrun
Serial Flash Communication Error
```

常见标志：

| Flag | 含义 |
|---|---|
| `FR[TFF]` | transfer finished |
| `FR[IPIEF]` | IP command trigger event |
| `FR[IPAEF]` | IP command error |
| `FR[ABOF]` | AHB buffer overflow |
| `FR[AIBSEF]` | AHB illegal burst size |
| `FR[AITEF]` | AHB illegal transaction |
| `FR[RBDF]` | RX buffer drain |
| `FR[RBOF]` | RX buffer overflow |
| `FR[ILLINE]` | illegal instruction |
| `FR[TBUF]` | TX buffer underrun |
| `FR[TBFF]` | TX buffer fill |

排查 QuadSPI 问题时，一般不要只看 `BUSY`，还要看：

```text
SR[BUSY]
SR[IP_ACC]
SR[AHB_ACC]
FR error flags
RBSR / TBSR fill level
RSER interrupt/DMA enable
```

---

## 19. QuadSPI 开发流程

如果将来工程真正启用外部 QSPI Flash，建议按这个顺序做：

```text
1. 确认外部 Flash 型号和 datasheet
2. 确认硬件连接：PCSFA1/SCKFA/IOFA[3:0]、供电、上拉、WP#/HOLD#
3. 配置 SIUL2/Port pin mux
4. 配置 MC_ME / MC_CGM 时钟：QSPI_MEM_CLK、QSPI_SFCK
5. 做 Chapter 78 要求的初始化序列
6. 配置 MCR/FLSHCR/SOCCR/SMPR
7. 配置 SFA1AD/SFA2AD 等地址映射
8. 解锁 LUT，写入 read/status/write/erase 等 sequence，再锁 LUT
9. 用 IP command 读 JEDEC ID 或 status register 验证通信
10. 配置 Quad Enable bit，让 Flash 进入 Quad I/O 能力
11. 验证 AHB memory mapped read
12. 再考虑 XIP/cache/linker/MPU/XRDC
```

不要一上来就做 XIP。正确顺序应该是：

```text
先读 ID
再读状态
再单线 read
再 quad read
再 AHB mapped read
最后才谈 XIP
```

---

## 20. EB 里的 `Spi` 和 Chapter 78 QuadSPI 的边界

这是本章和你截图最容易混的地方。

| 项目 | EB `Spi` 当前工程 | Chapter 78 `QuadSPI` |
|---|---|---|
| 底层硬件 | LPSPI | QuadSPI controller |
| 典型用途 | 普通 SPI 外设、传感器、收发器 | 外部串行 Flash |
| 数据模型 | Channel / Job / Sequence | LUT sequence / IP command / AHB read |
| 片选 | PCS0/PCS2 等普通 LPSPI PCS | PCSFA1 |
| 数据线 | SOUT/SIN，通常 1bit | IOFA[3:0]，最多 4bit |
| AUTOSAR 模块 | `Spi` MCAL | 通常不是 AUTOSAR `Spi` 普通配置项 |
| 当前工程实际调用 | BE13、Psi5/Level、CAN Trcv | 未看到应用层直接调用 |

所以，截图里的 `SpiChannel_BE13`、`SpiChannel_Level`、`SpiChannel_CAN` **不是 QuadSPI Flash 的 LUT 配置**。它们是普通 AUTOSAR SPI Handler/Driver 配置。

---

## 21. AUTOSAR Spi 的分层：Channel、Job、Sequence

AUTOSAR Spi 故意分成三层：

```text
Channel  = 一段数据怎么收发
Job      = 对某个外部设备做一次片选事务
Sequence = 一次 API 调度的 job 列表
```

更通俗地说：

```text
Channel  像“数据格式”
Job      像“一次和某个芯片说话”
Sequence 像“调用 Spi_SyncTransmit / Spi_AsyncTransmit 时提交的任务单”
```

当前工程每个 sequence 只有一个 job，每个 job 只有一个 channel：

```text
SpiSequence_BE13  -> SpiJob_BE13  -> SpiChannel_BE13  -> Spi0_BE13/LPSPI0
SpiSequence_Level -> SpiJob_Level -> SpiChannel_Level -> Spi1_Level/LPSPI1
SpiSequence_CAN   -> SpiJob_CAN   -> SpiChannel_CAN   -> Spi3_CAN/LPSPI3
```

虽然现在结构简单，但 AUTOSAR 允许一个 sequence 包含多个 job，一个 job 包含多个 channel。复杂外设初始化时可能会用到这种组合。

---

## 22. EB `SpiChannel` 配置项

截图里第一页就是 `SpiChannel`。它定义“数据是什么样”。

| 配置项 | 含义 | 当前工程 |
|---|---|---|
| `Name` | 配置对象名字，用于生成符号 | `SpiChannel_BE13` / `SpiChannel_Level` / `SpiChannel_CAN` |
| `SpiChannelId` | Channel ID，API 里用的数字 ID | 0 / 1 / 2 |
| `SpiChannelType` | buffer 类型，`IB` internal buffer 或 `EB` external buffer | 全部 `EB` |
| `SpiDataWidth` | 一个 SPI 数据元素的 bit 宽度 | 32 / 16 / 16 |
| `SpiDefaultData` | Tx pointer 为 NULL 时发的默认数据 | 当前 disabled，生成值为 1 |
| `SpiEbMaxLength` | EB channel 最大数据元素数 | 1024 / 512 / 511 |
| `SpiIbNBuffers` | IB buffer 个数 | 因为用 EB，所以 disabled |
| `SpiTransferStart` | MSB first 或 LSB first | 全部 `MSB` |
| `SpiByteSwapTransfer` | 是否字节交换 | 全部 `false` |
| `SpiChannelHalfDuplexDirection` | 半双工方向 | 当前 disabled |
| `SpiChannelEcucPartitionRef` | 多核/分区归属 | 当前 disabled |

### 22.1 EB 和 IB 怎么选

`IB` 是 internal buffer：

```text
应用先 Spi_WriteIB()
驱动把数据存在内部 buffer
再 Spi_SyncTransmit()/AsyncTransmit()
```

`EB` 是 external buffer：

```text
应用调用 Spi_SetupEB(txPtr, rxPtr, length)
驱动直接用应用传入的 buffer
再 Spi_SyncTransmit()/AsyncTransmit()
```

当前工程：

```text
SpiChannelBuffersAllowed = 1
SPI_CHANNEL_BUFFERS_ALLOWED = SPI_USAGE1
```

含义是：**只允许 External Buffer。**

这也和代码一致，工程里大量使用：

```c
Spi_SetupEB(...)
```

### 22.2 当前 Channel 配置表

| Channel | ID | Buffer | Width | MaxLength | Bit order | Byte swap | 实际用途 |
|---|---:|---|---:|---:|---|---|---|
| `SpiChannel_BE13` | 0 | EB | 32 | 1024 | MSB | false | `CDD/L2_Cdd_BE13` |
| `SpiChannel_Level` | 1 | EB | 16 | 512 | MSB | false | `CDD/Sensor/Height/Psi5` |
| `SpiChannel_CAN` | 2 | EB | 16 | 511 | MSB | false | `CANTrcv_Tja1145` |

---

## 23. EB `SpiExternalDevice` 配置项

`SpiExternalDevice` 描述“外部芯片怎么通信”。

它和 `SpiJob` 关系很紧。一个 job 会引用一个 external device，表示这次 job 用哪个 SPI 控制器、哪个 PCS、多少速率、哪种时钟模式。

| 配置项 | 含义 |
|---|---|
| `SpiBaudrate` | SPI SCK 目标频率 |
| `SpiUseBaudrateConfig` | 是否使用单独的 baudrate config 容器 |
| `SpiBaudrateConfigRef` | 引用 baudrate config |
| `SpiCalculatedBaudrate` | 工具计算出的实际 baudrate，当前 disabled |
| `SpiCsIdentifier` | 使用哪个 PCS |
| `SpiCsPolarity` | CS 有效电平，常见 active low |
| `SpiCsSelection` | CS 由硬件引擎控制还是 GPIO 控制 |
| `SpiDataShiftEdge` | 数据移出边沿，不要直接等同于采样边沿 |
| `SpiEnableCs` | 是否启用 CS 处理 |
| `SpiHwUnit` | 绑定哪个硬件 SPI 单元 |
| `SpiShiftClockIdleLevel` | SCLK 空闲电平，对应 CPOL |
| `SpiTimeClk2Cs` | clock 到 CS 的时序间隔 |
| `SpiTimeCs2Clk` | CS 到 clock 的时序间隔 |
| `SpiTimeCs2Cs` | 两次 CS 之间的间隔 |
| `SpiCsBehavior` | CS 是 toggle 还是 keep asserted |
| `SpiHostRequest` | host request 相关特性，当前禁用 |
| `SpiDeviceHalfDuplexSupport` | 外设是否支持半双工 |
| `SpiTransferWidth` | 传输线宽，当前普通 LPSPI 配置下 disabled |

### 23.1 当前 ExternalDevice 配置表

| ExternalDevice | Baudrate | HW | PCS | CS polarity | Clock idle | Shift edge | CS behavior |
|---|---:|---|---|---|---|---|---|
| `Spi0_BE13` | 5 MHz | `CSIB0` / LPSPI0 | PCS2 | LOW | LOW | TRAILING | `CS_TOGGLE` |
| `Spi1_Level` | 4 MHz | `CSIB1` / LPSPI1 | PCS0 | LOW | LOW | LEADING | `CS_KEEP_ASSERTED` |
| `Spi3_CAN` | 4 MHz | `CSIB2` / generated LPSPI3 instance | PCS0 | LOW | LOW | LEADING | `CS_KEEP_ASSERTED` |

### 23.2 `SpiDataShiftEdge` 和 CPHA 的关系

本工程生成的 `Lpspi_Ip_PBcfg.c` 里可以看到：

```text
BE13:  CPOL=0, CPHA=0
Level: CPOL=0, CPHA=1
CAN:   CPOL=0, CPHA=1
```

EB 里：

```text
BE13  SpiDataShiftEdge = TRAILING
Level SpiDataShiftEdge = LEADING
CAN   SpiDataShiftEdge = LEADING
```

这看起来有点反直觉，原因是 EB 参数说的是 **data shift edge**，不是 sample edge。

当 `CPOL=0`：

| CPHA | 采样边沿 | 移出边沿 |
|---:|---|---|
| 0 | leading/rising | trailing/falling |
| 1 | trailing/falling | leading/rising |

所以：

```text
TRAILING shift edge -> CPHA=0
LEADING shift edge  -> CPHA=1
```

**易错点：看外设 datasheet 时，优先看 sample edge/valid edge；看 EB 时确认它的参数到底说的是 shift 还是 sample。**

---

## 24. EB `SpiBaudrateConfig`

当前工程：

```xml
<d:lst name="SpiBaudrateConfig" type="MAP"/>
```

也就是没有单独配置 baudrate config 容器，而是直接在每个 `SpiExternalDevice` 里使用 `SpiBaudrate`。

这适合当前这种设备不多、每个设备固定速率的工程。

如果将来一个外设需要多档速率，例如：

```text
初始化低速
正常通信高速
诊断/特殊模式降速
```

就可以考虑把 baudrate 配置抽出来复用。

---

## 25. EB `SpiJob` 配置项

`SpiJob` 描述“一次外设事务”。

| 配置项 | 含义 | 当前工程 |
|---|---|---|
| `SpiJobId` | Job ID | 0 / 1 / 2 |
| `SpiJobPriority` | 异步调度优先级，0 最低，3 最高 | 全部 0 |
| `SpiJobStartNotification` | job 开始回调 | disabled / NULL |
| `SpiJobEndNotification` | job 结束回调 | disabled / NULL |
| `SpiDeviceAssignment` | 这个 job 对哪个 external device 通信 | BE13/Level/CAN 各自对应 |
| `SpiChannelList` | 这个 job 包含哪些 channel | 每个 job 只有 1 个 channel |
| `SpiChannelIndex` | channel 在 job 内的顺序 | 0 |

当前关系：

| Job | Device | Channel | HW unit |
|---|---|---|---|
| `SpiJob_BE13` | `Spi0_BE13` | `SpiChannel_BE13` | LPSPI0 |
| `SpiJob_Level` | `Spi1_Level` | `SpiChannel_Level` | LPSPI1 |
| `SpiJob_CAN` | `Spi3_CAN` | `SpiChannel_CAN` | LPSPI3 |

**重点：CS 行为是和 job 强相关的。一个 job 往往就是一次 CS 有效期间的通信。**

---

## 26. EB `SpiSequence` 配置项

`SpiSequence` 是应用 API 调用时提交的对象。

| 配置项 | 含义 | 当前工程 |
|---|---|---|
| `SpiSequenceId` | Sequence ID | 0 / 1 / 2 |
| `SpiInterruptibleSequence` | 是否允许被更高优先级 sequence 打断 | 全部 false |
| `SpiSeqEndNotification` | sequence 完成回调 | disabled / NULL |
| `SpiEnableDmaFastTransfer` | DMA fast transfer | false |
| `SpiDmaContMemTransferSequenceEnable` | DMA 连续内存传输 | false |
| `SpiJobAssignment` | sequence 包含哪些 job | 每个 sequence 只有 1 个 job |

当前关系：

| Sequence | Job |
|---|---|
| `SpiSequence_BE13` | `SpiJob_BE13` |
| `SpiSequence_Level` | `SpiJob_Level` |
| `SpiSequence_CAN` | `SpiJob_CAN` |

代码调用也是按 sequence 发起：

```c
Spi_SyncTransmit(SpiConf_SpiSequence_SpiSequence_Level);
Spi_AsyncTransmit(SpiConf_SpiSequence_SpiSequence_BE13);
```

---

## 27. EB `SpiPhyUnit` 配置项

`SpiPhyUnit` 是“真正的硬件控制器”配置。

| 配置项 | 含义 |
|---|---|
| `SpiPhyUnitMapping` | 映射到哪个 LPSPI instance |
| `SpiPhyUnitMode` | Master/Slave |
| `SpiPhyUnitSync` | 这个 HW unit 是否同步传输 |
| `SpiSamplePoint` | 采样点相关配置 |
| `SpiPinConfiguration` | 引脚配置模式 |
| `SpiPhyUnitClockRef` | 使用哪个 clock |
| `SpiPhyUnitAsyncUseDma` | 异步传输是否使用 DMA |
| `SpiPhyTxDmaChannel` | TX DMA channel |
| `SpiPhyRxDmaChannel` | RX DMA channel |
| `SpiFlexioTxAndClkChannelsConfig` | FlexIO SPI 相关，当前不用 |
| `SpiFlexioRxAndCsChannelsConfig` | FlexIO SPI 相关，当前不用 |

当前配置：

| PhyUnit | Mapping | Mode | Sync | Clock | Async DMA | DMA |
|---|---|---|---|---|---|---|
| `SpiPhyUnit_0_BE13` | `LPSPI_0` | Master | false | `AIPS_PLAT_CLK` | true | BE13 Tx/Rx DMA |
| `SpiPhyUnit_1_Level` | `LPSPI_1` | Master | true | `AIPS_PLAT_CLK` | false | 配置引用存在，但生成 LPSPI config 不启用 DMA |
| `SpiPhyUnit_3_CAN` | `LPSPI_3` | Master | true | `AIPS_PLAT_CLK` | false | 无 DMA |

生成代码体现：

```text
SpiPhyUnit_0_BE13 -> LPSPI_IP_POLLING + DMA enabled
SpiPhyUnit_1_Level -> LPSPI_IP_POLLING + DMA disabled
SpiPhyUnit_3_CAN -> LPSPI_IP_POLLING + DMA disabled
```

同时 `Target.c` 里调用了：

```c
Spi_SetAsyncMode(SPI_INTERRUPT_MODE);
```

说明系统运行时把异步模式切到 interrupt。实际最终行为要结合 `Spi_SetAsyncMode`、LPSPI state 和 DMA/IRQ 配置一起看。

---

## 28. EB `SpiGeneral` 配置项

当前工程关键 general 配置：

| 配置项 | 当前值 | 含义 |
|---|---|---|
| `SpiMulticoreSupport` | false | SPI driver 不启用多核支持 |
| `SpiCancelApi` | true | 生成 `Spi_Cancel` |
| `SpiChannelBuffersAllowed` | 1 | 只允许 EB |
| `SpiDevErrorDetect` | true | 开发错误检测打开 |
| `SpiHwStatusApi` | true | 生成 `Spi_GetHWUnitStatus` |
| `SpiInterruptibleSeqAllowed` | false | 不允许可中断 sequence |
| `SpiLevelDelivered` | 2 | 支持同步和异步增强功能 |
| `SpiSupportConcurrentSyncTransmit` | false | 不允许并发 `Spi_SyncTransmit` |
| `SpiVersionInfoApi` | true | 生成版本信息 API |
| `SpiGlobalDmaEnable` | true | 全局允许 DMA |
| `SpiTimeoutMethod` | `OSIF_COUNTER_DUMMY` | timeout 使用 dummy counter |
| `SpiTransmitTimeout` | 50000 | 传输等待超时计数 |

`SpiLevelDelivered = 2` 很重要：

| Level | 能力 |
|---|---|
| 0 | 简单同步 SPI |
| 1 | 基本异步 SPI |
| 2 | 增强 SPI，同步和异步都可用 |

当前工程既有：

```c
Spi_SyncTransmit(...)
```

也有：

```c
Spi_AsyncTransmit(...)
```

所以 Level 2 是合理的。

---

## 29. 当前工程实际 SPI 调用情况

### 29.1 初始化链

在 `EcuM_Cfg_Startup.c`：

```c
Spi_Init(ConfigPtr->ModuleInitPtrPB.SpiInitConfigPtr_cpst);
```

在 `Target.c`：

```c
Spi_SetAsyncMode(SPI_INTERRUPT_MODE);
```

也就是说，SPI 由 EcuM 初始化，之后 target 层把异步模式设为 interrupt。

### 29.2 BE13

文件：

```text
CDD/L2_Cdd_BE13/L2_Cdd_BE13.c
```

调用：

```c
Spi_SetupEB(SpiConf_SpiChannel_SpiChannel_BE13, tx, rx, length);
Spi_AsyncTransmit(SpiConf_SpiSequence_SpiSequence_BE13);
```

对应配置：

```text
LPSPI0
PCS2
5 MHz
32-bit frame
MSB first
CPOL=0, CPHA=0
异步，DMA enabled
```

这里还看到一个开发注意点：

```c
while (Spi_GetSequenceResult(SpiConf_SpiSequence_SpiSequence_BE13) != SPI_SEQ_OK)
{
    /* Subsequently, a timeout exit procedure needs to be implemented. */
}
```

注释已经说明需要 timeout。实际项目里这种 while 等待必须加退出条件，否则 SPI 异常时可能卡死任务。

### 29.3 Level / Psi5

文件：

```text
CDD/Sensor/Height/Src/MainFunction/Psi5.c
```

调用：

```c
Spi_SetupEB(SpiConf_SpiChannel_SpiChannel_Level, SendData, RecvData, mSize);
Spi_SyncTransmit(SpiConf_SpiSequence_SpiSequence_Level);
```

对应配置：

```text
LPSPI1
PCS0
4 MHz
16-bit frame
MSB first
CPOL=0, CPHA=1
同步传输
CS_KEEP_ASSERTED
```

代码里写 Level 芯片寄存器时，多帧组成一个寄存器操作。这个时候 `CS_KEEP_ASSERTED` 就很关键。

### 29.4 CAN Transceiver TJA1145

文件：

```text
CDD/CanTrcv/CANTrcv_Tja1145/Src/MainFunction/CANTrcv_Tja1145.c
```

调用：

```c
Spi_SetupEB(Spi_Channel, tx, rx, 2);
Spi_SyncTransmit(Spi_Sequence);
```

对应配置：

```text
LPSPI3 instance
PCS0
4 MHz
16-bit frame
MSB first
CPOL=0, CPHA=1
同步传输
CS_KEEP_ASSERTED
```

CAN transceiver 这类外设通常是短帧寄存器读写，`SetupEB + SyncTransmit` 很常见。

### 29.5 OS/ISR/DMA

OS 配置里有：

```text
Lpspi_Ip_LPSPI_0_IRQHandler
Lpspi_Ip_LPSPI_1_IRQHandler
Lpspi_Ip_LPSPI_3_IRQHandler
```

DMA 配置里有 LPSPI0/LPSPI1 的 Tx/Rx callback 引用。当前真正启用 DMA 的主要是 BE13 所在的 LPSPI0。

---

## 30. 当前工程 QuadSPI 实际应用情况

我在工程里看到 QuadSPI 相关基础设施：

| 位置 | 信息 |
|---|---|
| `S32K324_QUADSPI.h` | QuadSPI 寄存器头文件，`IP_QUADSPI_BASE = 0x404CC000` |
| `S32K324_QUADSPI_ARDB.h` | AHB RX Data Buffer，`IP_QUADSPI_ARDB_BASE = 0x68000000` |
| `system.c` | MPU 预留 QSPI Rx 和 QSPI AHB 区域 |
| `SAF_clock_config.c` | 配置 `QSPI_MEM_CLK`、`QSPI_SFCK`，注释中 QSPI_SFCK 可到 80 MHz |
| `Clock_Ip_Cfg_Defines.h` | 有 `CLOCK_IP_HAS_QSPI_MEM_CLK`、`CLOCK_IP_HAS_QSPI_SFCK_CLK` 等宏 |
| `Dma_Mux_Ip_Cfg_Defines.h` | 有 QSPI RX buffer drain / TX buffer fill DMA request |
| `MemAcc_CfgDefines.h` | 有 `MEMACC_MEM_HW_QSPI_0` |
| XRDC 配置 | 之前笔记中看到 `Xrdc_0_QuadSPI` memory region |

但我没有看到当前应用层直接使用：

```text
IP_QUADSPI
QuadSPI_* register programming
QSPI_IRQn handler application logic
外部 Flash LUT 初始化
QuadSPI IP read/write/erase API
```

所以当前判断是：

```text
本工程普通 SPI 已实际使用。
QuadSPI 硬件支持和系统基础配置存在，但当前应用层没有明显启用外部 QSPI Flash 访问流程。
```

这点很重要。不要因为 EB 里有 `Spi` 配置，就以为 Chapter 78 QuadSPI 已经在工程里用了。现在真正跑业务通信的是 LPSPI。

---

## 31. 普通 SPI 调试清单

如果 SPI 外设通信失败，按这个顺序查：

1. 外设供电、复位、片选脚是否正确。
2. Port pin mux 是否把 SCK/SOUT/SIN/PCS 配到了 LPSPI。
3. `SpiExternalDevice` 的 `SpiHwUnit`、`SpiCsIdentifier` 是否对上原理图。
4. `SpiBaudrate` 是否超过外设 datasheet。
5. `SpiShiftClockIdleLevel` 和 `SpiDataShiftEdge` 是否对应外设 SPI mode。
6. `SpiDataWidth` 是否符合协议帧宽。
7. `SpiTransferStart` 是否 MSB/LSB 正确。
8. 多帧命令是否需要 `CS_KEEP_ASSERTED`。
9. `Spi_SetupEB` 的 length 是否是 element 数，而不是 byte 数。
10. 异步传输是否配置了 ISR/DMA，OS 中断是否使能。
11. `Spi_GetSequenceResult` 是否 pending/failed，是否有超时保护。
12. 逻辑分析仪 decoder 的 CPOL/CPHA/bit order 是否和 EB 配置一致。

---

## 32. QuadSPI 调试清单

如果将来启用 QuadSPI 外部 Flash，建议这样查：

1. `MC_ME` 是否打开 QuadSPI clock。
2. `QSPI_MEM_CLK`、`QSPI_SFCK` 频率是否符合 S32K3 Data Sheet 和外部 Flash datasheet。
3. `SCKFA/PCSFA1/IOFA[3:0]` pin mux 是否正确。
4. 是否执行了手册要求的 SCKFA 初始化序列。
5. `MCR[MDIS]` 是否退出 Module Disable。
6. `SOCCR` / `MCR[DQS_FA_SEL]` / `SMPR` 是否符合 dummy pad loopback 方案。
7. LUT 是否解锁、写入、再锁定。
8. LUT sequence 是否符合外部 Flash command set。
9. 先用 IP command 读 JEDEC ID，而不是直接做 AHB/XIP。
10. Flash 的 QE bit 是否已经设置。
11. `SFA1AD/SFA2AD` 地址范围是否正确。
12. `BFGENCR[SEQID]` 是否指向 AHB read sequence。
13. `FR` 是否有 `ILLINE`、`IPAEF`、`AITEF`、`TBUF`、`RBOF` 等错误。
14. MPU 是否允许 0x68000000 映射区访问和执行。
15. XRDC 是否允许当前 core/DMA domain 访问 QuadSPI memory region。
16. cache/prefetch 是否按 XIP 要求配置。

---

## 33. 重点、难点、易错点

### 33.1 重点

1. SPI 是 master 输出 clock、CS 选中 slave、MOSI/MISO 同步交换数据。
2. `CPOL/CPHA` 决定时钟空闲电平和采样边沿。
3. `SpiDataWidth` 是一个数据元素的 bit 宽度。
4. `Spi_SetupEB` 的 length 要按 MCAL 对数据元素的定义理解。
5. AUTOSAR `Spi` 三层模型是 `Channel -> Job -> Sequence`。
6. 当前 EB `Spi` 配置走 LPSPI，不是 Chapter 78 QuadSPI。
7. QuadSPI 核心是 LUT + sequence engine。
8. QuadSPI 写 Flash 走 IP command + TX buffer，AHB mapped path 主要用于读。
9. S32K324 不支持 QuadSPI boot、AHB write、DDR、DLL、OTFAD、HyperRAM/HyperFlash。
10. 当前工程已实际使用 LPSPI0/1/3，QuadSPI 只看到基础支持，没有看到应用层直接访问。

### 33.2 难点

| 难点 | 为什么难 |
|---|---|
| CPHA 与 EB `SpiDataShiftEdge` | EB 参数说 shift edge，不是 sample edge |
| EB length 单位 | 很多人把 element 数和 byte 数混在一起 |
| Channel/Job/Sequence | 名字抽象，但实际对应数据格式、片选事务、调度任务 |
| QuadSPI LUT | 它不是普通配置表，而是 Flash 命令脚本 |
| AHB read 和 IP command | 一个像读内存，一个像发命令，适用场景不同 |
| XIP | 牵涉 QuadSPI、MPU、XRDC、cache、linker、启动顺序 |
| QSPI 速率 | 不只看 SCK，还看线宽、dummy cycle、PCB、Flash datasheet |

### 33.3 易错点

1. 把 EB `Spi` 当成 Chapter 78 QuadSPI。
2. 只配 `SpiBaudrate`，不核对 CPOL/CPHA。
3. 多帧命令却让 CS toggle。
4. `Spi_SetupEB` 长度单位理解错误。
5. 异步传输 while 等待没有 timeout。
6. 逻辑分析仪 SPI mode 设置和 EB 配置不一致。
7. 直接写 QuadSPI AHB mapped 区域。
8. 没设置外部 Flash QE bit 就尝试 quad read。
9. 没有配置 LUT 或 BFGENCR，就读 AHB mapped Flash。
10. 启用 XIP 前没处理 cache/MPU/XRDC/linker。

---

## 34. 复习问答

### Q1：SPI 为什么读数据时也要发 dummy？

因为 SPI 的时钟由 master 产生。从机只有在时钟跳变时才会移出数据。master 想读，就必须继续输出 SCLK；最常见办法就是发 dummy 数据来换取从机返回的数据。

### Q2：`SpiChannel`、`SpiJob`、`SpiSequence` 怎么区分？

`SpiChannel` 定义数据格式；`SpiJob` 定义对某个外设的一次事务；`SpiSequence` 是一次 API 调用提交的 job 列表。

### Q3：当前工程的 `SpiChannel_BE13` 是 QuadSPI 吗？

不是。它是 AUTOSAR Spi 模块下的 LPSPI0 普通 SPI channel。Chapter 78 的 QuadSPI 是另一个硬件控制器，面向外部串行 Flash。

### Q4：S32K324 能从 QuadSPI 启动吗？

不能。参考手册说明 boot from QuadSPI 不支持，但支持初始化后从外部 memory 执行。

### Q5：QuadSPI 为什么需要 LUT？

因为串行 Flash 没有统一命令标准。不同厂商的 read/program/erase/status 命令细节可能不同。LUT 让 QuadSPI 按软件配置的 command sequence 去适配不同 Flash。

### Q6：普通 SPI 的 4 MHz 和 QuadSPI 的 120 MHz 是一个概念吗？

不完全是。普通 SPI 的 baudrate 是 SCK 下的一位或一帧串行通信速率；QuadSPI 的外部 Flash 数据吞吐还要乘以数据线宽，考虑 command/address/dummy overhead，以及 Flash/PCB/控制器限制。

---

## 35. 一页速记

```text
普通 SPI:
  SCK  = master clock
  MOSI = master -> slave
  MISO = slave -> master
  CS   = select device / transaction boundary

SPI mode:
  CPOL = clock idle level
  CPHA = sample phase
  Mode0 = CPOL0 CPHA0
  Mode1 = CPOL0 CPHA1
  Mode2 = CPOL1 CPHA0
  Mode3 = CPOL1 CPHA1

AUTOSAR Spi:
  Channel  = data format
  Job      = one external-device transaction
  Sequence = API scheduling unit

Current EB Spi:
  BE13  -> LPSPI0, PCS2, 5MHz, 32-bit, CPOL0/CPHA0, async DMA
  Level -> LPSPI1, PCS0, 4MHz, 16-bit, CPOL0/CPHA1, sync
  CAN   -> LPSPI3, PCS0, 4MHz, 16-bit, CPOL0/CPHA1, sync

QuadSPI:
  purpose = external serial Flash
  core    = LUT + programmable sequence engine
  paths   = IP command / AHB memory-mapped read
  pins    = PCSFA1, SCKFA, IOFA[3:0]

S32K324 QuadSPI:
  base        = 0x404C_C000
  ARDB base   = 0x6800_0000
  LUT count   = 20 registers
  sequences   = 4
  boot QSPI   = not supported
  XIP         = supported after init
  AHB write   = not supported
  DDR/DLL     = not supported

Project status:
  LPSPI is actively used.
  QuadSPI infrastructure exists.
  No obvious application-level QuadSPI Flash driver flow found.
```

---

## 36. 参考文件和延伸阅读

1. `S32K3xx Reference Manual.pdf`：Chapter 78 Quad Serial Peripheral Interface (QuadSPI)。
2. `BasicSoftware/integration/mcal/MCAL_Cfg/config/Spi.xdm`。
3. `BasicSoftware/integration/mcal/src/gen/src/Spi_PBcfg.c`。
4. `BasicSoftware/integration/mcal/src/gen/src/Spi_Ipw_PBcfg.c`。
5. `BasicSoftware/integration/mcal/src/gen/src/Lpspi_Ip_PBcfg.c`。
6. `BasicSoftware/integration/mcal/src/modules/BaseNXP/header/S32K324_QUADSPI.h`。
7. `BasicSoftware/integration/mcal/src/modules/BaseNXP/header/S32K324_QUADSPI_ARDB.h`。
8. `BasicSoftware/integration/src/target/src/system.c`。
9. `CDD/L2_Cdd_BE13/L2_Cdd_BE13.c`。
10. `CDD/Sensor/Height/Src/MainFunction/Psi5.c`。
11. `CDD/CanTrcv/CANTrcv_Tja1145/Src/MainFunction/CANTrcv_Tja1145.c`。
12. NXP S32K3xx Data Sheet：`https://www.nxp.com/docs/en/data-sheet/S32K3xx.pdf`。
13. NXP Community：Maximum Data rate for QSPI：`https://community.nxp.com/t5/S32K/Maximum-Data-rate-for-QSPI/td-p/1933730`。
14. NXP AN13414：S32K1 to S32K3 Migration Guidelines：`https://www.nxp.com/docs/en/application-note/AN13414.pdf`。
