# Autosar MCAL-ADC详解（二）-基于Tc27x的cfg软件 - 学习笔记

> 来源公众号：汽车电子学习笔记

> 原文标题：Autosar MCAL-ADC详解（二）-基于Tc27x的cfg软件

> 原文链接：http://mp.weixin.qq.com/s?__biz=Mzk0NTM4MTI2MA==&mid=2247484338&idx=1&sn=67aa9cb9462f4e8cde5b9ae1d2c6f49d&chksm=c3170951f4608047e0f36b41ae1a8a3bd1bb08b108d51ab241a4d81929b5dec584951fbf3348#rd

> 发布时间：2022-11-05

> 归档标签：#Autosar

> 整理方式：本文是基于原文主题的学习笔记，不复制原文全文；重点补充概念框架、工程理解、排查思路和可复用检查清单。

---

## 1. 先给结论

这篇文章可以归到 **AUTOSAR 通信栈** 这一类问题里。学习时不要只记某个配置项或某个函数名，而要先抓住它背后的工程链路：为什么需要它、它位于哪一层、它依赖哪些前置条件、失败以后系统应该怎样响应。

我的理解是：**Autosar MCAL-ADC详解（二）-基于Tc27x的cfg软件** 这类问题的核心，不是把步骤机械跑通，而是把“需求、配置、生成物、运行行为、验证证据”连成闭环。只要闭环断了，项目里就会出现“配置看起来对、代码也生成了、但现象就是不对”的典型问题。

```mermaid

flowchart TD
    A["需求/问题"] --> B["配置与代码实现"]
    B --> C["生成物/运行行为"]
    C --> D["测试验证"]
    D --> E["工程经验沉淀"]

```

## 2. 原文脉络速读

这篇文章适合按 **MCAL 与外设配置** 的思路来读。不要把它当成孤立技巧，建议先建立一条从需求到验证的学习路线：

- 先把芯片资源、引脚复用、时钟和外设实例对应起来。
- 再看工具配置如何映射到 MCAL channel、container 和生成文件。
- 重点关注初始化顺序、中断/回调、硬件触发和 variant 策略。
- 最后用寄存器、波形、生成代码 diff 和功能现象交叉验证。

读这类文章时，建议不要一上来抄配置，而是先问三个问题：

- 这个机制解决的是哪个层级的问题？

- 它的输入、输出和触发条件是什么？

- 它失败时，系统应该怎么被观察、怎么被诊断、怎么被恢复？

## 3. 像老师一样拆开讲

### 3.1 先看它在系统里的位置

如果把整车软件看成分层系统，**AUTOSAR 通信栈** 通常不是孤立存在的。它会同时牵涉需求、配置工具、基础软件模块、生成代码、运行时状态和测试验证。通信栈问题要从信号一路看到总线：Signal、IPdu、Com、PduR、CanIf、CanDrv，每一层都可能正确，也都可能在边界条件下断开。

一个比较实用的理解方法是：把它拆成“静态配置”和“动态行为”两半。

- 静态配置回答：哪些参数、接口、映射、开关、阈值、回调需要提前定义？

- 动态行为回答：运行时谁先触发、谁负责转发、谁保存状态、谁最终产生外部可见结果？

很多问题之所以难排查，是因为我们只看了静态配置，没有顺着动态行为走一遍。

### 3.2 再看关键路径

结合这类问题的工程共性，可以把关键路径理解为：

1. 明确触发源：谁发起这个动作，是诊断请求、工具生成、周期任务、总线报文，还是启动流程？

2. 明确前置条件：会话、安全等级、网络状态、初始化阶段、模式管理状态是否满足？

3. 明确配置落点：配置最终进入哪个 ARXML、生成代码、配置表或链接段？

4. 明确运行路径：从入口到最终输出，中间经过哪些模块、回调、状态机或驱动接口？

5. 明确观测证据：总线、日志、DTC、调试变量、复位原因或生成文件 diff 能否证明链路闭合？

这里要提醒一点：这些点不是让你死记，而是让你在项目里建立“检查顺序”。先确认入口，再确认中间状态，最后确认输出和反馈。顺序对了，排查效率会高很多。

### 3.3 最容易踩坑的地方

这类问题在项目里常见的坑，通常不是某一个语法点，而是上下游没有对齐：

- 只看 DBC 或只看 COM 配置，没有确认 PDU 路由。

- 忽略超时、UpdateBit、信号初值和接收使能条件。

- 总线有报文，但应用层读不到，因为 RTE 或 COM signal path 没通。

- 周期发送、事件发送和 Nm/ComM 状态之间没有对齐。

所以排查时不要只盯着一个模块。要沿着“触发源 -> 配置 -> 生成代码 -> 运行状态 -> 外部现象”一路看下去。

## 4. 图片与原文图示

下面保留原文中解析到的图片引用，便于对照阅读：

![原文图片 1](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgx5JBI1jj3qHtlGfySE9fXDkgYTAhAGJG2gH5vgFG7RIjVI8EVcRRlg/640?wx_fmt=png)

![原文图片 2](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXg9SdSDiar71aFARjhCTEkwXcjQDxe03PYiaGSe8cmAtIe2g7WtwHSVoGw/640?wx_fmt=png)

![原文图片 3](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXg24jkbRZeoIFMks3nibibDpHNInXhIk7HdBoSoMawCr5sFBHE5WEZlh9g/640?wx_fmt=png)

![原文图片 4](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXg9HBQEwzib1X7cwmoHTiaYQhkb9UPtLWaa5TBWmShEZdEGq1ibATW1pQ8g/640?wx_fmt=png)

![原文图片 5](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgCoHe7cOzU7qGd4Ej8oOuqxrLAG1ibeeCTV7IlGAkvgjZag9VLf2jI0Q/640?wx_fmt=png)

![原文图片 6](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgRlovwIg7rlfYNsYVjInDibfYOmicpzHcDzyWmabX3D8dnVvqQTkibOQSw/640?wx_fmt=png)

![原文图片 7](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgj5VjgOEpvYZYhAS25uUOcfwzqutJ8nAX24sgHK32O5TYw5u8zibE6sg/640?wx_fmt=png)

![原文图片 8](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgNoFvl9SJj5EBhXtibK59QicibvhTrBsPE83G1kjH8zJwfUNxMSic04PqPQ/640?wx_fmt=png)

![原文图片 9](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgT1skhjUkrGXkfYgkGhicYpUbzhkJbmOq1GruetcicafDYguEJTWoVKHQ/640?wx_fmt=png)

![原文图片 10](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgGmyzmGZlyLLnibssW1VM1DTnvntYPWm58LsK7eOz1WNy8weFbGOJicNw/640?wx_fmt=png)

![原文图片 11](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgro9d0HiaeZCzibiaGnFZbF1PVzibjPB80WIWd9XvpAWjJvZPVvCvRXIAbw/640?wx_fmt=png)

![原文图片 12](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgP7zMCryicQ4lLhIJRDVYLu2BuqL6fyibiaibK22OBVJCia7qia48PWUvDGkQ/640?wx_fmt=png)

![原文图片 13](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXg6R8XJamn0xzbH2Qvr6kBeibdeBJ1pkoajb53rFZeX4VT2JEW6vA1FXQ/640?wx_fmt=png)

![原文图片 14](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgMDthB0HQr5EgMs3Ve7yZNeR9BQ1qtskkCHcc0HLVvMyibxN4GQKZS6Q/640?wx_fmt=png)

![原文图片 15](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgxf1OhN1NHtHmw615WQqEFOLBb8ptrw2lAVWPxwm1See5EOx5ibUgaVQ/640?wx_fmt=png)

![原文图片 16](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXg2Lc1U8h3stLM0tU8Iu4M5CxvUETqicjFBd6hE502cjWV82udebrbYlw/640?wx_fmt=png)

![原文图片 17](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgCak2viciaiboQpicB79h0zaFuaibK8aiaY1kxa821yuTlibxQwm0M7yMXvyHA/640?wx_fmt=png)

![原文图片 18](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgeIjJOq76m3M0ZX0FaWaGH52U5qhSsFnlwVvVh7xvV5l4NibYbqqhibxg/640?wx_fmt=png)

![原文图片 19](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgpqdMYBVFYx46o2SBNewyQgooabjTRM9tKQDib3ggmpRbo6xYPmxE2lQ/640?wx_fmt=png)

![原文图片 20](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgQxeu7YEog3aFy6FCic1Bu3X1eLzndTk0HUS5bCZQw597KHqgVbbaU5g/640?wx_fmt=png)

![原文图片 21](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgOsrkTznGwMZSL4WTrUhbyRQE4d1FseOxYuxOc4siciaow0lTsaBSQMTg/640?wx_fmt=png)

![原文图片 22](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXghsLfSpYZVPHExefUsXyOQO8Eic3hpDjo3iaqKXbtmNzFUAfjeD2zPribA/640?wx_fmt=png)

![原文图片 23](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgOricKV6So9YA8cC5D6bzJz1bHVfexN8QaVkcBupUibNn4J69mOwsAzXQ/640?wx_fmt=png)

![原文图片 24](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXg3rL5gvJFB3u9uQgCX2jUt6Z7XcHbk1tjQcqUTPCatYR3PxVCibthHBw/640?wx_fmt=png)

![原文图片 25](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgSCh2Cibpy4TmGmqAkVzSBoJU4kKzLW2Y6XDRP63hpIfY9n5aLaG5yGA/640?wx_fmt=png)

![原文图片 26](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXglcQZicer6EQZGJHiaE44YNtQUibsNL2JYEskmFnFiclaCGOWxMHQvCSFtA/640?wx_fmt=png)

![原文图片 27](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgsVkPZiaz808FcxPSqgYxcicnBc0TVib9TBHr3p6TxPB5jdoqUGIrhxq3Q/640?wx_fmt=png)

![原文图片 28](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXg3y97HwZI1y5vriaxfPiaJ0mhX58wWdwTHOibvuDYwQiarJrZufNOTGxleQ/640?wx_fmt=png)

![原文图片 29](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgOupficTT6MiccSaiaoSbFAhibcgu5Tx7PuZ1oIdKKvdiaxypXM8ickWbjwUw/640?wx_fmt=png)

![原文图片 30](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXghtDoL1oZzdxAT29b5QGiaxJO7TYDbIXrnWscokrK1hDDZ2Cjmic1bpBg/640?wx_fmt=png)

![原文图片 31](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgc0rTsHSial17vSRp114Ed0rj9R25fpkYOtLjNDiaug7VduUY1PVKwS5w/640?wx_fmt=png)

![原文图片 32](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXg1Cc9KkNGngC76vPuKbsOhERhFXC3xT8PgIR0FAGBxCGyaeO55Kicjpw/640?wx_fmt=png)

![原文图片 33](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXg2zhSmTq5xJOaGw0qrRQLJjLeJOq32CtRG9ppiaxsQTFWhFgz8lQAM8Q/640?wx_fmt=png)

![原文图片 34](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgbSibM11cnV1FGlMUoicqN1HgUiaiaqvgHVG8mlac1axOg8jCAxLu0acOiaQ/640?wx_fmt=png)

![原文图片 35](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXg103Lk27XtfpOwDIVGVp5f2pdYwJ9rfaH6LrwgglzSwMkhsmiazfN8Cw/640?wx_fmt=png)

![原文图片 36](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXg86vsAswQkbib5l7VUFD0neGHfMggHgzw3iaGRAYaiaicZZnJt3xOyBntjw/640?wx_fmt=png)

![原文图片 37](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgDvm1HGwmpBasfxdNtgFVcVK6hWDknC2XROESUB6icCKtEwV0eYFJbrQ/640?wx_fmt=png)

![原文图片 38](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgDj1epnVicXqRKUIfLVRlN6IwlWyHNO1GcpPiad6mYVW7sPmt3vmrGuzQ/640?wx_fmt=png)

![原文图片 39](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgGABV1PYGuqVm6MxMHvRbIz1glIdwE10Z70qbJ9SxUujK3Ynxia1Qmlw/640?wx_fmt=png)

![原文图片 40](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgL9u0eib6J2xyN5bZ4Heo9PnSGlB5NacvzRDd0viayiauZUfqb9XkfDdyQ/640?wx_fmt=png)

![原文图片 41](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgvWmosDwHnHXw4PXj0Nn4wFSkAcPo1ytibzga74fywL6I7Fe4udwIvqg/640?wx_fmt=png)

![原文图片 42](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXghKoUNRnibCZOk3oTpsUzU4kSWKqjEcf5sUsWTZfE8ibrmVQ8DccMGseg/640?wx_fmt=png)

![原文图片 43](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXg1kryydYNlEsVL39eastRicmYeJnkE82vRSiabIKn1icthkRVs2e3EzcPA/640?wx_fmt=png)

![原文图片 44](https://mmbiz.qpic.cn/mmbiz_png/gEqKyojpCYaZHwJfHhMD4sKOzsAb7MXgh5PXJKZF7SuFCwgp08pAlhNHIuu986zlWrIccpyMZ38xkJI58vBdNA/640?wx_fmt=png)

## 5. 工程检查清单

- 信号到 PDU 的映射是否正确？

- PduR/CanIf/CanDrv 路径是否完整？

- ComM/Nm 状态是否允许通信？

- 是否验证总线、COM buffer、RTE 读值三处观测点？

- 是否有日志、DTC、调试变量或总线报文可以证明链路走通？

- 是否考虑了复位、休眠唤醒、重复触发、多核、中断或超时场景？

## 6. 一句话总结

这篇文章真正值得学的，不只是 **Autosar MCAL-ADC详解（二）-基于Tc27x的cfg软件** 这个具体知识点，而是它展示的工程方法：把一个看似局部的问题，放回 AUTOSAR/MCU/工具链/诊断/测试的完整链路里理解。
