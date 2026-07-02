0 x 11(ECUReset)服务的主要作用是使用 ECUReset 服务来请求服务器重置。该服务根据嵌入在 ECUReset 请求消息中的 resetType 参数值的内容，请求服务器有效地执行服务器重置。 在服务器中执行重置之前，必须发送 ECUReset 肯定响应消息（如果需要）。 成功重置服务器后，服务器应激活 DefaultSession。
![](assets/0x11(ECUReset)/file-20260702141208336.png)


# 诊断请求
参数 1：ECUReset Request Service Id（该服务固定为 0 x 11）  
参数 2：sub-function（子功能选择）![](assets/0x11(ECUReset)/file-20260702141401040.png)


# 诊断响应
## 正响应
第一个参数：Service ID 是相对应的服务 ID 增加 0 x 40（即 0 x 11 服务的正相应应为 0 x 51）。
第二个参数：复位类型
第三个参数：powerDownTime。从正响应的格式说明里面，我们可以得知这里是只有当请求的子功能位 0 x 04（enableRapidPowerShutDown）时，该参数才被使用。

## 复响应
参数 1：Negative Response Service Id（固定不变为 7 F）  
参数 2： Request Service Id （相对应分诊断服务（11 服务则返回 11 服务））  
参数 3：responseCode（错误返回码 / NRC 码）
![](assets/0x11(ECUReset)/file-20260702141734660.png)
