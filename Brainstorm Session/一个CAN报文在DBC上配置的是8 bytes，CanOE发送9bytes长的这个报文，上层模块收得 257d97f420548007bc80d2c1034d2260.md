# 一个CAN报文在DBC上配置的是8 bytes，CanOE发送9bytes长的这个报文，上层模块收得到这个报文吗？为什么？

Total votes: 0
Created by: Jay
Status: In review

## Describe your idea

Provide a 2-3 sentence description.

**一个CAN报文在DBC上配置的是8 bytes，CanOE发送9bytes长的这个报文，上层模块收得到这个报文吗？为什么？**

一般来说，如果软件CanIF配置了DLC检查，那么，出现错误以后，应该给出错误提示或者错误的返回状态。但是，实际的工程中，不同软件厂商或者项目中，处理的策略不完全一样。如果DLC错误了，软件层面，送给上层也没有问题。

## Why do you think it’s important?

- 
- 
- 

## Supporting data

Link slack threads, data reports, etc.