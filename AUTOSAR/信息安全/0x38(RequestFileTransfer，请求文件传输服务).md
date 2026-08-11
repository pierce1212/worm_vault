# 功能描述
0 x 38 服务（RequestFileTransfer，请求文件传输服务）被客户端用于初始化从客户端到服务端或者服务端到客户端的文件数据传输(下载或者上传)。另外，该服务有能力去获取文件系统的一些信息。
  如果服务端实现了数据存储的文件系统，则该服务可以作为 RequestDownload 和 RequestUpload 服务的可替代的解决方案来支持数据上传或者下载功能。当配置文件系统的下载或者上传过程时，则应该使用 RequestFileTransfer 服务来替代。在服务端的文件系统中，该服务应该包含删除文件或者目录的功能。对于这个案例，TransferData 和 RequestTransferExit 服务不适用。
  在服务端已经接收到 RequestFileTransfer 的请求报文之后，服务端在其发送肯定应答报文之前，应该采取必要的行为去接收或者传送数据。

# 请求报文格式


![](assets/0x38(RequestFileTransfer，请求文件传输服务)/file-20260810115527434.png)

  C 1：这个消息参数的长度(字节数)由 filePathAndNameLength 来定义。  
  C 2：这些参数是否存在取决于 modeOfOperation 参数。  
  C 3：这个消息参数的长度(字节数)由 fileSizeParameterLength 来定义。




# 正响应
![](assets/0x38(RequestFileTransfer，请求文件传输服务)/file-20260810115527408.png)


