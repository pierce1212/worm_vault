该服务是请求写入提供的 DID 指定的数据。该服务允许客户端在由提供的 DID 指定的内部位置将数据写入服务器。数据并且可能会受到保护，也有可能不受到保护。0 x 2 C(DynamicallyDefineDataIdentifier)服务不得与此服务一起使用。
  在执行此服务时，如何满足写入的条件应有主车厂定义清楚。 该服务的可能用途是：
—— 将配置信息编程到服务器中（例如 VIN 号码）;
—— 清除非易失性存储器
—— 重置学习价值
—— 设置选项内容。
服务器可以限制或禁止对某些 DID 值（由供应商/主车厂 定义为只读的 DID）的写访问。

# 诊断请求格式
![](assets/0x2E(WriteDataByIdentifier)/file-20260715173317276.png)
# 正响应
![](assets/0x2E(WriteDataByIdentifier)/file-20260715173417913.png)
# 负响应 NRC 码
![](assets/0x2E(WriteDataByIdentifier)/file-20260715173439233.png)
