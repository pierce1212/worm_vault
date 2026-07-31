客户端请求从客户端到服务器的数据传输。服务器收到 requestDownload 请求消息后，服务器应在发送肯定响应消息之前采取所有必要的措施来接收数据。在这里，ISO 14229 中并没有明确定义需要采用什么措施来确保接受数据的可行性。因此，需要额外关注主车厂给到的相关措施。我所在项目的要求是：进入 ProgrammingSession 会话模式下，并对安全访问进行解锁之后才能进行数据的传输。


# 诊断请求格式
![](assets/0x34%20Request%20Download/file-20260728143752995.png)
![](assets/0x34%20Request%20Download/file-20260728143807028.png)


# 正响应格式
![](assets/0x34%20Request%20Download/file-20260728143829595.png)

# 负响应格式
![](assets/0x34%20Request%20Download/file-20260728143851355.png)
