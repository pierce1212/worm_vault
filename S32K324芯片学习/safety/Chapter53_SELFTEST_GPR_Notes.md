---
date: 2026-06-01
related_task: 软件功能安全开发
progress: 3%
timeline: "true"
---
# S32K3xx Chapter 53 SELFTEST_GPR 学习笔记

> 主题：Self-test General-Purpose Registers (`SELFTEST_GPR`)  
> 芯片背景：S32K3xx，当前工程为 S32K324  
> 主要资料：`S32K3xx Reference Manual, Rev. 9, 07/2024` Chapter 53，以及 STCU2 Chapter 54 的相关流程  
> 阅读定位：这不是普通外设章节，而是功能安全自测试链路里非常小、但不能乱改的一环

## 0. 先给结论

`SELFTEST_GPR` 是给 `STCU2` 的 `LBIST` 使用的一组辅助配置寄存器。它主要配置两件事：

1. `LBIST` 每个测试 pattern 内部需要多少个 scan shift cycle。
2. `LBIST` 开始或结束时，shift clock 是否做渐进式升频/降频，也就是 `PCS`。

它不负责启动自测试，也不负责保存最终测试结果。真正调度、启动、判断自测试的是 `STCU2`。所以学习这一章时，不能把它当成一个独立外设，而要放到下面这条链路里看：

```mermaid
flowchart LR
    A["软件启动阶段"] --> B["配置时钟"]
    B --> C["使能 STCU2 clock"]
    C --> D["写 SELFTEST_GPR"]
    D --> E["配置 STCU2"]
    E --> F["写 STCU2.RUNSW 启动 BIST"]
    F --> G["硬件执行 LBIST/MBIST"]
    G --> H["Self-Test 结束后 functional reset"]
    H --> I["复位后读取 STCU2 结果并决策"]
```

老师式一句话：

> `SELFTEST_GPR` 像是 LBIST 考试前交给监考老师 STCU2 的参数纸条；纸条很小，但上面的值必须和 NXP 验证过的考试方案一致。

## 1. 为什么会有 SELFTEST_GPR

S32K3 是车规 MCU。车规系统不仅要求功能正确，还要求能发现一部分硬件随机故障。比如芯片内部某段逻辑坏了、某个 SRAM 单元异常、某条控制路径卡死，如果软件完全不知道，就可能导致危险输出。

所以芯片内部提供了 `BIST`，也就是 `Built-In Self-Test`，内建自测试。

S32K3xx 的 BIST 大体分两类：

| 类型      | 全称                        | 测什么  | 粗略理解                                   |
| ------- | ------------------------- | ---- | -------------------------------------- |
| `LBIST` | Logic Built-In Self-Test  | 数字逻辑 | 测 CPU、总线、外设控制逻辑等内部逻辑结构                 |
| `MBIST` | Memory Built-In Self-Test | 存储器  | 测 SRAM、cache、TCM、外设 RAM 等 memory array |
|         |                           |      |                                        |

`STCU2` 是 Self-Test Control Unit 2，自测试控制器。它像一个自测试调度器，负责选择测试项、启动测试、控制超时、记录结果、触发 reset 或错误反应。

`SELFTEST_GPR` 不直接管理整个 BIST，它只补充配置 LBIST 的部分底层参数。尤其是：

- LBIST scan chain 的 shift count。
- LBIST shift clock 在启动/停止时是否渐进式变化。

这就是 Chapter 53 很短却不能轻视的原因：它不是“内容少所以不重要”，而是它服务于一个更大的安全机制。

## 2. 适用芯片和地址

### 2.1 模块存在性

Reference Manual Rev.9 在 Chapter 53 明确说明：

- `SELFTEST_GPR` 不存在于 `S32K312`。
- `SELFTEST_GPR` 不存在于 `S32K311`。

STCU2 章节还说明 `S32K312`、`S32K311`、`S32K310` 不支持 LBIST。你的工程是 `S32K324`，工程头文件里也有 `S32K324_SELFTEST_GPR.h`，所以本工程目标芯片是有这个模块的。

移植时要特别注意：不要把 S32K324 的 SELFTEST_GPR 访问代码直接搬到 S32K311/S32K312 项目里。

### 2.2 基地址和寄存器

`SELFTEST_GPR` 基地址：

```text
0x403B_0000
```

寄存器非常少：

| Offset | Register | Width | Access | Reset value | 用途 |
| --- | --- | --- | --- | --- | --- |
| `0x00` | `CONFIG_REG` | 32 bit | RW | `0x0000_ADD5` | 配置 PCS |
| `0x14` | `LBIST_PROG_REG` | 32 bit | RW | `0x0003_0050` | 配置 LBIST shift count |

当前工程头文件中的结构也对应这个布局：

```c
typedef struct {
  __IO uint32_t CONFIG_REG;      /* offset: 0x0 */
  uint8_t RESERVED_0[16];
  __IO uint32_t LBIST_PROG_REG;  /* offset: 0x14 */
} SELFTEST_GPR_Type;
```

这里 `CONFIG_REG` 到 `LBIST_PROG_REG` 中间隔了 16 字节 reserved 区域，所以 `LBIST_PROG_REG` 在 `0x14`，不是 `0x04`。

## 3. 访问 SELFTEST_GPR 前的硬性条件

==**访问 `SELFTEST_GPR` 前，软件必须确保 `STCU2` block clock 已经打开。**==

手册给出的要求是：

```text
MC_ME.PRTN1_COFB3_CLKEN[REQ104] = 1
```

如果没有打开这个 clock 就访问 `SELFTEST_GPR` 空间，手册提示可能产生不可预测行为。

这句话从开发角度要这样理解：

- 不是只会“读出来是 0”。
- 不是只会“写不进去”。
- 它可能让总线访问、模块状态、安全控制逻辑进入非预期行为。

所以实际初始化顺序中，要把 `SELFTEST_GPR` 的访问放在 STCU2 clock enable 之后。

开发顺序建议：

```text
配置 mode/clock tree
  -> 使能 STCU2 clock
  -> 写 SELFTEST_GPR
  -> 写 STCU2
  -> 启动 BIST
```

## 4. 先理解 LBIST 的几个基础概念

如果只看寄存器字段，很容易知道每个位叫什么，却不知道为什么这么配。下面几个概念必须先打通。

### 4.1 LBIST 是测逻辑，不是测软件

`LBIST` 测的是芯片内部数字逻辑。它不是 CPU 跑一段 C 代码去访问每个寄存器，而是硬件把芯片内部很多触发器切到 scan test 模式，然后自动送入测试 pattern。

所以 LBIST 运行时：

- CPU 软件通常不能正常继续执行。
- 被测试的逻辑资源不能同时服务正常业务。
- 自测试结束后通常会触发 functional reset。

这和普通软件单元测试完全不一样。

### 4.2 PRPG 是什么

==**`PRPG` 是 Pseudo Random Pattern Generator，伪随机 pattern 发生器**==。

LBIST 不会手工列出每一种输入组合，因为真实芯片逻辑太复杂，组合数量极大。它使用伪随机序列产生测试 pattern，通过足够多的 pattern 来达到目标故障覆盖率。

“伪随机”的意思是：

- 看起来像随机。
- 但硬件算法是确定的。
- 同样的 seed 和配置会产生同样的 pattern 序列。

这点非常重要，因为最终 MISR 签名必须可预测。

### 4.3 Scan chain 是什么

普通工作模式下，芯片内部触发器分散在各个逻辑模块里。测试模式下，很多触发器会被串接起来，形成类似移位寄存器的一条链，这就是 `scan chain`。

你可以想象成这样：

```text
PRPG -> FF0 -> FF1 -> FF2 -> ... -> FFn -> MISR
```

每来一个 shift clock，测试数据就往链里移动一位。一个 pattern 要完整灌入 scan chain，就需要若干个 shift cycles。

### 4.4 MISR 是什么

`MISR` 是 Multi-Input Signature Register，多输入签名寄存器。

它不保存每一个测试输出，而是把大量输出压缩成一个签名值。LBIST 结束后，硬件把实际签名和 NXP 预先验证过的期望签名比较。

如果签名一致，说明这组测试没有发现异常。

如果签名不一致，说明逻辑响应和预期不同，可能存在硬件故障、配置错误、时钟错误或测试序列不匹配。

### 4.5 Pattern count 和 shift count 的区别

这是一组特别容易混的概念。

| 概念 | 含义 | 类比 |
| --- | --- | --- |
| `pattern count` | LBIST 要跑多少组测试 pattern | 考试有多少道题 |
| `shift count` | 每个 pattern 内部要移位多少个 shift cycle | 每道题要填多少格 |

`SELFTEST_GPR.LBIST_PROG_REG[LBIST_SHIFT_COUNT]` 管的是 shift count，不是 pattern count。

pattern count 通常在 STCU2/LBIST 相关配置里体现，并且和 expected MISR、覆盖率、测试时间绑定。

## 5. PCS：Peripheral Shift Clock Switching

Chapter 53 的核心概念之一是 `PCS`。这里的 PCS 可以理解为 **==Progressive Shift Clock Switching，也就是渐进式 shift clock 切换。==**

### 5.1 为什么 LBIST 会有电流冲击

LBIST 运行时，大量内部逻辑可能同时翻转。逻辑翻转越集中，瞬时电流变化越大。

如果一启动 LBIST 就直接使用较高 shift clock，芯片内部可能出现明显的 current surge。电源网络如果承受不好，可能带来：

- 电压瞬态跌落。
- 时钟或逻辑异常。
- 自测试误失败。
- 极端情况下芯片行为异常。

==**所以 PCS 的设计目的就是让 LBIST 的 shift clock 不要“猛地上来、猛地停下”，而是更平滑。**==

### 5.2 PCS 在开始阶段做什么

如果 `CONFIG_REG[PCS_ENABLE_START] = 1`，LBIST 开始时启用 PCS。

此时 shift clock 会从较慢的频率开始，例如从原始频率的 `1/16` 开始，再逐步升到原始频率。

通俗说：

> LBIST 不直接一脚油门踩到底，而是先低速，再逐步加速。

### 5.3 PCS 在结束阶段做什么

如果 `CONFIG_REG[PCS_ENABLE_END] = 1`，LBIST 结束时启用 PCS。

此时 shift clock 会从原始频率逐步降到 `1/16`。

通俗说：

> LBIST 不突然刹停，而是慢慢降速。

### 5.4 PCS_STEP_SIZE 控制什么

`PCS_STEP_SIZE` 位于 `CONFIG_REG[6:4]`，控制每个渐变台阶持续多少个 pattern。

编码关系如下：

| `PCS_STEP_SIZE` | 含义 |
| --- | --- |
| `000b` | step size = 1 pattern |
| `001b` | step size = 2 patterns |
| `010b` | step size = 3 patterns |
| `011b` | step size = 4 patterns |
| `100b` | step size = 5 patterns |
| `101b` | step size = 6 patterns |
| `110b` | step size = 7 patterns |
| `111b` | step size = 8 patterns |

所以公式是：

```text
step_size = PCS_STEP_SIZE + 1
```

手册还说明，启用 PCS 后，会在已配置 count 之外增加额外 pattern：

```text
additional_patterns = (PCS_STEP_SIZE + 1) * 16
```

这意味着 PCS 不只是改变电流曲线，也会影响 LBIST 执行时长。

### 5.5 PCS 的开发含义

从机制上讲，**PCS 是为了降低 LBIST 开始和结束时的电流冲击。**

但从项目开发上讲，不能简单得出“PCS 一定要打开”或者“PCS 一定要关闭”。因为实际量产使用的 BIST sequence、pattern count、expected MISR、clock、PCS 配置是一整套经过 NXP 验证的配置。

重点：

> 你可以理解 PCS 的原理，但不要自己随意修改 PCS 位作为量产配置。

## 6. CONFIG_REG 详解

### 6.1 基本信息

```text
Register: CONFIG_REG
Offset:   0x00
Access:   RW
Reset:    0x0000_ADD5
```

主要字段：

| Bit | Field | 含义 |
| --- | --- | --- |
| `8` | `PCS_ENABLE_END` | LBIST 结束阶段是否启用 PCS |
| `7` | `PCS_ENABLE_START` | LBIST 开始阶段是否启用 PCS |
| `6:4` | `PCS_STEP_SIZE` | PCS 每个台阶持续的 pattern 数 |
| 其他 | Reserved | 保留位 |

### 6.2 PCS_ENABLE_END

位置：

```text
CONFIG_REG[8]
```

含义：

- `0`：LBIST 结束时不做 PCS 降频。
- `1`：LBIST 结束时做 PCS 降频。

启用后，LBIST shift clock 会从原始频率逐步降到 `divide by 16`。

从电源角度看，它用于减少 LBIST 结束阶段的突变。

### 6.3 PCS_ENABLE_START

位置：

```text
CONFIG_REG[7]
```

含义：

- `0`：LBIST 开始时不做 PCS 升频。
- `1`：LBIST 开始时做 PCS 升频。

启用后，LBIST shift clock 会从 `divide by 16` 逐步升到原始频率。

从电源角度看，它用于减少 LBIST 启动瞬间的电流冲击。

### 6.4 PCS_STEP_SIZE

位置：

```text
CONFIG_REG[6:4]
```

含义：

```text
000b -> 1 pattern
001b -> 2 patterns
...
111b -> 8 patterns
```

例如 `PCS_STEP_SIZE = 101b`，实际 step size 是 6 patterns。

如果只从 `CONFIG_REG` 复位值 `0x0000_ADD5` 解码：

```text
CONFIG_REG reset = 0x0000_ADD5
bits[6:4]        = 101b
step_size        = 6 patterns
bit[7]           = 1
bit[8]           = 1
```

也就是说复位值本身体现了 PCS start/end enable，且 step size 为 6。不过，这不代表项目一定应该直接使用复位值，因为手册和应用笔记都强调必须使用 NXP 支持的完整配置。

### 6.5 Reserved 位为什么不能乱动

`CONFIG_REG` 的复位值是 `0x0000_ADD5`，不是 `0x0000_0000`。

这说明某些看起来属于 reserved 的位，复位后可能也是 1。

因此不要写这种代码：

```c
/* 不推荐：这会把未显式处理的 reserved 位清掉 */
IP_SELFTEST_GPR->CONFIG_REG =
    SELFTEST_GPR_CONFIG_REG_PCS_ENABLE_START(1u) |
    SELFTEST_GPR_CONFIG_REG_PCS_ENABLE_END(1u) |
    SELFTEST_GPR_CONFIG_REG_PCS_STEP_SIZE(5u);
```

更合理的原则是：

- 使用 NXP 提供或生成的完整配置值。
- 或在明确允许的情况下，基于原值 read-modify-write，只改允许改的位。
- 对 safety 相关 BIST 配置，优先使用 SPD/SAF/RTD 生成的配置和 API。

## 7. LBIST_PROG_REG 详解

### 7.1 基本信息

```text
Register: LBIST_PROG_REG
Offset:   0x14
Access:   RW
Reset:    0x0003_0050
```

主要字段：

| Bit | Field | 含义 |
| --- | --- | --- |
| `7:0` | `LBIST_SHIFT_COUNT` | 一个 LBIST pattern 内 scan chain 的 shift cycles 数量 |
| `31:8` | Reserved | 保留位 |

### 7.2 LBIST_SHIFT_COUNT

位置：

```text
LBIST_PROG_REG[7:0]
```

含义：

> 指定 LBIST partition 中，一个 pattern count 对应的 scan chain shift cycles 数。

这句话拆开看：

- `LBIST partition`：被 LBIST 测试的一组逻辑区域。
- `pattern count`：LBIST 要跑的 pattern 数。
- `shift cycles`：每个 pattern 需要移入 scan chain 的时钟数。

复位值低 8 位是：

```text
0x50 = 80
```

也就是默认 `LBIST_SHIFT_COUNT = 80`。

### 7.3 为什么不能随意改 shift count

`LBIST_SHIFT_COUNT` 看起来只是一个 8 bit 数值，但它实际上影响整个 LBIST 的测试语义。

如果 shift count 不正确，可能出现：

- pattern 没有完整移入 scan chain。
- MISR 压缩到的响应不再对应 NXP 的 expected signature。
- 测试覆盖率不符合安全分析假设。
- BIST 失败，或者更危险的是测试结果失去安全意义。

所以这个字段不能拿来做“缩短测试时间”的随意优化。

老师提示：

> LBIST 的配置值不是性能调参旋钮，而是安全机制的一部分。

## 8. SELFTEST_GPR 和 STCU2 的关系

Chapter 53 一开始就说，**编程 self-test GPR 是 self-test programming sequence 的一部分，具体流程要看 STCU2 章节。**

STCU2 章节给出的高层流程可以整理为：

1. 配置 clock source 和 `MC_CGM`。
2. 按 LBIST 配置写 `SELFTEST_GPR.CONFIG_REG` 和 `SELFTEST_GPR.LBIST_PROG_REG`。
3. 按 NXP 推荐配置写 `STCU2`。
4. 配置 FCCU EOUT、reset pin 等 self-test 期间相关行为。
5. 禁用可能导致 self-test abort 的 functional reset source，例如 watchdog。
6. 通过 `STCU2.RUNSW` 启动 self-test。
7. Self-Test 结束后产生 functional reset。
8. 复位后软件读取 STCU2 状态寄存器并决定后续策略。

NXP AN14969 把 STCU2 的执行分成三个阶段：

| **阶段**                      | **含义**               |
| ----------------------- | ---------------- |
| **Software configuration**  | **软件写配置**            |
| **Start of BIST execution** | **硬件开始执行 BIST**      |
| **End of BIST**             | **BIST 结束，结果可供软件读取** |

这也解释了为什么 `SELFTEST_GPR` 要在 `RUNSW` 之前写好：一旦 BIST 开始，软件不应该再尝试临时修改这些参数。

## 9. 典型开发流程

下面是从开发角度整理的伪流程。它不是可直接量产的代码，而是帮助理解模块关系。

```c
/*
 * 伪代码：表达顺序，不表达具体项目配置值。
 * 量产项目应使用 NXP validated configuration、SPD/SAF/RTD 生成配置或项目安全包。
 */
void StartSelfTest(void)
{
    ConfigureClockTreeForBist();

    EnableStcu2Clock_REQ104();

    /*
     * SELFTEST_GPR 配置必须和 NXP 支持的 LBIST 配置保持一致。
     * 不要把这些值当成普通调参项。
     */
    IP_SELFTEST_GPR->CONFIG_REG     = NXP_SUPPORTED_SELFTEST_GPR_CONFIG;
    IP_SELFTEST_GPR->LBIST_PROG_REG = NXP_SUPPORTED_LBIST_PROG;

    UnlockStcu2WriteAccess();
    ConfigureStcu2ForSupportedBistSequence();

    DisableResetSourcesThatMayAbortSelfTest();
    PutPeripheralsIntoSafeStateBeforeSelfTest();

    STCU2->RUNSW = 1u;

    /*
     * 这里不要期待像普通函数一样继续执行。
     * BIST 完成后通常会触发 functional reset。
     */
}
```

复位后的伪流程：

```c
void AfterResetStartup(void)
{
    InitClockMemoryAndBasicDriversAgain();

    if (ResetWasCausedBySelfTestDone()) {
        ReadStcu2BistResult();

        if (BistPassed()) {
            ContinueNormalStartup();
        } else {
            EnterSafeStateOrReportFault();
        }
    } else {
        ContinueOtherResetHandling();
    }
}
```

关键点：

- Self-Test 结束后的 reset 是流程的一部分，不是异常现象。
- reset 后要重新初始化时钟、内存、外设。
- MBIST 可能破坏 SRAM 内容，所以不能假设 RAM 中的状态能跨 BIST 保存。

## 10. NXP 支持配置：这一章最重要的工程原则

Reference Manual 明确强调：

- NXP 只支持 NXP 已验证的 STCU2 BIST sequence。
- 支持配置的详细编程序列在单独应用笔记或安全资料中提供。
- `SELFTEST_GPR` 的值必须和 NXP 支持配置保持一致。

NXP AN14969 也说明，S32K3xx BIST manager 运行的是 NXP validated configuration sets，例如：

| 配置 | 用途理解 |
| --- | --- |
| `BIST_SAFETYBOOT_CFG` | 启动或关机阶段使用，关注 safety boot 场景 |
| `BIST_DIAGNOSTIC_CFG` | 诊断场景使用，覆盖更完整，通常要求系统处于受控状态 |

任何对这些配置的修改都可能改变覆盖率，所以不推荐也不保证。

开发上要牢记：

> 不是“我知道这个 bit 是什么意思，所以我就可以改”。  
> 功能安全相关配置要服从 NXP 验证配置、项目 safety manual、安全分析和工具生成结果。

## 11. 一个容易困惑的点：PCS 到底应该开还是关

Chapter 53 对 PCS 的描述里提到，启用 PCS 有助于避免 LBIST 开始或结束时的电流冲击，并且推荐运行 LBIST pattern 时启用该特性。

但是 STCU2 高层编程流程里又有一步提到把 `SELFTEST_GPR.CONFIG_REG` 的 `PCS_ENABLE[8:7]` 配成 0 来禁用 PCS。

这看起来像矛盾，其实学习时要这样理解：

1. ==Chapter 53 讲的是硬件机制：PCS 可以降低 shift clock 突变带来的电流冲击。
2. ==STCU2 流程和应用笔记讲的是具体 NXP 支持配置：某些配置可能要求禁用 PCS。
3. 真正项目中要以 NXP 针对该芯片、该 BIST sequence、该 safety package 验证过的配置为准。

所以不要用单独一句“推荐启用 PCS”来覆盖具体项目配置。

最稳的原则：

```text
理解 PCS 原理，但不要脱离 NXP validated configuration 单独修改 PCS。
```

## 12. 与 SPD/SAF 的关系

NXP 的 Safety Peripheral Driver，简称 `SPD`，以及 Safety Software Framework，简称 `SAF`，会对 BIST 相关硬件做封装。

AN14969 提到，BIST manager 会抽象包括：

- `STCU2`
- `MTR`
- `SELFTEST_GPR`
- `SELFTEST_GPR_TOP`

并提供 API 来配置、运行、读取结果和分析 LBIST/MBIST 执行结果。

这对项目很重要：

- 裸写寄存器适合学习机制。
- 量产项目通常更应该用 NXP 提供的 BIST driver 和生成配置。
- 如果使用 AUTOSAR/EB Tresos/S32DS 工具链，很多值不应该由应用手写。

常见调用模式类似：

```c
Bist_Run(BIST_SAFETYBOOT_CFG);
```

或者：

```c
Bist_Run(BIST_DIAGNOSTIC_CFG);
```

但要注意，`Bist_Run()` 启动后会进入硬件自测试流程，结束后可能 functional reset。它不是一个普通“调用后返回结果”的函数。

## 13. ==开发中最容易踩的坑

### 13.1 **没开 STCU2 clock 就访问 SELFTEST_GPR**

这是 Chapter 53 点名警告的问题。

正确做法是先保证：

```text
MC_ME.PRTN1_COFB3_CLKEN[REQ104] = 1
```

然后再访问 `0x403B_0000` 区域。

### 13.2 把 SELFTEST_GPR 当普通 GPR

名字里有 `GPR`，但它不是给应用存数据的寄存器组。

它是 self-test 相关配置寄存器，配置值和 LBIST/STCU2 的验证序列绑定。

### 13.3 清掉 reserved bit

两个寄存器的 reset value 都不是简单的低字段有效、高字段全 0：

```text
CONFIG_REG reset     = 0x0000_ADD5
LBIST_PROG_REG reset = 0x0003_0050
```

这说明 reserved 区域里有非零复位位。不要在不了解的情况下写一个自己拼出来的值，把 reserved 位清掉。

### 13.4 误以为 shift count 是 pattern count

`LBIST_SHIFT_COUNT` 不是 pattern 数量。

它是一个 pattern 内 scan chain 的 shift cycles 数。

### 13.5 为了缩短时间随便改 LBIST_SHIFT_COUNT

这会破坏 LBIST 的测试语义和 expected MISR 对应关系。即使测试能跑完，也不能说明安全覆盖还成立。

### 13.6 ==忘记 BIST 后会 reset

**Self-Test 结束后产生 functional reset 是正常流程。**

因此：

- 不要期望 BIST 后继续执行下一行代码。
- 不要把关键状态只放 SRAM。
- reset 后要重新初始化系统。

### 13.7 误用 EIM/ERM 去模拟 BIST 硬件故障

NXP Community 里也提醒过：BIST 和 ERM/EIM 是不同模块。软件不能真正给 LBIST 注入一个物理自测试故障。

可以测试某些 reporting path，但不能把 ECC injection 等同于 LBIST 自身故障注入。

### 13.8 忽略 watchdog 和 functional reset source

Self-Test 运行时软件不可用，无法正常喂狗。如果 watchdog 还在运行，可能导致 self-test 被 reset 打断。

STCU2 章节建议禁用或正确处理可能导致 self-test abort 的 functional reset source，例如：

- SWT reset
- HSE SWT reset
- 某些 debug functional reset
- 不合适的 JTAG 状态

## 14. 重点寄存器速查

### 14.1 CONFIG_REG

```text
Address = 0x403B_0000 + 0x00
Reset   = 0x0000_ADD5
Access  = RW
```

| Field | Bits | 作用 | 开发备注 |
| --- | --- | --- | --- |
| `PCS_ENABLE_END` | `8` | LBIST 结束阶段启用 PCS 降频 | 是否启用取决于 NXP 支持配置 |
| `PCS_ENABLE_START` | `7` | LBIST 开始阶段启用 PCS 升频 | 是否启用取决于 NXP 支持配置 |
| `PCS_STEP_SIZE` | `6:4` | 每个 PCS 台阶持续多少 pattern | 实际值 = 字段值 + 1 |
| Reserved | others | 保留 | 不要随意改 |

### 14.2 LBIST_PROG_REG

```text
Address = 0x403B_0000 + 0x14
Reset   = 0x0003_0050
Access  = RW
```

| Field | Bits | 作用 | 开发备注 |
| --- | --- | --- | --- |
| `LBIST_SHIFT_COUNT` | `7:0` | 每个 LBIST pattern 的 scan shift cycles | 必须匹配 NXP 支持配置 |
| Reserved | `31:8` | 保留 | 不要随意清零 |

## 15. 用一句话输出每个概念

面试、代码评审或自学复述时，可以这样说。

| 概念 | 一句话 |
| --- | --- |
| `SELFTEST_GPR` | STCU2 执行 LBIST 前使用的辅助配置寄存器组 |
| `STCU2` | S32K3xx 上负责调度、启动和记录 BIST 的 self-test controller |
| `LBIST` | 用 scan chain、PRPG 和 MISR 检测数字逻辑故障的内建自测试 |
| `MBIST` | 用 memory test algorithm 检测 SRAM/cache/TCM 等存储器故障的内建自测试 |
| `PCS` | LBIST shift clock 的渐进式升频/降频机制，用于降低电流突变 |
| `PCS_STEP_SIZE` | PCS 每个频率台阶持续的 pattern 数，编码值加 1 |
| `LBIST_SHIFT_COUNT` | 一个 LBIST pattern 内 scan chain 需要的 shift cycles 数 |
| `pattern count` | LBIST 总共跑多少组测试 pattern |
| `MISR` | 把 LBIST 输出压缩成签名，用来和期望值比较 |
| `PRPG` | 产生 LBIST 伪随机测试 pattern 的硬件 |

## 16. 复习清单

读完本章后，你应该能回答这些问题：

- `SELFTEST_GPR` 是谁用的？答案：主要给 `STCU2` 的 `LBIST` sequence 使用。
- `SELFTEST_GPR` 能启动 BIST 吗？答案：不能，启动由 `STCU2.RUNSW` 完成。
- 访问 `SELFTEST_GPR` 前必须确认什么？答案：STCU2 clock 已使能，即 `REQ104 = 1`。
- `CONFIG_REG` 最重要的字段是什么？答案：`PCS_ENABLE_END`、`PCS_ENABLE_START`、`PCS_STEP_SIZE`。
- `LBIST_PROG_REG` 最重要的字段是什么？答案：`LBIST_SHIFT_COUNT`。
- `LBIST_SHIFT_COUNT` 是 pattern 数吗？答案：不是，它是每个 pattern 内的 scan shift cycle 数。
- PCS 的目的是什么？答案：让 LBIST shift clock 在开始/结束时平滑变化，降低电流冲击。
- 为什么不能随便改这些寄存器？答案：它们和 NXP 验证过的 BIST 配置、MISR 签名、覆盖率、测试时间绑定。
- BIST 结束后通常发生什么？答案：functional reset，软件复位后再读取结果。
- 哪些芯片没有 `SELFTEST_GPR`？答案：Reference Manual Rev.9 明确说 S32K312、S32K311 没有；STCU2 章节还说明 S32K310/311/312 不支持 LBIST。

## 17. 建议的学习顺序

如果你要继续深入，建议这样学：

1. 先掌握 Chapter 53，也就是本笔记内容。
2. 再读 Chapter 54 `STCU2` 的 self-test programming sequence。
3. 重点看 `STCU2.RUNSW`、watchdog、LBIST/MBIST control、status/error register。
4. 再结合 NXP AN14969 看 `BIST_SAFETYBOOT_CFG` 和 `BIST_DIAGNOSTIC_CFG`。
5. 最后看项目里是否使用 SPD/SAF/RTD 生成的 BIST 配置。

不要一开始就从一堆寄存器值背起。更好的路径是：

```text
安全目标
  -> BIST 机制
  -> STCU2 调度
  -> SELFTEST_GPR 补充配置
  -> NXP validated configuration
  -> 项目集成和复位后结果处理
```

## 18. 参考资料

- 本地资料：`C:/Users/nvtc140/Zotero/storage/GKPNECE2/S32K3xx Reference Manual.pdf`，`S32K3xx Reference Manual, Rev. 9, 07/2024`，Chapter 53 `SELFTEST_GPR` 与 Chapter 54 `STCU2`。
- 工程头文件：`BasicSoftware/integration/mcal/src/modules/BaseNXP/header/S32K324_SELFTEST_GPR.h`。
- NXP S32K3 产品页：<https://www.nxp.com/products/S32K3>。页面显示 `S32K3xx MCU Family - Reference Manual` 当前有 `Rev 12, Nov 11, 2025`，账号下载。
- NXP AN14969：<https://www.nxp.jp/docs/en/application-note/AN14969.pdf>，`Using the Built-In Self-Test (BIST) Functionality on S32K3xx`，Rev. 1.0，2026-02-26。
- NXP Community，BIST functional reset 和 BIST/ERM 区分讨论：<https://community.nxp.com/t5/S32K/BIST-Query-of-S32K312/td-p/1754184>。
- NXP Community，`BIST_DIAGNOSTIC_CFG` 与 full MBIST 后 SRAM 内容不可保留的讨论：<https://community.nxp.com/t5/S32K/STCU2-internal-errors-and-SPD-BIST-BIST-DIAGNOSTIC-CFG/m-p/1817451>。

