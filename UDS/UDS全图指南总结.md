---
created: 2026-05-27
override_system_prompt:
date: 2026-05-11
related_task: UDS协议
progress: 10%
---
# UDS 全图指南总结


来源：`UDS全图指南.pdf`，Softing《Unified Diagnostic Services - ISO 14229》速查图。

## 1. 一句话理解 UDS

UDS（Unified Diagnostic Services，ISO 14229）是汽车 ECU 诊断应用层协议，用于会话切换、读写数据、DTC 故障码管理、例程控制、安全解锁、刷写下载等诊断功能。

典型协议栈：

```text
UDS 应用层：ISO 14229-1
诊断会话/应用扩展：ISO 15765-3
CAN 传输/网络层：ISO 15765-2
CAN 数据链路层：ISO 11898-1
CAN 物理层：ISO 11898-2 / ISO 11898-3
```

OBD 更偏法规排放诊断，UDS 更偏整车/ECU 工程诊断与刷写。

## 2. 报文结构要点

### 2.1 请求报文

无子功能服务：

```text
SID + Data Parameter
```

有子功能服务：

```text
SID + SubFunction + Data Parameter
```

常见有子功能的服务：

```text
0x10  Diagnostic Session Control
0x11  ECU Reset
0x19  Read DTC Information
0x27  Security Access
0x28  Communication Control
0x2C  Dynamically Define Data Identifier
0x31  Routine Control
0x3E  Tester Present
0x83  Access Timing Parameter
0x85  Control DTC Setting
0x86  Response On Event
0x87  Link Control
```

常见无子功能的服务：

```text
0x14  Clear Diagnostic Information
0x22  Read Data By Identifier
0x23  Read Memory By Address
0x24  Read Scaling Data By Identifier
0x2A  Read Data By Periodic Identifier
0x2E  Write Data By Identifier
0x2F  Input Output Control By Identifier
0x34  Request Download
0x35  Request Upload
0x36  Transfer Data
0x37  Request Transfer Exit
0x3D  Write Memory By Address
0x84  Secured Data Transmission
```

### 2.2 正响应和负响应

常规正响应 SID 通常为：

```text
Response SID = Request SID + 0x40
```

例如：

```text
10 03      请求进入扩展诊断会话
50 03      正响应
```

负响应格式固定：

```text
7F + Request SID + NRC
```

例如：

```text
10 03
7F 10 12   表示 0x10 服务的子功能不支持
```

## 3. SubFunction 字节

对于带子功能的服务，SubFunction 字节最高位有特殊含义：

```text
bit7      suppressPosRspMsgIndicationBit
bit6-0    sub-function value
```

含义：

- `bit7 = 0`：ECU 应发送正响应。
- `bit7 = 1`：请求抑制正响应，ECU 不应发送正响应。
- 负响应不受该位影响，出现错误仍然要返回负响应。
- 读数据类服务通常不支持正响应抑制。
- 功能寻址时，部分负响应会被抑制，例如 `0x11 Service not supported`、`0x12 SubFunction not supported`。

`0x86 Response On Event` 比较特殊：

```text
bit7      suppress positive response
bit6      storage state
bit5-0    sub-function value
```

## 4. 服务总览

### 4.1 诊断与通信管理

| SID | 服务 | 用途 |
|---:|---|---|
| `0x10` | Diagnostic Session Control | 切换默认/编程/扩展/安全系统会话 |
| `0x11` | ECU Reset | ECU 复位 |
| `0x27` | Security Access | Seed/Key 安全解锁 |
| `0x28` | Communication Control | 控制通信开启/关闭 |
| `0x3E` | Tester Present | 保持非默认会话活跃 |
| `0x83` | Access Timing Parameter | 读写诊断时序参数 |
| `0x84` | Secured Data Transmission | 安全数据传输 |
| `0x85` | Control DTC Setting | 控制 DTC 记录开关 |
| `0x86` | Response On Event | 事件触发响应 |
| `0x87` | Link Control | 链路控制 |

### 4.2 数据传输

| SID | 服务 | 用途 |
|---:|---|---|
| `0x22` | Read Data By Identifier | 按 DID 读取数据 |
| `0x23` | Read Memory By Address | 按地址读内存 |
| `0x24` | Read Scaling Data By Identifier | 读取 DID 缩放信息 |
| `0x2A` | Read Data By Periodic Identifier | 周期性读取数据 |
| `0x2C` | Dynamically Define Data Identifier | 动态定义 DID |
| `0x2E` | Write Data By Identifier | 按 DID 写数据 |
| `0x3D` | Write Memory By Address | 按地址写内存 |

### 4.3 故障码与存储数据

| SID | 服务 | 用途 |
|---:|---|---|
| `0x14` | Clear Diagnostic Information | 清除 DTC/故障记忆 |
| `0x19` | Read DTC Information | 读取 DTC、快照、扩展数据、状态等 |

### 4.4 I/O、例程与刷写

| SID | 服务 | 用途 |
|---:|---|---|
| `0x2F` | Input Output Control By Identifier | I/O 控制 |
| `0x31` | Routine Control | 启动/停止/查询例程 |
| `0x34` | Request Download | 请求下载，常用于刷写 |
| `0x35` | Request Upload | 请求上传 |
| `0x36` | Transfer Data | 数据块传输 |
| `0x37` | Request Transfer Exit | 结束传输 |

## 5. 常用 NRC 负响应码

| NRC | 名称 | 含义 |
|---:|---|---|
| `0x10` | General reject | 通用拒绝 |
| `0x11` | Service not supported | 服务不支持 |
| `0x12` | SubFunction not supported | 子功能不支持 |
| `0x13` | Incorrect message length or invalid format | 报文长度或格式错误 |
| `0x14` | Response too long | 响应过长 |
| `0x21` | Busy repeat request | ECU 忙，请求稍后重发 |
| `0x22` | Conditions not correct | 当前条件不满足 |
| `0x24` | Request sequence error | 请求顺序错误 |
| `0x25` | No response from sub-net component | 子网组件无响应 |
| `0x26` | Failure prevents execution | 故障阻止执行 |
| `0x31` | Request out of range | 请求超出范围 |
| `0x33` | Security access denied | 安全访问被拒绝 |
| `0x35` | Invalid key | Key 错误 |
| `0x36` | Exceeded number of attempts | 尝试次数超限 |
| `0x37` | Required time delay not expired | 延迟时间未到 |
| `0x70` | Upload/Download not accepted | 上传/下载不接受 |
| `0x71` | Transfer data suspended | 数据传输暂停 |
| `0x72` | General programming failure | 编程失败 |
| `0x73` | Wrong block sequence counter | 数据块序号错误 |
| `0x78` | Response pending | 请求已收到，响应处理中 |
| `0x7E` | SubFunction not supported in active session | 当前会话不支持该子功能 |
| `0x7F` | Service not supported in active session | 当前会话不支持该服务 |

实战判断顺序：

```text
先看 7F 后面的原始 SID，再看 NRC。
0x22 多半是条件不满足。
0x31 多半是 DID/RID/参数越界。
0x33/0x35/0x36/0x37 多半和安全访问有关。
0x78 表示 ECU 还在处理，不是失败。
```

## 6. DTC 相关服务

### 6.1 清除故障信息：0x14

请求参数包含 3 字节 DTC 或 DTC group：

```text
14 + groupOfDTC
```

### 6.2 读取故障信息：0x19

常用子功能：

| 子功能 | 含义 |
|---:|---|
| `0x01` | 按状态掩码报告 DTC 数量 |
| `0x02` | 按状态掩码报告 DTC |
| `0x03` | 报告 DTC 快照标识 |
| `0x04` | 按 DTC 读取快照记录 |
| `0x05` | 按记录号读取快照记录 |
| `0x06` | 按 DTC 读取扩展数据 |
| `0x07` | 按严重度掩码报告 DTC 数量 |
| `0x08` | 按严重度掩码报告 DTC |
| `0x09` | 报告 DTC 严重度信息 |
| `0x0A` | 报告支持的 DTC |
| `0x0B` | 报告首次测试失败 DTC |
| `0x0C` | 报告首次确认 DTC |
| `0x0D` | 报告最近测试失败 DTC |
| `0x0E` | 报告最近确认 DTC |
| `0x0F` | 按状态掩码报告镜像内存 DTC |
| `0x14` | 报告 DTC 故障检测计数器 |
| `0x15` | 报告永久 DTC |

## 7. 会话管理

标准会话类型：

| 类型 | 名称 |
|---:|---|
| `0x01` | Default Session |
| `0x02` | Programming Session |
| `0x03` | Extended Diagnostic Session |
| `0x04` | Safety System Diagnostic Session |

会话切换会影响：

- 支持哪些服务和子功能。
- 安全访问状态是否重置。
- 周期发送是否停止。
- 事件响应逻辑是否重置。
- 通信状态、测量值、临时设置是否恢复。

典型流程：

```text
上电后 ECU 进入 Default Session
Tester 发送 10 03 进入 Extended Session
ECU 响应 50 03
Tester 周期发送 3E 00 保持会话
超时后 ECU 回到 Default Session
```

## 8. 轮询、周期和事件响应

### 8.1 简单/轮询服务

普通诊断服务一般是一问一答：

```text
Tester Request
ECU Positive Response / Negative Response
```

物理寻址通常最多一个响应；功能寻址可能有多个 ECU 响应。

### 8.2 周期服务：0x2A

`0x2A Read Data By Periodic Identifier` 用于周期发送数据。流程：

```text
1. Tester 请求建立周期发送
2. ECU 给初始正响应
3. ECU 周期发送数据
4. Tester 请求停止某个周期数据
```

Transmission Mode：

| 值 | 含义 |
|---:|---|
| `0x01` | Slow |
| `0x02` | Medium |
| `0x03` | Fast |
| `0x04` | Stop sending |

具体频率由 OEM 和 ECU 供应商定义，标准只定义抽象档位。

周期响应有两种格式：

- Type 1：带 Response SID。
- Type 2：不带 Response SID。

### 8.3 事件响应：0x86

`0x86 Response On Event` 用于事件驱动响应，例如 DTC 状态变化时上报。

特点：

- 可在任意会话激活，包括默认会话。
- 激活后不需要 Tester Present 保活。
- 先配置事件逻辑，再启动事件逻辑。
- 事件发生后 ECU 主动返回 0 到 n 个事件响应。
- 多个事件之间的时间间隔是不确定的。

常见 Event Type：

| 值 | 含义 |
|---:|---|
| `0x00` | Stop Event Logic |
| `0x01` | 错误内存变化事件 |
| `0x03` | 某个 DID 描述的测量值变化事件 |
| `0x05` | Start Event Logic |
| `0x06` | Clear Event Logic |

## 9. 条件相关响应码

部分 NRC 描述的是车辆状态或环境条件：

| NRC | 含义 |
|---:|---|
| `0x81` | 转速过高 |
| `0x82` | 转速过低 |
| `0x83` | 发动机运行中 |
| `0x84` | 发动机未运行 |
| `0x85` | 发动机运行时间过短 |
| `0x86` | 温度过高 |
| `0x87` | 温度过低 |
| `0x88` | 车速过高 |
| `0x89` | 车速过低 |
| `0x8A` | 油门/踏板过高 |
| `0x8B` | 油门/踏板过低 |
| `0x8C` | 档位不在空挡 |
| `0x8D` | 档位不在目标档 |
| `0x8F` | 制动开关未闭合 |
| `0x90` | 换挡杆不在 P 档 |
| `0x91` | 液力变矩器离合器锁止 |
| `0x92` | 电压过高 |
| `0x93` | 电压过低 |

这类码的核心含义是：服务本身可能支持，但当前车辆状态不允许执行。

## 10. 实战抓包阅读方法

看到一段 UDS 报文，按这个顺序判断：

1. 看第一个字节是不是 `0x7F`。
   - 是：负响应，按 `7F + 原始 SID + NRC` 解读。
   - 否：看是不是请求 SID 或正响应 SID。
2. 正响应一般用 `请求 SID + 0x40` 对应。
   - `0x10 -> 0x50`
   - `0x22 -> 0x62`
   - `0x27 -> 0x67`
   - `0x31 -> 0x71`
   - `0x34 -> 0x74`
   - `0x36 -> 0x76`
   - `0x37 -> 0x77`
3. 判断服务属于哪一类：
   - `0x10/0x11/0x27/0x3E`：会话、安全、复位、保活。
   - `0x22/0x2E`：DID 读写。
   - `0x19/0x14`：DTC。
   - `0x31`：例程。
   - `0x34/0x36/0x37`：刷写传输。
4. 如果有子功能，检查 bit7 是否置位。
5. 如果返回 `0x7E/0x7F`，优先怀疑当前会话不对。
6. 如果返回 `0x33/0x35/0x36/0x37`，优先检查 Security Access。
7. 如果返回 `0x78`，等待 ECU 后续响应，不要立刻判失败。

## 11. 最值得记住的最小知识集

```text
UDS = ISO 14229 应用层诊断协议
CAN 上常配 ISO-TP / ISO 15765-2
请求 = SID + 参数
正响应 = SID + 0x40
负响应 = 7F + 原始 SID + NRC
SubFunction bit7 可抑制正响应，但不抑制负响应
0x10 会话，0x27 安全，0x3E 保活
0x22/0x2E DID 读写
0x19/0x14 DTC 读清
0x31 例程控制
0x34/0x36/0x37 刷写下载
0x78 代表处理中，不代表失败
0x7E/0x7F 多半是当前会话不支持
```

