
Client 端使用 Routine Control 服务来执行定义的步骤序列并获取特定序列的相关结果。<mark style="background: #FFB86CA6;">该服务有极大的灵活性</mark>。Service 31 的典型用途可以包括擦除内存、重置定义的数据、覆盖正常服务控制策略以及控制 ECU 值随时间变化的功能。
通过 Service 31 可以启动特定序列、停止运行该特定序列、请求运行结果。该服务以往常用于 ECU 在做 Software Update 时，应用于检查刷写条件是否满足、传输数据完整性以及独立性检测
![](assets/0x31(RoutineControl)/file-20261111165813192.png)/file-20261111165813192.png)![](assets/0x31(RoutineControl)/file-20261111165820825.png)/file-20261111165820825.png)


Service 31 01：开始执行 Routine DID 对应的例程；

Service 31 02：停止运行 Routine DID 对应的例程；

Service 31 03：请求 Routine DID 对应的例程运行结果



![](assets/0x31(RoutineControl)/file-20261111170019641.png)/file-20261111170019641.png)


# 看一下当前得配置吧
