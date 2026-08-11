# EEA5.0 & EEA5.1 平台整车网络管理需求整理

## 1. 文档信息

| 项目            | 内容                                           |
| ------------- | -------------------------------------------- |
| 需求来源          | `EEA5.0&EEA5.1平台项目整车网络管理方案V4.0-20241122.pdf` |
| 来源版本          | V4.0                                         |
| 来源日期          | 2024-11-22                                   |
| Zotero 条目 Key | `GV4ZI3MB`                                   |
| 整理范围          | 来源 PDF 第 4-17 页                              |
| 需求级别          | 本文将原方案中的原则、行为、参数和约束转换为可追踪的系统/软件需求            |
|               |                                              |

> 说明：下表中的“验证建议”是为便于开发和测试而补充的验收思路，不是来源文档原文。除特别标记为“待澄清”外，“需求”列均来自原文明确陈述。

## 2. 适用范围与术语

### 2.1 ECU 分类

- **<mark style="background: #FF5582A6;">I 类 ECU：KL15 为 OFF 时仍可进行 CAN/CAN FD 通信，并按 AUTOSAR NM 实现同步休眠和唤醒。本文档的网络管理设计主要面向 I 类 ECU。</mark>**
- II 类 ECU：仅在 KL15 为 ON 或被其他 ECU 使能时通信；KL15 变为 OFF 或使能被撤销后，立即停止通信或延时一段时间后停止通信。

### 2.2 节点与网络层级

| 平台/对象         | 定义                      |
| ------------- | ----------------------- |
| EEA5.0 主干通讯节点 | FLZCU、FRZCU、RZCU、VCC    |
| EEA5.1 主干通讯节点 | FLZCU、FRZCU             |
| 一级节点          | 与主干通讯节点直接相连且具备网络管理功能的节点 |
| 支干通讯节点        | 一级节点中具备协同网络休眠/唤醒功能的节点   |
| GLOBAL_CAN    | 主干通讯节点组成的主干通信网络         |
| 一级通信网络        | 与主干通讯节点相连且具备网络管理的网络     |
| 私有网络          | 支干通讯节点下挂并由其负责调度的网络      |

## 3. 总体与架构需求

| ID             | 适用对象                        | 需求                                             | 来源            | 验证建议                  |
| -------------- | --------------------------- | ---------------------------------------------- | ------------- | --------------------- |
| REQ-NM-GEN-001 | EEA5.0/5.1 网络管理 ECU         | 网络管理应采用 AUTOSAR NM。                            | 2，第 6 页       | 配置审查；状态机测试            |
| REQ-NM-GEN-002 | EEA5.0 主干网络                 | FLZCU、FRZCU、RZCU、VCC 所在主干网络应支持同眠同醒，且不支持 PN 分组。 | 2，第 6 页       | 多节点同步休眠/唤醒测试；确认 PN 关闭 |
| REQ-NM-GEN-003 | EEA5.1 主干网络                 | FLZCU、FRZCU 所在主干网络应支持同眠同醒，且不支持 PN 分组。          | 2，第 6 页       | 多节点同步休眠/唤醒测试；确认 PN 关闭 |
| REQ-NM-GEN-004 | EEA5.0 FLZCU/FRZCU/RZCU/VCC | 每个主干通讯节点应支持其下挂网段分别休眠和分别唤醒。                     | 2，第 6 页       | 各下挂网段独立休眠/唤醒测试        |
| REQ-NM-GEN-005 | EEA5.1 FLZCU/FRZCU          | 每个主干通讯节点应支持其下挂网段分别休眠和分别唤醒。                     | 2，第 6 页       | 各下挂网段独立休眠/唤醒测试        |
| REQ-NM-GEN-006 | 全部网络管理 ECU                  | 网络管理休眠/唤醒的最小控制粒度应为网段，不要求精确到单个 ECU。             | 2，第 6 页       | 架构及测试用例审查             |
| REQ-NM-GEN-007 | 整车网络管理                      | 网络管理设计应支持 CAN、CAN FD 和 LIN 网络。                 | 1.3、2，第 4、6 页 | 接口及集成测试               |
| REQ-NM-GEN-008 | CAN/CAN FD 网段               | CAN FD 和 CAN 网段的 NM 报文均应采用 Classical CAN 格式。   | 2，第 6 页       | 报文抓取，检查帧格式            |
| REQ-NM-GEN-009 | 域控制器                        | 网络管理应支持域控制器 SoC 唤醒。                            | 2，第 6 页       | SoC 唤醒场景测试            |
| REQ-NM-GEN-010 | 以太网                         | 不应使用 UDP NM 作为以太网网络管理机制。                       | 2，第 6 页       | 配置和通信矩阵审查             |
| REQ-NM-GEN-011 | 各 ECU                       | 硬线唤醒条件应作为 ECU 本地休眠/唤醒条件处理。                     | 1.3，第 4 页     | 硬线输入触发测试              |

## 4. 网络唤醒需求

### 4.1 唤醒后的基本行为

| ID              | 适用对象                                      | 需求                                                  | 来源                | 验证建议                   |
| --------------- | ----------------------------------------- | --------------------------------------------------- | ----------------- | ---------------------- |
| REQ-NM-WAKE-001 | 全部网络管理 ECU                                | ECU 网络唤醒后，应参与其所在网段的网络管理，并使能应用报文收发能力。                | 2.1，第 6 页         | 唤醒后报文及 NM 状态检查         |
| REQ-NM-WAKE-002 | EEA5.0 FLZCU/FRZCU/RZCU、TDU/ICC/FCM 等路由节点 | ECU 网络唤醒后，应同时使能路由功能。                                | 2.1，第 6 页         | 跨网段路由测试                |
| REQ-NM-WAKE-003 | EEA5.1 FLZCU/FRZCU、ICC/FCM 等路由节点          | ECU 网络唤醒后，应同时使能路由功能。                                | 2.1，第 6 页         | 跨网段路由测试                |
| REQ-NM-WAKE-004 | 全部 ECU                                    | 远程唤醒只能由总线上的网络管理报文触发，应用报文不得唤醒 ECU。                   | 2.1.1，第 7 页       | 睡眠态分别注入 NM/应用报文        |
| REQ-NM-WAKE-005 | 本地唤醒 ECU                                  | ECU 本地唤醒后应先判断是否存在通信需求；有通信需求时才发送 NM 报文唤醒相关网段。        | 2.1.2，第 7 页       | 有/无通信需求两组测试            |
| REQ-NM-WAKE-006 | 本地唤醒 ECU                                  | ECU 本地唤醒后若无通信需求，应禁止向总线发送任何报文。                       | 2.1.2，第 7 页       | 静默总线监测                 |
| REQ-NM-WAKE-007 | 首个本地唤醒 ECU                                | 最先被本地唤醒的 ECU 应识别唤醒源，并通过 NM 报文发送网络唤醒原因。              | 2.1.2，第 7 页       | 检查 NM User Data        |
| REQ-NM-WAKE-008 | 支干通讯节点                                    | 私有网络被唤醒时，支干通讯节点应发送 NM 报文及唤醒原因。                      | 2.1.2，第 7 页       | 私有网唤醒及 User Data 检查    |
| REQ-NM-WAKE-009 | 网络保持 ECU                                  | 当网络唤醒 ECU 与网络保持 ECU 不同时，网络保持 ECU 应通过 NM 报文发送网络保持原因。 | 2.1.2，第 7 页       | 双 ECU 场景及 User Data 检查 |
| REQ-NM-WAKE-010 | 一级通信网络控制器                                 | ECU 应通过 NM 报文发送网络请求原因；每个原因占用 1 bit，请求有效时置 1，否则置 0。  | 2.1.2 表 1，第 7-8 页 | 位级报文测试                 |
| REQ-NM-WAKE-011 | EEA5.0 FLZCU/FRZCU/RZCU/VCC               | 应具备网络请求原因分析和目标唤醒网段决策功能，并通过 NM 报文唤醒目标网段。             | 2.1.2，第 7-8 页     | 需求原因到目标网段映射测试          |
| REQ-NM-WAKE-012 | EEA5.1 FLZCU/FRZCU                        | 应具备网络请求原因分析和目标唤醒网段决策功能，并通过 NM 报文唤醒目标网段。             | 2.1.2，第 7-8 页     | 需求原因到目标网段映射测试          |
| REQ-NM-WAKE-013 | EEA5.0 FLZCU/FRZCU/RZCU/VCC               | 节点之间应通过应用报文传递目标唤醒网段信息；每个网段占用 1 bit，请求唤醒时置 1，否则置 0。  | 2.1.2 表 2，第 8 页   | 位级报文及多节点一致性测试          |
| REQ-NM-WAKE-014 | EEA5.1 FLZCU/FRZCU                        | 节点之间应通过应用报文传递目标唤醒网段信息；每个网段占用 1 bit，请求唤醒时置 1，否则置 0。  | 2.1.2 表 2，第 8 页   | 位级报文及多节点一致性测试          |
| REQ-NM-WAKE-015 | 支干通讯节点                                    | 支干通讯节点唤醒后，应能根据应用报文信号决策需要唤醒的私有网络目标网段。                | 2.1.2，第 7 页       | 应用信号到私有网段映射测试          |

### 4.2 NM User Data 布局

| 字节 | Bit7 | Bit6 | Bit5 | Bit4 | Bit3 | Bit2 | Bit1 | Bit0 |
|---|---|---|---|---|---|---|---|---|
| Byte 0 | `srcNodeId[7]` | `srcNodeId[6]` | `srcNodeId[5]` | `srcNodeId[4]` | `srcNodeId[3]` | `srcNodeId[2]` | `srcNodeId[1]` | `srcNodeId[0]` |
| Byte 1 | `reserved` | `reserved` | `reserved` | `reserved` | `reserved` | `reserved` | `reserved` | `RMR` |
| Byte 2 | Wakeup Source 8 | Wakeup Source 7 | Wakeup Source 6 | Wakeup Source 5 | Wakeup Source 4 | Wakeup Source 3 | Wakeup Source 2 | Wakeup Source 1 |
| Byte 3 | Wakeup Source 16 | Wakeup Source 15 | Wakeup Source 14 | Wakeup Source 13 | Wakeup Source 12 | Wakeup Source 11 | Wakeup Source 10 | Wakeup Source 9 |
| Byte 4 | Wakeup Source 24 | Wakeup Source 23 | Wakeup Source 22 | Wakeup Source 21 | Wakeup Source 20 | Wakeup Source 19 | Wakeup Source 18 | Wakeup Source 17 |
| Byte 5 | Awake Reason 8 | Awake Reason 7 | Awake Reason 6 | Awake Reason 5 | Awake Reason 4 | Awake Reason 3 | Awake Reason 2 | Awake Reason 1 |
| Byte 6 | Awake Reason 16 | Awake Reason 15 | Awake Reason 14 | Awake Reason 13 | Awake Reason 12 | Awake Reason 11 | Awake Reason 10 | Awake Reason 9 |
| Byte 7 | Awake Reason 24 | Awake Reason 23 | Awake Reason 22 | Awake Reason 21 | Awake Reason 20 | Awake Reason 19 | Awake Reason 18 | Awake Reason 17 |

> 注：Markdown 不支持原表的合并单元格。Byte 0 的 8 bit 整体为 `srcNodeId`，并非仅 Bit4。具体 Wakeup Source/Awake Reason 与业务场景的映射需以“休眠唤醒条件表”为准。

## 5. 网络休眠需求

| ID | 适用对象 | 需求 | 来源 | 验证建议 |
|---|---|---|---|---|
| REQ-NM-SLEEP-001 | 一级节点，包括支干通讯节点 | 本地休眠条件满足后，应停止发送 NM 报文。 | 2.2，第 8 页 | 条件满足后的报文监测 |
| REQ-NM-SLEEP-002 | 主干通讯节点 | 仅当本地休眠条件满足且下挂一级节点全部停发 NM 报文后，才应在 GLOBAL_CAN 停发 NM 报文。 | 2.2，第 8 页 | 下挂节点组合状态测试 |
| REQ-NM-SLEEP-003 | GLOBAL_CAN | 所有一级节点均停发 NM 报文后，GLOBAL_CAN 应进入休眠。 | 2.2，第 9 页 | 整车网络状态测试 |
| REQ-NM-SLEEP-004 | EEA5.0 FLZCU/FRZCU/RZCU/VCC | 主干节点应在一级通信网络停发 NM 报文，使对应一级通信网络进入休眠。 | 2.2，第 9 页 | 各一级网段休眠测试 |
| REQ-NM-SLEEP-005 | EEA5.1 FLZCU/FRZCU | 主干节点应在一级通信网络停发 NM 报文，使对应一级通信网络进入休眠。 | 2.2，第 9 页 | 各一级网段休眠测试 |
| REQ-NM-SLEEP-006 | 支干通讯节点 | 私有网络的休眠应由支干通讯节点根据自身功能需求控制。 | 2.2，第 9 页 | 私有网独立休眠测试 |

## 6. 节点角色与 LIN 网络管理需求

### 6.1 节点角色需求

| ID | 适用对象 | 需求 | 来源 | 验证建议 |
|---|---|---|---|---|
| REQ-NM-ROLE-001 | 主干通讯节点 | 应支持 AUTOSAR NM、网络请求原因分析、目标唤醒网段决策、网络请求原因发送及下挂网段独立休眠/唤醒。目标唤醒网段信息应通过 CAN 网络传递。 | 3.1.1，第 10 页 | 功能及接口测试 |
| REQ-NM-ROLE-002 | 支干通讯节点 | 应支持 AUTOSAR NM、网络请求原因发送及私有网段独立休眠/唤醒。 | 3.1.2，第 10 页 | 功能及接口测试 |
| REQ-NM-ROLE-003 | 非支干一级节点 | 应支持 AUTOSAR NM，并能够发送网络请求原因。 | 3.1.3，第 10 页 | 功能及报文测试 |

### 6.2 LIN 网络管理需求

| ID | 适用对象 | 需求 | 来源 | 验证建议 |
|---|---|---|---|---|
| REQ-NM-LIN-001 | LIN 主节点 | 主节点处于唤醒状态时，应唤醒 LIN 从节点。 | 3.1.4，第 10 页 | 主节点唤醒联动测试 |
| REQ-NM-LIN-002 | LIN 主节点 | 主节点准备休眠时，应向 LIN 从节点发送休眠指令 `0x3C`。 | 3.1.4，第 10 页 | 抓取 `0x3C` 帧 |
| REQ-NM-LIN-003 | LIN 从节点 | 收到休眠指令后，允许从节点继续完成本地功能。 | 3.1.4，第 10 页 | 本地功能持续性测试 |
| REQ-NM-LIN-004 | LIN 主节点 | 主节点应先停止发送应用报文，再关闭 LIN 通道。 | 3.1.4，第 10 页 | 时序检查 |
| REQ-NM-LIN-005 | LIN 从节点/主节点 | LIN 从节点功能激活时，从节点应唤醒主节点。 | 3.1.4，第 10 页 | 从节点反向唤醒测试 |
| REQ-NM-LIN-006 | RLHS/EBS | 雨天关窗功能激活时，RLHS 应唤醒主节点；智能补电功能激活时，EBS 应唤醒主节点。 | 3.1.4，第 10 页 | 两类业务场景测试 |

## 7. 供电、唤醒条件及特殊 ECU 配置需求

| ID | 适用对象 | 需求 | 来源 | 验证建议 |
|---|---|---|---|---|
| REQ-NM-COND-001 | 全部网络管理 ECU | `Passive Startup` 应对应远程唤醒条件；`Network Request` 应对应本地唤醒条件及网络保持条件；`Network Release` 应对应网络释放条件。网络保持条件表示 ECU 维持在 `Normal Operation State`。 | 3.2，第 11 页 | 条件到状态映射审查和测试 |
| REQ-NM-COND-002 | 仅 KL15 ON 本地唤醒且无远程唤醒条件的 ECU | KL15 ON 后应在 100 ms 内发出第一帧报文，并在 300 ms 内发出第一帧有效报文。 | 3.2，第 11 页 | 上电时序测量 |
| REQ-NM-COND-003 | 全部网络管理 ECU | NM 报文 CAN ID 应位于 `0x600-0x67F`。 | 3.3，第 11 页 | 通信矩阵和总线抓取检查 |
| REQ-NM-COND-004 | FLZCU/FRZCU/RZCU/BNCM | NM 报文快发次数应配置为 20 次。 | 3.4.1，第 11 页 | 配置检查和报文计数 |
| REQ-NM-COND-005 | EEA5.0 VCC | VCC 接收到 NM 报文时，只应在收到该 NM 报文的网段被动唤醒，不应唤醒其他直连网段。 | 3.4.2，第 11 页 | 多直连网段隔离测试 |
| REQ-NM-COND-006 | EEA5.0 VCC 的 CAN Diag 通道 | VCC 主动唤醒或保持网络时应开启对应 CAN Diag 通道；VCC 被动唤醒时不应开启该通道。 | 3.4.2，第 11 页 | 主动/被动唤醒对比测试 |
| REQ-NM-COND-007 | EEA5.1 ZCU 的 CAN Diag 通道 | ZCU 主动唤醒或保持网络时应开启对应 CAN Diag 通道。 | 3.4.2，第 11 页 | 通道状态测试 |
| REQ-NM-COND-008 | ZCU | ZCU 收到 NM 报文时，应主动唤醒接收该 NM 报文的网段以及存在网络需求的网段，不应唤醒其他直连网段。 | 3.4.2，第 11 页 | 多网段选择性唤醒测试 |

## 8. 以太网休眠/唤醒需求

| ID | 适用对象 | 需求 | 来源 | 验证建议 |
|---|---|---|---|---|
| REQ-NM-ETH-001 | 以太网关联系统 | 主动唤醒时，应先打开直接网络管理 CAN 网段；无需等待其他直接网络管理 CAN 网段进入 `Network Mode`，即可立即打开以太网段和非网络管理网段。 | 3.4.3，第 12 页 | 多网段启动时序测试 |
| REQ-NM-ETH-002 | 以太网关联系统 | 仅当所有直接网络管理 CAN 网段均进入 `Bus-Sleep Mode` 或 `Prepare Bus-Sleep Mode` 后，才应关闭以太网段和非网络管理网段。 | 3.4.3，第 12 页 | 多网段休眠门控测试 |
| REQ-NM-ETH-003 | 以太网节点 | CAN 网络休眠后，以太网节点应快速完成自身业务收尾并进入休眠，PHY 和 Switch 芯片应进入低功耗或休眠模式。 | 3.4.3，第 12 页 | 功耗和状态测量 |
| REQ-NM-ETH-004 | SOME/IP Server | 以太网休眠前应发送 `StopOfferService`。 | 3.4.3，第 12 页 | 报文抓取 |
| REQ-NM-ETH-005 | SOME/IP Client | 以太网休眠前应发送 `StopSubscribeEventgroup`。 | 3.4.3，第 12 页 | 报文抓取 |
| REQ-NM-ETH-006 | TCP Client | 以太网休眠前应发送 `FIN` 或 `Reset` 请求并断开 TCP 连接。 | 3.4.3，第 12 页 | TCP 会话抓取 |
| REQ-NM-ETH-007 | 周期 UDP 发送端 | 以太网休眠前应停止发送周期型 UDP 报文。 | 3.4.3，第 12 页 | 报文监测 |
| REQ-NM-ETH-008 | 特殊场景 | 特殊场景下，允许通过重新接入或断开硬件供电的方式重新打开或提前关闭以太网段。 | 3.4.3，第 12 页 | 场景及电源控制测试 |

## 9. 分网段休眠/唤醒需求

| ID | 适用对象 | 需求 | 来源 | 验证建议 |
|---|---|---|---|---|
| REQ-NM-SEG-001 | 整车网络 | 应实现分网段休眠和唤醒功能。该功能以 ECU 供电正常为前提；若整车节电策略主动关闭 ECU 供电，允许相应网段无法保持唤醒。 | 4，第 13 页 | 分网段场景及断电降级测试 |
| REQ-NM-SEG-002 | 整车同醒场景 | 整车同醒应作为“唤醒整车所有网段”的一种分网段场景处理。 | 4，第 13 页 | 整车同醒测试 |
| REQ-NM-SEG-003 | 休眠/唤醒控制器 | 在整车或分网段休眠/唤醒场景下，不在 Global 网段应用报文中定义的网段应默认打开。 | 4，第 13 页 | 缺省位/未映射网段测试 |
| REQ-NM-SEG-004 | ZCU | ZCU 收到 User Data 全为 0 的 NM 报文时，应将其识别为整车唤醒源，并按整车同醒场景处理。 | 4，第 13 页 | 全零 User Data 注入测试 |

## 10. NM 配置参数需求

| ID | 配置项 | 要求值 | 适用对象 | 来源 |
|---|---|---|---|---|
| REQ-NM-CFG-001 | `NM_USER_DATA_ENABLED` / `CANNM_USER_DATA_ENABLED` | `ON` | 全部相关 ECU | 5，第 14 页 |
| REQ-NM-CFG-002 | `NM_BUS_SYNCHRONIZATION_ENABLED` / `CANNM_BUS_SYNCHRONIZATION_ENABLED` | `OFF` | 全部相关 ECU | 5，第 14 页 |
| REQ-NM-CFG-003 | `NM_REMOTE_SLEEP_IND_ENABLED` | `ON` | 主干通讯节点、支干通讯节点 | 5，第 14 页 |
| REQ-NM-CFG-004 | `NM_REMOTE_SLEEP_IND_ENABLED` | `OFF` | 一级节点 | 5，第 14 页 |
| REQ-NM-CFG-005 | `NM_NODE_DETECTION_ENABLED` / `CANNM_NODE_DETECTION_ENABLED` | `OFF` | 全部相关 ECU | 5，第 14 页 |
| REQ-NM-CFG-006 | `NM_CONTROL_BIT_VECTOR_ENABLED` / `CANNM_CONTROL_BIT_VECTOR_ENABLED` | `OFF` | 全部相关 ECU | 5，第 14 页 |
| REQ-NM-CFG-007 | `NM_BUS_LOAD_REDUCTION_ENABLED` / `CANNM_BUS_LOAD_REDUCTION_ENABLED` | `OFF` | 全部相关 ECU | 5，第 14 页 |

## 11. NM 时间参数需求

| ID              | 参数                                              |       目标值 |     容差 | 来源       |
| --------------- | ----------------------------------------------- | --------: | -----: | -------- |
| REQ-NM-TIME-001 | `CANNM_TIMEOUT_TIME` (`TNM-timeout`)            |   2500 ms | +/-10% | 6，第 15 页 |
| REQ-NM-TIME-002 | `CANNM_WAIT_BUS_SLEEP_TIME` (`Twait_bus_sleep`) |   1500 ms | +/-10% | 6，第 15 页 |
| REQ-NM-TIME-003 | `CANNM_REPEAT_MESSAGE_TIME` (`Trepeat_message`) |   3000 ms | +/-10% | 6，第 15 页 |
| REQ-NM-TIME-004 | `CANNM_MSG_CYCLE_TIME`                          |   1000 ms |  +/-5% | 6，第 15 页 |
| REQ-NM-TIME-005 | `CANNM_MSG_CYCLE_OFFSET`                        | 未定义 (`/`) |    未定义 | 6，第 15 页 |
| REQ-NM-TIME-006 | `CANNM_MSG_REDUCED_TIME`                        | 未定义 (`/`) |    未定义 | 6，第 15 页 |
| REQ-NM-TIME-007 | `CANNM_IMMEDIATE_NM_CYCLETIME`                  |     20 ms | +/-10% | 6，第 15 页 |
| REQ-NM-TIME-008 | `CANNM_IMMEDIATE_NM_TRANSMISSIONS`              |    0 或 10 |    未定义 | 6，第 15 页 |
| REQ-NM-TIME-009 | `CANNM_REMOTE_SLEEP_IND_TIME`                   |   2000 ms | +/-10% | 6，第 15 页 |
|                 |                                                 |           |        |          |

> **<mark style="background: #FFB8EBA6;">注意：第 11 页另行规定 FLZCU、FRZCU、RZCU、BNCM 的 NM 报文快发次数为 20 次，而本表 `CANNM_IMMEDIATE_NM_TRANSMISSIONS` 为 0 或 10。两者可能对应不同概念/配置层级，也可能存在冲突，需项目方确认，不能直接互相替代。</mark>**

## 12. NM User Data 状态转换需求

| ID            | 状态转换                                       | Wakeup Source               | Awake Reason        | NM 报文行为 | 来源       |
| ------------- | ------------------------------------------ | --------------------------- | ------------------- | ------- | -------- |
| REQ-NM-UD-001 | `Bus-Sleep Mode -> Repeat Message`         | 按实际唤醒源置位                    | 若唤醒源同时也是保持源，则置位     | 发送      | 7，第 16 页 |
| REQ-NM-UD-002 | `Repeat Message -> Ready Sleep`            | 清零                          | 清零                  | 停发      | 7，第 16 页 |
| REQ-NM-UD-003 | `Repeat Message -> Normal Operation`       | 保持与 Repeat Message 状态一致     | 按实际保持源置位；多个保持源应同时置位 | 发送      | 7，第 16 页 |
| REQ-NM-UD-004 | `Normal Operation -> Ready Sleep`          | 清零                          | 清零                  | 停发      | 7，第 16 页 |
| REQ-NM-UD-005 | `Ready Sleep -> Prepare Bus-Sleep Mode`    | 保持清零                        | 保持清零                | 已停发     | 7，第 16 页 |
| REQ-NM-UD-006 | `Ready Sleep -> Normal Operation`          | 当保持源同时为唤醒源时置位；若仅保持源触发则可全为 0 | 按实际保持源置位            | 发送      | 7，第 16 页 |
| REQ-NM-UD-007 | `Prepare Bus-Sleep Mode -> Bus-Sleep Mode` | 保持清零                        | 保持清零                | 已停发     | 7，第 16 页 |
| REQ-NM-UD-008 | `Prepare Bus-Sleep Mode -> Repeat Message` | 按实际唤醒源置位                    | 若唤醒源同时也是保持源，则置位     | 发送      | 7，第 16 页 |

## 13. 报文识别与诊断/OTA 需求

| ID | 适用对象 | 需求 | 来源 | 验证建议 |
|---|---|---|---|---|
| REQ-NM-MISC-001 | 网络唤醒接收逻辑 | 使用 NM 报文唤醒网络时，只应识别 CAN ID，不应判断报文内容和长度。 | 8，第 17 页 | 使用不同 DLC/内容的同 ID 报文测试 |
| REQ-NM-MISC-002 | 网络保持接收逻辑 | 使用诊断报文保持网络时，只应识别 CAN ID，不应判断报文内容和长度。 | 8，第 17 页 | 使用不同 DLC/内容的同 ID 报文测试 |
| REQ-NM-MISC-003 | NM 状态机 | 收到其他 ECU 发出的 `RMR=1` NM 报文时，不应因此跳转到 `Repeat Message State`。 | 8，第 17 页 | RMR 注入及状态观测 |
| REQ-NM-MISC-004 | 诊断仪逻辑地址 `0x0E80` | 主驾 OBD 口插入诊断仪时，应激活该逻辑地址。 | 8，第 17 页 | OBD 插拔测试 |
| REQ-NM-MISC-005 | 远程诊断逻辑地址 `0x0E81` | 电源模式为 ON 且云端主动下发远程诊断任务时，应激活该逻辑地址。 | 8，第 17 页 | 远程任务场景测试 |
| REQ-NM-MISC-006 | OTA Master 逻辑地址 `0x0F00` | 电源模式为 ON 且 OTA 读取整车版本信息或执行 OTA 升级时，应激活该逻辑地址。 | 8，第 17 页 | 两种 OTA 场景测试 |
| REQ-NM-MISC-007 | 设备管理逻辑地址 `0x0F01` | 电源模式为 ON 且 OTA 读取整车版本信息时，应激活该逻辑地址。 | 8，第 17 页 | OTA 读版本场景测试 |
| REQ-NM-MISC-008 | 设备管理逻辑地址 `0x0F01` | 车辆唤醒且 VHR 读取整车版本信息时，应激活该逻辑地址；该场景保持网络的最长时间为 30 s。 | 8，第 17 页 | VHR 场景及 30 s 超时测试 |

## 14. 外部依赖与待澄清项

| ID          | 问题/缺口                                                                                                                                                                      | 影响                                                                       | 建议动作                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------- |
| OPEN-NM-001 | PDF 引用了《EEA5.0&EEA5.1平台网络管理配置及休眠唤醒条件表》，但该附件未包含在当前 Zotero 条目中，Zotero 中也未检索到同名条目。                                                                                            | 无法提取每个 ECU 的具体本地唤醒、远程唤醒、保持、释放条件，以及 Wakeup Source/Awake Reason bit 的业务映射。 | 获取并纳入条件表后，补充 ECU x 条件 x 网段的需求矩阵。            |
| OPEN-NM-002 | PDF 要求遵循《EE Standard Specification for CAN Network Management Implementation》和《EE Standard Specification for LIN Network Management Implementation》，但当前 Zotero 中未检索到这两份标准。 | 标准参数、异常处理和完整状态机要求无法在本文中展开。                                               | 获取标准的受控版本并建立追踪关系。                           |
| OPEN-NM-003 | `CANNM_IMMEDIATE_NM_TRANSMISSIONS` 在第 15 页为 0 或 10，但第 11 页规定 FLZCU/FRZCU/RZCU/BNCM NM 报文快发次数为 20。                                                                          | 配置可能冲突，可能导致生成参数或测试期望不一致。                                                 | 明确两者是否为不同参数/阶段；若为同一含义，应由项目方给出优先级。           |
| OPEN-NM-004 | 第 11 页 EEA5.1 使用“ZCU”，但第 5-8 页的 EEA5.1 主干节点只列 FLZCU、FRZCU。                                                                                                                 | “ZCU”具体指代范围不明确。                                                          | 确认 ZCU 是 FLZCU/FRZCU 的统称，还是另一个 ECU。         |
| OPEN-NM-005 | 时间参数表中 `CANNM_MSG_CYCLE_OFFSET`、`CANNM_MSG_REDUCED_TIME` 未定义，`CANNM_IMMEDIATE_NM_TRANSMISSIONS` 提供两个候选值。                                                                   | 无法形成唯一可执行配置。                                                             | 在 ECU 配置表中按节点给出最终值。                         |
| OPEN-NM-006 | “以太网必须在 CAN 网络休眠后快速处理自身业务”未给出“快速”的定量时间。                                                                                                                                    | 无法形成明确的超时验收标准。                                                           | 补充从 CAN 进入休眠状态到以太网/PHY/Switch 进入低功耗的最大允许时间。 |
| OPEN-NM-007 | 表 2 只给出了最多 64 个目标网段的位编码示例，没有给出实际网段到 bit 的映射。                                                                                                                               | 无法生成真实应用报文信号和逐网段测试用例。                                                    | 从通信矩阵或条件表补充 `bit -> 网段` 映射。                 |

## 15. 建议的验收覆盖

1. 配置静态检查：AUTOSAR NM 开关、时间参数、NM ID、快发参数、节点角色配置。
2. 状态机测试：覆盖第 12 节列出的 8 个状态转换及 User Data 置位/清零行为。
3. 总线唤醒测试：本地唤醒、NM 远程唤醒、应用报文不唤醒、无通信需求时总线静默。
4. 分网段测试：单网段唤醒、多个目标网段、整车同醒、User Data 全零、未映射网段默认打开。
5. 休眠测试：一级节点、主干节点、GLOBAL_CAN、私有网络逐级休眠，以及阻塞条件组合。
6. 路由和以太网测试：路由使能、CAN 到以太网启动/关闭时序、SOME/IP/TCP/UDP 收尾、PHY/Switch 低功耗。
7. LIN 测试：主唤从、从唤主、`0x3C` 休眠指令、应用报文停发与通道关闭顺序。
8. 诊断与 OTA 测试：4 个逻辑地址的激活条件、报文 ID 识别策略及 VHR 30 s 保持上限。
