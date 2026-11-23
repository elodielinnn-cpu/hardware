# 云端首页复核

正式路径：每小时 `Update news data` 先用 V3 规则、两项业务知识库和真实证据抽取候选事件，再读取上一次云端复核结果；独立的 `Gemini homepage decision review` 每天北京时间 08:30、14:30 只复核程序已入选和有事件证据的接近门槛新闻。它不逐篇通读所有抓取结果，不增设技术标签。

模型只返回 `SHOW`、`HIDE` 或 `UNCERTAIN`、一个已有候选事件编号、简短理由和对应引文。`UNCERTAIN`、接口失败、缺少 `GEMINI_API_KEY`、无效 JSON、引文不在输入里、主事件不在候选列表里，都保留程序原判断。模型不能补回抓取阶段已丢弃的新闻，也不能把正文证据不足、传闻、日期错误或行业不符的新闻改为入选。

复核输入最多保留每篇 5 个程序候选事件及其简短证据。每日两次，每次最多 12 篇、5 万输入 token、3000 输出 token；同一标题、摘要和候选事件的完成结果复用，不重复调用。失败最多重试 3 次，随后交人工。复核记录存于 `outputs/gemini-homepage-review/latest.json`，由云端工作流提交；下一次每小时更新只在候选 ID、内容哈希、规则版本和 30 天有效期全部匹配时应用。原文未整篇发送给模型。

应用层在 `decision.mjs`。它核对模型引用确实属于所选主事件；隐藏、补入和主事件调整都会记录在文章的 `homepageQualityReview`，原程序的 `v3Audit` 保留以便对照。输出仍要通过 `scripts/validate_generated_data.mjs`，并同步根目录与 `site/` 的数据和缓存版本。

测试：`node experiments/gemini-homepage-review/test-integration.mjs`、`test-snapshot.mjs`、`test-decision.mjs`、`test-apply-script.mjs`。这些测试不调用 Gemini，云端运行成功还需在 Actions 看实际调用和下一次数据更新结果。API 免费额度取决于用户的 Gemini 账号设置，代码只限流，不保证零费用。
