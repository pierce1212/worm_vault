# 什么是Basic CAN和Full CAN？ 一个CAN硬件单元最多可以配置多少个Basic CAN？配置CAN邮箱（harware objects）遵循什么样的原则？

Total votes: 0
Created by: Jay
Status: In review

## Describe your idea

Provide a 2-3 sentence description.

- **BasicCAN**：一个HWObject(Hardware Object)可以处理一段范围的CanId
- **FullCAN**：一个HWObject(Hardware Object)只能处理单个CanId

可以参考前文《[Autosar通信栈：FullCAN和BasicCAN基础](https://mp.weixin.qq.com/s?__biz=MzUyNDU4NTc1NQ==&mid=2247488397&idx=1&sn=cbf642001c3547a5be871976b9cec230&scene=21#wechat_redirect)》。一个CAN Node，发送/接收共256个objects，所以，最多可以配置256个Basic CAN。hardware objects遵循的配置原则，参考前文《[MCMCAN：CAN hardware object配置规则](https://mp.weixin.qq.com/s?__biz=MzUyNDU4NTc1NQ==&mid=2247490354&idx=1&sn=49314155734c1f16db9e84d091e83764&scene=21#wechat_redirect)》。CAN RAM各元素排布如下：

![image.png](%E4%BB%80%E4%B9%88%E6%98%AFBasic%20CAN%E5%92%8CFull%20CAN%EF%BC%9F%20%E4%B8%80%E4%B8%AACAN%E7%A1%AC%E4%BB%B6%E5%8D%95%E5%85%83%E6%9C%80%E5%A4%9A%E5%8F%AF%E4%BB%A5%E9%85%8D%E7%BD%AE%E5%A4%9A%E5%B0%91%E4%B8%AABasic%20CAN/image.png)

## Why do you think it’s important?

- 
- 
- 

## Supporting data

Link slack threads, data reports, etc.