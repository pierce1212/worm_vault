# S32K324 调试核选择

`run_auto_flash.bat` 和 `run_auto_hex_flash.bat` 无需改变调用方式。
它们通过 PS1 分别调用 `s32k324_APP_Auto_Fused.cmm` 和
`s32k324_HEX_Auto_Flash.cmm`。

两个 CMM 的烧录后调试阶段现默认 `CORE.ASSIGN 1.`，即只分配物理第一个核
（逻辑 Core0）。`CORE.select 0.` 选中它。顶部普通 Go 只控制 Core0，
不会因启动阶段尚未开启的 Core1 报 core power down。
固件仍可正常启动 Core1；单核调试时，Core0 停机不保证 Core1 同步停机。

烧录阶段原有双核分配、Flash 地址/算法、ELF 校验、HEX 与符号加载、
看门狗及 ECC 初始化逻辑均未改变。APP 脚本原有运行至 main 的行为保留；
HEX 脚本没有新增自动运行。没有执行 BAT 或烧录来验证本次修改。

## 已打开的 TRACE32 会话

修改磁盘 CMM 不会改变当前会话。CPU 停住后执行：

```text
DO E:\newdebugcmm\debug_core0.cmm
```

此脚本 Down/Attach 切换调试连接，不调用 Up，不复位、不烧录、不清 RAM。
若连接切换影响了断点部署，检查 Break.List 中的启用状态和核归属。

## 运行后需要双核同步调试

等固件启动 Core1，并在主核停机后执行：

```text
DO E:\newdebugcmm\debug_dualcore.cmm
```

该脚本先读取 MC_ME 两个核心的 CCS 时钟状态，Core1 未启动则拒绝切换。
检查通过才分配两个核并 Attach/Break；不强制启动 Core1。
时钟状态检查不能保证后续不会发生异步复位或关核。
切换为双核后，普通 Go/Break 对两个核生效。

**再次复位调试 Boot 前，先执行 debug_core0.cmm。**
复位可能关闭 Core1，双核分配不会自动变回单核。
若已在双核会话里复位，当前 Core0 可控时可用 Go /SingleCORE 临时推进，
或停机后执行 debug_core0.cmm 恢复单核分配。

本修改仅解决调试器多核联动问题，不修复 MpuDiag 保留区 ECC 故障。
验证建议：下一次正常烧录后检查只分配 Core0；复位后点击普通 Go，
确认能命中 APP RamInit；Core1 未启动时双核切换应拒绝。
Core1 启动后再验证双核切换、同步停机，以及切回 Core0 后的复位调试。
