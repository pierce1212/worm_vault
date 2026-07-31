# 功能
该服务允许客户端从服务器请求诊断信息（包括 DTC，捕获的数据等）。该服务允许客户端从车辆内的任何服务器或服务器组读取服务器驻留诊断故障代码（DTC）信息的状态。 除非另有说明，否则服务器应返回与排放有关的 DTC 信息和与排放无关的 DTC 信息。 该服务允许客户端执行以下操作：
—— 检索与客户端定义的 DTC 状态掩码匹配的 DTC 数量（在请求时）；
—— 检索与客户端定义的 DTC 状态掩码匹配的所有 DTC 的列表；
—— 检索与客户端定义的 DTC 和状态掩码组合相关联的 DTC Snapshot 数据；
—— 从 DTC 内存或 DTC 镜像内存中检索与客户端定义的 DTC 和状态掩码组合相关联的 DTC 扩展数据；
  —— DTC 发生计数器；
  —— 当前阈值；
  —— last 最后一次出现的时间；
  —— 故障验证计数器
  —— 未完成的测试计数器
  —— 故障发生计数器
  —— DTC 老化计数器
  —— 特定于 OBD 的计数器
—— 检索与客户端定义的严重性掩码匹配的 DTC 数量（在请求时）；
—— 检索与客户端定义的严重性掩码记录匹配的 DTC 列表；
—— 检索客户定义的故障诊断代码的严重性信息；
—— 检索服务器支持的所有 DTC 的状态；
—— 检索服务器失败的第一个故障诊断代码；
—— 检索服务器内最近发生故障的 DTC；
—— 检索服务器确认的第一个故障码；
—— 检索服务器中最近确认的故障诊断代码；
—— 从 DTC 镜像存储器中检索与客户端定义的 DTC 状态掩码匹配的 DTC 列表；
—— 从 DTC 镜像存储器中检索客户端定义的 DTC 掩码的镜像存储器 DTC Extended Data 记录数据和客户端定义的 DTC Extended Data 记录号；
—— 从与客户端定义的 DTC 状态掩码匹配的 DTC 镜像存储器中检索 DTC 的数量；
—— 检索与客户端定义的 DTC 状态掩码匹配的“仅”与排放相关的 OBD DTC 的数量
—— 检索所有当前已被或尚未被检测为“待定”或“已确认”的“合格的”故障诊断代码；
—— 检索所有具有“ permanentDTC”状态的 DTC（这些 DTC 先前已由 clearDiagnosticInformation 服务清除，但保留在服务器的非易失性存储器中，直到成功通过每个 DTC 的相应监视器为止。）
该服务使用子功能来确定客户端请求的诊断信息类 型。有关每个子功能参数的更多详细信息，请参见以下条款:

通过与客户端定义的状态掩码来索引匹配的 DTC 数量
  客户端可以通过发送对该服务的请求并将子功能设置为 reportNumberOfDTCByStatusMask 来检索与客户端定义的状态掩码匹配的 DTC 数量。 对此请求的响应包含 DTCStatusAvailabilityMask，它提供服务器支持用于屏蔽目的的 DTC 状态位的指示。 在 DTCStatusAvailabilityMask 之后，响应包含 DTCFormatIdentifier ，该报告报告有关 DTC 格式和编码的信息。 DTCFormatIdentifier 之后是 DTCCount 参数，该参数是一个两字节的无符号数字，其中包含基于客户端提供的状态掩码的服务器内存中可用的 DTC 数量。子功能 reportNumberOfMirrorMemoryDTCByStatusMask 具有与子功能 reportNumberOfDTCByStatusMask 相同的功能，不同之处在于它从 DTC 镜像存储器中返回 DTC 的数量
通过与客户端定义的状态掩码来索引匹配的 DTC 列表
  客户端可以通过发送带有设置为 reportDTCByStatusMask 的子功能字节的请求来检索满足客户端定义的状态掩码的 DTC 列表。此子功能允许客户端请求服务器报告 “ testFailed” 或 “ confirmed” 或 “ etc” 的所有 DTC。服务器应在客户端请求中指定的掩码和与服务器支持的每个 DTC 关联的实际状态之间执行按位逻辑“与”运算。除了 DTCStatusAvailabilityMask，服务器还应返回所有 AND 运算结果为非零的 DTC。 也就是 statusOfDTC 与 DTCStatusMask 执行逻辑与的运算之后，不为 0]。如果客户端指定的状态掩码包含服务器不支持的位，则服务器应仅使用其支持的位来处理 DTC 信息。如果服务器中没有 DTC 符合客户端请求中指定的屏蔽标准，则在肯定响应消息中的 DTCStatusAvailabilityMask 字节之后，不得提供 DTC 或状态信息。在客户端成功发出 ClearDiagnosticInformation 请求后，应清除 DTC 状态信息。
索引 DTCSnapshot 记录标识
  客户端可以通过发送子功能设置为 reportDTCSnapshotIdentification 的请求来检索所有捕获的 DTCSnapshot 记录标识信息。服务器应返回所有已存储 DTCSnapshot 记录的 DTCSnapshot 记录标识信息列表。服务器在响应消息中为单个 DTCSnapshot 记录放置的每个项目都应包含一个 DTCRecord [包含 DTC 编号（高，中，低字节）]和 DTCSnapshot 记录编号。如果为单个 DTC 存储了多个 DTCSnapshot 记录，则服务器应为每个事件在响应中放置一项，并为每个事件使用不同的 DTCSnapshot 记录号（用于以后检索记录数据）。客户端成功发出 ClearDiagnosticInformation 请求后，应清除 DTCSnapshot 记录标识信息。 主车厂需要定义清楚：当内存溢出的清楚出现时，删除已存储 DTC 和 DTCSnapshot 数据的规则。
通过客户端定义的 DTC 掩码和/或客户端定义的 DTCSnapshot 记录号来索引 DTCSnapshot 记录数据
  客户端只能通过发送对此服务的请求并将子功能设置为 reportDTCSnapshotRecordByDTCNumber 或 reportDTCSnapshotRecordByRecordNumber 来检索客户端定义的 DTCMaskRecord 的捕获的 DTCSnapshot 记录数据以及 DTCSnapshot 记录号。 如果是 reportDTCSnapshotRecordByDTCNumber，则服务器应在其支持的 DTC 中搜索与客户端指定的 DTCMaskRecord 的完全匹配 [包含 DTC 编号（高，中，低字节）]。 在这种情况下，客户请求中提供的 DTCSnapshotRecordNumber 参数应指定请求 DTCSnapshot 记录数据的特定 DTC 的特定出现。 如果是 reportDTCSnapshotRecordByRecordNumber ，则服务器应在其存储的 DTCSnapshot 记录中搜索与客户端提供的记录号的匹配项。
检索客户端定义的 DTC 掩码的 DTCExtendedData 记录数据和客户端定义的 DTCExtendedData 记录号
  客户端可以通过发送对此服务的请求并将子功能设置为 reportDTCExtendedDataRecordByDTCNumber 来检索客户端定义的 DTCMaskRecord 的 DTCExtendedData 以及 DTCExtendedData 记录号。 服务器应通过其支持的 DTC 搜索与客户端指定的 DTCMaskRecord 完全匹配[包含 DTC 编号（高，中，低字节）]。 在这种情况下，客户请求中提供的 DTCExtendedDataRecordNumber 参数应指定要为其请求 DTCExtendedData 的指定 DTC 的特定 DTCExtendedData 记录。
检索与客户端定义的严重性掩码记录匹配的 DTC 数量
  客户端可以通过发送对此服务的请求并将子功能设置为 reportNumberOfDTCBySeverityMaskRecord，来检索与客户端定义的严重性状态掩码记录匹配的 DTC 数量的计数。服务器应扫描所有受支持的 DTC，在客户端指定的掩码记录与每个存储的 DTC 的实际信息之间执行按位逻辑“与”运算。具体的运算表达式如下：((statusOfDTC & DTCStatusMask) & (severity & DTCSeverityMask)) != 0
检索与客户端定义的严重性掩码记录匹配的严重性和功能单元信息
  客户端可以通过发送带有设置为 reportDTCBySeverityMaskRecord 的子功能字节的请求来检索 DTC 严重性和功能单元信息的列表，该列表满足客户端定义的严重性掩码记录。此子功能允许客户端请求服务器报告具有“ testFailed”或“ confirmed”或“ etc”等严重性和状态的所有 DTC。服务器支持的每个 DTC 应在客户端请求中指定的 DTCSeverityMask 和 DTCStatusMask 与关联的实际 DTCSeverity 和 statusOfDTC 之间执行按位逻辑“与”运算。除 DTCStatusAvailabilityMask 外，服务器还应返回所有 AND 运算结果为非零的 DTC，运算关系如下：
（（statusOfDTC＆DTCStatusMask）＆（severity＆DTCSeverityMask））！= 0
检索客户端定义的 DTC 的严重性和功能单元信息
  客户端可以通过发送对此服务的请求并将子功能设置为 reportSeverityInformationOfDTC，来检索客户端定义的 DTCMaskRecord 的严重性和功能单元信息。 服务器应通过其支持的 DTC 搜索与客户端指定的 DTCMaskRecord 完全匹配[包含 DTC 编号（高，中，低字节）]。
检索服务器支持的所有 DTC 的状态
  客户端可以通过发送对该服务的请求并将其子功能设置为 reportSupportedDTC，来检索服务器支持的所有 DTC 的状态。 此请求的响应包含 DTCStatusAvailabilityMask，它提供服务器支持用于屏蔽目的的 DTC 状态位的指示。 在 DTCStatusAvailabilityMask 之后，响应还包含 listOfDTCAndStatusRecord，该列表包含服务器支持的每个诊断故障代码的 DTC 编号和相关状态。
检索第一个/最近失败的 DTC
  客户端可以通过发送请求，并将子功能字节分别设置为“ reportFirstTestFailedDTC”或“ reportMostRecentTestFailedDTC”，从服务器检索 第一个/最近失败的 DTC。 服务器应与 DTCStatusAvailabilityMask 一起，将第一个或最近失败的 DTC 编号以及相关状态返回给客户端。如果自客户端上次请求服务器清除诊断信息以来没有记录失败的 DTC，则在肯定响应消息中的 DTCStatusAvailabilityMask 字节之后，不得提供 DTC 状态信息。 另外，如果自客户上次请求服务器清除诊断信息以来仅一个 DTC 发生故障，则应将唯一的故障 DTC 返回到来自客户端的 reportFirstTestFailedDTC 和 reportMostRecentTestFailedDTC 请求。
检索第一个/最近检测到的已确认 DTC
  客户端可以通过发送请求并将子功能字节分别设置为“ reportFirstConfirmedDTC”或“ reportMostRecentConfirmedDTC”来从服务器检索第一个/最近确认的 DTC。 服务器应与 DTCStatusAvailabilityMask 一起，将第一个或最近确认的 DTC 编号以及相关状态返回给客户端。如果自从上次客户端请求服务器清除诊断信息以来没有记录任何确认的 DTC，则在肯定响应消息中的 DTCStatusAvailabilityMask 字节之后，不得提供 DTC /状态信息。 此外，如果自客户上次请求服务器清除诊断信息以来仅确认了一个 DTC，则唯一确认的 DTC 应予以确认。
从服务器 DTC 镜像内存中检索与客户端定义的状态掩码匹配的 DTC 列表
  子功能 reportMirrorMemoryDTCByStatusMask 的处理与为 reportDTCByStatusMask 定义的处理相同，除了所有状态掩码检查都是使用存储在服务器的 DTC 镜像存储器中的 DTC 执行的。 DTC 镜像存储器是服务器中的附加可选错误存储器，不能通过 ClearDiagnosticInformation（0 x 14）服务擦除。 DTC 镜像存储器镜像普通 DTC 存储器，例如，如果删除了普通错误存储器，则可以使用 DTC 镜像存储器。
从 DTC 镜像存储器中检索客户端定义的 DTC 掩码的镜像存储器 DTCExtendedData 记录数据和客户端定义的 DTCExtendedData 记录号
  子功能 reportMirrorMemoryDTCExtendedDataRecordByDTCNumber 的处理与为 reportDTCExtendedDataRecordByDTCNumber 定义的处理相同，除了从 DTC 镜像存储器中检索数据外。 DTC 镜像存储器是服务器中的附加可选错误存储器，不能通过 ClearDiagnosticInformation（0 x 14）服务擦除。 DTC 镜像存储器镜像普通 DTC 存储器，例如，如果删除了普通错误存储器，则可以使用 DTC 镜像存储器。
检索与客户端定义的状态掩码匹配的镜像存储器 DTC 的数量
  客户端可以通过发送对此服务的请求并将子功能设置为 ReportNumberOfMirrorMemoryDTCByStatusMask，来检索与客户端定义的状态掩码匹配的镜像内存 DTC 的数量的计数。对此请求的响应包含 DTCStatusAvailabilityMask，它提供服务器支持用于屏蔽目的的 DTC 状态位的指示。 在 DTCStatusAvailabilityMask 之后，响应包含 DTCFormatIdentifier，该报告报告有关 DTC 格式和编码的信息。 DTCFormatIdentifier 之后是 DTCCount 参数，该参数是一个两字节的无符号数字，其中包含基于客户端提供的状态掩码的服务器内存中可用的 DTC 数量。
检索与客户端定义的状态掩码匹配的“仅与排放有关的 OBD”故障诊断代码的数量
  客户端可以通过发送对子服务设置为 reportNumberOfEmissionsRelatedOBDDTCByStatusMask 的子功能的此服务请求，来检索与客户端定义的状态掩码匹配的“仅与排放有关的 OBD” DTC 数量的计数。 对此请求的响应包含 DTCStatusAvailabilityMask，它提供服务器支持用于屏蔽目的的 DTC 状态位的指示。 在 DTCStatusAvailabilityMask 之后，响应包含 DTCFormatIdentifier，该报告报告有关 DTC 格式和编码的信息。 DTCFormatIdentifier 之后是 DTCCount 参数，该参数是一个两字节的无符号数字，其中包含基于客户端提供的状态掩码的服务器内存中可用的“仅与排放有关的 OBD” DTC 数量。
检索与客户端定义的状态掩码匹配的“仅与排放有关的 OBD” DTC 的列表
  客户端可以通过发送带有设置为 reportEmissionsRelatedOBDDTCByStatusMask 的子功能字节的请求，来检索满足客户端定义的状态掩码的“仅与排放有关的 OBD” DTC 的列表。此子功能允许客户端请求服务器报告所有“ testFailed”或“ confirmed”或“ etc”的“与排放有关的 OBD” DTC。评估应如下进行。服务器应在客户端请求中指定的掩码与服务器支持的每个“排放相关 OBD” DTC 关联的实际状态之间执行按位逻辑“与”运算。除了 DTCStatusAvailabilityMask，服务器还应返回所有“与”相关的“与 OBD”的 DTC，其“与”运算的结果不为零。 （statusOfDTC 和 DTCStatusMask）！= 0]。如果客户端指定的状态掩码包含服务器不支持的位，则服务器应仅使用其支持的位来处理 DTC 信息。如果服务器内没有“排放相关的 OBD” DTC 与客户端请求中指定的屏蔽标准相匹配，则在肯定响应消息中的 DTCStatusAvailabilityMask 字节之后，不得提供任何 DTC 或状态信息。客户端发出成功的 ClearDiagnosticInformation 请求后，应清除“与排放有关的 OBD” DTC 状态信息。
检索“失败的” DTC 状态列表
  客户可以在客户请求时检索所有当前“已失效” DTC 的列表，这些列表已经或尚未被检测为“待定”或“已确认”。 DTCFaultDetectionCounter 的目的是一种简单的方法，用于识别无法通过特定 DTC 的 statusOfDTC 字节识别/读取的增长或间歇性问题。 DTCFaultDetectionCounter 的内部实现应特定于车辆制造商。 使用“故障前” DTC 可以加快在制造工厂进行测试期间针对故障诊断所需的成熟时间，而这些故障需要成熟时间，而这些时间是制造测试所无法接受的。 维修或安装新组件后，该服务具有类似的用例。
检索具有“ permanentDTC”状态的 DTC 列表
  客户端可以检索“ permanentDTC”状态的列表。 状态为“ permanentDTC”的 DTC 先前已由 clearDiagnosticInformation 服务清除，但保留在服务器的非易失性存储器中，直到成功通过每个 DTC 的相应监视器为止。永久故障码应存储在非易失性存储器中。 这些 DTC 不能通过任何测试设备（例如车载测试仪，非车载测试仪）清除。 OBD 系统应通过完成并通过车载监控器自行清除这些故障诊断代码。 这样可以避免仅通过断开电池来清除 DTC 的情况。确认的故障诊断码应不迟于点火循环结束时作为永久故障诊断码存储，并随后在确认的故障诊断码一直指示故障指示器亮起的所有时间（例如当前发生故障的系统，但不在 40 个预热周期的自我修复过程中）。

# 诊断请求格式
