# RSM8900 RTC 学习笔记

资料来源：

- 硬件手册：`E:/svn/project/ASU/平台开发/01_开发库/03_供应商输入/02_硬件/数据手册/RTC/RSM-DS-R-0036 RS4TC8900Q Real Time Clock (Rev 1.6).pdf`
- 驱动代码：`CDD/RTC/Src/MainFunction/RSM8900/RSM8900.h`
- 驱动代码：`CDD/RTC/Src/MainFunction/RSM8900/RSM8900.c`
- I2C 适配层：`CDD/RTC/Src/MainFunction/RSM8900/RSM_IIC.c`
- RTC 模块入口：`CDD/RTC/Src/MainFunction/RTC.c`
- AUTOSAR SWC 入口：`ASW/SWC/CDD_SWC/CDD_RTC/src/CDD_RTC.c`

> 说明：本笔记重点是把 RS4TC8900Q/RSM8900 数据手册中的寄存器模型和当前工程代码对应起来，便于后续调试、评审和补全驱动。当前环境没有可用的 PDF 文本抽取工具，手册要点主要结合代码中的寄存器命名、地址和位定义进行整理。

## 1. 模块定位

当前工程把外部 RTC 芯片封装成一个 CDD 模块：

```text
CDD_RTC Runnable
  -> RTC_Init / RTC_MainFunc
     -> RSM_IIC_Init / RSM_IIC_MainFunc
     -> RSM8900_Init / RSM8900_MainFunc
        -> RSM8900_SetTime / RSM8900_GetTime
        -> RSM8900_SetAlarm / RSM8900_GetAlarm
        -> RSM8900_ReadReg / RSM8900_WriteReg
           -> RSM_IIC_Receive_Data / RSM_IIC_Send_Data
              -> I2c_SyncTransmit(channel 0)
```

AUTOSAR 侧入口在 `CDD_RTC.c`：

- `RE_CDD_RTC_Init()` 调用 `RTC_Init()`。
- `RE_CDD_RTC_20ms()` 周期调用 `RTC_MainFunc()`。

底层 RTC 入口在 `RTC.c`：

- `RTC_Init()` 先初始化 I2C 适配层，再初始化 RSM8900。
- `RTC_MainFunc()` 目前主要调用 `RSM_IIC_MainFunc()` 和 `RSM8900_MainFunc()`，同时还保留了较多测试代码。

## 2. I2C 地址和访问方式

`RSM_IIC.c` 中定义：

```c
#define RSM_IIC_SLAVE_ADDRESS 0x32u
```

这是 7 位 I2C 从机地址。`RSM8900.h` 中同时定义了：

```c
#define RSM8900_IIC_WRITE 0x64
#define RSM8900_IIC_READ  0x65
```

这两个值是 8 位总线地址，即 `0x32 << 1` 后附加 R/W 位。当前 MCAL I2C 接口使用 7 位地址，所以实际传给 `I2c_RequestType.SlaveAddress` 的是 `0x32`，这是合理的。

读寄存器流程：

1. 先发送 1 字节寄存器地址 `cmd`。
2. 再发起接收请求，读取指定长度数据。
3. 两段请求都通过 `I2c_SyncTransmit(0U, &RequestData)` 完成。

写寄存器流程：

1. 构造发送缓冲区：第 0 字节是寄存器地址，后续字节是数据。
2. 一次同步发送 `1 + length` 字节。

代码限制单次数据长度：

```c
#define RSM_MAX_IIC_DATA_LEN 16U
#define RSM_MAX_IIC_BUFFER_LEN (1U + RSM_MAX_IIC_DATA_LEN)
```

对 RTC 当前时间寄存器一次读写 7 字节，告警寄存器一次读写 3 字节，都在该限制内。

## 3. 寄存器地图

`RSM8900.h` 中把寄存器分成 Basic Time and Calendar 区和 Extension 区。

Basic Time and Calendar 区：

| 地址 | 宏 | 用途 |
|---|---|---|
| `0x00` | `RSM8900_BTC_SEC` | 秒 |
| `0x01` | `RSM8900_BTC_MIN` | 分 |
| `0x02` | `RSM8900_BTC_HOUR` | 时 |
| `0x03` | `RSM8900_BTC_WEEK` | 星期 |
| `0x04` | `RSM8900_BTC_DAY` | 日 |
| `0x05` | `RSM8900_BTC_MONTH` | 月 |
| `0x06` | `RSM8900_BTC_YEAR` | 年 |
| `0x07` | `RSM8900_BTC_RAM` | RAM |
| `0x08` | `RSM8900_BTC_ALARM_MIN` | 告警分 |
| `0x09` | `RSM8900_BTC_ALARM_HOUR` | 告警时 |
| `0x0A` | `RSM8900_BTC_ALARM_WEEK_OR_DAY` | 告警星期/日 |
| `0x0B` | `RSM8900_BTC_TIMER_CNT_0` | 定时器计数低字节 |
| `0x0C` | `RSM8900_BTC_TIMER_CNT_1` | 定时器计数高字节 |
| `0x0D` | `RSM8900_BTC_EXT` | 扩展控制 |
| `0x0E` | `RSM8900_BTC_FLAG` | 标志 |
| `0x0F` | `RSM8900_BTC_CTRL` | 控制 |

Extension 区：

| 地址 | 宏 | 用途 |
|---|---|---|
| `0x10` ~ `0x16` | `RSM8900_EXT_SEC` ~ `RSM8900_EXT_YEAR` | 扩展时间/日期 |
| `0x17` | `RSM8900_EXT_TEMP` | 温度 |
| `0x18` | `RSM8900_EXT_BACKUP` | 备份/电源相关控制 |
| `0x1B` ~ `0x1F` | `RSM8900_EXT_TIMER_CNT_0` ~ `RSM8900_EXT_CTRL` | 扩展定时器、标志、控制 |

当前代码主要使用 `0x00` ~ `0x0F` 的 BTC 区，并额外写 `0x18` 关闭/配置备用电源相关功能。

## 4. 时间格式：BCD 与星期位图

RS4TC8900Q 的时间日期寄存器使用压缩 BCD：

- 十进制 26 写入寄存器为 `0x26`。
- 读取 `0x59` 后转成十进制 59。

代码中转换函数：

```c
static uint8 DECtoBCD(uint8 DEC)
{
    return ((uint8)(DEC / 10) << 4) + (DEC % 10);
}

static uint8 BCDtoDEC(uint8 BCD)
{
    return (uint8)(BCD >> 4) * 10 + (BCD & 0x0f);
}
```

读时间时，代码会屏蔽非数值位：

- 秒、分：`data[x] & 0x7F`
- 时：`data[2] & 0x3F`
- 日：`data[4] & 0x3F`
- 月：`data[5] & 0x1F`

星期不是 BCD，而是低 7 位单 bit 有效：

```c
date[RSM8900_BTC_WEEK] = 1 << (pTime->week);
```

`pTime->week` 的内部表达是 `0` ~ `6`，写入芯片后变成 `0x01`、`0x02`、`0x04` ... `0x40`。读取时 `RSM8900_GetWeekDay()` 从低位开始找第一个置位，转换回 `0` ~ `6`。

注意：代码注释里有“bit1 是星期天”的描述，但实现上实际是 bit0 对应 `week = 0`。后续调试时应以手册表格和实测为准，避免注释与实现不一致带来误解。

## 5. 初始化逻辑

`RSM8900_Init()` 做了三件主要事情：

1. 写入默认时间：

```c
uint8 default_time[7] = {0x00, 0x00, 0x00, 0x10, 0x01, 0x01, 0x00};
RSM8900_WriteReg(RSM8900_BTC_SEC, default_time, 7);
```

这相当于把秒、分、时、星期、日、月、年写入 `0x00` ~ `0x06`。这里的年份 `0x00` 对应代码语义中的 2000 年。

2. 读取并检查 `FLAG` 寄存器：

```c
RSM8900_ReadOneReg(RSM8900_BTC_FLAG, &data);
```

关注位：

- `VDET`：电压检测标志。
- `VLF`：电压低/时钟数据可能无效标志。
- `AF`：告警标志。
- `TF`：定时器标志。
- `UF`：更新标志。

只要任一标志置位，代码会清理控制、扩展和标志寄存器。

3. 配置备份相关寄存器：

```c
RSM8900_WriteOneReg(RSM8900_EXT_BACKUP, 0x8u);
```

代码注释说明“不需要备用电池供电功能，设置关闭电压检测功能”。这个值建议后续直接对照手册 `BACKUP` 寄存器确认每一位含义。

学习重点：`VLF/VDET` 这类标志通常意味着 RTC 时间可信度下降。当前代码先写默认时间，再读标志并清除，这会让上层很难知道“上电前 RTC 时间是否曾经失效”。如果产品逻辑需要保留掉电计时，应重新审视初始化顺序。

## 6. 设置与读取时间

### 设置时间

`RSM8900_SetTime()` 的流程：

1. 调用 `RTC_Time_Vaild()` 校验范围。
2. 秒、分、时、日、月、年转 BCD。
3. 星期转单 bit 位图。
4. 从 `RSM8900_BTC_SEC` 开始连续写 7 字节。

校验范围：

```c
year > 1970 && year <= 2099
month > 0 && month <= 12
date > 0 && date <= 31
week < 7
hour < 24
min < 60
sec < 60
```

这里 `year = pTime->year + 2000u`，所以结构体里的 `year` 实际存 0 ~ 99。比如 `{..., year = 26}` 表示 2026 年。

### 读取时间

`RSM8900_GetTime()` 的流程：

1. 从 `0x00` 连续读取 7 字节。
2. 按掩码去掉控制/保留位。
3. BCD 转十进制。
4. 星期位图转 `0` ~ `6`。
5. 再调用 `RTC_Time_Vaild()` 判断结果合法。

一个值得注意的点：读取后 `pTime->year = BCDtoDEC(data[6])`，也就是仍然保存 0 ~ 99，而不是完整年份 2000 ~ 2099。上层显示或诊断输出时要自行加 2000。

## 7. 告警逻辑

告警相关寄存器：

- `0x08`：告警分钟。
- `0x09`：告警小时。
- `0x0A`：告警星期或日期。
- `0x0D` 的 `WADA` 位决定第三个告警字段解释为 week 还是 day。
- `0x0E` 的 `AF` 位表示告警触发。
- `0x0F` 的 `AIE` 位使能告警中断，`UIE` 位使能更新中断。

`RSM8900_SetAlarm()` 的流程：

1. 读 `EXT` 和 `FLAG`。
2. 分、时转 BCD。
3. 根据 `WADA` 选择写入 day 或 week 位图。
4. 临时关闭 `AIE/UIE`。
5. 写 `0x08` ~ `0x0A` 三个告警寄存器。
6. 清 `AF`。
7. 重新打开 `AIE/UIE`。

`RSM8900_GetAlarm()` 的流程：

1. 读告警寄存器和 `EXT/FLAG`。
2. 按 `WADA` 解析第三个字段。
3. 如果 `AIE` 已使能且 `AF` 置位，则返回 1，否则返回 0。

需要特别复核的点：

- `RTC.c` 中注释写“WADA 置 0 代表 DAY，置 1 代表 WEEK”，但 `RSM8900_SetAlarm()` 里 `if (ctrl[0] & WADA)` 分支注释为 Day Alarm，`else` 分支为 Week Day Alarm。两者互相矛盾，需要对照手册确认。
- `RTC.c` 中 day alarm 测试代码使用 `ctrl |= ~RSM8900_BTC_EXT_WADA;`，这会把除 WADA 以外的位几乎全部置 1，不是清除 WADA。若目的是选择 day/week，应使用 `ctrl &= ~RSM8900_BTC_EXT_WADA` 或 `ctrl |= RSM8900_BTC_EXT_WADA`。
- `RSM8900_SetAlarm()` 对 day alarm 使用 `alarmvals[2] = pAlarm->al_day;`，没有转 BCD；但 `GetAlarm()` 读取 day 时使用 `BCDtoDEC(alarmvals[2] & 0x3f)`。这里写读格式不对称，应结合手册确认 day 告警寄存器是否需要 BCD。

## 8. 标志位与控制位

`RSM8900_BTC_EXT`：

| 位 | 宏 | 代码语义 |
|---|---|---|
| bit0 | `TSEL0` | 定时器选择 |
| bit1 | `TSEL1` | 定时器选择 |
| bit2 | `FSEL0` | 频率选择 |
| bit3 | `FSEL1` | 频率选择 |
| bit4 | `TE` | 定时器使能 |
| bit5 | `USEL` | 更新选择 |
| bit6 | `WADA` | 告警 day/week 选择 |
| bit7 | `TEST` | 测试位 |

`RSM8900_BTC_FLAG`：

| 位 | 宏 | 代码语义 |
|---|---|---|
| bit0 | `VDET` | 电压检测 |
| bit1 | `VLF` | 电压低/时间无效 |
| bit3 | `AF` | 告警触发 |
| bit4 | `TF` | 定时器触发 |
| bit5 | `UF` | 更新触发 |

`RSM8900_BTC_CTRL`：

| 位 | 宏 | 代码语义 |
|---|---|---|
| bit0 | `RESET` | 复位 |
| bit3 | `AIE` | 告警中断使能 |
| bit4 | `TIE` | 定时器中断使能 |
| bit5 | `UIE` | 更新中断使能 |
| bit6 | `CSEL0` | 时钟/校准选择 |
| bit7 | `CSEL1` | 时钟/校准选择 |

## 9. 当前代码中的工程注意点

### 9.1 I2C API 返回值没有检查

`RSM_IIC_Receive_Data()` 和 `RSM_IIC_Send_Data()` 调用 `I2c_SyncTransmit()` 后没有读取返回值或状态。上层 `RSM8900_GetTime()` 只能靠读出的数据是否合法判断，无法区分：

- I2C 总线失败。
- RTC 返回异常数据。
- 时间本身越界。

建议后续把 I2C 适配层改成返回 `Std_ReturnType`，并在 `RSM8900_ReadReg/WriteReg` 继续向上传递。

### 9.2 void 函数中 `return false`

`RSM_IIC_Receive_Data()` 和 `RSM_IIC_Send_Data()` 是 `void` 函数，但参数非法时写了 `return false;`。这在 C 中不规范，可能触发编译告警。应改成 `return;`，或者把函数签名改成有返回值。

### 9.3 全局发送缓冲区不可重入

`RSM_tx_data` 是全局数组，`RSM_IIC_Send_Data()` 会复用它。若未来 RTC 接口可能在不同任务或中断上下文同时调用，需要加互斥或改成本地缓冲。当前 CDD 20ms Runnable 单线程调用时风险较低。

### 9.4 `RTC_MainFunc()` 仍有测试逻辑

`RTC_MainFunc()` 当前会：

- 首次运行时写入固定时间 `{10, 10, 9, 5, 20, 3, 26}`。
- 每周期读取时间。
- 保留 I2C 引脚 GPIO 拉高/拉低测试代码。

这更像 bring-up 阶段代码。量产前应把测试逻辑移到专用测试接口或条件编译中，否则每次上电都可能覆盖 RTC 当前时间。

### 9.5 日期合法性只做粗校验

`RTC_Time_Vaild()` 只判断日 `1..31`，没有根据月份、闰年判断 2 月 29 日、4 月 31 日等非法日期。如果上层可能写入任意日期，建议补全日历校验。

### 9.6 年份语义需要统一

`RSM8900_time.year` 存 0 ~ 99，校验时加 2000，注释里只写 `year`。建议在头文件注释中明确：

- `year = 0` 表示 2000。
- `year = 26` 表示 2026。
- 支持范围 2000 ~ 2099。

### 9.7 初始化顺序可能影响掉电时间保持

`RSM8900_Init()` 一开始就写默认时间。如果 RTC 芯片在掉电期间正常走时，这一步会覆盖真实时间。更稳妥的策略通常是：

1. 先读 `FLAG`。
2. 如果 `VLF/VDET` 表明时间失效，再写默认时间。
3. 如果时间有效，则保留 RTC 当前时间。

这个策略需要结合产品需求决定。

## 10. 调试建议

上板调试时可以按下面顺序验证：

1. 确认 I2C 地址：逻辑分析仪观察地址应为 7 位 `0x32`，总线上 8 位写地址表现为 `0x64`，读地址表现为 `0x65`。
2. 验证连续读写：写 `0x00` ~ `0x06` 后连续读回，确认 BCD 与星期位图一致。
3. 验证秒递增：写入时间后等待 2 秒，再读秒寄存器确认递增。
4. 验证掉电标志：模拟 RTC 电源/备份电源场景，观察 `VLF/VDET` 是否置位以及初始化是否清除。
5. 验证告警：设置当前时间和 1 分钟后的告警，观察 `AF` 是否置位、外部中断脚是否动作。
6. 验证异常恢复：人为拉低/干扰 I2C，确认上层能识别失败，而不是把无效数据当时间。

## 11. 阅读代码路线

建议学习顺序：

1. 从 `RSM8900.h` 看寄存器地址和位定义，先建立芯片寄存器地图。
2. 看 `RSM_IIC.c`，理解当前驱动怎么把“寄存器地址 + 数据”转换成 MCAL I2C 请求。
3. 看 `RSM8900_SetTime()` 和 `RSM8900_GetTime()`，掌握 BCD 和星期位图。
4. 看 `RSM8900_Init()`，理解标志位清除、默认时间和备份配置。
5. 看 `RSM8900_SetAlarm()` 和 `RSM8900_GetAlarm()`，重点核对 `WADA/AF/AIE/UIE`。
6. 最后看 `RTC.c` 和 `CDD_RTC.c`，理解调度周期、初始化入口和当前测试代码。

## 12. 小结

RSM8900 这部分代码的核心并不复杂：它是一个基于 I2C 的外部 RTC 寄存器驱动，上层通过 AUTOSAR CDD 20ms Runnable 周期调用。学习时要抓住三条线：

- 数据格式线：时间日期是 BCD，星期是单 bit 位图。
- 通信线：I2C 7 位地址 `0x32`，读前先写寄存器地址，写时首字节带寄存器地址。
- 状态线：`FLAG` 里的 `VLF/VDET/AF/TF/UF` 决定时间可信度和告警/定时器事件。

后续若要把它从 bring-up 代码推进到可交付驱动，优先处理 I2C 返回值、初始化覆盖时间、告警 WADA 语义、日期校验和测试代码隔离。
