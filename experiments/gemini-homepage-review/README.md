# 云端首页复核

正式路径：`Update reviewed news` 每天北京时间 08:30、12:30 在同一次云端任务里依次抓取、用 V3 规则及两项业务知识库筛选、对少量候选做 Gemini 复核，最后才提交网站数据。抓取和程序判断期间，网站继续显示上次发布结果。模型不逐篇通读所有抓取结果，也不增设技术标签。

模型只返回 `SHOW`、`HIDE` 或 `UNCERTAIN`、一个已有候选事件编号、简短理由和对应引文。只有经过验证的 `SHOW` 才能进入本次首页；未复核、`HIDE` 和 `UNCERTAIN` 都不进首页。接口失败、缺少 `GEMINI_API_KEY`、无效 JSON 或引文不匹配时，本次任务不发布，网站保留上一次成功版本。模型不能补回抓取阶段已丢弃的新闻，也不能把正文证据不足、传闻、日期错误或行业不符的新闻改为入选。

复核输入最多保留每篇 5 个程序候选事件及其简短证据。每日两次，每次最多新调用 12 篇、5 万输入 token、3000 输出 token；超出预算的候选等待下次复核，不进入本次首页。同一标题、摘要、筛选规则和候选事件的完成结果可复用；变更后须重新复核。失败最多重试 3 次，随后交人工。复核记录与网站数据在同一个成功任务中提交到仓库。原文未整篇发送给模型。

应用层在 `decision.mjs`。它核对模型引用确实属于所选主事件；未获有效复核的程序入选项也会隐藏。补入和主事件调整记录在 `homepageQualityReview`，原程序的 `v3Audit` 保留以便对照。最终输出通过 `scripts/validate_generated_data.mjs`，并同步根目录与 `site/` 的数据和缓存版本。

测试：`node experiments/gemini-homepage-review/test-integration.mjs`、`test-snapshot.mjs`、`test-decision.mjs`、`test-apply-script.mjs`。这些测试不调用 Gemini，云端运行成功还需在 Actions 看实际调用和下一次数据更新结果。API 免费额度取决于用户的 Gemini 账号设置，代码只限流，不保证零费用。
