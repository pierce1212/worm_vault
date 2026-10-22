开心果 Need Car 本地归档（进行中）

双击 index.html 阅读。已取得日期的文章从早到晚排列。
实时数量、发布日期、保存状态、图片失败详情，请查看 manifest.json；不要把发现数量当成账号总数。

保存结构：
index.html：阅读入口
articles/：各篇HTML、TXT正文及本地图片
manifest.json：可续传状态与来源
link-sources/：人工核对过的合集链接清单
archive.py：解析、下载图片和生成目录
crawl-session.mjs：使用当前独立浏览器小批量读取文章
extract-expression.txt：页面数据提取规则

当前采用的范围：公众号公开可访问的文章，正文链接和作者合集链接递归发现。
完整性限制：尚未取得微信客户端的完整历史列表，因此不能用链接遍历证明账号全部文章已覆盖。被删除、不可访问、付费未授权内容及需要单独下载的音视频不保证离线可用。遇到验证会停止。

运行环境：Python 3.10+、beautifulsoup4、Node.js、@playwright/cli、本机Chrome。
当前浏览器会话：needcar-archive（Playwright CLI）。另有needcar-catalog用于目录检查。
archive.py --crawl 使用原browser-act方式；该工具在本机目前启动失败，应优先使用crawl-session.mjs。

原文版权归作者所有；保留作者、日期及来源，供个人学习。

重要更正：部分文章为付费文章。paywall状态只保存公开试读，不能算作全文归档；页面内已加醒目提示。

状态说明：
saved = 全文和正文图片已保存
paywall = 仅公开试读，付费全文未获取
blocked = 微信要求人工验证，正文未保存
unavailable = 原文明确不可用（例如作者已删除）
partial = 正文已取得，但存在资源缺失
discovered = 有链接，尚未处理

运行续传前先确认浏览器会话可访问。不要把试读页面当成全文。
