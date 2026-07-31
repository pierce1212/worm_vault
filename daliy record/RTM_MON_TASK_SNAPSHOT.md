# RTM Task 消耗统计快照

- 采集时间：2026-07-28 13:45:14 +08:00
- 目标：S32K324-M7
- TRACE32 状态：Running（未暂停目标）
- 数据源：`Rtm_MonTask[0..33]`
- Task 映射：`Rtm_MonTaskList` / `RTM_MON_TASK_LIST`
- RTM 时钟：40,000,000 ticks/s，即 `40 ticks = 1 us`
- 负载换算：`loadPercent = loadPer64k / 65536 * 100%`

> 这是运行态读取的实时快照。读取期间 Task 仍在执行，`curRT`、`curResponse`、调用计数等字段可能继续变化；min/max/average 和负载统计仍可用于当前阶段的性能分析。

## 运行时间、调用和负载

所有时间字段的单位均为 RTM tick。

|Idx|Task|curRT|minRT|averageRT|maxRT|总调用数|样本调用数|load/64K|负载|
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
|0|OsTask_SysOsApp_BswBg_100ms|872|837|883|1,371|4,809|50|14|0.021%|
|1|OsTask_SysOsApp_BswBg_10ms|1,031|936|1,023|6,596|48,086|500|167|0.255%|
|2|OsTask_SysOsApp_BSW_20ms_A|9,267|5,937|8,660|9,633|24,043|250|709|1.082%|
|3|OsTask_SysOsApp_ASW_100ms|571|536|577|751|4,809|50|9|0.014%|
|4|OsTask_AppOsApp_BSW_20ms|1,437|1,372|1,431|1,498|24,043|250|117|0.179%|
|5|OsTask_SysOsApp_BSW_20ms|2,853|2,787|2,865|16,123|24,043|250|234|0.357%|
|6|OsTask_SysOsApp_ASW_10ms|7,661|5,382|7,770|8,574|48,086|500|1,273|1.942%|
|7|OsTask_SysOsApp_ASW_20ms_A|1,035|519|851|1,058|24,043|250|69|0.105%|
|8|OsTask_CanOsApp_ASW_10ms|429|395|502|774|48,087|500|82|0.125%|
|9|OsTask_CanOsApp_ASW_100ms|567|465|549|602|4,809|50|9|0.014%|
|10|OsTask_SysOsApp_ASW_10ms_A|874|740|913|1,584|48,086|500|149|0.227%|
|11|OsTask_SysOsApp_ASW_10ms_B|5,334|4,984|5,553|5,937|48,086|500|909|1.387%|
|12|OsTask_CanOsApp_BSW_10ms|423|394|523|659|48,087|500|85|0.130%|
|13|OsTask_SysOsApp_BSW_10ms|8,581|1,536|6,384|19,798|48,086|500|1,046|1.596%|
|14|OsTask_SysOsApp_ASW_SWC_10ms_A|6,801|6,578|6,826|7,354|48,086|500|1,118|1.706%|
|15|OsTask_SysOsApp_Wdg|744|685|744|1,080|48,086|500|122|0.186%|
|16|OsTask_SysOsApp_BSW_10ms_A|41,226|39,220|41,285|50,552|48,086|500|6,764|10.321%|
|17|OsTask_SysOsApp_BSW_10ms_B|16,414|16,042|16,793|19,171|48,086|500|2,751|4.198%|
|18|OsTask_CanOsApp_BSW_1ms|4,279|3,906|4,387|7,372|480,862|5,000|7,187|10.966%|
|19|OsTask_SysOsApp_ASW_50ms|4,950|3,948|5,090|5,513|9,618|100|166|0.253%|
|20|OsTask_SysOsApp_ASW_SWC_10ms|12,391|11,960|12,332|19,891|48,087|500|2,020|3.082%|
|21|OsTask_SysOsApp_BSW_SWC_10ms|808|769|806|1,459|48,087|500|132|0.201%|
|22|OsTask_SysOsApp_BSW_SwcRequest|未运行|未运行|0|未运行|0|0|0|0.000%|
|23|OsTask_SysOsApp_CDD_5ms|8,894|7,887|8,932|9,691|96,173|1,000|2,927|4.466%|
|24|OsTask_SysOsApp_CDD_20ms|1,494|1,430|1,494|50,295|24,044|250|122|0.186%|
|25|OsTask_SysOsApp_CDD_10ms|482|426|471|707|48,087|500|77|0.117%|
|26|OsTask_SysOsApp_CDD_10ms_A|500|459|500|558|48,087|500|82|0.125%|
|27|OsTask_SysOsApp_BSW_1ms|1,447|1,270|1,378|1,659|480,903|5,000|2,258|3.445%|
|28|OsTask_SysOsApp_CDD_1ms|426|361|416|617|480,863|5,000|683|1.042%|
|29|OsTask_SysOsApp_DRE|未运行|未运行|0|未运行|0|0|0|0.000%|
|30|OsTask_SysOsApp_ASW_INIT_SWC|599|599|0|599|1|0|0|0.000%|
|31|OsTask_SysOsApp_BSW_INIT_SWC|720|720|0|720|1|0|0|0.000%|
|32|OsTask_SysOsApp_Startup|14,763|14,763|0|14,763|1|0|0|0.000%|
|33|OsTask_ECU_Startup|2,111,753|2,111,753|0|2,111,753|1|0|0|0.000%|

## 响应时间和栈消耗

响应时间字段的单位为 RTM tick，`wcstack` 的单位为 byte。

|Idx|Task|curResponse|minResponse|maxResponse|wcstack|
|---:|---|---:|---:|---:|---:|
|0|OsTask_SysOsApp_BswBg_100ms|162,935|145,204|251,096|224|
|1|OsTask_SysOsApp_BswBg_10ms|87,565|70,601|157,124|328|
|2|OsTask_SysOsApp_BSW_20ms_A|152,089|138,763|249,369|472|
|3|OsTask_SysOsApp_ASW_100ms|151,497|135,223|236,939|208|
|4|OsTask_AppOsApp_BSW_20ms|7,241|7,124|10,220|0|
|5|OsTask_SysOsApp_BSW_20ms|143,043|129,664|235,259|1,080|
|6|OsTask_SysOsApp_ASW_10ms|145,670|123,744|231,039|280|
|7|OsTask_SysOsApp_ASW_20ms_A|132,036|116,181|225,446|240|
|8|OsTask_CanOsApp_ASW_10ms|5,736|5,610|8,770|72|
|9|OsTask_CanOsApp_ASW_100ms|6,003|5,719|6,687|72|
|10|OsTask_SysOsApp_ASW_10ms_A|136,606|114,293|225,216|240|
|11|OsTask_SysOsApp_ASW_10ms_B|135,702|113,524|224,455|296|
|12|OsTask_CanOsApp_BSW_10ms|5,041|4,937|8,090|72|
|13|OsTask_SysOsApp_BSW_10ms|125,900|108,293|218,390|536|
|14|OsTask_SysOsApp_ASW_SWC_10ms_A|112,294|106,622|194,529|304|
|15|OsTask_SysOsApp_Wdg|104,643|98,940|186,666|192|
|16|OsTask_SysOsApp_BSW_10ms_A|104,773|99,087|187,227|344|
|17|OsTask_SysOsApp_BSW_10ms_B|58,561|53,703|142,957|424|
|18|OsTask_CanOsApp_BSW_1ms|4,481|4,103|7,401|72|
|19|OsTask_SysOsApp_ASW_50ms|37,693|36,415|123,318|272|
|20|OsTask_SysOsApp_ASW_SWC_10ms|34,922|32,372|115,388|424|
|21|OsTask_SysOsApp_BSW_SWC_10ms|21,779|19,827|101,083|680|
|22|OsTask_SysOsApp_BSW_SwcRequest|未运行|未运行|未运行|0|
|23|OsTask_SysOsApp_CDD_5ms|20,574|18,010|99,128|320|
|24|OsTask_SysOsApp_CDD_20ms|4,801|4,616|83,454|320|
|25|OsTask_SysOsApp_CDD_10ms|3,702|3,451|24,999|0|
|26|OsTask_SysOsApp_CDD_10ms_A|3,218|2,987|24,532|0|
|27|OsTask_SysOsApp_BSW_1ms|2,640|2,403|24,733|280|
|28|OsTask_SysOsApp_CDD_1ms|1,201|1,080|22,701|200|
|29|OsTask_SysOsApp_DRE|未运行|未运行|未运行|0|
|30|OsTask_SysOsApp_ASW_INIT_SWC|2,200,689|2,200,689|2,200,689|0|
|31|OsTask_SysOsApp_BSW_INIT_SWC|2,200,124|2,200,124|2,200,124|0|
|32|OsTask_SysOsApp_Startup|2,199,459|2,199,459|2,199,459|336|
|33|OsTask_ECU_Startup|2,183,466|2,183,466|2,183,466|1,288|

## 当前观察

- 负载最高的是 `OsTask_CanOsApp_BSW_1ms`：10.966%。
- 第二高是 `OsTask_SysOsApp_BSW_10ms_A`：10.321%。
- `OsTask_SysOsApp_BSW_10ms_A` 的平均运行时间最高（周期任务中）：41,285 ticks，约 1,032.1 us。
- `OsTask_SysOsApp_BSW_20ms` 的最大运行时间相对平均值有明显尖峰：16,123 ticks 对比平均 2,865 ticks。
- `OsTask_SysOsApp_CDD_20ms` 的最大运行时间尖峰明显：50,295 ticks 对比平均 1,494 ticks。
- `OsTask_SysOsApp_BSW_SwcRequest` 和 `OsTask_SysOsApp_DRE` 当前调用计数为 0，尚未形成测试结果。
- Startup/INIT Task 只执行一次，因此 `averageRT`、周期样本调用数和负载尚未形成统计值。
- `wcstack = 0` 表示当前未获得有效栈水位结果，不应直接解释为没有栈消耗。
