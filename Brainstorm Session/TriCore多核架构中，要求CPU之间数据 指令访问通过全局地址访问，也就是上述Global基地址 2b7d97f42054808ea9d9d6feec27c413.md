# TriCore多核架构中，要求CPU之间数据/指令访问通过全局地址访问，也就是上述Global基地址开始的有效访问空间。而对于每个CPU的本地数据，可以使用Local地址访问，也可以使用Global地址访问。

Total votes: 0
Created by: Jay
Status: New idea

## Describe your idea

Provide a 2-3 sentence description.

## Why do you think it’s important?

- 
- 
- 

## Supporting data

Link slack threads, data reports, etc.

![image.png](TriCore%E5%A4%9A%E6%A0%B8%E6%9E%B6%E6%9E%84%E4%B8%AD%EF%BC%8C%E8%A6%81%E6%B1%82CPU%E4%B9%8B%E9%97%B4%E6%95%B0%E6%8D%AE%20%E6%8C%87%E4%BB%A4%E8%AE%BF%E9%97%AE%E9%80%9A%E8%BF%87%E5%85%A8%E5%B1%80%E5%9C%B0%E5%9D%80%E8%AE%BF%E9%97%AE%EF%BC%8C%E4%B9%9F%E5%B0%B1%E6%98%AF%E4%B8%8A%E8%BF%B0Global%E5%9F%BA%E5%9C%B0%E5%9D%80/image.png)

![image.png](TriCore%E5%A4%9A%E6%A0%B8%E6%9E%B6%E6%9E%84%E4%B8%AD%EF%BC%8C%E8%A6%81%E6%B1%82CPU%E4%B9%8B%E9%97%B4%E6%95%B0%E6%8D%AE%20%E6%8C%87%E4%BB%A4%E8%AE%BF%E9%97%AE%E9%80%9A%E8%BF%87%E5%85%A8%E5%B1%80%E5%9C%B0%E5%9D%80%E8%AE%BF%E9%97%AE%EF%BC%8C%E4%B9%9F%E5%B0%B1%E6%98%AF%E4%B8%8A%E8%BF%B0Global%E5%9F%BA%E5%9C%B0%E5%9D%80/image%201.png)

C*PU0如果想访问CPU1中的数据，只能通过读取CPU1的Global地址获取，而不能通过Local地址获取，因为CPU0和CPU1两者的Local地址一样，如果访问Local地址，CPU0只能读取到本地数据，而不是CPU1的数据。*

> 为什么CPU0和CPU1的Local address是相同的，但是地址里面的值不同？
> 

因为 Local Address（本地地址）不是物理地址，而是每个 CPU 私有的局部地址空间。

# 🧠 **为什么 TriCore 设计成这样？**

1. **每个核都能快速访问自己的本地 RAM**
2. Local 地址相同 → 可以复用 linker script，不用为每个 CPU 单独写地址
3. 访问本地 DSPR/PSPR 走 local bus → 不走 SRI → 性能高
4. 核间不会互相干扰 → 数据隔离性强
5. 

![image.png](TriCore%E5%A4%9A%E6%A0%B8%E6%9E%B6%E6%9E%84%E4%B8%AD%EF%BC%8C%E8%A6%81%E6%B1%82CPU%E4%B9%8B%E9%97%B4%E6%95%B0%E6%8D%AE%20%E6%8C%87%E4%BB%A4%E8%AE%BF%E9%97%AE%E9%80%9A%E8%BF%87%E5%85%A8%E5%B1%80%E5%9C%B0%E5%9D%80%E8%AE%BF%E9%97%AE%EF%BC%8C%E4%B9%9F%E5%B0%B1%E6%98%AF%E4%B8%8A%E8%BF%B0Global%E5%9F%BA%E5%9C%B0%E5%9D%80/image%202.png)

以CPU0访问数据为例，数据的访问需要通过DMI（Data Memory Interface）

每个CPUx的DSPRx位于各自的DMI内部，如果CPUx需要访问CPUy的DSPRy，则需要通过SRI（Shared Resource Interconnect）Slave Interface