![](assets/0x10(DiagnosticSessionControl)/file-20260702134922899.png)![](assets/0x10(DiagnosticSessionControl)/file-20260702135017645.png)

# 为什么需要有不同的诊断会话模式？
因为在 DefaultSession 的模式下，部分诊断服务不支持。如果需要使用某些服务，则需要处于非 DefaultSession 模式下。具体有哪些服务在 DefaultSession 不支持，请查看下方的表格。![](assets/0x10(DiagnosticSessionControl)/file-20260702135157061.png)

# 诊断请求
 对于 普通 CAN:
 比如 02 10 02：0* 代表着 x个报文 字节，这里代表着普通 CAN 的两个字节的报文。 10 服务（会话控制） 02 代表着子服务编程会话。
 对于 CAN FD:
 比如 00 23 22  F 1 86...... 00 代表着 CAN FD 0 x 23 代表着 35 个报文字节。
 ![](assets/0x10(DiagnosticSessionControl)/file-20260702140315826.png)

# 诊断响应

### 正响应格式
Service ID 是相对应的服务 ID 增加 0 x 40（即 0 x 10 服务的正相应应为 0 x 50）。
### 负响应格式
参数 1：Negative Response Service Id（固定不变为 7 F）  
参数 2： Request Service Id （相对应分诊断服务（10 服务则返回 10 服务））  
参数 3：responseCode（错误返回码 / NRC 码）
![](assets/0x10(DiagnosticSessionControl)/file-20260702141013489.png)
