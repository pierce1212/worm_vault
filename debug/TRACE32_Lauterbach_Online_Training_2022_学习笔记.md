# TRACE32 Lauterbach Online Training 2022 学习笔记

资料来源：

- `H:\9.CP工具链的学习\4.调试器\劳特巴赫\Lauterbach_Online_Trainning_2022\1 Lauterbach Intro 2022.pdf`
- `H:\9.CP工具链的学习\4.调试器\劳特巴赫\Lauterbach_Online_Trainning_2022\2 软硬件安装及相关文档demo介绍.pdf`
- `H:\9.CP工具链的学习\4.调试器\劳特巴赫\Lauterbach_Online_Trainning_2022\3 TRACE32工具基础连接操作步骤.pdf`
- `H:\9.CP工具链的学习\4.调试器\劳特巴赫\Lauterbach_Online_Trainning_2022\4 TRACE32_PowerView_GUI.pdf`
- `H:\9.CP工具链的学习\4.调试器\劳特巴赫\Lauterbach_Online_Trainning_2022\5 断点.pdf`

## 1. TRACE32 调试流程总览

基础连接流程可以按下面顺序理解：

1. 确认开发板上电、调试头方向、参考电压、JTAG/SWD 连接正常。
2. 选择 CPU 或内核，例如 S32K、S32G、Cortex-M/R 等。
3. 配置调试协议、JTAG clock、多核信息、Coresight/DAP 参数。
4. 选择连接方式：`Down/NoDebug`、`Prepare`、`Attach`、`Up`。
5. 下载程序或烧写 Flash。
6. 加载符号表，关联 C/HLL 源码。
7. 设置断点、观察变量、运行程序。

这里最容易混淆的是第 4 步。`SYStem.state` 里的模式不是单纯的运行/暂停按钮，它是在控制调试器和目标芯片之间的连接状态、reset/debug 逻辑和 CPU 访问方式。

## 2. SYStem.state 中几个模式的含义

### Down / NoDebug

含义：

- 断开 TRACE32 和芯片之间的调试连接。
- TRACE32 软件刚打开时通常处于这个状态。
- 如果要修改 CPU、多核、JTAG 链路等基础配置，通常要先切到 `Down/NoDebug`。

适合场景：

- 初始配置。
- 更换目标芯片或内核。
- 调整系统级配置。

### Prepare

含义：

- 复位芯片调试逻辑，初始化 JTAG/SWD/cJTAG 和 Coresight DAP。
- 调试器不直接连接 CPU core。
- 可以通过 DAP/AP 访问 AXI、AHB、APB 等总线。

适合场景：

- CPU 已经异常，不能正常 halt/core debug。
- 需要通过 DAP 读物理内存或外设寄存器分析现场。
- 验证 DAP/JTAG 链路是否通。

### Attach

含义：

- 保持芯片原本运行状态。
- 调试器直接接入当前目标，不主动复位芯片。

适合场景：

- 不能破坏现场，例如芯片已经跑飞，需要保留 PC 和寄存器状态。
- 程序已经由 bootloader 或系统启动起来，只需要挂上去调试。
- 多核系统中 attach 到从核。

### Up

含义：

- 对芯片进行复位。
- 从复位后的第一条指令开始调试。

适合场景：

- 调试主核或启动核。
- 调试 bootloader、startup 汇编、C runtime 初始化。
- 需要重新复位目标，便于烧写或重新开始。

## 3. SYStem.state Go 和顶部工具栏 Go 的区别

这次调试里最关键的结论：

```text
SYStem.state 里的 Go != 顶部工具栏普通 Go
```

### 顶部工具栏 Go

顶部工具栏的 Go 更接近普通调试器里的 continue：

```text
从当前 PC 继续执行
命中断点后停止
一般不重新改变系统连接模式
一般不主动做 Down/Up/Attach 这类系统级动作
```

所以当程序已经停在某个断点、函数或 startup 指令时，点顶部 Go，通常就是从当前停点继续跑。

### SYStem.state 里的 Go

`SYStem.state` 里的 Go 是系统模式控制，它和当前选择的模式、reset 选项、JTAG/TRST/EnReset 设置有关。

它可能涉及：

```text
连接目标
释放或同步 reset/debug 状态
从 Down/Prepare/Attach/Up 切换到运行态
重新处理 TRST/EnReset 相关控制
```

所以它不一定等价于普通 continue。

## 4. 当前现象分析：为什么会停在 startup/reset 汇编

现象：

```text
从 SYStem.state 的 Down 状态点 Go
-> 停在 ST:00401408 cpsid i 附近
-> 再点 Go 进入 OsTask_ECU_Startup
-> 再点 Go 又回到 startup/reset 汇编附近
```

### 第一次为什么停在 startup/reset 汇编

从 `Down` 切到 `Go/Up` 本质上是在重新建立系统级调试状态。按照培训资料里对 `Up` 的解释，它会对芯片复位，并从复位后的第一条指令开始调试。

所以停在：

```asm
ST:00401408  cpsid i
```

并不奇怪。`cpsid i` 是 ARM 启动阶段常见的关中断指令，位置属于 reset/startup 早期代码，还没有进入 AUTOSAR OS task。

这时下面这些模块通常还没稳定初始化完成：

```text
OS task
EcuM_StartupTwo
BswM_Init
BswM_MainFunction
EcuM wakeup validation
BswM_EcuM_CurrentWakeup
```

因此这时不要期待：

```c
BswM_Cfg_GenericReqModeInfo_ast[0].dataMode_u16
BswM_Cfg_EcuMWkpSrcInfo_ast[0].dataState
```

已经发生业务意义上的写入。

### 第二次为什么能进入 OsTask_ECU_Startup

第一次已经把目标带到 startup/reset 汇编入口并停住。第二次如果只是继续当前 CPU，程序就会从 startup 汇编继续执行：

```text
startup 汇编
-> C runtime 初始化
-> OS 启动
-> OsTask_ECU_Startup
```

所以第二次看到：

```c
TASK(OsTask_ECU_Startup)
{
    RTM_CORECHECKPOINT_CORE_USERSTART();
    EcuM_StartupTwo();
    TerminateTask();
}
```

是合理的。

### 第三次为什么又回到 startup/reset 汇编

如果没有进入：

```c
ShutdownHook
EcuM_Shutdown
```

并且：

```c
BswM_Cfg_EcuMWkpSrcInfo_ast[0].dataState
```

一直是 0，那么第三次回到 startup/reset 汇编，不应优先怀疑 BswM 下电流程。

更可能的方向有两个：

1. 仍然在使用 `SYStem.state Go`，它不是普通 continue，而是系统级模式控制。
2. 目标发生了非软件下电路径的 reset，例如 debug reset、external reset、watchdog reset、functional reset。

取消 `ResBreak` 后现象仍一样，说明 `ResBreak` 不是根因。`ResBreak` 只影响 reset 发生后是否停在 reset 入口，但不会解释 reset 为什么发生。

下一步应查 reset 来源：

```c
Mcu_GetResetReason()
Mcu_GetResetRawValue()
```

或者直接看 S32K324 的 reset status 相关寄存器，例如 MC_RGM 的 reset event/status。

## 5. TRST / EnReset / ResBreak 的理解

### TRST

和 JTAG TAP reset 有关。勾选后，TRACE32 的系统级操作可能会控制 JTAG reset 逻辑。

### EnReset

和目标 reset 线控制有关。勾选后，TRACE32 的系统级模式切换可能会参与目标 reset 控制。

### ResBreak

表示 reset 后是否在 reset/startup 附近停住。它更像是“reset 发生后的捕获策略”，不是 reset 发生的根因。

所以：

```text
取消 ResBreak 后仍回 startup
```

只能说明：

```text
不是 ResBreak 把你额外拉回 startup
```

但不能说明没有 reset。要继续查 reset source。

## 6. 对当前 BswM/EcuM 唤醒问题的影响

当前观察值：

```text
EcuM_Prv_dataPendingWakeupEvents_u32 = 32
EcuM_Prv_dataValidatedWakeupEvents_u32 = 0
BswM_Cfg_EcuMWkpSrcInfo_ast[0].dataState = 0
WakeupSrc = 255
CanTrcv_TrcvWakeupReason = CANTRCV_WU_ERROR
```

说明：

```text
EcuM 已经有 CAN pending wakeup event
但还没有完成 validation
BswM 还没有收到 ECUM_WKSTATUS_VALIDATED
所以 WKSRC_CAN 仍然是 0
```

`BswM_Cfg_EcuMWkpSrcInfo_ast[0].dataState` 要变成 2，必须经过：

```text
EcuM_CheckValidation(32)
RE_ExeMgr_ValidateWakeup()
EcuM_ValidateWakeupEvent(32)
BswM_EcuM_CurrentWakeup(32, ECUM_WKSTATUS_VALIDATED)
BswM_Cfg_EcuMWkpSrcInfo_ast[0].dataState = 2
```

如果程序反复回到 startup/reset 阶段，就说明还没稳定跑到这条链路。

因此当前调试顺序应该是：

1. 先查清楚为什么会回 startup/reset。
2. 再看 EcuM wakeup validation。
3. 最后再看 BswM 下电规则。

不要一开始就把 `dataState = 0` 当成 BswM 规则错误。

## 7. 建议的操作流程

### 调试启动阶段

如果要调 startup、bootloader、C runtime：

```text
SYStem.state: Up/Go
允许停在 reset/startup 第一条指令
再使用顶部工具栏 Go 或 Step 继续
```

### 调试 AUTOSAR 业务阶段

如果要调 EcuM/BswM/ComM/Nm：

```text
1. 不要反复点 SYStem.state Go
2. 只用一次 SYStem.state 把目标拉起来
3. 之后全部用顶部工具栏 Go
4. 优先设置业务断点和 reset source 断点
```

推荐断点：

```c
Mcu_GetResetReason
Mcu_GetResetRawValue
EcuM_CheckValidation
RE_ExeMgr_ValidateWakeup
EcuM_ValidateWakeupEvent
BswM_EcuM_CurrentWakeup
BswM_Prv_ProcessDelayedReqst
BswM_Prv_Evaluate_Rule
```

如果怀疑 OS 或 watchdog：

```c
ShutdownHook
ProtectionHook
ErrorHook
Rtm callbacks
Watchdog service/feed function
```

### 当前建议的 TRACE32 操作

先做一轮对比实验：

```text
实验 A：
1. 从 Down 开始
2. 点一次 SYStem.state Go
3. 停在 startup 后，后面只点顶部工具栏 Go
4. 观察是否还会回 ST:00401408

实验 B：
1. 取消 EnReset/TRST/ResBreak
2. 使用 Attach 连接已经运行的目标
3. 不改变当前目标 reset 状态
4. 观察 PC 和 reset reason
```

如果实验 A 不再异常回 startup，说明主要是 `SYStem.state Go` 使用方式造成干扰。

如果实验 A 仍回 startup，但没进 `ShutdownHook/EcuM_Shutdown`，优先查 watchdog/debug/external reset。

## 8. 断点学习摘要

### 按实现原理

- Onchip breakpoint：硬件/片上断点。
- Software breakpoint：软件断点。
- ETM breakpoint：ETM 断点，依赖 ARM 部分芯片特性。

### 按使用场景

- Program breakpoint：程序运行到某个地址或函数时停下 CPU。
- Read/Write breakpoint：指定变量或内存发生读写时停下 CPU，只能是硬件断点。
- Data breakpoint：指定变量读写到某个值时停下 CPU。
- Advanced breakpoint：计数、条件等高级断点。

### 按实时性影响

- Real-time breakpoint：判断过程中不影响 CPU 实时运行。
- Intrusive breakpoint：判断过程中会不断停下 CPU，对实时性有影响。

调 AUTOSAR 启动流程时要谨慎使用侵入式断点。启动任务、OS protection、watchdog、RTM 监控都可能被断点停顿影响。

## 9. 常用命令片段

程序断点：

```text
Break.Set func_name
B.S func_name /Onchip
B.S func_name /Soft
```

临时运行到函数：

```text
Go main /Onchip
Go func_name /Soft
```

变量写断点：

```text
Var.Break.Set variable_name /Write
Var.Break.Set variable_name /ReadWrite
```

数据断点：

```text
Var.Break.Set variable_name /Write /DATA.Long 0xC
Var.Break.Set flags[3] /ReadWrite /DATA.Byte !0x1
```

条件断点：

```text
Var.Break.Set mstatic1 /Write /DATA.Long 0xC /VarCONDition vint!=0&&(plot1>0||plot2<0)
```

中断相关的断点反复命中问题：

```text
SYStem.Option.IMASKASM ON
SYStem.Option.IMASKHLL ON
```

变量运行时监控：

```text
Var.View%E variable_name
SYStem.Option DUALPORT ON
```

注意：运行时变量监控依赖目标架构和 MemAccess 设置。Soft 断点能否在 CPU running 时设置，也取决于 MemAccess；ARM Cortex 系列通常支持 running 时设置 Onchip 断点。

## 10. 当前问题的行动清单

1. 固定操作习惯：`SYStem.state` 只用于连接/复位/Attach，业务继续运行用顶部 Go。
2. 记录每次回到 `ST:00401408` 前是否发生 reset，并读取 reset reason。
3. 如果 reset reason 是 watchdog/functional reset，先处理看门狗或 RTM timing protection。
4. 如果 reset reason 是 debug/external reset，检查 TRACE32 的 `EnReset`、`TRST`、连接脚本和硬件 reset 线。
5. 稳定跑过 startup 后，再调：

```text
EcuM_CheckValidation
RE_ExeMgr_ValidateWakeup
EcuM_ValidateWakeupEvent
BswM_EcuM_CurrentWakeup
```

6. 确认 CAN wakeup 从 pending 变 validated 后，再回头看 BswM 的 `Run2PrepShutdown` 是否过早下电。

