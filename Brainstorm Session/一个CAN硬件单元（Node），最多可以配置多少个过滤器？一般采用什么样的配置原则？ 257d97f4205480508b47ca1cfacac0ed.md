# 一个CAN硬件单元（Node），最多可以配置多少个过滤器？一般采用什么样的配置原则？

Total votes: 0
Created by: Jay
Status: In review

## Describe your idea

Provide a 2-3 sentence description.

对于一个CAN Node，最多可以设置128个标准CAN ID的接收，示意如下

![image.png](%E4%B8%80%E4%B8%AACAN%E7%A1%AC%E4%BB%B6%E5%8D%95%E5%85%83%EF%BC%88Node%EF%BC%89%EF%BC%8C%E6%9C%80%E5%A4%9A%E5%8F%AF%E4%BB%A5%E9%85%8D%E7%BD%AE%E5%A4%9A%E5%B0%91%E4%B8%AA%E8%BF%87%E6%BB%A4%E5%99%A8%EF%BC%9F%E4%B8%80%E8%88%AC%E9%87%87%E7%94%A8%E4%BB%80%E4%B9%88%E6%A0%B7%E7%9A%84%E9%85%8D%E7%BD%AE%E5%8E%9F%E5%88%99%EF%BC%9F/image.png)

对于拓展帧，一般可以配置64帧过滤，示意如下：

![image.png](%E4%B8%80%E4%B8%AACAN%E7%A1%AC%E4%BB%B6%E5%8D%95%E5%85%83%EF%BC%88Node%EF%BC%89%EF%BC%8C%E6%9C%80%E5%A4%9A%E5%8F%AF%E4%BB%A5%E9%85%8D%E7%BD%AE%E5%A4%9A%E5%B0%91%E4%B8%AA%E8%BF%87%E6%BB%A4%E5%99%A8%EF%BC%9F%E4%B8%80%E8%88%AC%E9%87%87%E7%94%A8%E4%BB%80%E4%B9%88%E6%A0%B7%E7%9A%84%E9%85%8D%E7%BD%AE%E5%8E%9F%E5%88%99%EF%BC%9F/image%201.png)

工程中，一般基于通信矩阵（*.dbc、*.arxml等），只接收通信矩阵中需要的CAN报文。

## Why do you think it’s important?

- 
- 
- 

## Supporting data

Link slack threads, data reports, etc.