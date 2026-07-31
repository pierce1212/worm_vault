# ComM Transmission and Reception start (CAN)
![](assets/AUTOSAR%20--%20ComM%20标准流程/ComM%20Transmission%20and%20Reception%20start%20(CAN).bmp)
这张图讲的是：**ComM 收到 Full Communication 请求后，如何启动 CAN 收发和 NM 网络管理**

流程如下：

1. **ComM 收到 FullCom 请求**  
    某个用户或 EcuM/BswM 请求：  
    `COMM_FULL_COMMUNICATION`
    
    目标是让 CAN 网络进入可收发状态。
    
2. **ComM 请求 CanSM 进入 FullCom**  
    ComM 调用：
    
    ```
    CanSM_RequestComMode(NetworkHandle, COMM_FULL_COMMUNICATION)
    ```
    
    这里 `CanSM` 是 CAN State Manager，真正负责把 CAN Controller / CanIf / CanTrcv 拉到通信状态。
    
3. **CanSM 接受请求**  
    CanSM 返回：
    
    ```
    E_OK
    ```
    
    这只表示请求被接受，不一定代表 CAN 总线已经完全可通信。
    
4. **CanSM 通知 ComM：CAN 已进入 FullCom**  
    当 CanSM 完成 CAN 控制器启动、PDU mode 设置等动作后，回调 ComM：
    
    ```
    ComM_BusSM_ModeIndication(Channel, COMM_FULL_COMMUNICATION)
    ```
    
    这一步表示：**底层 CAN 通信状态已经进入 Full Communication**。
    
5. **ComM 根据 NM Variant 决定启动 NM**  
    图里有两个分支：
    
    **Active startup：主动唤醒/主动请求网络**  
    ComM 调用：
    
    ```
    Nm_NetworkRequest(NetworkHandle)
    ```
    
    含义是：本 ECU 主动请求网络保持唤醒，并开始 NM 通信。
    
    **Passive startup：被动唤醒/只加入网络**  
    ComM 调用：
    
    ```
    Nm_PassiveStartUp(NetworkHandle)
    ```
    
    含义是：本 ECU 不是主动发起者，只是因为检测到网络活动而加入 NM。
    
6. **Nm 返回 E_OK**  
    NM 接受请求：
    
    ```
    Nm_NetworkRequest(...) = E_OK
    ```
    
    或：
    
    ```
    Nm_PassiveStartUp(...) = E_OK
    ```
    
7. **Nm 通知 ComM 进入 NetworkMode**  
    NM 状态机进入网络模式后，回调：
    
    ```
    ComM_Nm_NetworkMode(Channel)
    ```
    
    这表示 NM 网络已经处于正常网络模式，ECU 可以按照 NM 规则保持网络唤醒、参与通信。
    

简单理解：

```
ComM 想通信
  -> 请求 CanSM 打开 CAN
  -> CanSM 打开 CAN 后通知 ComM
  -> ComM 再启动 Nm
  -> Nm 进入 NetworkMode 后通知 ComM
  -> CAN 通信正式处于 FullCom/NM 网络状态
```

结合你当前 CAN 唤醒功能，这张图对应的是**唤醒被确认以后，CAN 网络从 NoCom/Sleep 拉到 FullCom 的后半段流程**。前半段是 `CanTrcv/CanIf/EcuM` 检测和确认唤醒；这张图从 `ComM` 请求 FullCom 开始。



# ComM Passive Wake-up handling (CAN)
![](assets/AUTOSAR%20--%20ComM%20标准流程/ComM%20Passive%20Wake-up%20handling%20(CAN).bmp)
这张图讲的是：**CAN 被动唤醒后，ComM 如何把网络拉到 Full Communication，并通知上层模块**。

**核心含义**  
被动唤醒是指：不是本 ECU 的应用主动请求通信，而是外部 CAN 网络活动、NM 报文或收发器唤醒事件把 ECU 唤醒。典型链路是：

```
CAN 网络活动
 -> CanTrcv/CanIf/EcuM 检测到唤醒
 -> EcuM 通知 ComM
 -> ComM 等待通信允许
 -> ComM 请求 FullCom
 -> CanSM 启动 CAN
 -> ComM 通知 RTE/BswM/Dcm
```

**流程解释**

1. **EcuM 检测到 Passive Wake-up**  
    左侧 `EcuM` 收到一个被动唤醒事件，比如 CAN 收发器检测到总线活动。
    
2. **EcuM 通知 ComM**  
    EcuM 调用：
    
    ```
    ComM_EcuM_WakeUpIndication(Channel)
    ```
    
    含义是：这个 `ComM Channel` 对应的网络被唤醒了。
    
3. **ComM 激活唤醒处理**  
    ComM 收到 `WakeUpIndication` 后，会记录该通道有唤醒事件，并准备进入通信状态。
    
    图里标注了：
    
    ```
    Activate wake-up functionality()
    ```
    
    这是 ComM 内部状态处理，不一定是一个真实 API。
    
4. **等待通信允许**  
    图中间有一句很关键：
    
    ```
    Wait for and check ComM_CommunicationAllowed(<ch>, TRUE)
    ```
    
    也就是说，ComM 不能一收到 wakeup 就无条件拉 FullCom。必须确认该通道允许通信。这个允许信号通常来自 EcuM 或 BswM：
    
    ```
    ComM_CommunicationAllowed(Channel, TRUE)
    ```
    
    如果没有这个 TRUE，ComM 可能保持等待，不会真正启动 CAN 通信。
    
5. **ComM 切到 Full Communication**  
    通信被允许后，ComM 切换到：
    
    ```
    COMM_FULL_COMMUNICATION
    ```
    
    图里用 `ref Transmission and Reception start (CAN)` 引用了你上一张图，也就是：
    
    ```
    ComM -> CanSM_RequestComMode(FULL_COM)
         -> CanSM 启动 CAN Controller/CanIf/CanTrcv
         -> CanSM 回调 ComM_BusSM_ModeIndication(FULL_COM)
         -> Nm 进入 NetworkMode
    ```
    
6. **ComM 通知 RTE**  
    ComM 进入 FullCom 后，通过 RTE mode port 通知应用 SWC：
    
    ```
    Rte_Switch_currentMode(RTE_MODE_ComMMode_COMM_FULL_COMMUNICATION)
    ```
    
    这表示应用层可以知道：当前 CAN 网络已经进入 FullCom。
    
7. **ComM 通知 BswM**  
    ComM 调用：
    
    ```
    BswM_ComM_CurrentMode(Network, COMM_FULL_COMMUNICATION)
    ```
    
    BswM 可以根据这个模式触发规则，比如切换应用模式、允许诊断、控制电源保持等。
    
8. **ComM 通知 Dcm**  
    ComM 调用：
    
    ```
    Dcm_ComM_FullComModeEntered(Network)
    ```
    
    含义是告诉诊断模块：CAN 诊断通信现在可用，Dcm 可以正常接收和发送诊断报文。
    

**一句话总结**  
这张图描述的是：**EcuM 确认 CAN 被动唤醒后，通知 ComM；ComM 在通信被允许后，请求 CANSM/NM 把 CAN 网络拉到 FullCom，然后通知 RTE、BswM 和 Dcm。**

对你的 CAN 唤醒开发来说，重点检查这几个点：

```
EcuM 是否调用 ComM_EcuM_WakeUpIndication
ComM_CommunicationAllowed(Channel, TRUE) 是否被触发
CanSM 是否成功进入 COMM_FULL_COMMUNICATION
ComM 是否通知 BswM / Dcm / RTE
```



