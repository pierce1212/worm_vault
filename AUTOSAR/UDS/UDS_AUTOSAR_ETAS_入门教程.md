---
date: 2026-05-28
related_task: UDS协议
progress: 15%
timeline:
---
# UDS / AUTOSAR DCM / ETAS 配置入门教程


本文面向第一次接触 AUTOSAR 诊断的同事，目标是让你能读懂本项目里 UDS 是怎么跑起来的，并且知道以后要新增 DID、写 DID、安全解锁、例程控制、DTC 时应该改哪里、查哪里、测什么。

项目路径示例基于当前工程：

```text
E:\github\ECAS_qirui_Single_Chamber
```

UDS 基础资料可对照 `E:\UDS` 下的文档，尤其是：

```text
E:\UDS\UDS全图指南总结.md
E:\UDS\ISO14229-2013中文版_UDS诊断.pdf
E:\UDS\ISO-15765-2 中文.pdf
E:\UDS\关于AUTOSAR中DCM（ISO14229 UDS）模块的理解.pdf
```

## 1. 先建立一张图

本项目是 AUTOSAR + ETAS/RTA 生成的诊断栈。先不要从某一个服务开始死抠，先记住这一条链路：

```text
诊断仪
  |
  | CAN ID: 0x7DF / 0x72B
  v
CanIf
  |
  v
CanTp
  |
  v
PduR
  |
  v
Dcm DSL: 协议、连接、会话、缓冲区、定时
  |
  v
Dcm DSD: 判断 SID 是否支持、会话/安全是否允许
  |
  v
Dcm DSP: 具体服务处理，比如 0x22/0x2E/0x27/0x31/0x19
  |
  v
RTE / SWC 回调
  |
  v
应用代码返回数据或结果
  |
  | CAN ID: 0x7AB
  v
诊断仪
```

一句话理解：UDS 报文进来以后，底层通信栈负责把 CAN 帧拼成诊断请求，DCM 负责判断“这个服务当前能不能做”，然后把真正的数据读取、写入、安全算法、例程动作交给应用层 SWC。

## 2. UDS 报文最小基础

UDS 是 ISO 14229 定义的诊断应用层协议。常见报文由 `SID`、可选 `SubFunction` 和数据参数组成。

无子功能服务：

```text
SID + Data
```

有子功能服务：

```text
SID + SubFunction + Data
```

正响应一般是：

```text
Response SID = Request SID + 0x40
```

例子：

```text
请求: 10 03
含义: 进入扩展会话
正响应: 50 03 ...

请求: 22 F1 00
含义: 读取 DID F100
正响应: 62 F1 00 ...

请求: 2E F1 02 01
含义: 写 DID F102，数据为 01
正响应: 6E F1 02
```

负响应固定以 `0x7F` 开头：

```text
7F <原请求SID> <NRC>
```

例子：

```text
7F 2E 33
```

含义是 `0x2E WriteDataByIdentifier` 被拒绝，原因是 `0x33 securityAccessDenied`，通常是没解锁或安全等级不够。

## 3. AUTOSAR 诊断模块分工

本项目里你会反复看到这些模块：

| 模块 | 作用 | 本项目主要查看位置 |
| --- | --- | --- |
| `CanIf` | CAN 驱动上层接口，按 CAN ID 收发 I-PDU | `BasicSoftware/ecu_config/bsw/gen/RTA_BIP_CanIf_EcucValues.arxml` |
| `CanTp` | ISO 15765-2 传输层，处理单帧/首帧/连续帧/流控 | `BasicSoftware/ecu_config/bsw/gen/RTA_BIP_CanTp_EcucValues.arxml` |
| `PduR` | PDU 路由，把 CanTp 请求转给 Dcm，把 Dcm 响应转给 CanTp | `BasicSoftware/src/bsw/PduR/PduR_PBcfg.c` |
| `Dcm DSL` | 诊断协议、连接、PDU、缓冲区、P2/P2*/S3 定时 | `BasicSoftware/src/bsw/Dcm/Dcm_Lcfg_Dsl.c` |
| `Dcm DSD` | 服务表，判断 SID、子功能、会话、安全等级 | `BasicSoftware/src/bsw/Dcm/Dcm_Lcfg_Dsd.c` |
| `Dcm DSP` | 服务内部配置，例如 DID、RID、安全等级、DTC 服务 | `BasicSoftware/src/bsw/Dcm/Dcm_Lcfg_DspUds.c` |
| `Dem` | DTC、事件、冻结帧、扩展数据、清故障 | `BasicSoftware/src/bsw/Dem` |
| `RTE/SWC` | 具体读写数据、Seed/Key、Routine 动作 | `ASW/SWC/Dcm_Swc/src/Dcm_Swc.c`, `ASW/SWC/DiagUT/src/DiagUT.c` |

重要习惯：`BasicSoftware/src/bsw` 里的 DCM、PduR、Dem 大多是工具生成代码，不建议手改。你应该通过 ETAS/ISOLAR/配置源修改，再重新生成。应用行为逻辑一般写在 `ASW/SWC/...` 的 `PROTECTED REGION` 里。

## 4. 本项目的 DoCAN 地址和 PDU

本项目通过 CAN 做 UDS，也就是常说的 DoCAN。

在 `BasicSoftware/SysDesc/SysDesc_Can.arxml` 里能看到诊断帧：

| 用途 | Frame Trigger | 十进制 ID | 十六进制 ID | 方向 |
| --- | --- | ---: | ---: | --- |
| 功能寻址请求 | `UdsRxFnc_Trgr` | `2015` | `0x7DF` | Tester -> ECU |
| 物理寻址请求 | `UdsRxPhy_Trgr` | `1835` | `0x72B` | Tester -> ECU |
| 物理响应 | `UdsTxPhy_Trgr` | `1963` | `0x7AB` | ECU -> Tester |

含义：

- `0x7DF` 是功能寻址，通常用于广播式请求，例如扫描 ECU 是否支持某服务。功能寻址请求一般不应该触发某些会改变 ECU 状态的操作。
- `0x72B` 是物理寻址，请求发给本 ECU。
- `0x7AB` 是本 ECU 给诊断仪的响应 ID。

`BasicSoftware/SysDesc/DEXT/RTA_BIP_CanTpConfig.arxml` 里也能看到 CanTp 连接名，例如：

```text
UdsRxFnc_0x7df_Tester_0x00E0
UdsRxPhy_0x740_ETAS_0x0001
UdsTxPhy_0x748_ETAS_0x0001
```

注意：这个 DEXT 文件里的 `0x740/0x748` 命名看起来和当前 `SysDesc_Can.arxml` 的实际触发 ID `0x72B/0x7AB` 不一致。排查实车或台架通信时，优先以当前生成的 `SysDesc_Can.arxml`、CanIf 生成配置和最终 DBC/ARXML 为准。

CanTp 当前关键配置：

| 配置项 | 当前值 |
| --- | --- |
| Addressing format | `STANDARD` |
| Functional request | `TA-TYPE FUNCTIONAL` |
| Physical request/response | `TA-TYPE PHYSICAL` |
| Padding | `true` |
| Block Size | `8` |
| Timeout Bs | `0.25 s` |
| Timeout Br | `0.1 s` |

## 5. 从 CAN 到 DCM 的路由

PduR 是路由中心。查 `BasicSoftware/src/bsw/PduR/PduR_PBcfg.c` 可以看到：

请求方向：

```text
CanIf Rx
  -> CanTp_RxIndication
  -> CanTp 组包
  -> PduR_CanTpRxToUp
  -> Dcm_StartOfReception
  -> Dcm_CopyRxData
  -> Dcm_TpRxIndication
```

响应方向：

```text
Dcm
  -> PduR_DcmTransmit
  -> CanTp_Transmit
  -> PduR_CanTpTxToUp
  -> Dcm_CopyTxData
  -> Dcm_TpTxConfirmation
  -> CanIf Tx
```

当前 PduR 把两个诊断请求 PDU 路由给 DCM：

```text
UdsRxFnc_CanTp2PduR_Can_Network_Channel_CAN -> Dcm
UdsRxPhy_CanTp2PduR_Can_Network_Channel_CAN -> Dcm
```

当前 DCM 响应用一个 Tx PDU 发回 CanTp：

```text
UdsTxPhy_Dcm2PduR_Can_Network_Channel_CAN -> CanTp
```

如果你遇到“CAN 上有请求但 DCM 没反应”，排查顺序一般是：

```text
CAN ID 是否对 -> CanIf 是否收 -> CanTp 是否组包 -> PduR 是否路由到 Dcm -> Dcm 服务/会话/安全是否允许
```

## 6. DCM DSL: 协议、连接和定时

DSL 可以理解为 DCM 的“接待层”：哪个协议进来、用哪个连接、用多大缓冲区、P2/P2* 时间是多少。

主要文件：

```text
BasicSoftware/src/bsw/Dcm/Dcm_Cfg_DslDsd.h
BasicSoftware/src/bsw/Dcm/Dcm_Lcfg_Dsl.c
```

当前关键值：

| 项目 | 当前配置 |
| --- | --- |
| DCM MainFunction 周期 | `DCM_CFG_TASK_TIME_US = 10000`, 即 `10 ms` |
| S3Server | `DCM_CFG_S3MAX_TIME = 5000000 us`, 即 `5 s` |
| 协议 | `DCM_UDS_ON_CAN` |
| Dem Client | `DemConf_DemClient_DemClient_DoCAN` |
| Rx buffer | `2048` bytes |
| Tx buffer | `2048` bytes |
| Protocol max response size | `4095` bytes |
| P2 adjust | `10000 us` |
| P2* adjust | `10000 us` |
| Rx PDU 数量 | `2` |
| Tx PDU 数量 | `1` |

当前 DCM Rx PDU ID：

```text
DcmConf_DcmDslProtocolRx_UdsRxPhy_PduR2Dcm_Can_Network_Channel_CAN = 0x0
DcmConf_DcmDslProtocolRx_UdsRxFnc_PduR2Dcm_Can_Network_Channel_CAN = 0x1
```

当前 DCM Tx PDU ID：

```text
DcmConf_DcmDslProtocolTx_UdsTxPhy_Dcm2PduR_Can_Network_Channel_CAN = 0x0
```

`Dcm_Lcfg_Dsl.c` 中的主连接：

```text
ProtocolType        = DCM_UDS_ON_CAN
RxConnectionId      = 0
RxTesterSourceAddr  = 0x1
TxPduId             = PduRConf_PduRSrcPdu_UdsTxPhy_Dcm2PduR_Can_Network_Channel_CAN
```

项目里 `ASW/SWC/Rip/src/Rip_DiagUT.c` 还做了协议启停门控：

```text
Rip_DiagUT_DcmProtocolStart()
Rip_DiagUT_DcmProtocolStop()
```

它会检查：

```text
ProtocolID == DCM_UDS_ON_CAN
TesterSourceAddress == Dcm_Cfg_Dsl_pcst->mainConnCfg_pcast[...].rxTesterSrcAddr_u16
ConnectionId == Dcm_Cfg_Dsl_pcst->mainConnCfg_pcast[...].rxConnId_u16
```

如果 `Rip_DiagUT_DcmProtocol_TC_ENABLE != 0`，协议启动可能被拒绝。调试 DCM 完全无响应时，这个门控也要查。

## 7. 会话和安全等级的掩码

这是 AUTOSAR DCM 初学者最容易看错的地方。

本项目支持的 session ID 在 `Dcm_Lcfg_Dsl.c`：

```text
Dcm_DsldSupportedSessions_cau8[] = {0x1, 0x2, 0x3}
```

对应 `Dcm_Lcfg_DspUds.c`：

| Session ID | 名称 | P2 | P2* | Boot |
| ---: | --- | ---: | ---: | --- |
| `0x01` | Default Session | `50000 us` | `2000000 us` | `DCM_NO_BOOT` |
| `0x02` | Programming Session | `50000 us` | `2000000 us` | `DCM_OEM_BOOT` |
| `0x03` | Extended Diagnostic Session | `50000 us` | `2000000 us` | `DCM_NO_BOOT` |

但是生成代码里的 allowed session 不是直接写 `0x01/0x02/0x03`，而是写“掩码”。掩码按数组索引算：

| Session | 数组索引 | 掩码 |
| --- | ---: | ---: |
| Default `0x01` | `0` | `0x1` |
| Programming `0x02` | `1` | `0x2` |
| Extended `0x03` | `2` | `0x4` |

所以：

| 掩码 | 含义 |
| ---: | --- |
| `0x7` | Default + Programming + Extended |
| `0x6` | Programming + Extended |
| `0x5` | Default + Extended |
| `0x4` | Extended only |
| `0x2` | Programming only |
| `0x1` | Default only |

安全等级也一样。本项目支持的 security level 数组：

```text
Dcm_Dsld_supported_security_acu8[] = {0x0, 0x1, 0x3}
```

对应：

| Security Level | 含义 | 数组索引 | 掩码 |
| ---: | --- | ---: | ---: |
| `0x00` | Locked | `0` | `0x1` |
| `0x01` | Unlocked_L1 | `1` | `0x2` |
| `0x03` | Unlocked_L3 | `2` | `0x4` |

所以 DSD 表里看到 `Allowed security levels = 0x2`，意思不是“安全等级 2”，而是“数组索引 1 的掩码”，也就是 `Unlocked_L1`。

## 8. DCM DSD: 当前支持哪些 UDS 服务

服务表在：

```text
BasicSoftware/src/bsw/Dcm/Dcm_Lcfg_Dsd.c
```

当前 `ETAS_ServiceTable_DoCAN` 一共 12 个服务：

| SID | 服务 | 会话掩码 | 安全掩码 | 本项目含义 |
| ---: | --- | ---: | ---: | --- |
| `0x10` | DiagnosticSessionControl | `0x7` | all | 会话切换，支持 `01/02/03` |
| `0x11` | ECUReset | `0x7` | all | ECU reset，支持子功能 `01/03` |
| `0x14` | ClearDiagnosticInformation | `0x5` | all | 清 DTC，Default + Extended |
| `0x19` | ReadDTCInformation | `0x5` | all | 读 DTC，Default + Extended |
| `0x22` | ReadDataByIdentifier | `0x7` | all | 读 DID |
| `0x27` | SecurityAccess | `0x6` | all | 安全访问，Programming + Extended |
| `0x28` | CommunicationControl | `0x6` | all | 通信控制，Programming + Extended |
| `0x2E` | WriteDataByIdentifier | `0x4` | `0x2` | 写 DID，需要 Extended + L1 |
| `0x2F` | InputOutputControlByIdentifier | `0x4` | all | IO 控制，仅 Extended |
| `0x31` | RoutineControl | `0x6` | all | 例程控制，Programming + Extended |
| `0x3E` | TesterPresent | all | all | 保持会话 |
| `0x85` | ControlDTCSetting | `0x5` | all | DTC 开关，Default + Extended |

`0x27 SecurityAccess` 的子功能在本项目里有细分：

| 子功能 | 含义 | 允许会话 |
| ---: | --- | --- |
| `0x01` | requestSeed for L1 | Extended only |
| `0x02` | sendKey for L1 | Extended only |
| `0x05` | requestSeed for L3 | Programming only |
| `0x06` | sendKey for L3 | Programming only |

所以测试 L1 解锁时，正确前置步骤是：

```text
10 03
27 01
27 02 <key>
```

测试 L3 解锁时，正确前置步骤是：

```text
10 02
27 05
27 06 <key>
```

## 9. DCM DSP: DID 配置和应用回调

DID 的生成配置在：

```text
BasicSoftware/src/bsw/Dcm/Dcm_Lcfg_DspUds.c
BasicSoftware/src/bsw/Dcm/Dcm_Cfg_DspUds.h
```

应用回调主要在：

```text
ASW/SWC/Dcm_Swc/src/Dcm_Swc.c
```

当前 DID 数量较多，典型包括：

```text
0x000A, 0x000B, 0x010B, 0x0112,
0xD001, 0xD901, 0xE101,
0xF100, 0xF101, 0xF102, 0xF180, 0xF184, 0xF186, 0xF187, 0xF188,
0xF18A, 0xF18B, 0xF18C, 0xF190, 0xF191, 0xF192, 0xF193, 0xF194,
0xF195, 0xF197, 0xF199, 0xF19E, 0xF1A8,
0xFC00 ...,
0xFD00 ...
```

几个适合入门的 DID：

| DID | 长度 | 读/写 | 应用函数 | 说明 |
| ---: | ---: | --- | --- | --- |
| `0xF100` | `10` | Read | `RE_DataServices_DID_0xF100_Read_func` | 软件版本号 |
| `0xF101` | `10` | Read | `RE_DataServices_DID_0xF101_Read_func` | 硬件版本号 |
| `0xF102` | `1` | Read/Write | `RE_DataServices_DID_0xF102_Read_func`, `RE_DataServices_DID_0xF102_Write_func` | 通过 RTE 读写 NvM 风格数据 |
| `0xF186` | `1` | Read | `RE_DataServices_DID_0xF186_Read_func` | 读取当前会话 |

以 `F100` 为例，请求：

```text
22 F1 00
```

DCM 的大致处理：

```text
0x22 服务允许？
  -> 当前会话是否允许？
  -> DID F100 是否存在？
  -> DID F100 是否允许读？
  -> 调 RTE ReadData 接口
  -> 进入 ASW/SWC/Dcm_Swc/src/Dcm_Swc.c
  -> RE_DataServices_DID_0xF100_Read_func(Data)
  -> 正响应 62 F1 00 <10 bytes data>
```

`F102` 更适合理解写 DID。它的配置：

```text
DID = 0xF102
TotalByteSize = 1
FixedLength = TRUE
Read Session = 0x5  -> Default + Extended
Write Session = 0x4 -> Extended only
Write Security = 0x2 -> Unlocked_L1
```

所以写 `F102` 的完整流程应该是：

```text
10 03              # 进入 Extended
27 01              # 请求 L1 seed
27 02 <4字节key>   # 发送 L1 key
2E F1 02 01        # 写 DID F102 = 01
```

应用代码里 `RE_DataServices_DID_0xF102_Write_func` 会：

```text
检查 NvM buffer 长度 >= DID 配置长度
把请求数据复制到 Type_Array_DIDF102
Rte_Write_PRP_DIDF102NvBlock_VDP_DIDF102(DcmDidBuffer)
MCUResetCounterStart = 0
```

如果没有进 Extended，会看到类似：

```text
7F 2E 7F
```

含义：service not supported in active session。ETAS 代码里这个 NRC 在服务表中配置为 `0x7F`。

如果没解锁 L1，会看到类似：

```text
7F 2E 33
```

含义：securityAccessDenied。

## 10. SecurityAccess: Seed / Key 在哪里

安全访问配置在：

```text
BasicSoftware/src/bsw/Dcm/Dcm_Lcfg_DspUds.c
```

应用实现主要在：

```text
ASW/SWC/DiagUT/src/DiagUT.c
BasicSoftware/src/UDSDiag/Dcm_App/Dcm_App.c
```

当前有两个安全等级：

| 等级 | UDS Level | Seed 长度 | Key 长度 | 失败次数阈值 | 延时 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `Unlocked_L1` | `0x01` | `4` | `4` | `3` | `1000 * DcmTaskTime = 10 s` |
| `Unlocked_L3` | `0x03` | `4` | `4` | `3` | `1000 * DcmTaskTime = 10 s` |

L1 的 RTE 端口：

```text
Rte_Call_SecurityAccess_Unlocked_L1_GetSeed
Rte_Call_SecurityAccess_Unlocked_L1_CompareKey
```

应用函数：

```text
SecurityAccess_Unlocked_L1_GetSeed()
SecurityAccess_Unlocked_L1_CompareKey()
```

L1 逻辑：

```text
GetSeed:
  GenerateSeed(Seed)
  保存 Seed_Generate

CompareKey:
  用 Seed_Generate 拼成 uint32 seed
  GenerateKey_L1(seed)
  比较诊断仪传来的 4 字节 key
```

`GenerateSeed()` 和 `GenerateKey_L1()` 在：

```text
BasicSoftware/src/UDSDiag/Dcm_App/Dcm_App.c
```

当前 L1 key 算法：

```c
key = (uint32)((((seed >> 4U) ^ seed) << 3U) ^ seed);
```

L3 当前实现是固定 seed/key 风格：

```text
SecurityAccess_Unlocked_L3_GetSeed()
  返回 Dcm_Seed[0..3]

SecurityAccess_Unlocked_L3_CompareKey()
  比较 Dcm_Key[4..7]
```

这更像演示逻辑，不适合当量产安全算法。量产项目通常需要 OEM 指定算法、Seed 随机性、重放防护、失败计数/NvM 持久化等。

## 11. RoutineControl: 例程控制

服务 `0x31` 用于让 ECU 执行一个动作，例如擦除、校验、标定动作、内部测试等。

本项目配置在：

```text
BasicSoftware/src/bsw/Dcm/Dcm_Lcfg_DspUds.c
```

应用实现主要在：

```text
ASW/SWC/DiagUT/src/DiagUT.c
```

当前 RID：

| RID | 允许会话 | 支持动作 | 应用函数 |
| ---: | --- | --- | --- |
| `0x000C` | all | Start/Stop/RequestResults | 生成配置存在，应用函数可能在 RTE 映射中 |
| `0x0203` | Extended only | Start | `RoutineServices_DcmDspRoutine_Routine_Control_203_Start` |
| `0xABFE` | all | Start | `RoutineServices_DcmDspRoutine_Routine_Control_ABFE_Start` |
| `0xABFF` | Extended only | Start/RequestResults | `RoutineServices_DcmDspRoutine_Routine_Control_ABFF_Start`, `..._ABFF_RequestResults` |
| `0xD003` | all | Start | 生成配置存在，应用函数可能在 RTE 映射中 |

请求格式：

```text
31 <RoutineControlType> <RID高字节> <RID低字节> [data]
```

常见子功能：

```text
01 startRoutine
02 stopRoutine
03 requestRoutineResults
```

例如启动 `0x0203`：

```text
10 03
31 01 02 03
```

因为 `0x0203` 配置为 Extended only，所以不进 `10 03` 直接请求会被会话拒绝。

## 12. DTC / DEM: 0x19 和 0x14 怎么工作

DTC 服务入口在 DCM：

```text
0x19 ReadDTCInformation
0x14 ClearDiagnosticInformation
```

真正的故障事件、DTC 编号、状态位、冻结帧和扩展数据由 DEM 管。

DCM DSL 协议行绑定了：

```text
DemConf_DemClient_DemClient_DoCAN
```

DEM 相关配置可查：

```text
BasicSoftware/src/bsw/Dem/Dem_Cfg_Client.h
BasicSoftware/src/bsw/Dem/Dem_Cfg_Client_DataStructures.c
BasicSoftware/src/bsw/Dem/Dem_Cfg_DTC_DataStructures.c
BasicSoftware/src/bsw/Dem/Dem_Cfg_Events_DataStructures.c
BasicSoftware/src/bsw/Dem/Dem_Cfg_EnvFreezeFrame.h
BasicSoftware/src/bsw/Dem/Dem_Cfg_EnvExtendedData.h
```

当前 DoCAN Client 使用 ISO14229 DTC translation：

```text
DEM_DTC_TRANSLATION_ISO14229_1
```

项目里有很多 DTC，比如：

```text
DTC_0x411001_Event
DTC_0x411002_Event
...
DTC_0xC01101_Event
```

应用侧示例在：

```text
ASW/SWC/DiagUT/src/DiagUT.c
```

典型接口：

```text
Rte_Call_Event_DTC_0x411001_Event_SetEventStatus(...)
Rte_Call_Event_DTC_0x411001_Event_ClearPrestoredFreezeFrame()
Rte_Call_EvtInfo_DTC_0x411001_Event_GetEventStatus(...)
Rte_Call_OpCycle_DemOpCycle_DEM_POWER_SetCycleQualified()
```

`DiagUT.c` 中还有一个测试变量：

```text
Test_DTCfault
```

它在 `SetEventStatus_Adapt_Appl()` 附近被用来触发 `DTC_0x411001_Event` 的 failed/passed 测试逻辑。实际项目里，DTC 应该由具体监控逻辑根据传感器、执行器、通信、供电等条件调用 `Dem_SetEventStatus` 或 RTE 封装接口上报。

0x19 当前支持子功能：

| 子功能 | 含义 |
| ---: | --- |
| `0x01` | reportNumberOfDTCByStatusMask |
| `0x02` | reportDTCByStatusMask |
| `0x04` | reportDTCSnapshotRecordByDTCNumber |
| `0x06` | reportDTCExtendedDataRecordByDTCNumber |
| `0x0A` | reportSupportedDTC |

常用测试：

```text
19 02 FF   # 读取所有状态掩码匹配的 DTC
19 0A      # 读取支持的 DTC
14 FF FF FF # 清全部 DTC group
```

清 DTC 时，如果 DEM event 配了 ClearEventAllowed 回调，应用可以拒绝清除。

## 13. 常用测试报文

下面的例子假设用物理请求 ID `0x72B` 发送，接收响应 ID `0x7AB`。

保持会话：

```text
3E 00
```

预期：

```text
7E 00
```

进入扩展会话：

```text
10 03
```

预期：

```text
50 03 <P2/P2*>
```

读取软件版本：

```text
22 F1 00
```

预期：

```text
62 F1 00 <10 bytes>
```

读取硬件版本：

```text
22 F1 01
```

预期：

```text
62 F1 01 <10 bytes>
```

一次读多个 DID，本项目 `0x22` 单次最多配置 `5` 个 DID：

```text
22 F1 00 F1 01
```

预期：

```text
62 F1 00 <data> F1 01 <data>
```

读取当前会话：

```text
22 F1 86
```

预期数据通常能反映当前 DCM session。

写 F102：

```text
10 03
27 01
27 02 <4 bytes key>
2E F1 02 01
```

读取 DTC：

```text
19 02 FF
```

清 DTC：

```text
14 FF FF FF
```

启动 Routine `0x0203`：

```text
10 03
31 01 02 03
```

## 14. 如何新增或修改 DID

推荐流程：

1. 在 ETAS/ISOLAR 诊断配置里新增 `DcmDspDid`。
2. 配 DID 值，例如 `0xF1xx`。
3. 配数据长度、固定长度、数据类型、endianness。
4. 配 `DcmDspDataUsePort`。本项目常见是 `USE_DATA_ELEMENT_SPECIFIC_INTERFACES` 或同步 client/server RTE。
5. 配读权限：Allowed Read Session / Security。
6. 如果需要写，配写权限：Allowed Write Session / Security，并启用 WriteData。
7. 重新生成 BSW/RTE。
8. 到 `ASW/SWC/Dcm_Swc/src/Dcm_Swc.c` 中实现对应 `Read_func` / `Write_func` 的用户逻辑。
9. 编译。
10. 用 `0x22` / `0x2E` 测试。

新增只读 DID 时，最小检查清单：

```text
DID 是否出现在 Dcm_Lcfg_DspUds.c 的 DID 表
DID TotalByteSize 是否符合诊断规范
Read Session/Security 是否符合需求
RTE 是否生成 ReadData 调用
Dcm_Swc.c 是否实现 Read_func
0x22 正响应长度是否正确
```

新增可写 DID 时，多检查：

```text
Write Session/Security 是否符合需求
是否需要 Extended + SecurityAccess
Write_func 是否检查长度和数据合法性
写入后是否需要 NvM 持久化
写入失败时是否设置合理 NRC
```

本项目可参考 `F102`：

```text
配置: BasicSoftware/src/bsw/Dcm/Dcm_Lcfg_DspUds.c
读:   RE_DataServices_DID_0xF102_Read_func
写:   RE_DataServices_DID_0xF102_Write_func
```

## 15. 如何新增 SecurityAccess 等级

推荐流程：

1. 在 DCM 配置中新增 `DcmDspSecurityRow`。
2. 分配 UDS security level，比如 `0x05`。注意奇数 seed、偶数 key 的子功能关系。
3. 配 SeedSize、KeySize。
4. 配 delay time、power on delay、最大失败次数。
5. 配 GetSeed / CompareKey 使用的 RTE port。
6. 重新生成 BSW/RTE。
7. 在应用 SWC 中实现 `GetSeed` 和 `CompareKey`。
8. 把需要保护的服务/DID/Routine 的 Allowed Security 改成对应掩码。
9. 测试正确 key、错误 key、失败次数、延时、会话切换后安全状态。

注意：服务或 DID 里填的 `Allowed Security` 是掩码，不是 UDS security level 原值。新增安全等级以后，一定要重新确认 `Dcm_Dsld_supported_security_acu8[]` 的顺序和对应掩码。

## 16. 如何新增 Routine

推荐流程：

1. 在 DCM 配置里新增 `DcmDspRoutine`。
2. 分配 RID，例如 `0xABxx`。
3. 配支持的控制类型：Start、Stop、RequestResults。
4. 配输入/输出参数。
5. 配允许会话和安全等级。
6. 配 usePort，让 DCM 通过 RTE 调应用。
7. 重新生成 BSW/RTE。
8. 在 `ASW/SWC/DiagUT/src/DiagUT.c` 里实现对应 routine 函数。
9. 测试 `31 01 <RID>`、`31 02 <RID>`、`31 03 <RID>`。

Routine 常见负响应：

| NRC | 含义 | 常见原因 |
| ---: | --- | --- |
| `0x12` | subFunctionNotSupported | 没配置 Start/Stop/Result |
| `0x13` | incorrectMessageLengthOrInvalidFormat | 请求长度和输入参数不匹配 |
| `0x22` | conditionsNotCorrect | 应用条件不允许执行 |
| `0x31` | requestOutOfRange | RID 不存在或当前条件不支持 |
| `0x33` | securityAccessDenied | 安全等级不够 |
| `0x78` | responsePending | 例程异步执行，还没完成 |

## 17. 如何新增 DTC

推荐流程：

1. 在 DEM 配置里新增 Event。
2. 配 Event 到 DTC 的映射，例如 `0x41xxxx`。
3. 配 DTC kind、severity、status availability mask。
4. 配 operation cycle，例如 `DemOpCycle_POWER`。
5. 如果需要，配置 freeze frame DID set。
6. 如果需要，配置 extended data record。
7. 配 ClearEventAllowed、EventAvailable 等回调。
8. 重新生成 BSW/RTE。
9. 在应用监控逻辑中调用 RTE Event 接口上报 failed/passed。
10. 用 `19 02 FF`、`19 04 <DTC>`、`19 06 <DTC>`、`14 FF FF FF` 测试。

应用上报故障的核心不是 DCM，而是 DEM：

```text
Monitor 检测到故障
  -> Rte_Call_Event_xxx_SetEventStatus(DEM_EVENT_STATUS_FAILED)
DEM 更新 ISO14229 status byte
0x19 读取时 DCM 从 DEM 取 DTC
```

故障恢复：

```text
Monitor 检测到恢复
  -> Rte_Call_Event_xxx_SetEventStatus(DEM_EVENT_STATUS_PASSED)
```

## 18. 常见 NRC 与本项目排查方向

| NRC | 名称 | 本项目常见排查点 |
| ---: | --- | --- |
| `0x11` | serviceNotSupported | `Dcm_Lcfg_Dsd.c` 服务表是否有该 SID |
| `0x12` | subFunctionNotSupported | 子功能表是否配置，比如 `0x27/0x31/0x19` |
| `0x13` | incorrectMessageLengthOrInvalidFormat | DID 长度、Routine 参数长度、CanTp 拼包 |
| `0x22` | conditionsNotCorrect | 应用回调条件不满足，mode rule 或业务状态拒绝 |
| `0x31` | requestOutOfRange | DID/RID/DTC group 不存在，或参数越界 |
| `0x33` | securityAccessDenied | 未解锁或安全掩码不对 |
| `0x35` | invalidKey | SecurityAccess key 算错 |
| `0x36` | exceedNumberOfAttempts | 错误 key 次数超过阈值 |
| `0x37` | requiredTimeDelayNotExpired | 安全访问延时未结束 |
| `0x78` | requestCorrectlyReceivedResponsePending | 异步处理未完成 |
| `0x7E` | subFunctionNotSupportedInActiveSession | 当前 session 不支持该子功能 |
| `0x7F` | serviceNotSupportedInActiveSession | 当前 session 不支持该服务，本项目服务表里常配置为这个 NRC |

排查 `0x2E F102` 失败时的例子：

```text
收到 7F 2E 7F:
  查当前是否已经 10 03
  查 DSD 里 0x2E Allowed sessions = 0x4
  查 F102 extended config Write Session = 0x4

收到 7F 2E 33:
  查是否已经 27 01 / 27 02 解锁 L1
  查 DSD 里 0x2E Allowed security = 0x2
  查 F102 extended config Write Security = 0x2

收到 7F 2E 13:
  查请求长度是否是 2E F1 02 + 1 byte data
  查 F102 TotalByteSize = 1
```

## 19. 修改配置后的验证清单

每次改诊断配置后，建议按这个顺序验：

```text
1. 生成代码是否更新
2. RTE 接口是否生成
3. 应用回调是否实现
4. 编译是否通过
5. CAN ID 是否正确
6. 单帧请求是否有响应
7. 多帧请求/响应是否正常
8. 默认会话下权限是否符合预期
9. 扩展/编程会话下权限是否符合预期
10. 安全未解锁/已解锁行为是否符合预期
11. 错误长度、错误 DID/RID、错误 key 是否返回合理 NRC
12. DTC 类服务是否和 DEM event 状态一致
```

## 20. 初学者最推荐的上手路线

建议按下面 5 步练习，不要一开始就碰刷写：

1. 只测 `3E 00` 和 `10 03`，确认 DCM 链路通。
2. 测 `22 F1 00`、`22 F1 01`，理解 0x22 如何读应用数据。
3. 测 `22 F1 02`，再读代码看它如何从 RTE/NvM 风格 buffer 取值。
4. 跑通 `10 03 -> 27 01 -> 27 02 -> 2E F1 02 01`，理解会话和安全掩码。
5. 测 `19 02 FF`，再看 DEM event 和 DTC 配置，理解 DTC 不在 DCM 里“手写返回”，而是 DCM 从 DEM 查询。

等这 5 步跑通以后，再看 `0x31 RoutineControl`、`0x2F IOCBI`、`0x28 CommunicationControl` 和刷写服务，会轻松很多。

## 21. 本项目诊断文件速查

| 想查什么 | 文件 |
| --- | --- |
| CAN 诊断 ID | `BasicSoftware/SysDesc/SysDesc_Can.arxml` |
| CanTp 连接 | `BasicSoftware/SysDesc/DEXT/RTA_BIP_CanTpConfig.arxml` |
| PduR 路由 | `BasicSoftware/src/bsw/PduR/PduR_PBcfg.c` |
| DCM 周期/S3/PDU ID 宏 | `BasicSoftware/src/bsw/Dcm/Dcm_Cfg_DslDsd.h` |
| DCM 协议行/连接/缓冲区 | `BasicSoftware/src/bsw/Dcm/Dcm_Lcfg_Dsl.c` |
| DCM 服务表 | `BasicSoftware/src/bsw/Dcm/Dcm_Lcfg_Dsd.c` |
| DCM DID/Security/Routine 配置 | `BasicSoftware/src/bsw/Dcm/Dcm_Lcfg_DspUds.c` |
| DID 读写应用代码 | `ASW/SWC/Dcm_Swc/src/Dcm_Swc.c` |
| Security/Routine/DTC demo 应用代码 | `ASW/SWC/DiagUT/src/DiagUT.c` |
| Seed/Key 辅助算法 | `BasicSoftware/src/UDSDiag/Dcm_App/Dcm_App.c` |
| DCM 协议启动门控 | `ASW/SWC/Rip/src/Rip_DiagUT.c` |
| ETAS DCM 集成模板 | `BasicSoftware/integration/src/bsw/Dcm/integration` |
| DEM DTC/Event 配置 | `BasicSoftware/src/bsw/Dem` |
| BswM 初始化 DCM/PduR/CanTp | `BasicSoftware/ecu_config/bsw/static/Base/RTA_BswM_EcucValues.arxml` |

## 22. 一句话总结

在本项目里，UDS 的“配置骨架”主要由 ETAS 生成在 `BasicSoftware/src/bsw/Dcm`、`PduR`、`Dem` 里；UDS 的“业务行为”主要落在 `ASW/SWC/Dcm_Swc` 和 `ASW/SWC/DiagUT` 的 RTE 回调里。读配置时先看 CAN ID 和 PduR 路由，再看 DCM 的 DSL/DSD/DSP，最后落到应用回调。改功能时尽量从配置工具改，再生成，再补应用逻辑，最后用会话、安全、正负响应一起验证。
