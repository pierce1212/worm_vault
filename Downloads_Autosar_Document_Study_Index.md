# Downloads AUTOSAR/车载软件资料学习索引

生成时间：2026-05-20 11:26:00

资料目录：`C:/Users/nvtc140/Downloads`

输出说明：这是给猪芯以后回答 AUTOSAR、CANoe、CAPL、S32K、MCAL、通信栈、诊断栈问题时用的本地学习索引。

## 1. 文档清单

1. **AUTOSAR MCAL 的原理与实践.pdf** — 243 页，34.44 MB
2. **AUTOSAR Overview.pdf** — 28 页，3.39 MB
3. **AUTOSAR_User_Manual_CAN_COM.pdf** — 61 页，4.53 MB
   - 主题判断：COM通信栈, AUTOSAR总览/架构, PNC/网络管理
4. **Can Communication Stack Training.pdf** — 30 页，4.04 MB
5. **Diagnostic Stack.pdf** — 36 页，3.79 MB
6. **ETAS _RH850_MCAN_UserManul_1.0.pdf** — 11 页，1.06 MB
   - 主题判断：MCAL/EB tresos配置, CAN/RH850/MCAN, AUTOSAR总览/架构
7. **ETAS_AUTOSAR_User_Manual_PNC.pdf** — 26 页，1.52 MB
   - 主题判断：PNC/网络管理, COM通信栈, AUTOSAR总览/架构
8. **Freetech_AUTOSAR_User_Manual_E2E.pdf** — 23 页，1.51 MB
   - 主题判断：E2E保护, AUTOSAR总览/架构, COM通信栈
9. **Freetech_AUTOSAR_User_Manual_NvBlock.pdf** — 12 页，2.0 MB
   - 主题判断：存储/NvM/MemStack, AUTOSAR总览/架构, MCAL/EB tresos配置
10. **How to deploy UDS Diag Stack by Dext in RTA_CAR9_2_1.pdf** — 38 页，5.08 MB
   - 主题判断：诊断UDS/DCM/DEM, AUTOSAR总览/架构, COM通信栈
11. **LATE-017 SR5E1 How to configure MCAL with EB tresos studio Rev3.0 Jun 2024.pdf** — 88 页，8.5 MB
   - 主题判断：MCAL/EB tresos配置, 存储/NvM/MemStack, 电机控制器软件
12. **Memory Stack.pdf** — 60 页，8.29 MB
13. **基于AUTOSAR规范的车用电机控制器软件开发.pdf** — 206 页，35.26 MB

## 2. 推荐学习顺序

1. AUTOSAR Overview.pdf：先建立 AUTOSAR 分层、RTE、BSW、MCAL、服务层的整体地图。
2. Can Communication Stack Training.pdf：再学习 COM/PduR/CanIf/CanDrv/CAN TP 的数据路径。
3. AUTOSAR_User_Manual_CAN_COM.pdf：结合实际 CAN COM 配置，把 Signal/I-PDU/L-PDU 的关系落到工具配置。
4. Diagnostic Stack.pdf：学习 DCM/DEM/UDS 诊断栈，与 CANoe 诊断测试关联。
5. How to deploy UDS Diag Stack by Dext in RTA_CAR9_2_1.pdf：看 ETAS/RTA-CAR 诊断栈部署流程。
6. Memory Stack.pdf：学习 NvM/MemIf/Fee/Fls 等存储栈。
7. Freetech_AUTOSAR_User_Manual_NvBlock.pdf：把 NvBlock 配置细节补齐。
8. Freetech_AUTOSAR_User_Manual_E2E.pdf：学习 E2E 保护、计数器、CRC、DataID。
9. ETAS_AUTOSAR_User_Manual_PNC.pdf：学习 ComM/NM/PNC 部分网络。
10. LATE-017 SR5E1 How to configure MCAL with EB tresos studio Rev3.0 Jun 2024.pdf：重点看 EB tresos 下 MCAL 配置方法，可迁移到 S32K3 GUI 理解。
11. AUTOSAR MCAL 的原理与实践.pdf：补 MCAL 原理与驱动抽象层理解。
12. 基于AUTOSAR规范的车用电机控制器软件开发.pdf：结合应用层/电机控制器软件架构理解完整项目。

## 3. 分主题索引

### AUTOSAR总览/架构
- AUTOSAR_User_Manual_CAN_COM.pdf（命中分：65）
- Freetech_AUTOSAR_User_Manual_E2E.pdf（命中分：63）
- ETAS_AUTOSAR_User_Manual_PNC.pdf（命中分：57）
- How to deploy UDS Diag Stack by Dext in RTA_CAR9_2_1.pdf（命中分：24）
- LATE-017 SR5E1 How to configure MCAL with EB tresos studio Rev3.0 Jun 2024.pdf（命中分：12）
- ETAS _RH850_MCAN_UserManul_1.0.pdf（命中分：12）
- Freetech_AUTOSAR_User_Manual_NvBlock.pdf（命中分：8）

### COM通信栈
- ETAS_AUTOSAR_User_Manual_PNC.pdf（命中分：171）
- AUTOSAR_User_Manual_CAN_COM.pdf（命中分：145）
- Freetech_AUTOSAR_User_Manual_E2E.pdf（命中分：62）
- How to deploy UDS Diag Stack by Dext in RTA_CAR9_2_1.pdf（命中分：22）
- ETAS _RH850_MCAN_UserManul_1.0.pdf（命中分：10）
- Freetech_AUTOSAR_User_Manual_NvBlock.pdf（命中分：2）
- LATE-017 SR5E1 How to configure MCAL with EB tresos studio Rev3.0 Jun 2024.pdf（命中分：1）

### 诊断UDS/DCM/DEM
- How to deploy UDS Diag Stack by Dext in RTA_CAR9_2_1.pdf（命中分：111）
- AUTOSAR_User_Manual_CAN_COM.pdf（命中分：11）
- Freetech_AUTOSAR_User_Manual_E2E.pdf（命中分：5）
- ETAS_AUTOSAR_User_Manual_PNC.pdf（命中分：5）
- LATE-017 SR5E1 How to configure MCAL with EB tresos studio Rev3.0 Jun 2024.pdf（命中分：3）
- ETAS _RH850_MCAN_UserManul_1.0.pdf（命中分：3）

### 存储/NvM/MemStack
- Freetech_AUTOSAR_User_Manual_E2E.pdf（命中分：51）
- AUTOSAR_User_Manual_CAN_COM.pdf（命中分：41）
- ETAS_AUTOSAR_User_Manual_PNC.pdf（命中分：40）
- LATE-017 SR5E1 How to configure MCAL with EB tresos studio Rev3.0 Jun 2024.pdf（命中分：37）
- Freetech_AUTOSAR_User_Manual_NvBlock.pdf（命中分：36）
- How to deploy UDS Diag Stack by Dext in RTA_CAR9_2_1.pdf（命中分：13）
- ETAS _RH850_MCAN_UserManul_1.0.pdf（命中分：8）

### MCAL/EB tresos配置
- LATE-017 SR5E1 How to configure MCAL with EB tresos studio Rev3.0 Jun 2024.pdf（命中分：141）
- ETAS _RH850_MCAN_UserManul_1.0.pdf（命中分：36）
- AUTOSAR_User_Manual_CAN_COM.pdf（命中分：36）
- How to deploy UDS Diag Stack by Dext in RTA_CAR9_2_1.pdf（命中分：15）
- ETAS_AUTOSAR_User_Manual_PNC.pdf（命中分：14）
- Freetech_AUTOSAR_User_Manual_E2E.pdf（命中分：11）
- Freetech_AUTOSAR_User_Manual_NvBlock.pdf（命中分：8）

### E2E保护
- Freetech_AUTOSAR_User_Manual_E2E.pdf（命中分：244）
- LATE-017 SR5E1 How to configure MCAL with EB tresos studio Rev3.0 Jun 2024.pdf（命中分：1）
- How to deploy UDS Diag Stack by Dext in RTA_CAR9_2_1.pdf（命中分：1）

### PNC/网络管理
- ETAS_AUTOSAR_User_Manual_PNC.pdf（命中分：322）
- AUTOSAR_User_Manual_CAN_COM.pdf（命中分：59）
- Freetech_AUTOSAR_User_Manual_E2E.pdf（命中分：21）
- How to deploy UDS Diag Stack by Dext in RTA_CAR9_2_1.pdf（命中分：14）
- ETAS _RH850_MCAN_UserManul_1.0.pdf（命中分：6）
- LATE-017 SR5E1 How to configure MCAL with EB tresos studio Rev3.0 Jun 2024.pdf（命中分：1）

### CAN/RH850/MCAN
- ETAS _RH850_MCAN_UserManul_1.0.pdf（命中分：28）
- AUTOSAR_User_Manual_CAN_COM.pdf（命中分：22）

### 电机控制器软件
- LATE-017 SR5E1 How to configure MCAL with EB tresos studio Rev3.0 Jun 2024.pdf（命中分：31）
- ETAS _RH850_MCAN_UserManul_1.0.pdf（命中分：3）
- How to deploy UDS Diag Stack by Dext in RTA_CAR9_2_1.pdf（命中分：2）
- ETAS_AUTOSAR_User_Manual_PNC.pdf（命中分：2）
- Freetech_AUTOSAR_User_Manual_E2E.pdf（命中分：1）
- AUTOSAR_User_Manual_CAN_COM.pdf（命中分：1）

## 4. 每份文档的目录/重点摘录

### AUTOSAR MCAL 的原理与实践.pdf
- 路径：`C:\Users\nvtc140\Downloads\AUTOSAR MCAL 的原理与实践.pdf`
- 页数/大小：243 页 / 34.44 MB
- PDF标题：14504464
- 目录来源：embedded
- 目录前若干项：
  - 封面  (p.1)
  - 书名  (p.2)
  - 版权  (p.3)
  - 前言  (p.4)
  - 目录  (p.19)
  - 1  (p.24)
  - 2  (p.25)
  - 3  (p.26)
  - 4  (p.27)
  - 5  (p.28)
  - 6  (p.29)
  - 7  (p.30)
  - 8  (p.31)
  - 9  (p.32)
  - 10  (p.33)
  - 11  (p.34)
  - 12  (p.35)
  - 13  (p.36)

### AUTOSAR Overview.pdf
- 路径：`C:\Users\nvtc140\Downloads\AUTOSAR Overview.pdf`
- 页数/大小：28 页 / 3.39 MB
- PDF标题：S22C-6i23080208570

### AUTOSAR_User_Manual_CAN_COM.pdf
- 路径：`C:\Users\nvtc140\Downloads\AUTOSAR_User_Manual_CAN_COM.pdf`
- 页数/大小：61 页 / 4.53 MB
- 主要主题：COM通信栈, AUTOSAR总览/架构, PNC/网络管理, 存储/NvM/MemStack, MCAL/EB tresos配置, CAN/RH850/MCAN, 诊断UDS/DCM/DEM, 电机控制器软件
- 目录来源：scanned_first_pages
- 目录前若干项：
  - Contents  (p.3)
  - Contents  (p.3)
- 高频关键词：com(96), nm(41), ea(38), autosar(26), port(20), rte(19), bsw(18), signal(17), ipdu(16), spi(11), mailbox(11), canif(10)
- 开头可读文本：
  > [page 1]
  > FREETECH DMS AUTOSAR Platform - 1p0
  > User Manual – CAN-COM
  > Status: Released
  > [page 2]
  > Copyright
  > The data in this document may not be altered or amended without special notification
  > from ETAS GmbH. ETAS GmbH undertakes no further obligation in relation to this docu-
- 代表片段：
  - com：[page 1] FREETECH DMS AUTOSAR Platform - 1p0 User Manual – CAN-COM Status: Released [page 2] 2 Copyright The data in this document may not be altered or amended without special notification from ETAS GmbH. ETAS GmbH undertakes no further obligation in relation to this docu- ment. The software described in it can only be used if the customer is in possession of a general license agreement or single license. Using
  - nm：....................................................... 48 Use Case 11: ComIPdu Callout and Checksum ................................................................. 49 3 CAN NM ................................................................................................................................ 52 Introduction ................................................................................................................... 52 CANNM C
  - ea：[page 1] FREETECH DMS AUTOSAR Platform - 1p0 User Manual – CAN-COM Status: Released [page 2] 2 Copyright The data in this document may not be altered or amended without special notification from ETAS GmbH. ETAS GmbH undertakes no further obligation in relation to this docu- ment. The software described in it can only be used if the customer is in possession of a general license agreement or single license. Using and copying is

### Can Communication Stack Training.pdf
- 路径：`C:\Users\nvtc140\Downloads\Can Communication Stack Training.pdf`
- 页数/大小：30 页 / 4.04 MB
- PDF标题：S22C-6i23080208460

### Diagnostic Stack.pdf
- 路径：`C:\Users\nvtc140\Downloads\Diagnostic Stack.pdf`
- 页数/大小：36 页 / 3.79 MB
- PDF标题：S22C-6i23080208430

### ETAS _RH850_MCAN_UserManul_1.0.pdf
- 路径：`C:\Users\nvtc140\Downloads\ETAS _RH850_MCAN_UserManul_1.0.pdf`
- 页数/大小：11 页 / 1.06 MB
- PDF标题：ETAS Manual
- 主要主题：MCAL/EB tresos配置, CAN/RH850/MCAN, AUTOSAR总览/架构, COM通信栈, 存储/NvM/MemStack, PNC/网络管理, 诊断UDS/DCM/DEM, 电机控制器软件
- 目录来源：scanned_first_pages
- 目录前若干项：
  - 3 | Contents  (p.3)
  - Contents  (p.3)
  - 4 | Safety and Privacy Information  (p.4)
  - 5 | Safety and Privacy Information  (p.5)
  - 6 | Safety and Privacy Information  (p.6)
  - 7 | Import CAN Configuration from BIP  (p.7)
  - 8 | Import CAN Configuration from BIP  (p.8)
  - 9 | Import CAN Configuration from BIP  (p.9)
  - 10 | Import CAN Configuration from BIP  (p.10)
  - 11 | Contact Information  (p.11)
  - 70469 Stuttgart  (p.11)
- 高频关键词：port(23), mcan(14), rh850(13), com(10), mcal(10), ea(8), mcu(6), autosar(4), rte(4), nm(3), bsw(2), basic software(2)
- 开头可读文本：
  > [page 1]
  > ETAS _RH850_MCAN_1.0
  > Import CAN Configuration from BIP
  > [page 2]
  > Copyright
  > The data in this document may not be altered or amended without special notification
  > from ETA S GmbH. ETAS GmbH undertakes no further obligation in relation to this docu-
  > ment. The software described in it can only be used if the customer is in possession of a
- 代表片段：
  - port：[page 1] ETAS _RH850_MCAN_1.0 Import CAN Configuration from BIP [page 2] Copyright The data in this document may not be altered or amended without special notification from ETA S GmbH. ETAS GmbH undertakes no further obligation in relation to this docu- ment. The software described in it can only be used if the customer is in possession of a general license agreement or single license.
  - mcan：[page 1] ETAS _RH850_MCAN_1.0 Import CAN Configuration from BIP [page 2] Copyright The data in this document may not be altered or amended without special notification from ETA S GmbH. ETAS GmbH undertakes no further obligation in relation to this docu- ment. The software described in it can only be used if the customer is in possession of a general license agreement or si
  - rh850：[page 1] ETAS _RH850_MCAN_1.0 Import CAN Configuration from BIP [page 2] Copyright The data in this document may not be altered or amended without special notification from ETA S GmbH. ETAS GmbH undertakes no further obligation in relation to this docu- ment. The software described in it can only be used if the customer is in possession of a general license agreement

### ETAS_AUTOSAR_User_Manual_PNC.pdf
- 路径：`C:\Users\nvtc140\Downloads\ETAS_AUTOSAR_User_Manual_PNC.pdf`
- 页数/大小：26 页 / 1.52 MB
- 主要主题：PNC/网络管理, COM通信栈, AUTOSAR总览/架构, 存储/NvM/MemStack, MCAL/EB tresos配置, 诊断UDS/DCM/DEM, 电机控制器软件
- 目录来源：scanned_first_pages
- 目录前若干项：
  - Contents  (p.3)
  - Contents  (p.3)
  - 2 shows the layered architecture of these modules and the data flow of NM message, which  (p.9)
  - will be explained detailed in chapter 3.1.  (p.9)
  - layer for passing the changed PN information to Com module. This chapter explains how this  (p.10)
  - Partial Networking Information of the NM-PDU following NM PDU Filter Algorithm (Chapter  (p.10)
  - using RTA-BSW is introduced in Chapter 3.2.  (p.11)
  - with this. Please refer chapter 3.5):  (p.11)
  - If the PN is locally requested by the node (see Use Case 4 in Chapter 3.4), PN Control  (p.11)
  - In this chapter, the ComM functional regarding PNC management except PNC Gateway will  (p.12)
  - be introduced. In the last chapter we have learned that the PNC requests are transmitted by  (p.12)
  - behavior, please refer AUTOSAR_SWS_COMManager.pdf chapter 7.1.3.  (p.12)
- 高频关键词：com(133), comM(93), pnc(88), nm(86), cannm(42), ea(40), bsw(28), autosar(24), partial network(13), canif(12), pdur(10), port(9)
- 开头可读文本：
  > [page 1]
  > ETAS AUTOSAR
  > User Manual – PNC
  > Status: Released
  > [page 2]
  > Copyright
  > The data in this document may not be altered or amended without special notification
  > from ETAS GmbH. ETAS GmbH undertakes no further obligation in relation to this docu-
- 代表片段：
  - com：............ 12 2.2.5 PN Timer ................................................................................................................... 12 PNC State Management with ComM ................................................................................ 12 2.3.1 PNC State Machine ..................................................................................................... 12 2.3.2 PNC, ComMUser and ComMChannel ....................
  - comM：............ 12 2.2.5 PN Timer ................................................................................................................... 12 PNC State Management with ComM ................................................................................ 12 2.3.1 PNC State Machine ..................................................................................................... 12 2.3.2 PNC, ComMUser and ComMChannel ....................
  - pnc：[page 1] ETAS AUTOSAR User Manual – PNC Status: Released [page 2] 2 Copyright The data in this document may not be altered or amended without special notification from ETAS GmbH. ETAS GmbH undertakes no further obligation in relation to this docu- ment. The software described in it can only be used if the customer is in possession of a general license agreement or single license. Using

### Freetech_AUTOSAR_User_Manual_E2E.pdf
- 路径：`C:\Users\nvtc140\Downloads\Freetech_AUTOSAR_User_Manual_E2E.pdf`
- 页数/大小：23 页 / 1.51 MB
- 主要主题：E2E保护, AUTOSAR总览/架构, COM通信栈, 存储/NvM/MemStack, PNC/网络管理, MCAL/EB tresos配置, 诊断UDS/DCM/DEM, 电机控制器软件
- 目录来源：embedded
- 目录前若干项：
  - 1 Introduction  (p.6)
  -   1.1 Who should read this document  (p.6)
  -   1.2 How will you receive more information  (p.6)
  -   1.3 Safety Notice  (p.6)
  -   1.4 Definitions and Abbreviations  (p.7)
  -   1.5 Conventions  (p.9)
  - 2 E2E Protection Overview  (p.10)
  -   2.1 E2E Library introduction  (p.10)
  -   2.2 E2E profile Introduction  (p.11)
  -   2.3 Implementation of E2E Library  (p.13)
  - 3 E2E BSW Configuration  (p.14)
  - 4 Use Case 1: E2E Protection Requirement in System Description  (p.16)
  - 5 Use Case 2: E2E Wrapper Implementation  (p.17)
  - 6 Use Case 3: DataTypeMapping and DataMapping for SignalGroup  (p.20)
  - 7 ETAS Contact Addresses  (p.22)
  -   ETAS HQ  (p.22)
  -   ETAS Automotive Technology (Shanghai) Co., Ltd.  (p.22)
- 高频关键词：e2e(131), ea(47), com(41), crc(41), autosar(34), counter(32), profile(28), comM(20), signal(19), rte(17), bsw(10), data id(9)
- 开头可读文本：
  > [page 1]
  > FREETECH DMS AUTOSAR Platform - 1p0
  > User Manual – E2E
  > Status: Released
  > [page 2]
  > Copyright
  > The data in this document may not be altered or amended without special notification
  > from ETAS GmbH. ETAS GmbH undertakes no further obligation in relation to this docu-
- 代表片段：
  - e2e：[page 1] FREETECH DMS AUTOSAR Platform - 1p0 User Manual – E2E Status: Released [page 2] 2 Copyright The data in this document may not be altered or amended without special notification from ETAS GmbH. ETAS GmbH undertakes no further obligation in relation to this docu- ment. The software described in it can only be used if the customer is in possession of a general license agreement or single license. Using
  - ea：[page 1] FREETECH DMS AUTOSAR Platform - 1p0 User Manual – E2E Status: Released [page 2] 2 Copyright The data in this document may not be altered or amended without special notification from ETAS GmbH. ETAS GmbH undertakes no further obligation in relation to this docu- ment. The software described in it can only be used if the customer is in possession of a general license agreement or single license. Using and copying is
  - com：................................................. 22 [page 4] ETAS Figures FREETECH DMS AUTOSAR Platform - 1p0 User Manual – E2E 4 Figures Figure 1 - Source of faults in E2E communication ................................................................................. 10 Figure 2 - Timeout detection ................................................................................................................. 12 Figure 3 - Example Data layout 

### Freetech_AUTOSAR_User_Manual_NvBlock.pdf
- 路径：`C:\Users\nvtc140\Downloads\Freetech_AUTOSAR_User_Manual_NvBlock.pdf`
- 页数/大小：12 页 / 2.0 MB
- 主要主题：存储/NvM/MemStack, AUTOSAR总览/架构, MCAL/EB tresos配置, COM通信栈
- 目录来源：scanned_first_pages
- 目录前若干项：
  - Contents  (p.2)
- 高频关键词：ea(28), port(8), nvm(6), rte(5), bsw(2), com(2), nvram(2), autosar(1)
- 开头可读文本：
  > [page 1]
  > FREETECH DMS AUTOSAR Platform - 1p0
  > User Manual – NvBlock
  > Status: Released
  > [page 2]
  > Contents
  > 1.
  > Create NvBlock SWC and NvBlock Descriptor ....................................................................................... 3
- 代表片段：
  - ea：[page 1] FREETECH DMS AUTOSAR Platform - 1p0 User Manual – NvBlock Status: Released [page 2] Contents 1. Create NvBlock SWC and NvBlock Descriptor ....................................................................................... 3 2. Create DataTypes (IDT and ADT) for data elements ............................................................................ 3 3. Create Interfaces ..........................................
  - port：........... 3 3. Create Interfaces ................................................................................................................................... 4 4. Add ports in NvBlock SWC .................................................................................................................... 5 5. Edit Internal Behavior in NvBlock SWC .............................................................................................
  - nvm：already exists. - Create DataTypeMappingSet and DataTypeMap: [page 4] 3. Create Interfaces - Create Nv Data Interface The type of interface which connects NvBlock SWC and NvM user SWC (Application SWC e.g. NvM_SWC) is Nv Data Interface. - Reference ADT to NvData under the Interface - Create ClientServerInterface for NvMNotifyJobFinished This one may already have been provided in example project. [page 5] 4. Add ports in NvBlock SWC - Add PR-Port 

### How to deploy UDS Diag Stack by Dext in RTA_CAR9_2_1.pdf
- 路径：`C:\Users\nvtc140\Downloads\How to deploy UDS Diag Stack by Dext in RTA_CAR9_2_1.pdf`
- 页数/大小：38 页 / 5.08 MB
- PDF标题：ETAS Manual
- 主要主题：诊断UDS/DCM/DEM, AUTOSAR总览/架构, COM通信栈, MCAL/EB tresos配置, PNC/网络管理, 存储/NvM/MemStack, 电机控制器软件, E2E保护
- 目录来源：scanned_first_pages
- 目录前若干项：
  - Contents  (p.3)
  - Contents  (p.3)
  - 1.1 Scope  (p.4)
  - 1.2 Sample project assumptions  (p.4)
  - 1.2.1 UDS General Requirements  (p.4)
  - 1.3 Definitions and Abbreviations  (p.4)
  - 2.1 Background  (p.6)
  - 2.2 Add configuration for Dext in ISOLAR A/B 9.2.1  (p.6)
  - In this chapter we are going to show how to:  (p.6)
  - 2.2.1 Import the Dext file into the project  (p.7)
  - 2.2.2 Replace ECU in Dext  (p.8)
  - 2.2.3 Add Diagnostic Connection  (p.10)
  - 2.2.4 Add Diagnostic Protocol  (p.11)
- 高频关键词：uds(43), diagnostic(29), com(17), dcm(17), dem(15), bsw(13), ea(13), port(13), comM(11), autosar(5), did(5), rte(4)
- 开头可读文本：
  > [page 1]
  > ETAS RTA-CAR User Manual
  > How to configure UDS (ISO 14229)
  > [page 2]
  > Copyright
  > The data in this document may not be altered or amended without special notifica-
  > tion from ETAS GmbH. ETAS GmbH undertakes no further obligation in relation to
  > this document. The software described in it can only be used if the customer is in
- 代表片段：
  - uds：[page 1] ETAS RTA-CAR User Manual How to configure UDS (ISO 14229) [page 2] Copyright The data in this document may not be altered or amended without special notifica- tion from ETAS GmbH. ETAS GmbH undertakes no further obligation in relation to this document. The software described in it can only be used if the customer is in possession of a general license agreement or single license. Using and copyin
  - diagnostic：.................................................... 7 2.2.2 Replace ECU in Dext .................................................................................. 8 2.2.3 Add Diagnostic Connection ....................................................................... 10 2.2.4 Add Diagnostic Protocol ............................................................................ 11 2.2.5 Add Diagnostic Ecu Instance Props ...........................
  - com：................................................. 11 2.2.5 Add Diagnostic Ecu Instance Props ........................................................... 13 2.2.6 Add DiagnosticCommonPropsVariables for DcmContributionSet ................. 14 2.2.7 Add DiagnosticCommonPropsVariants for DemContributionSet................... 14 2.2.8 Add configuration items for PrimaryMemory ............................................... 15 2.2.9 Add related configu

### LATE-017 SR5E1 How to configure MCAL with EB tresos studio Rev3.0 Jun 2024.pdf
- 路径：`C:\Users\nvtc140\Downloads\LATE-017 SR5E1 How to configure MCAL with EB tresos studio Rev3.0 Jun 2024.pdf`
- 页数/大小：88 页 / 8.5 MB
- 主要主题：MCAL/EB tresos配置, 存储/NvM/MemStack, 电机控制器软件, AUTOSAR总览/架构, 诊断UDS/DCM/DEM, COM通信栈, E2E保护, PNC/网络管理
- 目录来源：scanned_first_pages
- 目录前若干项：
  - Contents  (p.2)
  - 1.1 创建新的配置工程  (p.11)
- 高频关键词：mcu(62), spi(31), mcal(26), ea(17), fee(15), port(13), gpt(10), rte(8), dio(7), icu(7), fls(5), adc(5)
- 开头可读文本：
  > [page 1]
  > 如何使用 EB tresos 工具配置MCAL
  > 本文档基于以下版本介绍EB tresos 对于Stellar E1 芯片MCAL 的配置。
  > MCAL_A20_SR5E1_0.1.00-EAR
  > AUTOSAR R20-11
  > Elektrobit Tresos Release 29.1.0 (b220609-0352)
  > SR5E1 eLQFP176 cut 1.0
  > HighTec clang version 8.1.0
- 代表片段：
  - mcu：............................ 21 4.3 Resource 模块的配置 ....................................................................................................................... 22 4.4 Mcu 模块的配置 .............................................................................................................................. 22 4.4.1 外部晶振配置 .......................................................................................................................
  - spi：.................... 41 6.3 PWM Channel 配置 .......................................................................................................................... 42 7、MCAL – Spi 模块配置 ........................................................................................................................ 44 7.1 SPI 时钟配置 ..............................................................................................................................
  - mcal：[page 1] 如何使用 EB tresos 工具配置MCAL 本文档基于以下版本介绍EB tresos 对于Stellar E1 芯片MCAL 的配置。 • MCAL_A20_SR5E1_0.1.00-EAR • AUTOSAR R20-11 • Elektrobit Tresos Release 29.1.0 (b220609-0352) • SR5E1 eLQFP176 cut 1.0 • HighTec clang version 8.1.0 参考文档： 1. RM0483 SR5E1 Reference manual Rev3 Nov 2023 2. DS13808 SR5E1 Datasheet Rev4 Oct 2023 3. TN1404 SR5E1x IO definition Rev3 Sep 20

### Memory Stack.pdf
- 路径：`C:\Users\nvtc140\Downloads\Memory Stack.pdf`
- 页数/大小：60 页 / 8.29 MB
- PDF标题：S22C-6i23080208520

### 基于AUTOSAR规范的车用电机控制器软件开发.pdf
- 路径：`C:\Users\nvtc140\Downloads\基于AUTOSAR规范的车用电机控制器软件开发.pdf`
- 页数/大小：206 页 / 35.26 MB
- PDF标题：基于AUTOSAR规范的车用电机控制器软件开发
- 目录来源：embedded
- 目录前若干项：
  - 封面  (p.1)
  - 书名  (p.3)
  - 版权  (p.4)
  - 前言  (p.5)
  - 目录  (p.9)
  - 第1章 汽车电子的软件开发  (p.14)
  -   1.1 汽车电子系统简介  (p.15)
  -   1.2 汽车电子系统的开发  (p.18)
  -   1.3 基于AUTOSAR自顶向下地开发电机控制器  (p.20)
  -   1.4 汽车电子系统的安全性  (p.21)
  - 第2章 多核单片机在汽车电子系统中的应用  (p.23)
  -   2.1单核单片机在汽车电子系统中的应用及局限性  (p.23)
  -   2.2多核单片机在汽车电子系统中的优势和软件开发中的挑战  (p.23)
  -     2.2.1 多核处理器的优势  (p.23)
  -     2.2.2 多核软件开发所面临的问题  (p.24)
  -     2.2.3 AUTOSAR规范的应用  (p.24)
  -   2.3英飞凌AURIX单片机的特点介绍  (p.25)
  -     2.3.1 AURIX系列单片机简介  (p.25)

## 5. 我以后回答时的使用原则

- 问 AUTOSAR 通信栈：优先按 COM → PduR → CanTp/J1939Tp → CanIf → CanDrv 的路径解释，并区分 Signal、I-PDU、N-PDU、L-PDU。
- 问 CANoe/CAPL：结合 E:/CANoe开发从入门到精通.pdf、E:/CAPL编程手册.pdf，以及 Downloads 中通信栈/诊断栈资料。
- 问 S32K3/MCAL/EB tresos：把 GUI 配置项和 MCAL/硬件抽象层、寄存器/外设概念对应起来解释。
- 问 UDS/诊断：优先从 DCM/DEM/CanTp/PduR/CanIf 的链路说明 CANoe 测试为什么这样配。
- 问 NvM/E2E/PNC：优先引用对应用户手册的概念和配置路径，再结合项目落地。