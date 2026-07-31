# 功能
请求控制特定于服务器的输入/输出。客户端请求消息包含一个 DID，用于输入信号，内部服务器功能或输出信号。 controlOptionRecord 参数应包含服务器的输入信号，内部功能和输出信号所需的所有信息。如果请求消息已成功执行，则服务器应发送肯定响应消息。 即使 DID 当前不受测试人员控制，服务器也应使用 returnControlToECU 的 inputOutputControlIParameter 向请求消息发送肯定响应消息。 如果需要，请求消息的 controlOptionRecord 参数可以实现为单个 ON / OFF 参数，也可以实现为更复杂的控制参数序列，包括多个循环，持续时间等。该服务允许在单个请求消息中使用相应的 controlOptionRecord 控制单个 DID。 这样，服务器将以单个响应消息进行响应，其中包括请求消息的 DID 以及可选的 controlStatus 信息。

# 诊断请求格式
![](assets/0x2F(InputOutputControlByIdentifier)/file-20260715173741197.png)
## Sub-function
![](assets/0x2F(InputOutputControlByIdentifier)/file-20260715173844427.png)

# 正响应
![](assets/0x2F(InputOutputControlByIdentifier)/file-20260715173910165.png)
# 负向应
![](assets/0x2F(InputOutputControlByIdentifier)/file-20260715173928811.png)/file-20260715173928811.png)