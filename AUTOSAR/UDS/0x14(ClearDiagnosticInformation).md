该服务允许客户端从服务器清除诊断信息（包括 DTC，捕获的数据等）。完全处理该服务后，服务器应发送肯定响应。即使没有存储任何 DTC，服务器也应发送肯定的响应。 如果服务器支持内存中 DTC 状态信息的多个副本（例如，RAM 中的一个副本和 EEPROM 中的一个副本），则服务器应清除 ReadDTCInformation 状态报告服务使用的副本。其他副本，例如长期记忆中的备份副本会根据适当的备份策略进行更新（例如，在电源锁存阶段）。如果电源闩锁阶段受到干扰（例如，在电源闩锁阶段断开电池连接），则可能导致数据不一致。客户端的请求消息包含一个参数。参数 groupOfDTC 允许客户端清除一组 DTC 或特定的 DTC。除非另有说明，否则服务器应从内存中清除与排放有关的 DTC 信息和与非排放有关的 DTC 信息。
![](assets/0x14(ClearDiagnosticInformation)/file-20260728140548451.png)通过此服务重置/清除的 DTC 信息包括但不限于以下内容：  
—— DTC 状态字节  
—— DTC 快照数据  
—— DTC 扩展数据  
—— 其他与 DTC 相关的数据

<mark style="background: #FF5582A6;">永久故障码应存储在非易失性存储器中。 这些 DTC 不能通过任何测试设备（例如车载测试仪，非车载测试仪）清除。</mark> OBD 系统应通过完成并通过车载监控器自行清除这些故障诊断代码。 这将防止仅通过断开电池来清除 DTC。如<mark style="background: #FFF3A3A6;">果重新编程了发动机控制模块，并且所有受监视的组件和系统的就绪状态都设置为“未完成”，则永久性 DTC 必须可擦除。</mark>服务器中可选的可用 DTC 镜像存储器中存储的所有 DTC 信息均不受此服务的影响（有关 DTC 镜像存储器的定义，请参见 ReadDTCInformation（0 x 19）服务）。


# 诊断请求格式
![](assets/0x14(ClearDiagnosticInformation)/file-20260728140802179.png)

# 正响应格式
![](assets/0x14(ClearDiagnosticInformation)/file-20260728140903813.png)

# 负响应格式
![](assets/0x14(ClearDiagnosticInformation)/file-20260728140943547.png)
