![](assets/0x28(CommunicationControl)/file-20260702144119234.png)/file-20260702144119234.png)![](assets/0x28(CommunicationControl)/file-20260702144149490.png)/file-20260702144149490.png)
该服务主要运用于控制某些类 型数据的收发。因为在项目中只是验证该服务是否能够正常生效，并没有做更深入的研究。这里主要以介绍为主。

# 诊断请求格式
![](assets/0x28(CommunicationControl)/file-20260702144257310.png)/file-20260702144257310.png)

![](assets/0x28(CommunicationControl)/file-20260702144326194.png)关于communicationType的参数说明请看下方表格
![](assets/0x28(CommunicationControl)/file-20260702144403844.png)


# 正响应格式
第一个参数：Service ID 是相对应的服务 ID 增加 0 x 40（即 0 x 28 服务的正相应应为 0 x 68）。
第二个参数：控制类型


# 负响应格式
![](assets/0x28(CommunicationControl)/file-20260702144532062.png)


