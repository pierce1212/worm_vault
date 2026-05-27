---
title: S32K324 Memory Map 内存映射学习笔记
tags:
  - S32K324
  - S32K3
  - Memory-Map
  - Linker
  - EB-tresos
  - AUTOSAR-MCAL
  - S32K324_TEL9471
created: 2026-05-13 11:21:10 +0800
sources:
  - NXP S32K3xx Reference Manual, Rev. 9, 07/2024, Memory map / MSCM / Cortex-M7 memory related chapters
  - E:/git_project/S32K324_TEL9471/EB_Configuration/config/Mcu.xdm
  - E:/git_project/S32K324_TEL9471/ld/linker_flash_s32k324_new.ld
  - E:/git_project/S32K324_TEL9471/src/04Startup/src/startup.c
  - E:/git_project/S32K324_TEL9471/src/04Startup/src/system.c
  - E:/git_project/S32K324_TEL9471/src/02SWC/00Main/src/Memory.c
  - E:/git_project/S32K324_TEL9471/src/02SWC/02Version/src/Version.c
  - E:/git_project/S32K324_TEL9471/BasicSoftware/src/bsw/EcuM/EcuM_Cfg_Startup.c
links:
  - "[[S32K324 Clocking 时钟系统学习笔记]]"
  - "[[Modes and Power Management/S32K324 Modes and Power Management 模式与电源管理学习笔记]]"
  - "[[Real-time control/S32K324 Real-time control 实时控制学习笔记]]"
---

# S32K324 Memory Map 内存映射学习笔记

> 这篇笔记继续按照 `[[S32K324 Clocking 时钟系统学习笔记]]` 的写法：先从 S32K324 Reference Manual 的概念理解 Memory Map，再落到 EB tresos / MCAL 的 Mcu 配置，最后重点结合当前 `E:/git_project/S32K324_TEL9471` 工程的 linker、startup、MPU、标定数据和版本信息分区说明。
>
> 对嵌入式项目来说，Memory Map 不是“地址表”这么简单。它决定了：程序从哪里启动、代码烧到哪里、变量运行时放在哪里、初始化数据怎么从 Flash 拷贝到 RAM、哪些 RAM 可缓存/不可缓存、Bootloader 怎么判断 APP 有效、诊断 0x23 服务能读到哪些调试信息、标定数据如何从 ROM 搬到 RAM。

---

## 1. 一句话理解 S32K324 Memory Map

可以把 S32K324 的内存系统理解成一栋楼：

1. Program Flash 是“档案室”：程序代码、常量、版本号、APP 有效标志、标定 ROM 镜像都放在这里。
2. Data Flash 是“独立小仓库”：常用于 NVM / Fee / 数据持久化，地址空间和 Program Flash 不同。
3. SRAM 是“办公区”：普通全局变量、栈、可缓存 RAM、不可缓存 RAM、shareable RAM、调试信息区等运行时数据放在这里。
4. ITCM / DTCM 是“高速专用房间”：离 Cortex-M7 核更近，访问延迟低，适合放关键代码/数据/下载缓冲等。
5. 外设寄存器区是“设备控制面板”：AIPS、MC_ME、MC_CGM、CAN、SPI、ADC、STM、DIO 等外设都映射成固定地址寄存器。
6. Linker 文件负责“房间规划图”：把 `.text`、`.data`、`.bss`、`.caldata`、`.AppVaildFlag` 等 section 放进指定地址。
7. Startup 代码负责“开工前布置”：拷贝初始化数据、清零 bss、配置 VTOR、配置 MPU/cache 属性。
8. EB tresos 的 Mcu 配置负责“MCAL 视角的 RAM 初始化/时钟/模式配置”：例如 `McuRamSectorSettingConf`、RAM/Flash wait state 开关、是否生成 `Mcu_InitRamSection()` 能用的配置。

---

## 2. 手册层面的 Memory Map 要点

### 2.1 S32K324 常见地址空间

根据 S32K3xx Reference Manual 和当前 TEL9471 linker 注释，项目里最关键的地址空间是：

| 区域 | 典型地址 | 当前工程使用方式 |
| --- | --- | --- |
| ITCM | `0x00000000` 起 | 当前 linker 定义 `int_itcm = 0x00000000, 32 KB`，MPU 单独配置 ITCM region |
| Program Flash | `0x00400000` 起 | 当前 APP 实际从 `0x0047A800` 开始分配，直到版本/标定/有效标志等特殊区域 |
| Data Flash | `0x10000000` 起 | 当前 linker 只给出 `__ROM_DATA_START = 0x10000000`，Fls/Fee/NvM 相关配置会使用该区 |
| DTCM | `0x20000000` 起 | 当前 linker 定义 `int_dtcm = 0x20000000, 40 KB`，并放 `.RequestDownData` |
| SRAM | `0x20400000` 起 | 当前 linker 从 `0x20400000` 划分普通 SRAM、栈、no-cache、shareable、调试区 |
| 外设寄存器 | `0x40000000` 起 | MPU 中 AIPS_0/1/2 分别配置 `0x40000000/0x40200000/0x40400000` |
| UTEST | `0x1B000000` 附近 | MPU 中配置 UTEST region：`rbar[14]=0x1B000000` |

手册里的 Memory Map 说明的是芯片硬件可以访问哪些地址；工程里的 linker 才决定“这个软件项目实际把哪些 section 放到哪些地址”。两者必须一致，否则可能出现：下载后启动失败、访问 HardFault、MPU violation、cache 一致性问题、Bootloader 找不到 APP 标志、诊断读错地址等问题。

### 2.2 ITCM / DTCM 的意义

S32K324 使用 Cortex-M7，TCM 是和 CPU 紧密耦合的高速存储：

- ITCM：Instruction Tightly Coupled Memory，通常用于关键代码或向量/启动相关代码。
- DTCM：Data Tightly Coupled Memory，通常用于高频访问数据、临时下载缓冲、实时控制数据。

当前 TEL9471 linker 中：

```ld
int_itcm : ORIGIN = 0x00000000, LENGTH = 0x00008000    /* 32K */
int_dtcm : ORIGIN = 0x20000000, LENGTH = 0x0000A000    /* 40K */
int_dtcm_bd0 : ORIGIN = 0x21000000, LENGTH = 0x00010000 /* 64K */
int_dtcm_bd1 : ORIGIN = 0x21404000, LENGTH = 0x0000C000 /* 48K */
```

注意这里还有 `0x21000000`、`0x21404000` 这种 backdoor / alias 风格地址。项目中 `.caldata1` 被放到了 `int_dtcm_bd1`，而 `.RequestDownData` 放到了 `int_dtcm`。这说明工程已经不是简单使用一整块 SRAM，而是按启动、下载、标定、诊断等用途做了细分。

---

## 3. TEL9471 工程的 linker 总体规划

当前核心 linker 文件：

```text
E:/git_project/S32K324_TEL9471/ld/linker_flash_s32k324_new.ld
```

它是 Memory Map 笔记中最重要的工程文件。EB 配置告诉 MCAL 怎么初始化 RAM/clock/mode，但最终变量和 section 放到哪里，是 linker 文件决定的。

### 3.1 Program Flash 分区

当前 `MEMORY` 中 Program Flash 相关区域如下：

| linker memory | 起始地址 | 长度 | 用途 |
| --- | ---: | ---: | --- |
| `int_flash` | `0x0047A800` | `0x00140000` | 主要代码、常量、向量表、MCAL/OS/Safety 代码 |
| `int_flash_sys` | `0x005BA800` | `0x000D0000` | SysCore 分区相关代码，配合 `GHS_ARM_EcucPartition_SysCore.ld` |
| `int_flash_com` | `0x0068A800` | `0x000757C8` | ComCore 分区相关代码，配合 `GHS_ARM_EcucPartition_ComCore.ld` |
| `int_APP_Ver` | `0x006FFFC8` | `0x38` | APP 版本信息区，放 F1AE/F1A0/F1A1/F1A2/F1A5 等 DID 常量 |
| `int_bootheader` | `0x00700000` | `0x1000` | boot header，放 `.boot_header` |
| `int_flash_app` | `0x00701000` | `0x10000` | AppCore 或应用分区 |
| `int_flash_shareable` | `0x00711000` | `0x10000` | shareable flash 分区 |
| `int_APP_Reserved` | `0x007AFF00` | `0xF0` | APP reserved / develop version 等 |
| `int_APP_Vaild` | `0x007AFFF0` | `0x10` | APP 有效标志，`.AppVaildFlag` |
| `int_calibration` | `0x007B8800` | `0x1B7D8` | 标定 ROM 镜像，`.ROM.caldata` / `.ROM.caldata1` |
| `int_calibrationver` | `0x007D3FD8` | `0x18` | 标定版本号，`.F1AE_SWP1` / `.calibrationdataversion` |
| `int_Cal_Vaild` | `0x007D3FF0` | `0x10` | 标定有效标志，`.CalVaildFlag` |

这个布局明显体现了 Bootloader + APP + Calibration 的产品化需求：

- APP 主体不是从 `0x00400000` 起，而是从 `0x0047A800` 起。
- `0x007AFFF0` 固定 16 字节作为 APP valid flag。
- `0x007B8800` 以后是标定数据区。
- 版本号和标定版本号被放在固定地址，方便 Bootloader、诊断、产线工具读取。

### 3.2 SRAM / DTCM / ITCM 分区

当前 RAM 相关 linker 分区如下：

| linker memory | 起始地址 | 长度 | 用途 |
| --- | ---: | ---: | --- |
| `int_itcm` | `0x00000000` | `0x8000` | ITCM，32 KB |
| `int_dtcm` | `0x20000000` | `0xA000` | DTCM，40 KB，当前放 `.RequestDownData` |
| `int_dtcm_bd0` | `0x21000000` | `0x10000` | DTCM backdoor/alias 区，64 KB |
| `int_dtcm_bd1` | `0x21404000` | `0xC000` | DTCM backdoor/alias 区，48 KB，当前放 `.caldata1` |
| `int_sram` | `0x20400000` | `0x14800` | 普通 cacheable SRAM，放 `.data`、`.bss` 等 |
| `int_sram_com` | `0x20414800` | `0x900` | ComCore SRAM 小分区 |
| `int_sram_sys` | `0x20415100` | `0x8800` | SysCore SRAM 小分区 |
| `RAM_CAL_PR` | `0x2041D900` | `0x15400` | 标定 RAM 数据区，放 `.caldata` |
| `int_sram_fls_rsv` | `0x20432F00` | `0x100` | Fls flash access code RAM reserve |
| `int_sram_stack_c0` | `0x20433000` | `0x3000` | Core0 stack，12 KB |
| `int_sram_stack_c1` | `0x20436000` | `0x3000` | Core1 stack，12 KB |
| `int_sram_no_cacheable` | `0x20439000` | `0x6F00` | non-cacheable RAM，向量 RAM / MCAL no-cache 数据 |
| `int_sram_results` | `0x2043FF00` | `0x100` | test result / int_results |
| `int_sram_shareable_0` | `0x20440000` | `0x1800` | shareable RAM 0 |
| `int_DcInfo` | `0x20441800` | `0x200` | 诊断 0x23 读取 DC debug info |
| `int_LcInfo` | `0x20442000` | `0x200` | 诊断 0x23 读取 LC debug info |
| `int_OtherInfo` | `0x20442800` | `0x200` | 诊断 0x23 读取其他 debug info |
| `int_sram_shareable_1` | `0x20443000` | `0xE00` | shareable RAM 1 |
| `int_sram_Protected` | `0x20443E00` | `0x200` | protected RAM |

特别注意 linker 注释中写到：

```text
Last 48 KB of SRAM_1 reserved by HSE Firmware
Last 176 KB of CODE_FLASH_3 reserved by HSE Firmware
Last 128 KB of DATA_FLASH reserved by HSE Firmware
```

所以不要只按芯片手册容量理解可用空间。实际软件必须避开 HSE 固件保留区，否则 HSE、安全启动、Crypto 服务或启动流程可能异常。

---

## 4. section 到地址的映射关系

### 4.1 普通代码和常量

linker 中 `.flash` section 放入 `int_flash`：

```ld
.flash :
{
    __text_start = .;
    __interrupts_rom_start = .;
    *(.os_vectors_0)
    ...
    *(.startup)
    *(.systeminit)
    *(.text.startup)
    *(.text)
    *(.mcal_text)
    *(.os_text)
    *(.s32_saf_text)
    *(.rodata)
    *(.mcal_const_cfg)
    *(.mcal_const)
    *(.s32_saf_const)
    *(.s32_saf_const_cfg)
    __init_table = .;
    *(.init_table)
    __zero_table = .;
    *(.zero_table)
} > int_flash
```

这说明：

- OS 向量表、startup、system init、普通代码、MCAL 代码、OS 代码、安全库代码、只读常量都在 `int_flash`。
- `.init_table` 和 `.zero_table` 也在 Flash，它们给 startup 的 `init_data_bss()` 使用。
- 如果新增一个自定义 section，但 linker 没收它，可能会被默认放到意外位置，甚至链接失败。

### 4.2 `.data` 和 `.bss` 的启动初始化

`.sram_data` 是运行在 RAM、初值在 ROM 的 section：

```ld
.sram_data : AT(__sram_data_rom)
{
    __sram_data_begin__ = .;
    *(.ramcode)
    *(.data)
    *(.mcal_data)
    *(.s32_saf_data)
    __sram_data_end__ = .;
} > int_sram
```

`.sram_bss` 是 NOLOAD，启动时清零：

```ld
.sram_bss (NOLOAD) :
{
    __sram_bss_start = .;
    *(.bss)
    *(.mcal_bss)
    *(.s32_saf_bss)
    __sram_bss_end = .;
} > int_sram
```

对应启动代码在：

```text
E:/git_project/S32K324_TEL9471/src/04Startup/src/startup.c
```

`init_data_bss()` 的逻辑是：

1. 从 `__INIT_TABLE` 读取 copy layout。
2. 把 ROM 中的初始化数据逐字节拷贝到 RAM。
3. 从 `__ZERO_TABLE` 读取 zero layout。
4. 把 bss 区域逐字节清 0。

所以 `.data` 初值能正确生效，不是 C 语言天然完成的，而是 linker table + startup copy 共同完成的。

### 4.3 no-cache 和 shareable RAM

linker 中：

```ld
.non_cacheable_data : AT(__non_cacheable_data_rom) > int_sram_no_cacheable
.non_cacheable_bss (NOLOAD) : > int_sram_no_cacheable
.shareable_data : AT(__shareable_data_rom) > int_sram_shareable_0
.shareable_bss (NOLOAD) : > int_sram_shareable_0
```

这类 section 对多核、DMA、外设 buffer、HSE/MCAL 共享数据很重要：

- cacheable RAM：CPU 访问快，但 DMA/外设看到的数据可能和 cache 不一致。
- non-cacheable RAM：适合外设 DMA、HSE、MCAL 特殊 buffer，不需要频繁 clean/invalidate cache。
- shareable RAM：多核共享或 MCAL shared data 使用。

当前工程还在 `system.c` 中用 MPU 明确配置了这些区域的属性，见后面的 MPU 小节。

---

## 5. TEL9471 的特殊固定地址 section

### 5.1 版本号 DID：F1AE / F1A0 / F1A1 / F1A2 / F1A5

代码位置：

```text
E:/git_project/S32K324_TEL9471/src/02SWC/02Version/src/Version.c
E:/git_project/S32K324_TEL9471/src/02SWC/02Version/include/Version.h
```

代码使用 GHS pragma 指定 rodata section，例如：

```c
#pragma ghs section rodata=".F1AE_Number"
const uint8 DID_F1AE_Number[8] = {0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00};
#pragma ghs section

#pragma ghs section rodata=".F1AE_SWLM"
const uint8 DID_F1AE_SWLM[8] = {...};
#pragma ghs section
```

linker 把这些 section 固定放到 `int_APP_Ver`：

```ld
.F1AE_Number ALIGN(8) : > int_APP_Ver
.F1AE_SWLM   ALIGN(8) : > .
.F1A0_SXDI_SWLM ALIGN(8) : > .
.F1A1_SXDI_SXBL ALIGN(8) : > .
.F1A2_SXDI_SWBL ALIGN(8) : > .
.F1A5_SXBL      ALIGN(8) : > .
.APPversion     ALIGN(8) : > .
```

`int_APP_Ver` 起始地址是 `0x006FFFC8`，长度 `0x38`，刚好用于几个 8 字节版本字段。诊断代码中会读取这些数组，例如：

```text
E:/git_project/S32K324_TEL9471/ASW/DiagUT/src/Rd_Wt.c
```

其中 `DataServices_DID_F1AE_ECU_Software_Part_Numbers_Geely_DID_F1AE_func()` 会把 `DID_F1AE_Number`、`DID_F1AE_SWLM`、`DID_F1AE_SWP1` 等填到诊断响应数据里。

这类数据一定不能随便改 section 名字，否则 linker 不会放到固定地址，诊断和 Bootloader/产线工具就可能读不到。

### 5.2 APP 有效标志 `.AppVaildFlag`

代码位置：

```text
E:/git_project/S32K324_TEL9471/src/02SWC/02Version/src/Version.c
```

代码：

```c
#pragma ghs section rodata=".AppVaildFlag"
const uint8 appvaild[16] = {'G','E','E','L','Y','_','S','3','2','K','3','2','_','A','P','P'};
#pragma ghs section
```

linker：

```ld
int_APP_Vaild : ORIGIN = 0x007AFFF0, LENGTH = 0x00000010
.AppVaildFlag ALIGN(16) : > int_APP_Vaild
```

这 16 字节通常给 Bootloader 判断 APP 是否完整/有效使用。当前内容是字符串：

```text
GEELY_S32K32_APP
```

注意工程里拼写使用的是 `Vaild`，不是 `Valid`：

- linker memory：`int_APP_Vaild`
- section：`.AppVaildFlag`
- 变量：`appvaild`

虽然拼写不标准，但工程中已经形成约定，不要轻易修正为 `Valid`，否则 linker section 对不上。

### 5.3 标定 ROM/RAM：`.ROM.caldata`、`.caldata`、`.caldata1`

linker 中标定相关 section：

```ld
.ROM.caldata  ROM(.caldata)  ALIGN(4) : > int_calibration
.ROM.caldata1 ROM(.caldata1) ALIGN(4) : > .
.F1AE_SWP1 ALIGN(8) : > int_calibrationver
.calibrationdataversion : > .
...
.caldata  ALIGN(4) : > RAM_CAL_PR
.RequestDownData NOCLEAR ABS ALIGN(4) : > int_dtcm
.caldata1_bss ALIGN(4) : > .
.caldata1 ALIGN(4) : > int_dtcm_bd1
```

这说明当前项目采用“Flash 中保存标定初值，运行时复制到 RAM”的方式：

- `.ROM.caldata` 放在 Flash 的 `int_calibration`。
- `.caldata` 运行地址放在 SRAM 的 `RAM_CAL_PR = 0x2041D900`。
- `.ROM.caldata1` 紧跟 `int_calibration` 后面。
- `.caldata1` 运行地址放在 `int_dtcm_bd1 = 0x21404000`。
- `.F1AE_SWP1` / `.calibrationdataversion` 放在 `int_calibrationver = 0x007D3FD8`。

对应运行时复制代码：

```text
E:/git_project/S32K324_TEL9471/src/02SWC/00Main/src/Memory.c
```

```c
void Memory_Init(void)
{
    MemCopy32(&__RAM_CALDATA_START,
              &__ROM_CALDATA_START,
              (uint32)(&__ROM_CALDATA_END) - (uint32)(&__ROM_CALDATA_START));

    MemCopy32(&__RAM_CALDATA1_START,
              &__ROM_CALDATA1_START,
              (uint32)(&__ROM_CALDATA1_END) - (uint32)(&__ROM_CALDATA1_START));
}
```

这些 linker 符号定义在 `linker_flash_s32k324_new.ld`：

```ld
__RAM_CALDATA_START  = ADDR(.caldata);
__ROM_CALDATA_START  = ADDR(.ROM.caldata);
__ROM_CALDATA_END    = ADDR(.ROM.caldata) + SIZEOF(.caldata);

__RAM_CALDATA1_START = ADDR(.caldata1);
__ROM_CALDATA1_START = ADDR(.ROM.caldata1);
__ROM_CALDATA1_END   = ADDR(.ROM.caldata1) + SIZEOF(.caldata1);
```

`Memory_Init()` 被 EcuM startup 调用：

```text
E:/git_project/S32K324_TEL9471/BasicSoftware/src/bsw/EcuM/EcuM_Cfg_Startup.c
```

其中有：

```c
(void) Memory_Init();
```

所以标定数据生效链路是：

```text
变量通过 pragma / section 放入 .caldata / .caldata1
  -> linker 同时生成 ROM 镜像 .ROM.caldata / .ROM.caldata1
  -> linker 生成 __RAM_CALDATA_START / __ROM_CALDATA_START 等符号
  -> EcuM startup 调用 Memory_Init()
  -> Memory_Init() 把 Flash 标定初值复制到 RAM 标定区
  -> 应用运行时读写 RAM 标定值
```

### 5.4 诊断 0x23 调试信息区：Dc/Lc/OtherDebugInfo

linker：

```ld
int_DcInfo    : ORIGIN = 0x20441800, LENGTH = 0x200
int_LcInfo    : ORIGIN = 0x20442000, LENGTH = 0x200
int_OtherInfo : ORIGIN = 0x20442800, LENGTH = 0x200

.DcDebugInfo    ALIGN(4) : > int_DcInfo
.LcDebugInfo    ALIGN(4) : > int_LcInfo
.OtherDebugInfo ALIGN(4) : > int_OtherInfo
```

当前工程大量代码用 GHS pragma 把调试变量放入这些固定区。例如：

```c
#pragma ghs section bss = ".OtherDebugInfo"
uint8 HSE_INSTALL_FLAG = 0u;
#pragma ghs section
```

还有：

- `CD004A_AnalogSigRoute.c` 中 `VeAnalogSig_Result` 放入 `.OtherDebugInfo`。
- `TLE94x1.c` 中 SPI 读写 buffer 放入 `.OtherDebugInfo`。
- `Elmos52141_Ext.c` 中 PSI5 相关测试变量放入 `.OtherDebugInfo`。
- `CD015A_AirSprgVlvDiag.c` 中 `Lc_LS_OC` 放入 `.LcDebugInfo`。
- `Routine_IO_Ctrl.c` 中 `VIN_NVM`、`Tem_VIN_NVM` 放入 `.LcDebugInfo`。

linker 注释写得很明确：这些区域“use for 0x23 service”。也就是说，诊断 0x23 ReadMemoryByAddress 很可能会读取这些固定 RAM 地址，方便标定/测试/售后抓取内部变量。

注意事项：

1. 每个区只有 `0x200`，也就是 512 字节，不能无限塞变量。
2. 如果变量总大小超过 512 字节，链接可能报 overflow，或者后续 section 地址被挤坏。
3. 这些变量是 bss/debug info，复位后会清零或重新初始化，不能当 NVM 使用。
4. 新增变量要考虑 4 字节对齐和诊断工具读取表是否同步。

---

## 6. EB tresos / Mcu 配置怎么理解 Memory Map

当前 EB 配置文件：

```text
E:/git_project/S32K324_TEL9471/EB_Configuration/config/Mcu.xdm
```

Memory Map 相关的 EB 配置主要在 Mcu 模块里，但要明确一点：

> EB 的 Mcu 配置不负责决定 `.text`、`.data`、`.bss` 的最终链接地址；这些由 linker 文件决定。EB Mcu 负责生成 MCAL 的 RAM section 配置、clock/power 配置、wait state 相关开关，以及 `Mcu_InitRamSection()` 等 API 可以使用的描述信息。

### 6.1 Mcu General Configuration 中的 memory 相关项

当前 `Mcu.xdm` 中：

```xml
<d:var name="McuDisableRamWaitStatesConfig" type="BOOLEAN" value="true"/>
<d:var name="McuDisableFlashWaitStatesConfig" type="BOOLEAN" value="true"/>
<d:var name="McuPrepareMemoryConfig" type="FUNCTION-NAME" value="NULL_PTR">
  <a:a name="ENABLE" value="false"/>
</d:var>
```

含义：

| EB 配置项 | 当前值 | 说明 |
| --- | --- | --- |
| `McuDisableRamWaitStatesConfig` | `true` | Mcu 初始化时不由该配置自动设置 RAM wait states |
| `McuDisableFlashWaitStatesConfig` | `true` | Mcu 初始化时不由该配置自动设置 Flash wait states |
| `McuPrepareMemoryConfig` | `NULL_PTR` 且 disabled | 没有配置自定义 prepare memory callout |

这和 Clocking 笔记有关：CPU/Flash 频率提高时，Flash wait states 必须正确，否则高频运行可能不稳定。当前工程把 wait state 配置禁用，说明 wait state 可能由启动代码、默认配置、其他底层流程或已有安全启动环境处理。后续如果改主频或迁移工程，要重点复查这一点。

### 6.2 McuRamSectors 和 RAM section 配置

当前 `Mcu.xdm` 中：

```xml
<d:var name="McuRamSectors" type="INTEGER" value="1"/>
```

后面有 `McuRamSectorSettingConf_0`：

```xml
<d:var name="McuRamSectorId" type="INTEGER" value="0"/>
<d:var name="McuRamDefaultValue" type="INTEGER" value="0"/>
<d:var name="McuRamSectionBaseAddress" type="INTEGER" value="541065216"/>
<d:var name="McuRamSectionSize" type="INTEGER" value="327680"/>
<d:var name="McuRamSectionWriteSize" type="INTEGER" value="8"/>
```

把十进制换成十六进制：

```text
541065216 = 0x20400000
327680    = 0x00050000 = 320 KB
```

这正好对应 S32K324 SRAM 总范围：

```text
0x20400000 ~ 0x2044FFFF，320 KB
```

也就是说 EB Mcu 的 RAM sector 配置从 MCAL 角度描述了“整块 SRAM 可初始化范围”。生成代码中对应：

```text
E:/git_project/S32K324_TEL9471/src/00BSW/MCAL_Dynamic/src/Mcu_PBcfg.c
E:/git_project/S32K324_TEL9471/src/00BSW/MCAL_Dynamic/src/Ram_Ip_Cfg.c
```

`Mcu_PBcfg.c` 中：

```c
/* Number of RAM Sections configurations. */
(Mcu_RamSectionType)1U,

/* Pointer to RAM Section configurations. */
&Mcu_aRamConfigPB,
```

`Ram_Ip_Cfg.c` 中会定义 `Mcu_aRamConfigPB`，供 `Mcu_InitRamSection()` 这类 MCAL API 使用。

关键理解：

- EB RAM sector 是 MCAL 初始化 API 的配置。
- linker RAM 分区是实际编译链接布局。
- 两者都从 `0x20400000` 这块 SRAM 出发，但用途不同。
- 当前工程的启动清零/拷贝主要依赖 startup 的 `init_data_bss()` 和 linker table；标定 RAM 初始化则依赖自定义 `Memory_Init()`。

### 6.3 EB 配置与 linker 的关系

可以这样理解：

```text
EB Mcu.xdm
  -> 生成 Mcu_PBcfg.c / Ram_Ip_Cfg.c
  -> 描述 Mcu_Init、Mcu_InitClock、Mcu_InitRamSection 能用的配置

linker_flash_s32k324_new.ld
  -> 决定每个 section 实际地址
  -> 生成 startup / Memory_Init 使用的 linker symbol

startup.c / system.c / Memory.c
  -> 根据 linker symbol 复制、清零、配置 MPU、初始化标定 RAM
```

如果只改 EB，不改 linker，变量地址不会自动改变。
如果只改 linker，不同步 EB 的 RAM sector / MPU / cache 属性，可能 MCAL 或 startup 对内存的理解不一致。

---

## 7. MPU / cache 属性与 Memory Map 的关系

当前 MPU 配置在：

```text
E:/git_project/S32K324_TEL9471/src/04Startup/src/system.c
```

`system.c` 中使用 linker symbol 配置 MPU region：

```c
extern uint32 __INT_ITCM_START[];
extern uint32 __ROM_CODE_START[];
extern uint32 __ROM_DATA_START[];
extern uint32 __INT_DTCM_START[];
extern uint32 __INT_SRAM_START[];
extern uint32 __RAM_NO_CACHEABLE_START[];
extern uint32 __RAM_SHAREABLE_START[];
extern uint32 __RAM_CACHEABLE_SIZE[];
extern uint32 __RAM_NO_CACHEABLE_SIZE[];
extern uint32 __RAM_SHAREABLE_SIZE[];
```

主要 region：

| MPU region | base | 属性/用途 |
| --- | --- | --- |
| 0 | `0x00000000` | background，默认 strong-order/no access 风格 |
| 1 | `__INT_ITCM_START` | ITCM |
| 2 | `__ROM_CODE_START` | Program Flash code |
| 3 | `__ROM_DATA_START = 0x10000000` | Data Flash，Device / Non-cache / Share |
| 4 | `__INT_DTCM_START` | DTCM |
| 5 | `__INT_SRAM_START` | cacheable SRAM + stack |
| 6 | `__RAM_NO_CACHEABLE_START` | no-cache RAM + int result |
| 7 | `__RAM_SHAREABLE_START` | shareable RAM |
| 8/9/10 | `0x40000000/0x40200000/0x40400000` | AIPS 外设区域 |
| 11/12 | `0x67000000/0x68000000` | QSPI 相关区域 |
| 13 | `0xE0000000` | Cortex-M system control space |
| 14 | `0x1B000000` | UTEST |

这里有一个非常重要的细节：

```c
#if !defined(S32K344) && !defined(S32K324)
    rasr[5]=...
#else
    /*disable subregion 7-8*/
    rasr[5]=... | (1<<15) | (1<<14);
#endif
```

也就是说 S32K324 对 cacheable SRAM region 做了 subregion disable，避免覆盖后面 no-cache/shareable/HSE 保留等区域。这个 MPU 设置必须和 linker 中 `int_sram_no_cacheable`、`int_sram_shareable_0`、`int_sram_Protected` 等地址保持一致。

如果后续调整 RAM 分区，要同时检查：

1. linker `MEMORY` 地址和长度。
2. `__RAM_CACHEABLE_SIZE` / `__RAM_NO_CACHEABLE_SIZE` / `__RAM_SHAREABLE_SIZE`。
3. `system.c` MPU RASR size/subregion 配置。
4. 是否有 DMA/HSE/MCAL buffer 被错误放到 cacheable RAM。

---

## 8. AUTOSAR MemMap.h 和 GHS pragma 的区别

当前工程中有两类放 section 的方式。

### 8.1 AUTOSAR MemMap 宏方式

例如：

```c
#define WdgMUT_START_SEC_VAR_INIT_8
#include "WdgMUT_MemMap.h"
Wdg_Test_t WdgM_AliveTest = WDG_NONE;
...
#define WdgMUT_STOP_SEC_VAR_INIT_8
#include "WdgMUT_MemMap.h"
```

这种是 AUTOSAR 标准风格：

```text
模块源文件
  -> 模块自己的 Xxx_MemMap.h
  -> 项目级 MemMap.h / compiler abstraction
  -> 编译器 pragma / section attribute
  -> linker 收对应 section
```

在 TEL9471 中，ASW、BSW、CDD、MCAL 都大量使用这种方式。例如：

- `WdgMUT_MemMap.h`
- `ExeMgrUT_MemMap.h`
- `Rd_Wt_MemMap.h`
- `Routine_IO_Ctrl_MemMap.h`
- `Mcu_MemMap.h`
- `Platform_MemMap.h`

### 8.2 直接 GHS pragma 方式

例如版本号和调试变量：

```c
#pragma ghs section rodata=".F1AE_Number"
const uint8 DID_F1AE_Number[8] = {...};
#pragma ghs section

#pragma ghs section bss = ".OtherDebugInfo"
uint8 HSE_INSTALL_FLAG = 0u;
#pragma ghs section
```

这种更直接，通常用于“必须放固定地址”的特殊数据：

- DID 版本号。
- APP valid flag。
- 标定版本。
- 诊断调试 RAM 区。

注意：用了 `#pragma ghs section` 后一定要用空的 `#pragma ghs section` 复位，否则后续变量可能意外进入同一个 section。

---

## 9. 当前 TEL9471 项目 Memory Map 启动链路

可以把启动时内存相关动作按时间顺序理解：

```text
Reset / Bootloader 跳转 APP
  -> 进入 APP vector / startup
  -> system.c 配置 FPU、MPU、cache/内存属性
  -> startup.c:init_data_bss()
       - 按 __INIT_TABLE 拷贝 .data / ramcode / no-cache data / shareable data
       - 按 __ZERO_TABLE 清零 .bss / no-cache bss / shareable bss
  -> EcuM startup
       - 初始化 OS/Stack/Vector/BSW 相关内容
       - 调用 Memory_Init()
  -> Memory_Init()
       - 拷贝 .ROM.caldata 到 .caldata RAM
       - 拷贝 .ROM.caldata1 到 .caldata1 RAM
  -> 应用、RTE、BSW 周期任务开始运行
```

其中两个初始化体系要区分：

1. C runtime/startup 初始化：处理普通 `.data`、`.bss`、MCAL data、OS data。
2. 项目自定义 `Memory_Init()`：处理标定数据 ROM -> RAM 的复制。

所以如果某个变量没有按预期初始化，要先判断它属于哪类 section。

---

## 10. 修改 Memory Map 时的检查清单

### 10.1 新增固定地址常量

例如新增一个 DID 常量：

1. 在 C 文件中用 `#pragma ghs section rodata=".YourSection"` 包住变量。
2. 在 linker 中添加 `.YourSection ALIGN(x) : > 某个 memory`。
3. 确认该 memory 长度足够。
4. 查看 map 文件，确认变量地址符合预期。
5. 如果诊断读取，更新 DID 服务代码和诊断数据库。

### 10.2 新增 RAM 调试变量

如果要放到 0x23 读内存区域：

1. 选择 `.DcDebugInfo` / `.LcDebugInfo` / `.OtherDebugInfo`。
2. 检查每个区只有 512 字节。
3. 用 GHS pragma 包住变量，并及时 reset pragma。
4. 编译后查 map 文件，确认没有 overflow。
5. 更新测试/诊断读取地址表。

### 10.3 调整标定区大小

如果 `.caldata` 增大：

1. 检查 `int_calibration` Flash 长度是否够。
2. 检查 `RAM_CAL_PR` SRAM 长度是否够。
3. 检查 `Memory_Init()` copy 长度来自 linker symbol，正常不需要改代码。
4. 检查 `.F1AE_SWP1`、`.CalVaildFlag` 是否仍在固定地址。
5. 检查 Bootloader / 标定工具 / A2L 是否同步。

### 10.4 调整 SRAM 分区

1. 改 linker `MEMORY`。
2. 改 linker symbols：`__RAM_CACHEABLE_SIZE`、`__RAM_NO_CACHEABLE_SIZE`、`__RAM_SHAREABLE_SIZE` 等。
3. 检查 `system.c` MPU region size/subregion disable。
4. 检查 EB `McuRamSectionBaseAddress` / `McuRamSectionSize` 是否仍合理。
5. 检查 HSE 保留区不能被覆盖。
6. 重新编译并查看 map 文件。

### 10.5 调整 Flash 分区

1. 确认 Bootloader 跳转地址、APP 起始地址、vector table 地址一致。
2. 确认 `int_APP_Ver`、`int_APP_Vaild`、`int_calibration`、`int_Cal_Vaild` 固定地址是否被工具依赖。
3. 检查 HSE 保留的 Code Flash 尾部区域。
4. 检查刷写脚本、hex/srec 裁剪脚本、诊断下载地址。
5. 重新生成/检查 map、hex、srec。

---

## 11. 和 Clocking / Power / Real-time 的关系

Memory Map 看起来和 clocking 不同，但实际高度相关：

1. Clocking 决定 CPU/Flash/SRAM 访问频率。频率变高时，Flash wait states、RAM wait states 必须正确。
2. Power mode 会影响哪些 SRAM 保持、哪些 clock/domain 关闭。Standby RAM 和普通 SRAM 要区分。
3. Real-time control 的 DMA/外设 buffer 不能随便放 cacheable RAM，否则可能出现数据一致性问题。
4. 多核通信、MCAL shared data、HSE buffer 需要 shareable/no-cache 区域配合 MPU。
5. Bootloader/APP/Calibration 分区必须和刷写流程、诊断下载流程一致。

当前 TEL9471 工程中最值得重点记住的 Memory Map 主线是：

```text
APP code:       0x0047A800 起
APP version:    0x006FFFC8 起
Boot header:    0x00700000 起
APP valid flag: 0x007AFFF0, 16 bytes
Calibration:    0x007B8800 起
Cal version:    0x007D3FD8 起
Cal valid flag: 0x007D3FF0, 16 bytes
SRAM:           0x20400000 起
Cal RAM:        0x2041D900 起
No-cache RAM:   0x20439000 起
Debug 0x23 RAM: 0x20441800 / 0x20442000 / 0x20442800
DTCM:           0x20000000 起
caldata1 RAM:   0x21404000 起
```

---

## 12. 最后总结

对 S32K324_TEL9471 来说，Memory Map 要同时看四类文件：

1. 手册：知道芯片硬件地址空间和 ITCM/DTCM/SRAM/Flash/外设的大框架。
2. EB：看 `Mcu.xdm` 里 RAM sector、wait state、Mcu 初始化配置。
3. linker：看 `linker_flash_s32k324_new.ld`，这是变量和 section 真实地址的最终依据。
4. startup/应用代码：看 `startup.c`、`system.c`、`Memory.c`、`Version.c`，确认运行时是否拷贝、清零、配置 MPU、放固定地址。

一句话记忆：

> EB 负责生成 MCAL 对内存的配置视角，linker 负责真实地址布局，startup 负责让 RAM 变成 C 语言可用状态，应用代码通过 pragma/MemMap 把关键数据放进指定 section。

如果以后遇到“变量值复位后不对、标定没生效、Bootloader 不认 APP、诊断 0x23 读不到、DMA 数据异常、HardFault/MPU fault”，第一反应就应该回到这条链路检查：

```text
变量/section 名称
  -> MemMap.h 或 #pragma ghs section
  -> linker section
  -> MEMORY 区域地址和长度
  -> startup copy/zero 或 Memory_Init
  -> MPU/cache 属性
  -> map 文件最终地址
```
