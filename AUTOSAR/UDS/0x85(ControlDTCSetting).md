![](assets/0x85(ControlDTCSetting)/file-20260702144724000.png)/file-20260702144724000.png)![](assets/0x85(ControlDTCSetting)/file-20260702144847847.png)

# 功能
客户端应使用 ControlDTCSetting 服务停止或恢复服务器中诊断故障代码（DTC）的设置。该服务请求消息可用于停止在单个服务器或一组服务器中设置诊断故障代码。如果被寻址的服务器不能停止诊断故障代码的设置，则它应以 ControlDTCSetting 否定响应消息作为响应，指示拒绝原因。一旦执行了将子功能设置为“ on”的 ControlDTCSetting 请求或发生会话层超时（服务器转换为 defaultSession），DTC 状态位信息的更新将继续。如果活动会话中支持该服务且请求了该请求，则服务器仍应发送肯定响应。即使请求的 DTC 设置状态已经激活，该子功能也将设置为“ on”或“ off”。如果客户端发送了 clearDiagnosticInformation（14 hex）服务，则 ControlDTCSetting 不应禁止重置服务器的 DTC 内存。如果执行成功的 ECUReset，则重新启用 DTC 的设置。


# 诊断格式
![](assets/0x85(ControlDTCSetting)/file-20260702145238143.png)
![](assets/0x85(ControlDTCSetting)/file-20260702145249832.png)

另一个参数 DTCSettingControlOptionRecord 是用户可选的，并在控制 DTC 设置时将数据传输到服务器。 它可以包含要打开或关闭的 DTC 列表。
![](assets/0x85(ControlDTCSetting)/file-20260702145338111.png)/file-20260702145338111.png)