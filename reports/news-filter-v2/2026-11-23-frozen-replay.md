# 2026-11-23 新闻筛选同输入回放

## 回放口径

- 来源：2026-11-20 14:07（北京时间）云端产物中的 137 条，选取 12 条实际链接，覆盖四组重点与负例。该云端产物只有摘要和筛选结果，没有保存完整送入模型或程序的正文；**无法还原 11 月 20 日的原始全文输入**。
- 2026-11-23 重新抓取这 12 个链接，冻结标题、摘要、正文段落和输入 SHA-256。旧版与新版判定程序都读取同一份冻结 JSON。旧版结果在修改判定规则前保存；新版结果见 [机器可读回放](2026-11-23-frozen-replay.json)。原文只保留在本机临时文件 `/private/tmp/frozen-news-replay-2026-11-23.json`，不提交到公开仓库。
- “入选”仅指这篇新闻本身通过首页价值门槛；线上还会应用日期窗口及重复事件合并。本报告不把 12 条当作首页数量预测。
- `article_body` 表示抽到可用正文，`related_links_only` 表示抓到的“正文”主要是侧栏旧闻；后者改按已有摘要判断，证据状态记为 `summary_only`。

## 逐条结果

| 新闻及来源 | 新版正文状态 | 旧版 → 新版 | 主要证据、对象与阶段 | 新版最终环节 |
|---|---|---|---|---|
| [CPO 生产集群部署](https://www.servethehome.com/nvidia-and-lambda-disclose-first-production-co-packaged-optics-cluster-it-is-finally-real/) | 正文 | 排除，无候选 → 入选，产品技术 | Lambda 披露 CPO 已部署于生产集群、规模逾 1 万 GPU；对象为**光互连器件**，阶段为**初步应用**。不是整个机柜的发布。 | `accepted / product_technology_change` |
| [NVIDIA 官方财报](https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-third-quarter-fiscal-2027) | 正文，49 段 | 入选，但误以 Rubin 出货为主事件 → 入选，经营变化为主事件 | 数据中心营收 1076 亿美元，同比增 110%；对象为**企业经营**，阶段**不适用**。Rubin 出货仍是另一候选事件。 | `accepted / strategic_business_change` |
| [EE Times 财报解读](https://www.eetimes.com/nvidia-reports-115-8b-in-quarterly-revenue-under-interim-ceo/) | 正文 | 经营变化入选 → 保持 | 季度营收 1158 亿美元及同比变化；企业经营，阶段不适用。 | `accepted / strategic_business_change` |
| [TechPowerUp 财报转载](https://www.techpowerup.com/354965/nvidia-reports-q3-2026-earnings-of-usd-115-8-billion) | 正文夹侧栏，侧栏已剔除 | 经营变化入选 → 保持 | 同一财报；企业经营，阶段不适用。线上应由重复事件规则合并，不能计作另一条独立首页价值。 | `accepted / strategic_business_change` |
| [Dell Exascale 液冷存储](https://www.storagereview.com/news/dell-exascale-liquid-cooled-storage-poweredge-m8825-openmanage-rack-scale-sc26) | 正文 | 入选，但误判为整柜直接产品 → 入选，按液冷存储平台与冷板关联 | 新 2-OU 液冷存储可容纳 32 块 NVMe；相邻段说明发热部件用冷板、无风扇、与机柜共享冷却液。**主对象是存储平台，不是整柜**；冷板是相关器件；阶段为**已发布**，正文另称预计 2027 年初供货。 | `accepted / product_technology_change` |
| [Supermicro 全闪服务器出货](https://www.techpowerup.com/354989/supermicro-ships-first-all-flash-storage-servers-delivering-pcie-gen-6-performance-and-broad-software-defined-storage-support) | **仅摘要；网页正文是侧栏旧闻** | 因优先级低排除 → 凭摘要中明确出货事实入选 | 摘要明确首批 Petascale 系统现已出货；对象为**服务器**，阶段**初步应用**。未来 AMD SP8 产品另列候选，不覆盖现有出货。**需要后续取得厂商全文再核验**。 | `accepted / product_technology_change`，`inputStatus=summary_only` |
| [Intel D270 芯片跑分](https://www.techpowerup.com/354944/intel-publishes-benchmarks-for-d270-crescent-island-gpu-claims-wins-over-rtx-pro-6000) | **仅摘要；网页正文是侧栏旧闻** | 排除 → 待补正文 | 摘要只有芯片跑分和功耗；未证明对服务器、整柜或立讯相关部件的工程影响。当前应说明证据不足，不能把它当成有完整正文的低价值判断。 | `input_evidence / needs_review`，不上首页 |
| [AdGuard 促销](https://www.techpowerup.com/354892/block-ads-encrypt-traffic-this-adguard-bundle-is-usd-44-this-week) | 侧栏旧闻 | 排除 → 排除 | 标题本身是软件套餐折扣；无需借侧栏判断行业价值。 | `content_type / rejected` |
| [TSMC 客户付款传闻](https://www.techpowerup.com/355020/tsmc-reportedly-reviews-customer-finances-asks-some-chip-buyers-to-pay-upfront) | **仅摘要；网页正文是侧栏旧闻** | 排除 → 排除 | 标题及摘要均以“据报”表述，尚无确认的政策变更；即使有行业供需风险措辞也不能入首页。 | `source_confidence / rejected` |
| [Marvell × Penguin 合作](https://investor.marvell.com/news-events/press-releases/detail/1044/marvell-and-penguin-solutions-collaborate-to-address-data-center-ai-memory-and-accelerate-inference-at-scale) | 正文 | 排除 → 排除 | CXL 内存合作是实际行业事件，阶段不适用；目前该事件证据没有把其具体影响连到关注的产品或制造环节。**行业归属成立，业务关联未过**。 | `business_relevance / rejected` |
| [AI 加速器供电工程文章](https://semiengineering.com/ai-accelerators-drive-changes-in-power-delivery-networks/) | **仅摘要，正文未取得** | 待复核 → 待复核 | 标题有工程主题，但缺少足以核查的功耗、供电约束或设计结论。不是“行业外”或“业务无价值”。 | `input_evidence / needs_review` |
| [One UI 消费软件](https://www.ithome.com/1/029/829.htm) | 正文 | 排除 → 排除 | 3C 软件内容，与汽车及通信数据中心筛选范围无关。 | `industry / rejected` |

## 本次流程修复

1. **正文先验**：抓取器支持官方财报页 `.article-body` 和列表项；去除日期开头的侧栏旧闻；判定器对旧数据里的侧栏列表再做一次防护，记录 `sourceBodyStatus`、`inputStatus` 与最终拒绝环节。只凭无效正文不能宣称“全文证据充分”。
2. **先多事件，后主事件**：保留所有候选，按每个事件自己的证据、业务相关性、重要性和标题关系选择主事件。财报优先选择有金额的经营事实；出货与同段未来计划拆开。审计保留各候选及其拒绝环节。
3. **按实际对象映射**：器件、服务器、整柜、基础设施和经营事件分别标记。存储平台提到“用于 AI 机柜”不等于整柜；冷板在 Dell 案例中属于关联部件。服务器实际出货可对应整机装配业务，不因同句提到 CPU 就只匹配芯片。
4. **四条独立入口**：产品技术、重大经营、实质供需风险、工程分析分别可通过。四条均有通用合成回归测试；真实冻结样本验证了前两条。供需风险和工程分析在这批样本中没有证据充分的正例，因此不声称真实样本通过了这两条。

## 仍需关注

- 这 12 条是从同一云端批次抽取的诊断样本；**不是 137 条全量同输入回放**。公开云端产物未保存 11 月 20 日的完整正文，无法对该日的真实送模正文做逐字复现。
- Supermicro 的首页价值判断目前依赖新闻摘要。应优先补厂商公告全文；若未来摘要没有明确出货、对象和阶段，程序应保持待复核。
- TechPowerUp 个别页面向抓取器返回 403 或只给侧栏。修复保证状态诚实，但不能保证该网站今后可抓。云端下一轮须检查该来源的 `sourceBodyStatus` 分布。
- 对财报多家媒体转载，线上仍需确认重复事件合并效果及日期窗口。不要以本回放的入选条数推断正式首页条数。
