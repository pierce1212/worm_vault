
# CanNmAlgorithm 
![](assets/AUTOSAR%20--%20CANNM%20标准流程/CanNmAlgorithm.bmp)
这张图是 **AUTOSAR CanNm 的状态机**，描述 CAN 网络管理从休眠、被唤醒、保持通信、释放网络、再回到休眠的完整流程。

先看整体结构：

```
Bus-Sleep Mode
    -> Network Mode
        -> Repeat Message State
        -> Normal Operation State
        -> Ready Sleep State
    -> Prepare Bus-Sleep Mode
    -> Bus-Sleep Mode
```

图里的写法一般是：

```
触发事件 / 执行动作
```

例如：

```
CanNm_NetworkRequest() / Start NM-Timeout Timer; Start Repeat Message Timer; Nm_NetworkMode()
```

意思是：调用 `CanNm_NetworkRequest()` 后，CanNm 启动相关定时器，并通知上层进入 Network Mode。

## **1. Bus-Sleep Mode**  
这是 CAN 网络的休眠状态。

此时：

- ECU 不发送 NM 报文
- CAN 网络认为处于睡眠
- CanNm 已初始化，但没有参与网络通信
- 通常对应 ComM 的 `COMM_NO_COMMUNICATION`

图左上角：

```
PowerOn
CanNm_Init()
Initialization of CanNm
```

表示上电后调用：

```
CanNm_Init()
```

初始化完成后，CanNm 进入：

```
Bus-Sleep Mode
```

在这个状态下，有几种方式会被唤醒。

### **方式一：收到 NM 报文**

```
CanNm_RxIndication()
/ Nm_NetworkStartIndication()
```

也就是底层 CanIf 收到 CAN NM 报文后，通知 CanNm：

```
CanNm_RxIndication(...)
```

CanNm 发现网络上已经有其他节点醒了，于是通知上层 Nm/ComM：

```
Nm_NetworkStartIndication(NetworkHandle)
```

含义是：检测到网络启动了。

这是典型的 **Passive Wake-up**。

### **方式二：被动启动**

```
CanNm_PassiveStartUp()
```

这个一般来自 ComM/Nm 接口。含义是：本 ECU 不主动请求网络，但因为外部网络活动，需要被动加入网络。

### **方式三：主动请求网络**

```
CanNm_NetworkRequest()
```

这表示本 ECU 自己需要通信，比如应用请求 FullCom，ComM 进一步请求 Nm 保持网络。

这属于 **Active Wake-up / Active Network Request**。

## **2. Network Mode**  
一旦进入 Network Mode，说明 CanNm 已经参与 CAN 网络管理。

进入 Network Mode 时，图里写了：

```
Start NM-Timeout Timer;
Start Repeat Message Timer;
Nm_NetworkMode();
```

也就是执行：

```
Nm_NetworkMode(NetworkHandle)
```

通知上层：NM 已进入 Network Mode。

在 AUTOSAR 里，`Nm_NetworkMode()` <mark style="background: #FF5582A6;">往上通常会影响 ComM，最终 ComM 会知道网络已经处于可通信状态。</mark>

Network Mode 不是单一状态，它内部还有 3 个子状态：

```
Repeat Message State
Normal Operation State
Ready Sleep State
```

### **2.1. Repeat Message State**  （RMS 快发模式）
这是刚进入 Network Mode 后的初始状态。

图中进入 Network Mode 后，黑点直接指向：

```
Repeat Message State
```

这个状态的目的：**短时间内快速发送 NM 报文，让网络上的其他节点知道本节点已经醒来或仍然存在**。

图里写：

```
entry / Stop Bus Load Reduction
```

含义是进入 Repeat Message State 时，停止总线负载降低机制。简单说就是：这个阶段 NM 报文发送更积极，用来快速同步网络状态。

Repeat Message State 由：

```
Repeat Message Timer
```

控制持续时间。

当定时器超时：

```
Repeat Message Timer has expired
```

会根据当前是否还需要网络，选择进入两个状态之一：

```
[Network Requested] -> Normal Operation State
[Network Released]  -> Ready Sleep State
```

也就是说：

- 如果本 ECU 还需要通信，进入 `Normal Operation State`
- 如果本 ECU 不需要通信，只是被动醒来，进入 `Ready Sleep State`

### **2.2. Normal Operation State**  
这是正常网络管理状态。

进入条件一般是：

```
Network Requested
```

也就是本 ECU 主动需要网络，通常来自：

```
CanNm_NetworkRequest()
```

在这个状态下：

- 本节点保持网络唤醒
- 周期发送 NM 报文
- 接收其他节点 NM 报文
- CAN 通信一般处于 FullCom
- 对 ComM 来说，网络是被请求保持的

图里 Normal Operation State 里写：

```
entry / Start Bus Load Reduction
```

含义是进入正常操作后，可以开始总线负载降低机制，降低 NM 报文压力。

这个状态下有两个重要事件。

**收到 NM 报文**

```
CanNm_RxIndication()
/ Start NM-Timeout Timer
```

只要收到其他节点 NM 报文，就重启 NM Timeout Timer，说明网络仍然活跃。

**本节点 NM 报文发送成功**

```
CanNm_TxConfirmation()
/ Start NM-Timeout Timer
```

发送 NM 报文成功后，也刷新 NM Timeout Timer。

所以 `NM-Timeout Timer` 的作用是：**判断网络管理是否还活跃**。

### **2.3. Ready Sleep State**  
Ready Sleep 是“准备睡，但还不能马上睡”的状态。

进入这个状态通常是因为：

```
CanNm_NetworkRelease()
```

也就是本 ECU 已经不需要主动保持网络了。

从图中可以看到：

```
Normal Operation State -- CanNm_NetworkRelease() --> Ready Sleep State
```

Ready Sleep 的含义：

- 本节点释放了网络请求
- 本节点不再主动保持网络
- 但如果其他节点还在发 NM，本节点还不能立即进入 Bus-Sleep
- 它要等待 NM Timeout Timer 超时

如果在 Ready Sleep 中又有人请求网络：

```
CanNm_NetworkRequest()
```

则回到：

```
Normal Operation State
```

如果收到 Repeat Message 请求，也会回到：

```
Repeat Message State
```

例如图中：

```
Repeat Message Bit Received
CanNm_RepeatMessageRequest()
/ Start Repeat Message Timer
```

这表示网络里有节点要求大家重新进入 Repeat Message 阶段，用来重新同步网络状态。

### **2.4 Ready Sleep 到 Prepare Bus-Sleep**  
如果 Ready Sleep 状态下长时间没有收到 NM 报文，`NM-Timeout Timer` 超时：

```
NM-Timeout Timer has expired
/ Start Wait Bus-Sleep Timer;
  Nm_PrepareBusSleepMode();
```

CanNm 会进入：

```
Prepare Bus-Sleep Mode
```

并通知上层：

```
Nm_PrepareBusSleepMode(NetworkHandle)
```

含义是：网络即将进入 Bus-Sleep，请上层准备睡眠。

这一步对 ComM 很重要。ComM 收到后，会把通道状态往 `SILENT_COMMUNICATION` 或准备 NoCom 的方向推进。

## **3. Prepare Bus-Sleep Mode**  
Prepare Bus-Sleep 是真正睡眠前的等待阶段。

为什么不能直接进 Bus-Sleep？

因为要给网络一个缓冲窗口，防止刚准备睡时又有节点发 NM 或请求网络。

这个状态启动：

```
Wait Bus-Sleep Timer
```

如果等待期间没有新的网络活动，定时器超时：

```
Wait Bus-Sleep Timer has expired
/ Nm_BusSleepMode()
```

然后进入：

```
Bus-Sleep Mode
```

并通知上层：

```
Nm_BusSleepMode(NetworkHandle)
```

含义是：网络已经进入睡眠。

如果在 Prepare Bus-Sleep 期间又收到 NM 报文：

```
CanNm_RxIndication()
```

或者被动启动：

```
CanNm_PassiveStartUp()
```

或者主动请求：

```
CanNm_NetworkRequest()
```

那就重新回到：

```
Network Mode
```

也就是网络又被拉醒了。

## **4. 几个关键定时器**  
`Repeat Message Timer`

控制 Repeat Message State 持续多久。超时后根据是否有本地网络请求，进入 Normal Operation 或 Ready Sleep。

`NM-Timeout Timer`

判断 NM 网络是否还活跃。收到 NM 报文或发送成功后会刷新。Ready Sleep 中如果它超时，说明网络没人维持了，可以进入 Prepare Bus-Sleep。

`Wait Bus-Sleep Timer`

Prepare Bus-Sleep 状态下使用。给网络一个最终等待窗口，避免误睡。如果期间无新活动，进入 Bus-Sleep。

`Tx Timeout Timer`

监控 NM 报文发送确认。如果发送后迟迟没有 `TxConfirmation`，触发：

```
Nm_TxTimeoutException()
```

这通常用于诊断 NM 发送异常或 CAN 底层异常。

## **5. 和 ComM 的关系**  
这张图是 CanNm 内部状态机，但它和 ComM 强相关。

典型关系是：

```
ComM_RequestComMode(FULL_COM)
 -> Nm_NetworkRequest()
 -> CanNm_NetworkRequest()
 -> CanNm 进入 Network Mode
```

释放通信时：

```
ComM_RequestComMode(NO_COM)
 -> Nm_NetworkRelease()
 -> CanNm_NetworkRelease()
 -> Ready Sleep
 -> Prepare Bus-Sleep
 -> Bus-Sleep
```

被动唤醒时：

```
CanTrcv/CanIf 检测到 CAN 活动
 -> EcuM 确认 wakeup
 -> ComM_EcuM_WakeUpIndication()
 -> Nm_PassiveStartUp()
 -> CanNm_PassiveStartUp()
 -> Network Mode
```

## **6. 对 CAN 唤醒开发的意义**  
你开发 CAN 唤醒时，要重点保证这条链路闭环：

```
CAN 总线唤醒
 -> CanTrcv/CanIf/EcuM 检测
 -> ComM_EcuM_WakeUpIndication()
 -> ComM 允许通信
 -> CanSM 进入 FullCom
 -> Nm_PassiveStartUp 或 Nm_NetworkRequest
 -> CanNm 进入 Network Mode
 -> 收到/发送 NM 报文刷新 NM Timeout
```

如果唤醒后没有进入 Network Mode，常见问题是：

- `ComM_EcuM_WakeUpIndication()` 没有被调用
- `ComM_CommunicationAllowed(Channel, TRUE)` 没有置位
- CanSM 没有进入 `COMM_FULL_COMMUNICATION`
- NM 报文没有收到，`CanNm_RxIndication()` 没有触发
- `CanNm_NetworkRequest()` 或 `CanNm_PassiveStartUp()` 没有被调用
- NM Timeout 太短，刚醒来就回 Ready Sleep / Prepare Bus-Sleep
- CanIf/PduR/CanNm 的 NM PDU 路由配置不对

一句话总结：这张图描述的是 **CanNm 如何通过 NetworkRequest、PassiveStartUp、RxIndication 和多个定时器，在“唤醒、保持网络、释放网络、进入睡眠”之间切换**。对于 CAN 唤醒功能，重点不是只把 CAN 控制器拉起来，而是要让 ComM、CanSM、Nm、CanNm 这几层状态都一致地进入和退出 FullCom。