# 新闻规则现状审计（供外部复核）

**核对日期：2026-11-12。** 本文描述代码和已有结果，不提出或实施新标签体系。代码分属两个仓库：线上静态网站 `hardware`（本文所在仓库，当前分支 `codex/news-tagging-shadow`）及独立试验仓库 `news-filter-lab`（本地目录 `news-filter-trial/`，不属于前者的 Git 跟踪文件）。仓库中的现状不等于已经验证的分类准确率；文中的“AI 复核”是一次性人工辅助判断，并非网站自动发布规则。

## 一、真正生效的流程和规则层级

| 层级 | 执行状态 | 输入、输出与作用 |
| --- | --- | --- |
| 网站定时更新 | **线上生效** | [`update-news.yml`](.github/workflows/update-news.yml) 每小时第 17 分钟启动，设置 `NEWS_FILTER_MODE=v3`；[`fetch_real_sources.mjs`](scripts/fetch_real_sources.mjs) 抓取、去重、生成 `real-data.js` 和 `taxonomy.js`，同步至 `site/`。已提交的 [`real-data.js`](real-data.js) 元数据也写着 `filterMode: "v3"`，生成时间为 2026-11-04；不能据此断言 11 月 12 日之后的实际云端运行情况。|
| 网站 V3 判断 | **上述任务的主筛选器** | [`news-filter-v3.mjs`](experiments/news-filter-v3/news-filter-v3.mjs) 对候选作结构检查、广告/游戏/促销剔除、业务知识库匹配、相关性、重要性、阶段和首页可见性判断。无模型调用。标签和首页结果写进文章；网站 [`app.js`](app.js) 再按日期、`showByDefault` 和用户筛选条件展示、排序。|
| 网站旧版规则 | **仍运行以供回退/对照，通常不决定发布结果** | [`fetch_real_sources.mjs`](scripts/fetch_real_sources.mjs) 总会计算旧版结果；V3 模式成功时以 V3 覆盖，V3 加载或执行失败会回退旧版。旧版的标题/正文关键词、`detectedIncrementType` 和旧阶段有时残留在生成文章的内部字段中，不能把它们当成 V3 的最终判定。|
| 两业务程序试验 | **手动/试验，不接网站首页** | `news-filter-trial/experiments/news-screening/{scope,rules,screen}.mjs` 和 `news-filter-trial/experiments/news-tagging/fetch-fresh.mjs`：只看通信与数据中心、汽车；输出 `入选/待定/排除`、粗事件名与证据。11 月 12 日的 30 篇属于这里。|
| Feeds Fun 风格语义打标 | **历史影子试验，自动工作流已删除** | `news-filter-trial/experiments/news-tagging/{taxonomy.json,system-prompt.txt,adapter.mjs,run.mjs,refine.mjs,compare.mjs}`：本地/临时模型服务生成候选标签，程序复核后导出对照表；`3e8248e` 删除自动 Actions 工作流。模型配置和提示词尚在，但当前网站更新任务不调用它。|

**实际顺序。** 网站：来源发现与抓取 → 候选去重 → 旧版分析作为回退 → V3 知识库与评分 → V3 保留/首页决定 → 生成静态数据 → 浏览器按日期和用户筛选展示。候选发现/抓取的限额、正文缺失和去重都可能先于 V3 排除新闻。影子模型试验：输入清单 → 排除消费电子 → 正文分块 → 模型抽取事件/内容标签 → JSON/引文位置校验 → `refineEvents` 用程序剔除候选事件 → 选一个展示用 `main_event` → `compareDecisions` 标出与旧程序的差异。模型**可对仍在清单中的程序“排除”新闻发现事件**，但不能补回未抓到、未入清单或在试验入口已剔除的新闻；差异仅供复核，**不会自动改成入选或推到首页**。模型结果也**会再次经过程序过滤**，包括背景角色、状态和引文关键词门槛。详见试验 `run.mjs`、`refine.mjs`、`compare.mjs`。

## 二、网站当前全部有限标签/字段

这些字段维度不同。除明确说明，以下不是对同一篇新闻的多个事件标签。

| 字段及全部取值 | 代码定义及实际准入 | 排除/边界与互斥关系 |
| --- | --- | --- |
| `industry`：数据中心硬件、3C 产品、核心零部件、财报/产业信号 | [`taxonomy.js`](taxonomy.js) 列举；[`inferIndustry`](scripts/fetch_real_sources.mjs) 用全文词和分数赋**一个**值 | **单选互斥**。它是宽泛网页分类，并非两业务试验的领域；`3C 产品` 仍存在于网站代码和数据，说明“仅汽车/数据中心”未贯穿线上网站。没有独立汽车行业值，汽车可能落入其他值或回退值。|
| `signalCategory`：供应链、产品、财报、公司动态、宏观经济 | [`taxonomy.js`](taxonomy.js) 列举；[`classifyText`](scripts/fetch_real_sources.mjs) 按优先次序“财报→公司动态→供应链→产品”赋**一个**值 | **单选互斥**，不是严格事件类型。`宏观经济` 有定义但该生成函数没有返回路径。标题/正文中的财报词可能盖过真正主事件。|
| `importance`：高、中、低；`relevance`：高、中、低 | V3 [`determinePriority`、`determineRelevance`](experiments/news-filter-v3/news-filter-v3.mjs) 各输出**一个**值；中文映射在 [`fetch_real_sources.mjs`](scripts/fetch_real_sources.mjs) | 两字段彼此独立；高相关不必然高重要。广告/软件促销降重要性，传闻最多中重要。直接产品对象可给高相关；上游须有具体影响才提级；重大平台/客户供应链可走独立战略路径。|
| `showByDefault`：真/假；`decisionStatus`：accepted、rejected、needs_review；`admissionPath`：major_platform_commercialization、important_customer_supply_chain、core_deep_technical_analysis、relevance_priority、material_increment、major_platform_future、none | V3 [`decideHomepage`](experiments/news-filter-v3/news-filter-v3.mjs)；前五个路径可令 `showByDefault=true` | **单个去向/路径**，不是内容标签。证据不足、传闻、低相关或低重要先挡住首页；“保留在数据中”和“默认首页展示”不同。`needs_review` 并不自动触发人工复核队列。|
| `eventStage`：rumor、sampling_validation、prediction、confirmed_future、mixed、occurred、unknown、not_applicable | V3 [`inferEventStage`](experiments/news-filter-v3/news-filter-v3.mjs) 对拼接的文章文本赋**一个主值**；`mixed` 同时记录已发生和未来；深技术分析无事件可记 `not_applicable` | **主值互斥**。优先序为传闻→试样/验证→预测→未来→混合→已发生→未知；存在单篇多事件互相污染风险。它没有明确区分“初步应用”与“规模应用”，也没有统一的“发布”阶段。|
| `tags`：AI、GPU、Data Center、Server、HBM、Networking、Smartphone、Filings、CAPEX、Cloud、Automotive、Gaming、Packaging、Storage、Power、Cooling；另加最多两个命中的公司名 | [`extractTags`](scripts/fetch_real_sources.mjs) 对标题+正文的关键词命中，去重后最多取前 **5** 个 | **可并用**，按规则顺序截断；没有主事件、事实阶段或同句证据门槛。某些词组只是领域/技术名，不表示“发生变化”。公司名集合由 `companyPatterns` 动态匹配，故无封闭的“全部公司标签”清单。|
| `briefingValue`：Demand signal、Supply signal、Cost signal、Technology shift、Risk event、Customer move、Competitor move、Capital allocation、Luxshare business fit | [`briefingValueRules`、`inferBriefingValue`](scripts/fetch_real_sources.mjs) 用多组宽泛词和客户/竞品动作；旧版及生成字段仍可存在 | **可并用**。`Technology shift` 可能仅因平台/产品词命中；`Luxshare business fit` 不是已证实立讯供货。V3 首页不直接以此数组判定。|
| `defaultFeedAudit`、`v3Audit` | V3 还输出原因码、产品匹配、证据充分性、阶段等机器可读审计字段，代码在 [`classifyWithV3`](scripts/fetch_real_sources.mjs) | 审计字段不是给读者看的正式标签。`defaultFeedAudit.eventType` 在 V3 中实际装的是 **首页准入路径**，不是事件类型；名称存在混用。|

V3 对广告、垃圾、无关游戏、纯软件促销可直接 `retained=false`；其余新闻即使不进首页也可能保留在“全部”视图。浏览器默认只展示 `showByDefault=true`，还要求所选日期范围内；“全部”筛选可以看隐藏文章，但不能找回抓取前已丢失的文章。[`app.js`](app.js)

网页 `tags` 的逐项判据如下，均是**出现词即命中，不要求它是主事件**，并无独立的语义排除条件：AI（AI/artificial intelligence）、GPU（GPU/Blackwell/CUDA）、Data Center（data center/datacenter）、Server（server/rack）、HBM（HBM/memory/DRAM）、Networking（network/Ethernet/InfiniBand）、Smartphone（iPhone/smartphone/mobile/Android）、Filings（10-K/10-Q/8-K/filing）、CAPEX（capex/capital expenditure）、Cloud（cloud/inference）、Automotive（robotaxi/automotive/driving）、Gaming（GeForce Now/gaming）、Packaging（advanced packaging/chiplet/OSAT）、Storage（storage/SSD/NAND）、Power（power/PDU/busbar/UPS）、Cooling（cooling/liquid/CDU）。`HBM` 可因普通 memory 命中，`Cloud` 可因 inference 命中，不能按字面认为已验证 HBM/云业务。超过五项按代码先后截断。准入与排除详情以 [`extractTags`](scripts/fetch_real_sources.mjs) 正则为准。

### 线上业务知识库与证据边界

[`config/luxshare-business-profile.json`](config/luxshare-business-profile.json) 版本 1.0.0，状态写着 `draft_for_review`，仍被线上 V3 加载。领域含 AI 服务器与整柜、高速互连、光通信、电源与液冷、先进封装与微组装、消费电子、汽车电子、GPU/CPU/存储上游。产品关系四级：`direct`、`upstream`、`adjacent`、`unconfirmed`。[`business-profile.mjs`](experiments/news-filter-v3/business-profile.mjs) 将产品别名与正文匹配，并对光模块、AEC 芯片/线缆、SiP/先进封装等歧义作特殊处理；`article_subject` 与 `related_luxshare_product` 分开。**`direct` 是知识库中的产品类别映射，不是立讯供应该新闻客户的证明**；代码没有“必须证明立讯与该客户有供货关系”这一前置条件。反过来，真实行业事件也不会自动具有立讯业务相关性，V3 仍要判断产品或明确的上下游影响。

知识库保留消费电子领域，线上 [`inferIndustry`](scripts/fetch_real_sources.mjs)、`tags` 和旧版过滤也仍含 3C。这与两业务程序试验“排除 3C”的口径不一致，需要外部复核确认统一范围；本文不擅自把线上改成两业务。知识库把“公开证据”“工作范围”分开，但 V3 仍采用关键词和有限上下文判断对象，不能将匹配等同供应事实。

## 三、两业务程序试验的标签与门槛（非线上正式标签）

| 维度 | 全部取值和准入 | 排除与互斥 |
| --- | --- | --- |
| 领域 | 通信与数据中心、汽车；[`scope.mjs`](https://github.com/elodielinnn-cpu/news-filter-lab/blob/codex/news-tagging-shadow/experiments/news-screening/scope.mjs) 先排除标题中的消费电子，再由标题、摘要/正文前段或来源判断 | 两领域可同时出现。没有命中则 `排除`；标题式 3C 排除不等于全文都检查完。|
| 程序事件 | **9 类**：商业部署与供货（部署、运行、出货）；新品与平台方案（推出、展示、发布）；供应商与技术合作（合作、联合开发）；供应商变化（选定、更换、份额线索）；订单与产能（签约、订单、扩产、迁产）；并购与投资；需求与成本变化；技术与制造变化；政策与供应风险。定义见 [`rules.mjs`](https://github.com/elodielinnn-cpu/news-filter-lab/blob/codex/news-tagging-shadow/experiments/news-screening/rules.mjs) 各正则。 | 一个句子可命中多个；`screen.mjs` 遍历正文变化，选**第一个满足业务门槛**的事件，未选中时显示第一个命中。不是主事件排序，类间重叠明显：发布可同属新品/技术，扩产可同属订单/产能/投资。教程/促销标题、背景句、否定句、软件片段等会挡掉；技术变化另需硬件词。|
| 业务门槛与结果 | [`screen.mjs`](https://github.com/elodielinnn-cpu/news-filter-lab/blob/codex/news-tagging-shadow/experiments/news-screening/screen.mjs) 先找正文具体变化，再核对变化句及相邻句的直接产品；上游变化须有同对象、明确因果和直连产品的影响句。输出 `入选`、`待定`、`排除`。 | **结果互斥**，不是网站 `showByDefault`。消息不确定、正文不足或上游影响不明为待定；仅同篇提到产品不算对应。没有独立的事件阶段、重要性、首页字段。对已被前置消费电子门槛或采集失败删除的新闻无补回路径。|

## 四、历史语义模型试验的全部封闭标签（当前不自动运行）

来源为试验 [`taxonomy.json`](https://github.com/elodielinnn-cpu/news-filter-lab/blob/codex/news-tagging-shadow/experiments/news-tagging/taxonomy.json)、[`system-prompt.txt`](https://github.com/elodielinnn-cpu/news-filter-lab/blob/codex/news-tagging-shadow/experiments/news-tagging/system-prompt.txt)、[`refine.mjs`](https://github.com/elodielinnn-cpu/news-filter-lab/blob/codex/news-tagging-shadow/experiments/news-tagging/refine.mjs)。提示词全文以链接文件为准：先抽“主体—对象—动作—阶段—证据”的独立事件，再给标签；每个分块最多四个事件；背景事件不得成为文章事件；同一发展优先最具体标签；两句可共同支持同一事件。模型配置 [`runtime.json`](https://github.com/elodielinnn-cpu/news-filter-lab/blob/codex/news-tagging-shadow/experiments/news-tagging/runtime.json) 指向 Qwen2.5-7B-Instruct-Q4_K_M；这只是可运行试验配置，**不是线上网站模型**。Feeds Fun 提供的是流程借鉴，网站并未直接部署它的原版服务。模型输入的业务产品清单来自上述知识库和 `activeProducts`，但提示词明令不得推断立讯产品/供应关系。

**领域标签（3）**：通信与数据中心、汽车、范围外。可多选，模式要求只用清单；具体行业边界主要由输入范围和模型理解决定，taxonomy 未给逐项数值门槛。

**内容类型（14）**：产业新闻、企业公告、财务披露、技术分析、市场研究、产品评测、使用与安装教程、广告促销、观点评论、访谈、展会与会议报道、标准与规范、研究与专利、资讯汇编。可多选；代码**没有每类逐项的必要/排除条件**，主要由普通语义和模型提示词判断。其中广告促销、教程、产品评测、资讯汇编只要任一出现，`compare.mjs` 就不把该篇视作实质事件候选，即使另一事件属实；此为试验对照门槛，不是网站首页规则。

**事件类型（25）**：下表“准入/排除”是提示词语义条件，加上程序复核的实际限制；未列的专门限制表示没有单独代码验证，而非自动正确。每条事件只取一种类型；一篇可有多个不同事件，展示输出仅选一个 `main_event`。

| 标签 | 准入事实 | 明确排除/程序限制 |
| --- | --- | --- |
| 技术与工艺更新 | 新功能、规格、工艺或可归因测量变化 | 仅技术词、旧背景不够；`technologyChange` 动词与 `oldBackground` 正则拦截 |
| 系统架构变化 | 系统级拓扑、角色、接口、供电/散热布局变化 | 单颗芯片、兼容性或商业模式不够；`architectureEvidence` 正则拦截 |
| 新品与平台发布 | 正式发布或现已可订购的产品/平台 | 展示、评测、泄露、未来上市不够；`formalLaunch`、`futureLaunch` 拦截 |
| 供应商与份额变化 | 确认替换、切换、份额变动 | 首次提及供应商不够；专门正则检查 |
| 订单与合同 | 已签商业采购/供货合同或明确扩大采购框架 | 合作意向、并购、内部目标或“框架即订单”不成立；`contractAction` 等检查 |
| 合作与联合开发 | 有名主体共同宣布新联合行动 | 仅兼容、希望协同不够；`partnershipAction` 检查 |
| 资本投资 | 股权融资或明确商业投资行动 | 并购估值、公共补助不等同；通用引文正则检查 |
| 产能扩张 | 可识别产能项目及施工/投运里程碑 | 批准/承诺不能当已完工；专门正则偏重实际建设/上线 |
| 制造迁移 | 原址与新址、产线迁移事实 | 只提新工厂不够；专门正则检查动作 |
| 试产量产与产能爬坡 | 实际生产或交付爬坡 | 销售额、计划、厂内机器人移动不够；未来词再拦截 |
| 部署与采用 | 指名用户/地点已运行、测试，或平台已普遍可用 | 未来部署、审批、单纯评测/零售不够；`futureOnly` 再拦截；“已可用”与“客户部署”在此混用 |
| 客户定点、认证与验证 | 已确认客户定点或通过第三方/客户/监管认证 | 不自动推出订单/量产；专门正则检查，但对普通 `selected` 的覆盖不全 |
| 业绩与经营变化 | 公司正式财务业绩 | 车辆销量/登记不算公司财报；专门正则检查 |
| 需求与出货展望 | 已发生的需求/出货变化，或可归因预测 | 作者自行揣测不够；对 `forecast` 有额外归因检查 |
| 价格与成本变化 | 新价格/成本事实 | 仅提“成本”不够；金额/涨跌正则检查 |
| 供应中断与短缺 | 新的短缺、中断事实 | 没有独立专门正则，仍受通用证据/阶段门槛 |
| 并购整合 | 有依据的提议、签约或完成 | 需按实际阶段，签约不等于完成；专门正则检查 |
| 政策与监管 | 新普遍规则或正式公共项目行动 | 单项产品批准归认证；专门正则检查 |
| 贸易与出口限制 | 新贸易/出口限制 | 无独立专门正则，受通用证据/阶段门槛 |
| 质量问题与召回 | 已启动召回 | 一般质量讨论不够；专门召回正则 |
| 安全事件 | 实际入侵、攻击、泄露 | 安全功能/模拟演练不够；专门正则检查 |
| 重组与业务退出 | 新重组/退出事实或正式计划 | 计划停产不是已经停产；无独立专门正则 |
| 研究原型与试验 | 实物原型、工程样品或实际验证 | 未来测试协议不够；专门正则检查 |
| 标准与互操作变化 | 新标准或互操作改变 | 仅兼容性描述不够；无独立专门正则 |
| 其他具体变化 | 原有类目都不适合的具体变化 | `refineEvents` **一律剔除**，实际不会作为最终事件 |

**模型事件阶段（7）**：`occurred` 已发生、`confirmed-plan` 正式计划、`trial-validation` 试验验证、`forecast` 预测、`rumor` 传闻、`historical` 历史背景、`unclear` 未明确。每条事件单选；同篇各事件可不同阶段。后置程序直接丢弃 rumor/historical/unclear，forecast 除需求展望、价格成本、产品发布之外通常丢弃。故 taxonomy 虽允许“阶段未明确”，最终标签中该阶段**实际上留不下来**；`product-launch` 允许 forecast 与提示词“未来上市不能算新品发布”也不完全一致。`relations` 还列 `direct` 直接产品变化、`explicit-indirect` 明确上下游影响、`unclear` 关系未明，但当前事件 schema/导出未作为正式判定输出，属于未落地维度。`raw_tags` 可记录至多六个原文概念，`proposed_tags` 至多一个新事件/内容类建议，均不自动成为正式标签。参见 [`adapter.mjs`](https://github.com/elodielinnn-cpu/news-filter-lab/blob/codex/news-tagging-shadow/experiments/news-tagging/adapter.mjs)、[`run.mjs`](https://github.com/elodielinnn-cpu/news-filter-lab/blob/codex/news-tagging-shadow/experiments/news-tagging/run.mjs)。

## 五、近期复核引入的个案措辞与限制

| 修改位置/来源 | 原本要解决的问题 | 当前效力与局限 |
| --- | --- | --- |
| `news-filter-trial` 提交 `6f9116a`；[`refine.mjs`](https://github.com/elodielinnn-cpu/news-filter-lab/blob/codex/news-tagging-shadow/experiments/news-tagging/refine.mjs) | HPE × Vultr 的 `booked order`、NetApp Novus 的 `orderable today`、Schneider × Equinix 的 `live deployment`、Supermicro OCP 的 `available now` 曾被误删 | 加入这些词组到订单、发布、部署规则；仅在手动模型试验生效。救回对应措辞，但同义表达仍可能漏。 |
| 提交 `e938b3f`；[`system-prompt.txt`](https://github.com/elodielinnn-cpu/news-filter-lab/blob/codex/news-tagging-shadow/experiments/news-tagging/system-prompt.txt)、[`quality.mjs`](https://github.com/elodielinnn-cpu/news-filter-lab/blob/codex/news-tagging-shadow/experiments/news-tagging/quality.mjs) | NetApp 发布句与可订购句分离；Meta 文章用 CoreWeave 背景句支持 Meta 部署；Valeo × Nissan 定点漏抽 | 新增事件对象/主体/动作/阶段与相邻句补证；`orderable`、`selected by` 是**警告**，不会自动补事件。背景角色会在 `refine` 中剔除，但不会自动重新寻找正确引文。 |
| 提交 `45c241a`、`3e9b52b`；[`refine.mjs`](https://github.com/elodielinnn-cpu/news-filter-lab/blob/codex/news-tagging-shadow/experiments/news-tagging/refine.mjs) | 评论区话语、旧发布/旧展会背景误作当前事件；采购框架和实际订单混淆 | `editorialAside`、`oldBackground`、合同动作词修正。`in May`、`in September` 等宽泛日期片语可能误伤当期回顾或当前事实。 |
| 提交 `c608952`；[`adapter.mjs`](https://github.com/elodielinnn-cpu/news-filter-lab/blob/codex/news-tagging-shadow/experiments/news-tagging/adapter.mjs) | 辅助引文 ID 无效时整块输出丢失 | 只警告并保留有效主引文；解决模型协议/证据定位，不解决语义判断。 |
| 网站 [`news-filter-v3.mjs`](experiments/news-filter-v3/news-filter-v3.mjs)、[`fetch_real_sources.mjs`](scripts/fetch_real_sources.mjs) | 旧版大量噪声与业务落点不足 | V3 的通用结构/商业化/证据门槛线上生效；旧版仍有 `explicitDefaultFeedBans` 等很长的具体词表和特殊限制，但 V3 成功时不直接作首页结论。两套规则同时留存增加排查难度。 |

## 六、最近 30 篇的八个可核对案例

样本源为独立试验仓库 `news-filter-trial/outputs/news-tagging/review-30-comparison-2026-11-12.csv`；同目录 JSON 保留正文段落与程序证据。表中编号取样本文件原有的 `sampleNumber`。**“程序结果/标签”是两业务程序试验；“AI 去向”是一次性 Codex 阅读复核，不是人工标准答案，也没有再次运行历史 Qwen 标签模型。**我又用当前网站 V3 函数和当前业务知识库直接回放同一 JSON：30 篇中仅 13 篇有 `publishedAt`，17 篇缺失，后者被 V3 的必填字段检查直接判 `structural_invalid`，无法衡量事件/业务判断。这是输入格式不齐，并不能证明 17 篇新闻本身不应进首页。此离线调用也没有经过网站的来源发现、去重和抓取流程，因此只代表该输入下的 V3 函数输出，不等于线上已发布结果。

30 篇程序输出为 **4 入选、12 待定、14 排除**。这只是该批试验的原始分布，不能当作线上首页命中率。

| 编号、新闻 | 两业务程序结果/事件 | 网站 V3 直接回放 | 一次性 AI 复核的主事件/去向 | 暴露的边界 |
| --- | --- | --- | --- | --- |
| [#1 Lenovo SC755 V5](https://www.storagereview.com/news/lenovo-thinksystem-sc755-v5-sr755-v5-de6800-amd-epyc-9006) | 待定／新品与平台方案 | 高相关、中重要、阶段未知、**默认展示**（`relevance_priority`） | 液冷服务器及机柜新品／建议首页 | 事件存在；V3 可仅凭相关性+重要性进首页，即使阶段未知。 |
| [#4 AMD EPYC Venice SP7 评测](https://www.storagereview.com/review/amd-epyc-venice-sp7-review) | 待定／技术与制造变化 | 高相关、中重要、混合阶段、**默认展示**（`core_deep_technical_analysis`） | CPU 发布及评测／建议观察 | 程序挑到 MRDIMM 原理，不是主事件；V3 把评测也送首页，值得重点复核。 |
| [#16 AMD Helios 在 Meta 测试](https://www.storagereview.com/news/amd-helios-racks-running-at-meta-custom-instinct-gpu-6th-gen-epyc-muse) | 入选／供应商与技术合作 | 样本缺发布日期，直接回放为 `structural_invalid`，**未评估内容** | 机柜已在 Meta 安装测试／建议首页 | 两业务程序入选方向合理，但主事件是已安装试验，不是后段未来合作；试验≠规模应用。 |
| [#20 Vertiv SmartIT](https://www.storagereview.com/news/vertiv-smartit-mgx-orv3-ai-rack-gb300-vera-rubin-nvl72-120-142kw-242kw-liquid-cooling) | 入选／技术与制造变化 | 缺发布日期，**未评估内容** | 可购买的预集成机柜/液冷方案／建议首页 | 发布与商业可用须分开；原文不能证明立讯供应 Vertiv。 |
| [#24 Smartbird × WEKA](https://www.storagereview.com/news/smartbird-dedicated-ai-clusters-weka-neuralmesh-managed-enterprise-ai) | 待定／供应商与技术合作 | 缺发布日期，**未评估内容** | 托管 AI 集群的软件数据层合作／建议仅全集 | 合作事实成立，但硬件业务映射未证实；非首页不等于合作不成立。 |
| [#27 NVIDIA DSX POD 及光引擎扩产](https://www.storagereview.com/news/nvidia-gtc-berlin-2026-dsx-pod-14-day-ai-factory-substrate-openshell-ai-ran) | 入选／订单与产能 | 缺发布日期，**未评估内容** | 主事件为 DSX POD 预集成参考方案，合作伙伴**拟于 2027 年**交付／建议首页 | 程序挑中后段扩产：该事件可真实存在，却不是文章主事件；14 天是有条件目标。 |
| [#34 Valeo 铝制换热器验证](https://www.valeo.com/en/valeo-presents-breakthrough-aluminum-cooling-technology-for-data-centers-at-ocp-global-summit-2026-and-reaches-significant-durability-milestones) | 排除／无事件 | 缺发布日期，**未评估内容** | 已公布数据中心换热器试验进展／建议观察 | 技术验证事实与立讯冷板/CDU 关联不同；“排除”不等于新闻无事实。 |
| [#37 Valeo 角雷达合同](https://www.valeo.com/en/valeo-secures-contract-for-next-generation-radar-technology-with-north-american-oem) | 排除／技术与制造变化 | 缺发布日期，**未评估内容** | 获北美车企下一代角雷达合同／建议首页 | 程序漏识合同主事件及汽车业务映射；需复核是候选漏抽还是对象映射漏配。 |

这 8 篇覆盖新品、技术评测、试验验证、商业可用、合作、扩产及合同。只有两篇样本输入满足 V3 的发布日期必填条件；其余六篇的实际网站去向**未能由此次回放确定**。补齐可核实的原始发布日期后，应以网站抓取入口重跑并保存 `v3Audit`，再比较最终首页去向。

## 七、待统一的概念和未定义处

1. **“不是主事件”与“标签不成立”目前混用。** 两业务程序以第一个通过门槛的事件为输出；第 22 篇的扩产可以成立但不是主事件。模型试验虽有 `article_role` 和 `main_event`，仍是“第一个合格 primary”而非完整的主次排序。网站 V3 根本不输出统一的主事件类型。
2. **“真实事件”与“立讯相关”不是同一判断。** 两业务试验分了事件门和业务门；V3 有产品关系/战略路径。内容分析不要求证明立讯实际供货，但如果要向管理层表述“立讯供应某客户”，仍需独立证据，当前标签无法证明。
3. **阶段体系未统一。** 网站 V3 用文章整体关键词，`mixed` 可由不同事件触发；旧版另有 `preparation_validation`；模型用每事件 7 状态却后置剔除 `unclear`；两业务程序无阶段。发布、计划、测试、初步应用、规模应用还没有共同且完整的枚举/证据门槛。
4. **领域、事件、重要性、首页混用。** `industry=财报/产业信号` 不是行业；`signalCategory=供应链/产品/财报` 混合议题、内容和动作；`defaultFeedAudit.eventType` 在 V3 是首页准入路径；`briefingValue=Technology shift` 可能只是技术名词；可购买与客户部署在影子模型同属“部署与采用”。
5. **规则过细和措辞依赖确实存在。** 网站旧版的特定产品/媒体例外词、模型 `oldBackground` 日期片语以及 `available now`、`booked order` 等补词，都可能在个案上奏效而对同义句失效或误伤。哪些标签必须保留、哪些只需作为正文事实尚未有统一口径。
6. **尚未定义**：全系统通用的跨新闻三维标签口径；“初步应用/规模应用”的量化或可核对边界；多事件新闻选主事件的统一规则；领域和事件标签是否允许多选的正式产品要求；AI 差异如何进入线上首页的人工审核责任与闭环。本文不把用户提出的三维示例写成既定规则。

**建议的下一步复核动作：** 先让外部复核者按上表 8 篇分别给“主事件是否正确、业务映射是否成立、阶段事实、首页去向”四列结论；同时从原文核实并补齐 17 篇缺失的发布日期，再通过网站抓取入口重跑 V3 并保存机器可读审计。这样能比较现行线上流程与拟定口径，也避免拿影子试验的“入选”代替网站首页。
