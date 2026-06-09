# RSM8900 RTC Driver说明

本文说明当前工程中 `CDD/RTC/Src/MainFunction/RSM8900` 下 RTC 驱动的函数功能、运行逻辑、调用关系和寄存器设置。

相关文件：

- `RSM8900.c` / `RSM8900.h`：RTC功能层，提供初始化、时间读写、闹钟、周期唤醒、寄存器读写接口。
- `RSM_IIC.c` / `RSM_IIC.h`：I2C传输层，封装对RS4TC8900Q的寄存器读写。

## 1. 总体结构

驱动分为两层：

```text
应用/上层模块
    |
    | 调用 RSM8900_Init / RSM8900_SetTime / RSM8900_GetTime
    |      RSM8900_SetAlarm / RSM8900_GetAlarm
    |      RSM8900_SetCycWake / RSM8900_SetCycWakeMinutes
    v
RSM8900 RTC功能层
    |
    | 调用 RSM8900_ReadReg / RSM8900_WriteReg
    |      RSM8900_ReadOneReg / RSM8900_WriteOneReg
    v
RSM_IIC I2C传输层
    |
    | 调用 I2c_SyncTransmit
    v
CDD_I2c驱动 / LPI2C硬件
```

I2C设备地址在 `RSM_IIC.c` 中定义：

```c
#define RSM_IIC_SLAVE_ADDRESS 0x32u
```

寄存器地址在 `RSM8900.h` 中定义。时间日历寄存器有两组地址映射：

- `0x00~0x06`：Basic Time and Calendar区域，当前驱动主要使用这一组。
- `0x10~0x16`：Extension区域中的镜像时间寄存器，当前只使用了扩展区的 `TEMP/BACKUP` 等寄存器地址。

## 2. 关键寄存器

### 2.1 时间日历寄存器

| 宏 | 地址 | 功能 | 当前代码使用 |
|---|---:|---|---|
| `RSM8900_BTC_SEC` | `0x00` | 秒，BCD格式 | `SetTime/GetTime/Init` |
| `RSM8900_BTC_MIN` | `0x01` | 分，BCD格式 | `SetTime/GetTime/Init` |
| `RSM8900_BTC_HOUR` | `0x02` | 时，BCD格式 | `SetTime/GetTime/Init` |
| `RSM8900_BTC_WEEK` | `0x03` | 星期，单bit有效 | `SetTime/GetTime/Init` |
| `RSM8900_BTC_DAY` | `0x04` | 日期，BCD格式 | `SetTime/GetTime/Init` |
| `RSM8900_BTC_MONTH` | `0x05` | 月，BCD格式 | `SetTime/GetTime/Init` |
| `RSM8900_BTC_YEAR` | `0x06` | 年，BCD格式，00~99 | `SetTime/GetTime/Init` |

时间数据以BCD格式存放，例如十进制 `23` 写入寄存器为 `0x23`。星期寄存器使用单bit表示：

```text
bit0 Sunday
bit1 Monday
bit2 Tuesday
bit3 Wednesday
bit4 Thursday
bit5 Friday
bit6 Saturday
```

当前代码的 `pTime->week` 使用 `0~6`，写寄存器时执行：

```c
date[RSM8900_BTC_WEEK] = 1 << (pTime->week);
```

### 2.2 闹钟寄存器

| 宏 | 地址 | 功能 |
|---|---:|---|
| `RSM8900_BTC_ALARM_MIN` | `0x08` | 闹钟分钟 |
| `RSM8900_BTC_ALARM_HOUR` | `0x09` | 闹钟小时 |
| `RSM8900_BTC_ALARM_WEEK_OR_DAY` | `0x0A` | 闹钟星期或日期 |

闹钟的第三个字段由 `RSM8900_BTC_EXT.WADA` 决定：

- `WADA = 0`：按星期匹配，写入 `1 << al_week`。
- `WADA = 1`：按日期匹配，写入 `al_day`。

### 2.3 Timer定时唤醒寄存器

| 宏 | 地址 | 功能 |
|---|---:|---|
| `RSM8900_BTC_TIMER_CNT_0` | `0x0B` | Timer计数低8位 |
| `RSM8900_BTC_TIMER_CNT_1` | `0x0C` | Timer计数高4位 |
| `RSM8900_BTC_EXT` | `0x0D` | Timer时钟源/使能等扩展控制 |
| `RSM8900_BTC_FLAG` | `0x0E` | 中断/状态标志 |
| `RSM8900_BTC_CTRL` | `0x0F` | 中断使能/控制 |

当前定时唤醒使用分钟为单位，默认 `120min`：

```c
#define RSM8900_CYCWAKE_DEFAULT_MIN 120u
#define RSM8900_TIMER_COUNTER_MAX   4095u
```

Timer计数器是12位：

```c
timer_cnt[0] = (uint8)(wakeup_min & 0xFFu);
timer_cnt[1] = (uint8)((wakeup_min >> 8u) & 0x0Fu);
```

### 2.4 EXT寄存器 `0x0D`

| bit | 宏 | 当前用途 |
|---:|---|---|
| bit0 | `RSM8900_BTC_EXT_TSEL0` | Timer源选择 |
| bit1 | `RSM8900_BTC_EXT_TSEL1` | Timer源选择 |
| bit2 | `RSM8900_BTC_EXT_FSEL0` | 频率输出选择，当前未主动配置 |
| bit3 | `RSM8900_BTC_EXT_FSEL1` | 频率输出选择，当前未主动配置 |
| bit4 | `RSM8900_BTC_EXT_TE` | Timer Enable |
| bit5 | `RSM8900_BTC_EXT_USEL` | Update Timer选择 |
| bit6 | `RSM8900_BTC_EXT_WADA` | 闹钟按星期/日期选择 |
| bit7 | `RSM8900_BTC_EXT_TEST` | 测试位，当前未主动配置 |

`RSM8900_SetCycWakeMinutes()` 中的设置逻辑：

```c
extreg &= ~(TSEL0 | TSEL1 | TE | USEL);
extreg |=  (TSEL0 | TSEL1 | TE | USEL);
```

也就是：

- `TSEL0 = 1`
- `TSEL1 = 1`
- `TE = 1`
- `USEL = 1`

该配置沿用旧项目中已实现的周期唤醒逻辑，用于分钟级Timer唤醒。

### 2.5 FLAG寄存器 `0x0E`

| bit | 宏 | 含义 | 当前处理 |
|---:|---|---|---|
| bit0 | `RSM8900_BTC_FLAG_VDET` | 电压检测标志 | Init中检测，置位则清标志 |
| bit1 | `RSM8900_BTC_FLAG_VLF` | 低电压/时钟有效性标志 | Init中检测，置位则清标志 |
| bit3 | `RSM8900_BTC_FLAG_AF` | Alarm Flag | SetAlarm清除，GetAlarm判断 |
| bit4 | `RSM8900_BTC_FLAG_TF` | Timer Flag | Init判断是否定时唤醒，SetCycWake清除 |
| bit5 | `RSM8900_BTC_FLAG_UF` | Update Flag | Init中检测，置位则清标志 |

`RSM8900_Init()` 中如果检测到 `TF = 1`，会设置：

```c
RSM8900_TimerWakeup = 1u;
```

上层可以通过该变量判断本次启动是否来自RTC Timer唤醒。

### 2.6 CTRL寄存器 `0x0F`

| bit | 宏 | 含义 | 当前处理 |
|---:|---|---|---|
| bit0 | `RSM8900_BTC_CTRL_RESET` | 软件复位 | 当前未主动使用 |
| bit3 | `RSM8900_BTC_CTRL_AIE` | Alarm Interrupt Enable | SetAlarm置位，SetCycWake清除 |
| bit4 | `RSM8900_BTC_CTRL_TIE` | Timer Interrupt Enable | SetCycWake置位 |
| bit5 | `RSM8900_BTC_CTRL_UIE` | Update Interrupt Enable | SetAlarm置位，SetCycWake清除 |
| bit6 | `RSM8900_BTC_CTRL_CSEL0` | 时钟选择 | Init清CTRL时写入 |
| bit7 | `RSM8900_BTC_CTRL_CSEL1` | 时钟选择 | 当前未主动置位 |

## 3. 函数说明

### 3.1 `RSM8900_Init(void)`

功能：

- 写入默认时间。
- 读取 `RSM8900_BTC_FLAG` 判断状态标志。
- 如果 `VDET/VLF/AF/TF/UF` 任一置位，则清 `CTRL/EXT/FLAG`。
- 如果 `TF` 置位，则认为本次启动来自RTC Timer唤醒，设置 `RSM8900_TimerWakeup = 1u`。
- 写 `RSM8900_EXT_BACKUP = 0x08`，关闭备用电池供电相关电压检测功能。

调用关系：

```text
RSM8900_Init
  -> RSM8900_WriteReg(RSM8900_BTC_SEC, default_time, 7)
       -> RSM_IIC_Send_Data
  -> RSM8900_ReadOneReg(RSM8900_BTC_FLAG, &data)
       -> RSM_IIC_Receive_Data
  -> RSM8900_WriteOneReg(RSM8900_BTC_CTRL, RSM8900_BTC_CTRL_CSEL0)
  -> RSM8900_WriteOneReg(RSM8900_BTC_EXT, 0)
  -> RSM8900_WriteOneReg(RSM8900_BTC_FLAG, 0)
  -> RSM8900_WriteOneReg(RSM8900_EXT_BACKUP, 0x08)
```

注意：

- 当前初始化每次都会写默认时间。如果产品需要保存RTC真实时间，建议只在 `VLF` 等失效标志置位时才写默认时间。
- `RSM8900_TimerWakeup` 只在检测到 `TF` 时置 `1`，代码中没有自动清零接口。

### 3.2 `RSM8900_MainFunc(void)`

功能：

- 当前为空函数，保留周期任务接口。

调用关系：

```text
RSM8900_MainFunc
  -> no operation
```

### 3.3 `RSM8900_SetTime(RSM8900_time* pTime)`

功能：

- 校验时间合法性。
- 将十进制时间转换为BCD。
- 从 `0x00` 开始连续写入7个时间日历寄存器。

输入结构：

```c
typedef struct
{
    uint8  sec;
    uint8  min;
    uint8  hour;
    uint8  week;   /* 0~6 */
    uint8  date;
    uint8  month;
    uint16 year;
} RSM8900_time;
```

运行逻辑：

```text
RSM8900_SetTime
  -> RTC_Time_Vaild(pTime)
  -> DECtoBCD(sec/min/hour/date/month/year)
  -> week转换为单bit
  -> RSM8900_WriteReg(RSM8900_BTC_SEC, date, 7)
```

寄存器设置：

| 地址 | 写入内容 |
|---:|---|
| `0x00` | `DECtoBCD(sec)` |
| `0x01` | `DECtoBCD(min)` |
| `0x02` | `DECtoBCD(hour)` |
| `0x03` | `1 << week` |
| `0x04` | `DECtoBCD(date)` |
| `0x05` | `DECtoBCD(month)` |
| `0x06` | `DECtoBCD(year % 100)` |

返回值：

- `E_OK`：时间合法且写入已发起。
- `E_NOT_OK`：时间非法。

### 3.4 `RSM8900_GetTime(RSM8900_time* pTime)`

功能：

- 从 `0x00` 开始连续读取7个时间日历寄存器。
- 屏蔽无关位。
- 将BCD转换为十进制。
- 将星期单bit转换为 `0~6`。
- 再次校验时间合法性。

运行逻辑：

```text
RSM8900_GetTime
  -> RSM8900_ReadReg(RSM8900_BTC_SEC, data, 7)
  -> BCDtoDEC(data[0] & 0x7F) -> sec
  -> BCDtoDEC(data[1] & 0x7F) -> min
  -> BCDtoDEC(data[2] & 0x3F) -> hour
  -> RSM8900_GetWeekDay(data[3] & 0x7F) -> week
  -> BCDtoDEC(data[4] & 0x3F) -> date
  -> BCDtoDEC(data[5] & 0x1F) -> month
  -> BCDtoDEC(data[6]) -> year
  -> RTC_Time_Vaild(pTime)
```

返回值：

- `E_OK`：读取出的时间合法。
- `E_NOT_OK`：读取出的时间非法。

### 3.5 `RSM8900_SetAlarm(RSM8900_alarm* pAlarm)`

功能：

- 设置RTC Alarm中断。
- 写入闹钟分钟、小时、星期/日期。
- 清除 `AF`。
- 使能 `AIE` 和 `UIE`。

输入结构：

```c
typedef struct
{
    uint8 al_min;
    uint8 al_hour;
    uint8 al_week;
    uint8 al_day;
} RSM8900_alarm;
```

运行逻辑：

```text
RSM8900_SetAlarm
  -> RSM8900_ReadReg(RSM8900_BTC_EXT, ctrl, 2)
       ctrl[0] = EXT
       ctrl[1] = FLAG
  -> al_min/al_hour转换为BCD
  -> 根据 EXT.WADA 判断第三个字段写星期还是日期
  -> RSM8900_ReadOneReg(RSM8900_BTC_CTRL, &ctrlreg)
  -> 如果 AIE/UIE 已置位，先清除并写回CTRL
  -> RSM8900_WriteReg(RSM8900_BTC_ALARM_MIN, alarmvals, 3)
  -> 清 FLAG.AF
  -> 置 CTRL.AIE 和 CTRL.UIE
```

寄存器设置：

| 寄存器 | 设置 |
|---|---|
| `ALARM_MIN(0x08)` | `DECtoBCD(al_min)` |
| `ALARM_HOUR(0x09)` | `DECtoBCD(al_hour)` |
| `ALARM_WEEK_OR_DAY(0x0A)` | `1 << al_week` 或 `al_day` |
| `FLAG(0x0E)` | 清 `AF` |
| `CTRL(0x0F)` | 置 `AIE/UIE` |

注意：

- 当前代码在 `WADA = 1` 时直接写入 `al_day`，没有执行BCD转换；如果芯片手册要求日期闹钟为BCD，需要确认这里是否应改为 `DECtoBCD(al_day)`。

### 3.6 `RSM8900_GetAlarm(RSM8900_alarm* pAlarm)`

功能：

- 读取Alarm设置。
- 判断Alarm中断是否使能。
- 判断 `AF` 是否触发。

运行逻辑：

```text
RSM8900_GetAlarm
  -> RSM8900_ReadReg(RSM8900_BTC_ALARM_MIN, alarmvals, 3)
  -> RSM8900_ReadReg(RSM8900_BTC_EXT, ctrl, 2)
  -> 解析分钟/小时
  -> 根据 EXT.WADA 解析星期或日期
  -> RSM8900_ReadOneReg(RSM8900_BTC_CTRL, &ctrlreg)
  -> 如果 CTRL.AIE=1 且 FLAG.AF=1，返回1
  -> 否则返回0
```

返回值：

- `1`：Alarm中断使能且Alarm Flag已触发。
- `0`：未触发或Alarm中断未使能。

### 3.7 `RSM8900_SetCycWake(void)`

功能：

- 使用全局变量 `RSM8900_Cycwake_min` 配置周期定时唤醒。
- 默认周期为 `120min`。

运行逻辑：

```text
RSM8900_SetCycWake
  -> RSM8900_SetCycWakeMinutes(RSM8900_Cycwake_min)
```

推荐调用时机：

- 系统准备进入休眠前调用，用RTC Timer配置下一次唤醒时间。

### 3.8 `RSM8900_SetCycWakeMinutes(uint16 wakeup_min)`

功能：

- 配置RTC倒计时Timer。
- 清除旧的 `TF`。
- 使能Timer和Timer中断。

参数：

- `wakeup_min`：定时唤醒周期，单位分钟。
- 有效范围：`1~4095`。

运行逻辑：

```text
RSM8900_SetCycWakeMinutes
  -> 参数范围检查
  -> 拆分12位Timer Counter
  -> 读取 EXT/CTRL/FLAG
  -> EXT: 配置TSEL0/TSEL1/TE/USEL
  -> CTRL: 清AIE/UIE，置TIE
  -> FLAG: 清TF
  -> 写 TIMER_CNT_0/TIMER_CNT_1
  -> 写 FLAG
  -> 写 CTRL
  -> 写 EXT
```

寄存器设置：

| 寄存器 | 设置 |
|---|---|
| `TIMER_CNT_0(0x0B)` | `wakeup_min`低8位 |
| `TIMER_CNT_1(0x0C)` | `wakeup_min`高4位 |
| `FLAG(0x0E)` | 清 `TF` |
| `CTRL(0x0F)` | 清 `AIE/UIE`，置 `TIE` |
| `EXT(0x0D)` | 置 `TSEL0/TSEL1/TE/USEL` |

返回值：

- `E_OK`：参数合法并完成寄存器写入。
- `E_NOT_OK`：参数为0或大于4095。

### 3.9 `RSM8900_ReadReg(uint8 RegIndex, uint8 *pData, uint8 RegNum)`

功能：

- RTC功能层的多寄存器读取接口。
- 对读取长度做范围限制。
- 调用I2C层执行实际读操作。

运行逻辑：

```text
RSM8900_ReadReg
  -> RegNum < 1 时修正为1
  -> RegNum > RSM_MAX_IIC_DATA_LEN 时修正为RSM_MAX_IIC_DATA_LEN
  -> RSM_IIC_Receive_Data(RegIndex, pData, RegNum)
```

### 3.10 `RSM8900_ReadOneReg(uint8 RegIndex, uint8 *pData)`

功能：

- 读取单个RTC寄存器。

运行逻辑：

```text
RSM8900_ReadOneReg
  -> RSM_IIC_Receive_Data(RegIndex, pData, 1)
```

### 3.11 `RSM8900_WriteReg(uint8 RegIndex, uint8 *pData, uint8 RegNum)`

功能：

- RTC功能层的多寄存器写入接口。
- 对写入长度做范围限制。
- 调用I2C层执行实际写操作。

运行逻辑：

```text
RSM8900_WriteReg
  -> RegNum < 1 时修正为1
  -> RegNum > RSM_MAX_IIC_DATA_LEN 时修正为RSM_MAX_IIC_DATA_LEN
  -> RSM_IIC_Send_Data(RegIndex, pData, RegNum)
```

### 3.12 `RSM8900_WriteOneReg(uint8 RegIndex, uint8 Data)`

功能：

- 写入单个RTC寄存器。

运行逻辑：

```text
RSM8900_WriteOneReg
  -> RSM_IIC_Send_Data(RegIndex, &Data, 1)
```

### 3.13 `DECtoBCD(uint8 DEC)`

功能：

- 十进制转压缩BCD。

示例：

```text
23 -> 0x23
59 -> 0x59
```

### 3.14 `BCDtoDEC(uint8 BCD)`

功能：

- 压缩BCD转十进制。

示例：

```text
0x23 -> 23
0x59 -> 59
```

### 3.15 `RSM8900_GetWeekDay(uint8 weekday)`

功能：

- 将RTC星期寄存器中的单bit值转换为 `0~6`。

示例：

```text
0x01 -> 0
0x02 -> 1
0x04 -> 2
0x08 -> 3
0x10 -> 4
0x20 -> 5
0x40 -> 6
```

如果输入为0或低7位没有有效bit，返回 `0xFF`。

### 3.16 `RTC_Time_Vaild(RSM8900_time* pTime)`

功能：

- 校验时间结构体是否合法。

校验范围：

| 字段 | 范围 |
|---|---|
| year | `1971~2099`，代码中按 `pTime->year + 2000` 判断 |
| month | `1~12` |
| date | `1~31` |
| week | `< 7` |
| hour | `< 24` |
| min | `< 60` |
| sec | `< 60` |

注意：

- 当前只检查日期 `1~31`，没有区分大小月和闰年。

## 4. I2C读写逻辑

### 4.1 读寄存器

`RSM_IIC_Receive_Data(cmd, pData, length)` 采用两段式同步传输：

```text
1. I2C write:
   SlaveAddress = 0x32
   DataBuffer   = &cmd
   BufferSize   = 1
   RepeatedStart = TRUE

2. I2C read:
   SlaveAddress = 0x32
   DataBuffer   = pData
   BufferSize   = length
   RepeatedStart = TRUE
```

也就是先发送寄存器地址，再读取指定长度的数据。

### 4.2 写寄存器

`RSM_IIC_Send_Data(cmd, pData, length)` 会组包：

```text
RSM_tx_data[0] = cmd
RSM_tx_data[1] = pData[0]
RSM_tx_data[2] = pData[1]
...
```

然后一次同步发送：

```text
SlaveAddress = 0x32
BufferSize   = 1 + length
DataBuffer   = RSM_tx_data
```

最大数据长度：

```c
#define RSM_MAX_IIC_DATA_LEN    16U
#define RSM_MAX_IIC_BUFFER_LEN  (1U + RSM_MAX_IIC_DATA_LEN)
```

## 5. 典型调用流程

### 5.1 上电初始化

```text
RSM_IIC_Init()
RSM8900_Init()
```

初始化后：

- 如果 `RSM8900_TimerWakeup == 1u`，说明RTC Timer Flag在初始化时被检测到。
- 如果需要继续使用周期唤醒，休眠前重新调用 `RSM8900_SetCycWake()`。

### 5.2 设置并读取当前时间

```text
RSM8900_time time;

time.sec = 0;
time.min = 30;
time.hour = 10;
time.week = 1;
time.date = 8;
time.month = 6;
time.year = 26;

RSM8900_SetTime(&time);
RSM8900_GetTime(&time);
```

### 5.3 设置Alarm

```text
RSM8900_alarm alarm;

alarm.al_min = 30;
alarm.al_hour = 10;
alarm.al_week = 1;
alarm.al_day = 0;

RSM8900_SetAlarm(&alarm);
```

如果 `EXT.WADA = 0`，第三个字段按星期匹配。

### 5.4 设置120分钟周期唤醒

```text
RSM8900_SetCycWake();
```

等价于：

```text
RSM8900_SetCycWakeMinutes(120u);
```

### 5.5 设置自定义周期唤醒

```text
if (RSM8900_SetCycWakeMinutes(60u) == E_OK)
{
    /* 60min timer wakeup configured */
}
```

## 6. 当前实现注意事项

- `RSM8900_Init()` 当前每次都会写默认时间，这可能覆盖RTC实际保持的时间。
- `RSM8900_TimerWakeup` 置位后没有驱动内清除函数，上层使用后可按项目需要手动清零或增加接口。
- `RSM8900_SetCycWakeMinutes()` 会清 `AIE/UIE` 并置 `TIE`，因此配置Timer唤醒会关闭Alarm/Update中断使能。
- `RSM8900_SetAlarm()` 会置 `AIE/UIE`，如果同时使用Timer唤醒和Alarm，需要明确中断组合策略。
- `RSM_IIC_Receive_Data()` 和 `RSM_IIC_Send_Data()` 声明返回 `void`，但参数非法时使用了 `return false;`，从C语义上建议后续改成 `return;` 或将函数改成返回状态。
- `RTC_Time_Vaild()` 函数名拼写为 `Vaild`，当前保持现状以兼容已有调用。
- 日期合法性未区分月份天数和闰年。

