
# CanSM_StateMachine

![](assets/AUTOSAR%20--%20CanSM标准流程/CanSM_StateMachine.bmp)
这张图描述的是 AUTOSAR CanSM（CAN State Manager）的网络状态机。理解它最关键的一点是：

> CanSM 不负责报文内容，**而是根据 ComM 的通信请求，协调 CanIf、CAN Controller、CAN Transceiver、BswM、ComM 和 Dem，让一条 CAN 网络在“关闭、只收不发、正常通信、Bus-Off 恢复”之间切换。**

结合当前工程源码，这个状态机实际上分成两层：

1. 外层：网络通信模式状态机  
    `NO_COMMUNICATION / SILENT_COMMUNICATION / FULL_COMMUNICATION`
2. 内层：Full Communication 下的 Bus-Off Recovery 状态机  
    `BUS_OFF_CHECK / NO_BUS_OFF / RESTART_CC / RECOVERY_L1 / RECOVERY_L2`

---

## 1. 三种通信模式到底有什么区别

|通信模式|CAN Controller|PDU 模式|发送|接收|Transceiver|
|---|---|---|---|---|---|
|No Communication|STOPPED/SLEEP|OFFLINE|禁止|禁止|通常 STANDBY|
|Silent Communication|通常 STARTED|TX_OFFLINE|禁止|允许|NORMAL|
|Full Communication|STARTED|ONLINE|允许|允许|NORMAL|

其中最容易混淆的是 Silent Communication：

- Controller 通常仍然运行。
- CAN 接收仍然有效。
- 只关闭发送路径。
- 当前工程通过 `CanIf_SetPduMode(..., CANIF_TX_OFFLINE)` 实现，见 [CanSM_InternalStateTransition.c (line 1591)](E:/github/ECAS_qirui_Single_Chamber/BasicSoftware/src/bsw/CanSM/src/CanSM_InternalStateTransition.c:1591)。

**所以 Silent Communication 不是“CAN 关闭”，而是“只监听，不发送”。**

---

# 2. 图中状态与当前工程源码的对应关系

图中的名称属于概念模型，当前工程使用的枚举名称略有不同。

|图中的状态|当前工程对应状态|
|---|---|
| `CANSM_UNINITED` | `CANSM_BSM_S_NOT_INITIALIZED` |
| `CANSM_BSM_RequestedDeinit` | `CANSM_BSM_S_PRE_NOCOM` |
| `CANSM_NO_COMM_REQUESTED` | `CANSM_BSM_S_NOCOM` |
| `CANSM_SILENT_COMM_REQUESTED` | `CANSM_BSM_S_SILENTCOM` |
| `CANSM_FULL_COMM_REQUESTED` | `CANSM_BSM_S_PRE_FULLCOM` → `CANSM_BSM_S_FULLCOM` |
| `CANSM_ONLINE` | `FULLCOM + CANSM_S_NO_BUS_OFF` |
| `CANSM_CHECK_BUS_OFF` | `CANSM_S_BUS_OFF_CHECK` |
| `CANSM_BUS_OFF_RECOVERY_START` | `CANSM_S_RESTART_CC` |
| `CANSM_BUS_OFF_RECOVERY_WAIT` | `CANSM_S_RESTART_CC_WAIT`、`RECOVERY_L1/L2` |
| `CANSM_BUS_OFF_RECOVERY_END` |恢复后重新进入 `CANSM_S_BUS_OFF_CHECK` |
| `CANSM_NM_TX_EXCEPTION_RECOVER` | `CANSM_BSM_S_TX_TIMEOUT_EXCEPTION` |

工程中的完整网络模式和 Bus-Off 子状态枚举可见 [CanSM.h (line 171)](E:/github/ECAS_qirui_Single_Chamber/BasicSoftware/src/bsw/CanSM/api/CanSM.h:171)。

---

# 3. 上电与初始化

图中的路径是：

```
PowerOff
   ↓ PowerOn
CANSM_UNINITED
   ↓ CanSM_Init()
CANSM_BSM_RequestedDeinit
   ↓ 初始化完成
CANSM_NO_COMM_REQUESTED
```

## 3.1 PowerOn → UNINITED

刚上电时，CanSM 尚未初始化：

- 不接受正常的通信模式切换。
- Controller 状态未知。
- Transceiver 状态未知。
- Bus-Off Recovery 没有启动。

## 3.2 调用 `CanSM_Init()`

当前工程初始化时，对每个 CanSM Network 做以下处理：

- 网络状态先设为 `CANSM_BSM_S_NOT_INITIALIZED`
- Bus-Off 子状态设为 `CANSM_BOR_IDLE`
- Bus-Off 计数器清零
- Bus-Off Recovery 禁用
- 默认请求模式设为 `COMM_NO_COMMUNICATION`
- Controller 软件状态设为 `UNINIT`
- Dem Bus-Off 事件报告为 `PASSED`

随后进入：

```
CANSM_BSM_S_PRE_NOCOM
```

相关初始化见 [CanSM_Init.c (line 231)](E:/github/ECAS_qirui_Single_Chamber/BasicSoftware/src/bsw/CanSM/src/CanSM_Init.c:231)。

## 3.3 `PRE_NOCOM` 的意义

图里的 `CANSM_BSM_RequestedDeinit` 对应这个过渡阶段。

它不是最终 No Communication，而是在执行“关闭网络”的动作，例如：

1. 停止 CAN Controller。
2. 如果配置了 Transceiver，将其切到 Standby。
3. 如果支持 Partial Networking，处理 Wake-up Flag。
4. 等待 `CanSM_ControllerModeIndication()`。
5. 等待 `CanSM_TransceiverModeIndication()`。
6. 全部完成后进入稳定的 `NOCOM`。
7. 通知 ComM 当前已是 `COMM_NO_COMMUNICATION`。

使用过渡态的原因是：`CanIf_SetControllerMode()` 等接口通常是异步请求，函数返回 `E_OK` 只代表请求被接受，真正完成需要等待 indication。

---

# 4. No Communication → Full Communication

当 ComM 调用：

```
CanSM_RequestComMode(network, COMM_FULL_COMMUNICATION);
```

当前工程从：

```
CANSM_BSM_S_NOCOM
        ↓
CANSM_BSM_S_PRE_FULLCOM
        ↓
CANSM_BSM_S_FULLCOM
```

请求判定见 [CanSM_RequestComMode.c (line 202)](E:/github/ECAS_qirui_Single_Chamber/BasicSoftware/src/bsw/CanSM/src/CanSM_RequestComMode.c:202)。

## 4.1 PRE_FULLCOM 内部动作

典型子状态顺序是：

```
Transceiver → NORMAL
        ↓ 等待 TransceiverModeIndication
Controller → STOPPED
        ↓ 等待 ControllerModeIndication
Controller → STARTED
        ↓ 等待 ControllerModeIndication
PDU Mode → ONLINE
        ↓
FULLCOM
```

为什么先 STOPPED 再 STARTED？

因为 CanSM 要保证 Controller 从一个确定状态重新启动，特别是初始化、唤醒、波特率切换或错误恢复后，不能假定 Controller 原来已经处于正确状态。

当前工程的实现位于 [CanSM_InternalStateTransition.c (line 1271)](E:/github/ECAS_qirui_Single_Chamber/BasicSoftware/src/bsw/CanSM/src/CanSM_InternalStateTransition.c:1271)。

进入 Full Communication 后会执行：

- `CanSM_CurrNw_Mode_en = CANSM_BSM_S_FULLCOM`
- Bus-Off 计数器清零
- Bus-Off 状态设为 `CANSM_S_BUS_OFF_CHECK`
- 启用 Bus-Off Recovery
- `CanIf_SetPduMode(..., CANIF_ONLINE)`
- 通知 BswM：`CANSM_BSWM_FULL_COMMUNICATION`
- 通知 ComM：`COMM_FULL_COMMUNICATION`

因此，进入 Full Communication 后，并不是直接认定网络完全健康，而是先进入 `BUS_OFF_CHECK` 观察期。

---

# 5. Full Communication 内部的正常路径

图中 Full Communication 的正常内部路径是：

```
BUS_OFF_RECOVERY_END
        ↓
CHECK_BUS_OFF
        ↓ 稳定时间内无 Bus-Off
ONLINE
```

当前工程可以理解为：

```
进入 FULLCOM
   ↓
CANSM_S_BUS_OFF_CHECK
   ↓ 网络稳定达到 BorTimeTxEnsured
CANSM_S_NO_BUS_OFF
```

## 5.1 `CANSM_S_BUS_OFF_CHECK`

这个状态表示：

> CAN 已经恢复发送，但暂时还不能证明网络已经稳定。

进入该状态时启动 `tiTx`，即发送稳定性检查定时器。

如果满足以下任一条件：

- 在 `CanSMBorTimeTxEnsured` 内没有再次发生 Bus-Off；或者
- 配置了 Tx Confirmation Polling，并检测到成功的 Tx/Rx notification，

则进入：

```
CANSM_S_NO_BUS_OFF
```

随后：

- Bus-Off Counter 清零。
- 停止稳定性计时器。
- `Dem_SetEventStatus(..., DEM_EVENT_STATUS_PASSED)`。

代码见 [CanSM_Main.c (line 150)](E:/github/ECAS_qirui_Single_Chamber/BasicSoftware/src/bsw/CanSM/src/CanSM_Main.c:150)。

## 5.2 `CANSM_ONLINE` 与 `CANSM_S_NO_BUS_OFF`

图里的 `CANSM_ONLINE` 可以理解为：

```
FULLCOM
+ Controller STARTED
+ PDU ONLINE
+ Bus-Off Recovery 已启用
+ 已经过稳定性检查
```

它不是一个简单的 PDU 状态，而是“Full Communication 已稳定”的逻辑状态。

---

# 6. Bus-Off 是什么

CAN Controller 的发送错误计数器 TEC 超过限制后，Controller 进入 Bus-Off：

- Controller 不能再发送报文。
- CAN Driver/CanIf 向 CanSM 调用：

```
CanSM_ControllerBusOff(ControllerId);
```

- CanSM 开始恢复流程。

**<mark style="background: #FFB86CA6;">Bus-Off 本质上是 Controller 硬件错误状态；CanSM 的任务是控制恢复节奏，避免节点不断立即重连、反复冲击总线。</mark>**

---

# 7. ONLINE/CHECK_BUS_OFF → Bus-Off Recovery

Bus-Off 可能发生在：

- 已稳定的 `ONLINE/NO_BUS_OFF`
- 恢复后的 `CHECK_BUS_OFF`
- 甚至又一次恢复过程中

收到 `CanSM_ControllerBusOff()` 后，当前工程会：

1. 根据 ControllerId 找到对应 CanSM Network。
2. 设置 Bus-Off 标志。
3. 通知 BswM：
    
    ```
    CANSM_BSWM_BUS_OFF
    ```
    
4. 对外把 BusSM 通信模式降为：
    
    ```
    COMM_SILENT_COMMUNICATION
    ```
    
5. 通知 ComM 当前暂时只能 Silent Communication。
6. 向 Dem 报告：
    
    ```
    DEM_EVENT_STATUS_PREFAILED
    ```
    
7. 进入 Controller 重启流程。

对应代码见 [CanSM_ControllerBusoff.c (line 44)](E:/github/ECAS_qirui_Single_Chamber/BasicSoftware/src/bsw/CanSM/src/CanSM_ControllerBusoff.c:44)。

这里有一个重要细节：

> Bus-Off 时，ComM 被通知为 Silent Communication，但当前工程不一定把外层 `CanSM_CurrNw_Mode_en` 改成真正的 `SILENTCOM`。

因为这是 Full Communication 内部的临时错误恢复，而不是上层主动请求的 Silent Communication。恢复完成后仍要自动回到 Full Communication。

---

# 8. Bus-Off Recovery 的详细跳转

可以把完整流程理解为：

```
Bus-Off indication
       ↓
报告 BswM BUS_OFF、Dem PREFAILED
       ↓
Controller STOP/START
       ↓
RESTART_CC_WAIT
       ↓ Controller 已 STARTED
选择 L1 或 L2 恢复等待
       ↓ 恢复时间到
PDU ONLINE
       ↓
BUS_OFF_CHECK
       ↓ 稳定时间内无 Bus-Off
NO_BUS_OFF / ONLINE
```

## 8.1 `BUS_OFF_RECOVERY_START` / `CANSM_S_RESTART_CC`

这个阶段主要做 Controller 重启：

```
CanIf_SetControllerMode(controller, CAN_CS_STARTED);
```

如果一个 Network 绑定多个 CAN Controller，则通常先保证所有 Controller 停止，再统一重新启动。

同时：

- Bus-Off Recovery Timer 开始计时。
- PDU 发送在恢复完成前保持不可用。
- 对 ComM 表现为 Silent Communication。

## 8.2 `RESTART_CC_WAIT`

`CanIf_SetControllerMode()` 是异步请求。

CanSM 要等待：

```
CanSM_ControllerModeIndication(
    ControllerId,
    CAN_CS_STARTED
);
```

如果在 `CanSMModeRequestRepetitionTime` 内没有收到 indication：

- 回到 `RESTART_CC`
- 再次发 Controller STARTED 请求
- 重试次数增加

超过 `CanSMModeRequestRepetitionMax` 后，会报告运行时错误 `CANSM_E_MODE_REQUEST_TIMEOUT`。

当前工程配置为：

- 重试周期：70 ms
- 最大重试次数：5

配置见 [CanSM_PBcfg.c (line 99)](E:/github/ECAS_qirui_Single_Chamber/BasicSoftware/src/bsw/CanSM/CanSM_PBcfg.c:99)。

## 8.3 选择 L 1 还是 L 2

Controller 启动成功后，根据 Bus-Off Counter 选择恢复级别：

```
BusOffCounter < BorCounterL1ToL2
    → BUS_OFF_RECOVERY_L1

BusOffCounter >= BorCounterL1ToL2
    → BUS_OFF_RECOVERY_L2
```

L 1 用于偶发 Bus-Off，恢复较快。

L 2 用于连续、频繁 Bus-Off，恢复等待更长，目的是避免故障节点频繁重新接入总线。

## 8.4 L 1 恢复

等待：

```
tiRecover >= CanSMBorTimeL1
```

当前工程主网络 `Can_Network` 的配置是：

- `BorTimeL1 = 100 ms`
- `BorCounterL1ToL2 = 10`

也就是说，在稳定性计数被清零之前，前面的恢复尝试使用 100 ms 等待。

L 1 等待完成后：

1. Bus-Off Counter 加一。
2. PDU Mode 切回 `CANIF_ONLINE`。
3. 对外重新通知 `COMM_FULL_COMMUNICATION`。
4. 进入 `CANSM_S_BUS_OFF_CHECK`。
5. 启动 `BorTimeTxEnsured` 稳定性检查。

## 8.5 L 2 恢复

当：

```
BusOffCounter >= 10
```

主网络进入 L 2。

当前工程主网络配置：

- `BorTimeL2 = 1 s`

L 2 与 L 1 的动作基本一样，但等待时间更长。当前实现中 Bus-Off Counter 只在 L 1 超时恢复时递增；进入 L 2 后不会继续无限增加。

Bus-Off 跳转核心代码见 [CanSM_ControllerBusoff.c (line 244)](E:/github/ECAS_qirui_Single_Chamber/BasicSoftware/src/bsw/CanSM/src/CanSM_ControllerBusoff.c:244)。



```
L1 = 快速恢复，适合偶发 Bus-Off
L2 = 延迟恢复，适合连续 Bus-Off
```
---

# 9. 为什么恢复后不是直接进入 ONLINE

恢复时间到后，CanSM 会先：

```
CanIf_SetPduMode(..., CANIF_ONLINE);
CanSM_currBOR_State_en = CANSM_S_BUS_OFF_CHECK;
```

而不是直接进入 `NO_BUS_OFF`。

原因是：

> Controller 能重新启动，不等于总线故障已经消失。

例如 CAN_H/CAN_L 短路还在，Controller 一开始发送就可能再次 Bus-Off。

因此恢复过程包含两个时间概念：

- `BorTimeL1/BorTimeL2`：在重新允许发送前等待多久。
- `BorTimeTxEnsured`：重新发送后，需要稳定运行多久，才认为故障真正消失。

当前主网络配置：

| 参数                      | 值      |
| ----------------------- | ------ |
| `CanSMBorTimeL1`        | 100 ms |
| `CanSMBorTimeL2`        | 1 s    |
| `CanSMBorTimeTxEnsured` | 1 s    |
| `CanSMBorCounterL1ToL2` | 10     |

配置来源见 [RTA_BIP_CanSM_EcucValues.arxml (line 41)](E:/github/ECAS_qirui_Single_Chamber/BasicSoftware/ecu_config/bsw/gen/RTA_BIP_CanSM_EcucValues.arxml:41)。

工程中 `CanSM_MainFunction()` 运行于 10 ms 周期任务，因此生成代码中的：

```
BorTimeL1_u16       = 10 ticks
BorTimeL2_u16       = 100 ticks
BorTimeTxEnsured    = 100 ticks
```

分别对应 100 ms、1 s、1 s。调度位置见 [Rte.c (line 20912)](E:/github/ECAS_qirui_Single_Chamber/BasicSoftware/src/rte/gen/Rte.c:20912)。

---

# 10. 连续 Bus-Off 时计数器怎么工作

假设主网络持续存在物理故障：

```
第一次 Bus-Off
→ L1 等待 100 ms
→ Counter = 1
→ 恢复发送
→ 再次 Bus-Off

第二次 Bus-Off
→ L1 等待 100 ms
→ Counter = 2
→ 再次恢复
...
第十次恢复
→ Counter 达到 10

下一次 Bus-Off
→ L2 等待 1 s
→ 再恢复
```

如果恢复后网络稳定运行超过 `BorTimeTxEnsured = 1 s`：

```
BUS_OFF_CHECK
→ NO_BUS_OFF
→ Counter 清零
→ Dem PASSED
```

因此 Counter 统计的不是 ECU 生命周期内累计 Bus-Off 次数，而是：

> 当前这一轮“尚未证明稳定”的连续 Bus-Off 恢复次数。

只要稳定期通过，计数器就会清零。

---

# 11. Full → Silent Communication

当 ComM 请求：

```
COMM_SILENT_COMMUNICATION
```

CanSM 执行：

1. 禁用正常 Bus-Off Recovery 处理。
2. 外层状态改为 `CANSM_BSM_S_SILENTCOM`。
3. `CanIf_SetPduMode(..., CANIF_TX_OFFLINE)`。
4. CAN Controller 保持 STARTED。
5. 通知 BswM 为 Silent Communication。
6. 通知 ComM 切换完成。

路径是：

```
FULLCOM
   ↓ Silent Communication requested
SILENTCOM
```

这对应图左侧从 Full 到 `CANSM_SILENT_COMM_REQUESTED` 的箭头。

---

# 12. Silent → Full Communication

收到 Full Communication 请求后：

1. PDU Mode 从 `TX_OFFLINE` 切回 `ONLINE`。
2. 外层状态设为 `FULLCOM`。
3. Bus-Off Counter 清零。
4. Bus-Off Recovery 重新启用。
5. Bus-Off 子状态进入 `BUS_OFF_CHECK`。
6. 开始 `BorTimeTxEnsured` 稳定性检查。
7. 通知 BswM 和 ComM。

代码见 [CanSM_InternalStateTransition.c (line 1668)](E:/github/ECAS_qirui_Single_Chamber/BasicSoftware/src/bsw/CanSM/src/CanSM_InternalStateTransition.c:1668)。

---

# 13. Full/Silent → No Communication

当 ComM 请求 `COMM_NO_COMMUNICATION` 时：

```
FULLCOM 或 SILENTCOM
          ↓
CANSM_BSM_S_PRE_NOCOM
          ↓
CANSM_BSM_S_NOCOM
```

主要动作包括：

1. 禁止 PDU 通信。
2. 停止 Controller。
3. 等待 ControllerModeIndication。
4. Transceiver 切到 Standby。
5. 如果支持 PN，清理和检查 Wake-up Flag。
6. 最后通知 ComM 已进入 No Communication。

需要注意：当前工程在 Bus-Off Recovery、Controller 重启、波特率切换或 Tx Timeout 恢复过程中，会限制通信模式请求，避免几个异步状态机互相打断。相关保护条件见 [CanSM_RequestComMode.c (line 127)](E:/github/ECAS_qirui_Single_Chamber/BasicSoftware/src/bsw/CanSM/src/CanSM_RequestComMode.c:127)。

---

# 14. Tx Timeout Exception Recovery

图中的：

```
CANSM_NM_TX_EXCEPTION_RECOVER
```

不是普通 Bus-Off。

它通常表示上层或 CanIf 发现某个发送请求长时间没有得到发送确认，于是调用：

```
CanSM_TxTimeoutException(Channel);
```

当前工程只在以下条件接受：

```
外层状态 = FULLCOM
Bus-Off 状态 = NO_BUS_OFF
```

然后：

```
FULLCOM
  ↓ TxTimeoutException
停止 Controller
  ↓ 等待 STOPPED indication
重新启动 Controller
  ↓ 等待 STARTED indication
PDU ONLINE
  ↓
FULLCOM + NO_BUS_OFF
```

本质上是对 CAN Controller 做一次受控重启。

入口条件见 [CanSM_TxTimeoutException.c (line 46)](E:/github/ECAS_qirui_Single_Chamber/BasicSoftware/src/bsw/CanSM/src/CanSM_TxTimeoutException.c:46)，内部恢复状态机见 [CanSM_InternalStateTransition.c (line 1758)](E:/github/ECAS_qirui_Single_Chamber/BasicSoftware/src/bsw/CanSM/src/CanSM_InternalStateTransition.c:1758)。

它和 Bus-Off Recovery 的区别是：

|项目|Bus-Off Recovery|Tx Timeout Exception|
|---|---|---|
|触发来源|CAN Controller 硬件进入 Bus-Off|发送长时间无确认|
|Dem|通常报告 Bus-Off PREFAILED/FAILED|不一定作为 Bus-Off 报告|
|L 1/L 2 延时|有|没有|
|Bus-Off Counter|使用|不使用|
|核心动作|延迟、重启、稳定性检查|停止并重启 Controller|

---

# 15. 一次完整 Bus-Off 时序示例

以主网络第一次 Bus-Off 为例：

```
t0:
FULLCOM + NO_BUS_OFF
Controller STARTED
PDU ONLINE

t1:
CAN Driver 检测到 Bus-Off
→ CanSM_ControllerBusOff()

t1:
BswM ← CANSM_BSWM_BUS_OFF
ComM ← COMM_SILENT_COMMUNICATION
Dem  ← PREFAILED
BOR  ← RESTART_CC

t1～:
CanIf_SetControllerMode(STARTED)
等待 ControllerModeIndication

Controller 启动完成:
BusOffCounter=0 < 10
→ RECOVERY_L1

等待 100 ms:
PDU → ONLINE
BusOffCounter → 1
ComM ← COMM_FULL_COMMUNICATION
BOR → BUS_OFF_CHECK
启动 1 s 稳定性定时器

如果 1 s 内再次 Bus-Off:
→ 再走 L1
→ Counter 继续增加

如果 1 s 内没有 Bus-Off:
BOR → NO_BUS_OFF
Counter → 0
Dem → PASSED
网络恢复完成
```

最后可以用一句话概括整张图：

> ComM 决定“需要什么通信模式”，CanSM 负责把 Controller、Transceiver 和 PDU 安全地切换到那个模式；一旦发生 Bus-Off，CanSM 临时降级为 Silent Communication，按 L 1/L 2 延时重启 Controller，恢复发送后再经过稳定性观察，最终回到正常 Full Communication。
