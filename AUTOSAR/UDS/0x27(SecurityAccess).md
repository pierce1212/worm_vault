![](assets/0x27(SecurityAccess)/file-20260702142101014.png)27 01 需要扩展会话中。
![](assets/0x27(SecurityAccess)/file-20260702142159189.png)
# 如何解锁安全模式 ？具体的流程又是怎样的？

第一步：客户端发送 seed 请求
第二步：服务端发出 seed
第三步：客户端发送 key 密钥，依据服务发出的 seed 进行处理
第四步：服务端分析客户端发过来的 key 密钥，如果无误则完成解锁功能

## 发送 seed 请求
具体的格式如下。这里需要对 Sub-function 参数说一个说明，**当 sub-function 的值为奇数时，才是发送 seed 请求的命令。**
![](assets/0x27(SecurityAccess)/file-20260702142359063.png)
通常来说，我们在请求 seed 的时候，一般不对参数 securityAccessDataRecord 进行赋值。因为该参数在协议 中定义为一个可选项。

##  发送 key 密钥
具体的格式如下。这里需要对 Sub-function 参数说一个说明，当 sub-function 的值为偶数时，才是发送 key 密钥的命令。securityKey 的值是通过获取到的 seed 值，在 ECU 自己内部计算得到的一个 key 值，所以这个值是随着 seed 值变化而变化的。这一点在自动化过程中需要注意。

![](assets/0x27(SecurityAccess)/file-20260702142758336.png)



关于 sub-function 的具体格式定义如下：

![](assets/0x27(SecurityAccess)/file-20260702142753302.png)


# 正响应格式
第一个参数：Service ID 是相对应的服务 ID 增加 0 x 40（即 0 x 27 服务的正相应应为 0 x 67）。
第二个参数：安全访问类型
第三个参数：参数 securitySeed，该参数只针对于 seed 请求（27 01）的响应才存在。也就是说，当我们发送 key 密钥请求的时候，返回的正响应只有参数 Service ID 和 securityAccessType 这两个。

# 负响应格式
![](assets/0x27(SecurityAccess)/file-20260702143251563.png)/file-20260702143251563.png)
其中，对于 35/36/37 这三个错误码，需要比较关注一下。具体的测试细节因项目不同而不同。之前的项目是第一次发送错误的 key，上报 0 x 35； 等待 5 s，第二次发送错误的 key，上报 0 x 36；等待 5 s，第三次发送错误的 key，上报 0 x 37。