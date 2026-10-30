# Qwen3-8B 20篇人工标签最终复审记录

日期：2026-10-30

范围：仅更新离线实验人工标签及评价记录，不修改原始新闻证据、A/B模型输出、Prompt、Schema或生产逻辑。

## 1. 版本与口径

- 旧标签完整快照：`reviews/human-labels-before-latest-rules-2026-10-30.json`
- 旧标签 SHA-256：`31466e696711aadece8f068bc32eb293927009ebf7886f0926f49c6668278b59`
- 新标签文件：`human-labels.json`
- A组原始输出：Run `40644621847`，20篇。
- B组原始输出：Run `40992830933`，20篇，业务知识库版本 `1.0.0`，51项产品/能力。
- 模型输出仅用于对照，不作为标签真值。

本报告明确区分：

1. **原人工标签**：旧标签快照中的值。
2. **本轮最终标签**：依据用户本轮明确条件写入 `human-labels.json` 的值。
3. **待复核**：证据不足时保持原值，不代表已确认文章没有价值。

## 2. 最终分类统计

| 类别 | 数量 | 文章 |
|---|---:|---|
| A. 标签值已调整 | 2 | NVIDIA供应链扩产、CPO测试成本 |
| B. 证据不足，保持原标签 | 3 | 硅光规模化测试、面板级封装、U.2转PCIe适配器 |
| C. 仍需用户裁决 | 0 | 本轮没有未决标签；新增证据出现后可重新复审 |
| D. 原标签保留 | 15 | 包括Marvell CXL及其余14篇 |

## 3. 实际标签修改记录

### 3.1 NVIDIA供应链扩产

- **样本**：`high-01-nvidia-capacity` — NVIDIA and Supply Chain Partners Expand Capacity to Accelerate AI Infrastructure Buildout
- **来源/日期**：NVIDIA Newsroom，2026-10-21。
- **原始证据**：NVIDIA正式宣布与供应链伙伴扩大全球制造产能，以满足加速计算和AI factory平台需求；保留证据未给出具体规模、制造对象或伙伴名单。
- **业务映射**：`server_complete_assembly`、`ai_rack_scale_integration`；属于立讯直接业务链条的需求与制造产能信号，但不能推断立讯参与。
- **原标签**：Medium / High / 首页是 / `confirmed_future`。
- **最终标签**：**Medium / Medium / 首页是 / `confirmed_future`**。
- **规则依据**：正式供应链扩产具有首页跟踪价值；缺少具体规模和制造对象的扩产通常只评Medium Priority。
- **证据状态**：足以确认正式未来计划；不足以判断具体产能落点。
- **A组模型**：Low / Low / 首页是 / `unknown`。
- **B组模型**：High / Medium / 首页是 / `confirmed_future`。

### 3.2 CPO测试成本

- **样本**：`edge-06-cpo-test-cost` — Bringing Down Test Costs For Co-Packaged Optics
- **来源/日期**：Semiconductor Engineering，2026-10-26。
- **原始证据**：明确指出失效定位、known-good optical engine以及CPO进入先进封装后的测试成本控制问题。
- **业务映射**：`cpo_solution` 为直接业务；`optical_engine` 能力仍待核实。关联点是CPO制造测试、良率和成本，不推断立讯自产光引擎。
- **原标签**：High / Medium / 首页否 / `unknown`。
- **最终标签**：**High / Medium / 首页是 / `unknown`**。
- **规则依据**：摘要提供了具体测试瓶颈及成本/制造影响，符合核心业务深度技术分析首页准入，不要求另有商业事件。
- **证据状态**：足以确认技术分析主题和具体瓶颈；没有量化降本结果，因此事件阶段仍为`unknown`。
- **A组模型**：Medium / Low / 首页是 / `confirmed_future`。
- **B组模型**：High / Medium / 首页是 / `confirmed_future`。

## 4. 证据不足但未改标签

### 4.1 硅光规模化测试

- **样本**：`edge-05-silicon-photonics-test` — Testing Silicon Photonics At Scale
- **来源/日期**：Semiconductor Engineering，2026-10-26。
- **证据**：仅列出光纤对准、耦合效率、偏振管理和光学仪器等测试要求，没有说明其制造、成本或性能影响。
- **业务映射**：`optical_module`、`cpo_solution`；`silicon_photonics_chip` 仍待核实。
- **原标签 = 最终标签**：**High / Medium / 首页否 / `unknown`**。
- **处理**：保持待复核。需要更完整摘要或全文证明这些要求构成具体技术瓶颈及制造、成本或性能影响后，才可改为首页是。
- **A组模型**：Low / Low / 首页是 / `unknown`。
- **B组模型**：Low / Low / 首页是 / `unknown`。

### 4.2 面板级封装

- **样本**：`edge-04-panel-packaging` — The AI Packaging Challenge: 5 Reasons Panels Are Gaining Momentum
- **来源/日期**：EE Times，2026-10-26。
- **证据**：只保留panel-level processing正在成为先进封装扩展路径的趋势陈述，没有保留“5个原因”的具体技术内容。
- **业务映射**：可能涉及 `sip_packaging`、`electronic_module_packaging`、`micro_assembly`；若实质属于CoWoS或2.5D/3D，则相关能力仍待核实。
- **原标签 = 最终标签**：**Medium / Medium / 首页否 / `unknown`**。
- **处理**：不改标签，记录待补全文；不能仅凭标题或“panel-level”自动判High或默认展示。
- **A组模型**：Low / Low / 首页是 / `unknown`。
- **B组模型**：High / Medium / 首页是 / `confirmed_future`。

### 4.3 U.2转PCIe适配器评测

- **样本**：`hide-07-pcie-adapter-review` — ADT R27A-BK3 U.2 to PCIe Adapter Review
- **来源/日期**：ServeTheHome，2026-10-24。
- **证据**：摘要截断，`bodyEvidence`为空；标题显示为低价适配器评测。
- **业务映射**：可能表面涉及 `high_speed_connector`，但没有接口性能、信号完整性或制造难点证据。
- **原标签 = 最终标签**：**Low / Low / 首页否 / `unknown`**。
- **处理**：保持隐藏；按用户要求不为该低价值文章优先补抓全文。
- **A组模型**：Low / Low / 首页是 / `unknown`。
- **B组模型**：Low / Low / 首页否 / `unknown`。

## 5. Marvell CXL专项结论

- **样本**：`edge-03-marvell-cxl` — ADDING and REPLACING Marvell Unveils Second-generation Structera X, Industry-first Six-channel CXL 3.2 Memory Expanders for AI Inference
- **来源/日期**：Marvell Newsroom，2026-10-12。
- **证据**：六通道DDR4/DDR5、PCIe Gen6、容量规格及预计2027年Q1送样；文章描述CXL生态和内存池，但没有证明服务器整机/整柜或互连接口需求已经发生具体变化。
- **业务映射**：`dram_memory`、`cpu_chip` 为上游；可能间接影响 `server_complete_assembly`、`ai_rack_scale_integration`。
- **原标签 = 最终标签**：**Medium / Medium / 首页否 / `confirmed_future`**。
- **规则依据**：产品规格和未来送样计划本身不足以放行。只有可靠证据明确说明服务器系统设计、互连接口或整机/整柜集成需求变化时才改为首页是。
- **A组模型**：Low / Low / 首页是 / `unknown`。
- **B组模型**：Low / Low / 首页是 / `unknown`。

## 6. 其余14篇逐篇复核

### 6.1 Vertiv Polar 41MW

- **样本/标题/来源**：`high-02-vertiv-polar` — Vertiv targets up to 30% more cumulative AI token output in first 12 months using NVIDIA DSX, Polar deploys approach at Norway site；Vertiv News，2026-10-21。
- **证据**：41MW首期项目正在应用预制部署；Vertiv供应预制电源、热管理、SmartRun和SmartMod。
- **productId**：`ai_rack_scale_integration`、`server_power_supply`、`power_distribution_unit`、`coolant_distribution_unit`。
- **原标签 = 最终标签**：High / Medium / 首页是 / `occurred`。
- **A/B**：A=High/Medium/是/`confirmed_future`；B=Low/Low/是/`confirmed_future`。
- **结论**：证据充分，无需补全文或用户裁决。

### 6.2 Vertiv 2.3MW CDU

- **样本/标题/来源**：`high-03-vertiv-cdu` — Vertiv Coolant Distribution Unit qualified as NVIDIA DSX ready for AI factory infrastructure；Vertiv News，2026-09-21。
- **证据**：2.3MW CoolChip CDU已经获得NVIDIA DSX Ready资格。
- **productId**：`coolant_distribution_unit`。
- **原标签 = 最终标签**：High / Medium / 首页是 / `occurred`。
- **A/B**：A=High/Medium/是/`confirmed_future`；B=High/Medium/是/`confirmed_future`。
- **结论**：竞争产品资格里程碑已发生；证据充分。

### 6.3 Apple American Manufacturing Program

- **样本/标题/来源**：`high-04-apple-manufacturing` — Apple announces American Manufacturing Program partners for latest iPhone lineup；Apple Newsroom，2026-10-20。
- **证据**：关键材料/组件伙伴、四年6000亿美元制造承诺、Broadcom 15亿美元扩建和多年150亿颗芯片协议。
- **productId**：关联 `consumer_connectors_and_charging`、`consumer_optical_modules`及消费电子制造能力；不推断具体立讯供货项目。
- **原标签 = 最终标签**：High / High / 首页是 / `confirmed_future`。
- **A/B**：A=High/Medium/是/`confirmed_future`；B=Low/Low/是/`unknown`。
- **结论**：重大客户地域、供应商和制造布局变化，证据充分。

### 6.4 Supermicro 208kW液冷整柜

- **样本/标题/来源**：`high-05-supermicro-rack` — Supermicro NVIDIA Vera CPU Rack: 256 Vera CPUs, 400TB of LPDDR5X, and 22,500 Agent Sandboxes in a 208kW Liquid-Cooled 48U；StorageReview，2026-10-22。
- **证据**：48U、100%液冷、256颗Vera CPU和明确系统规格。
- **productId**：`ai_rack_scale_integration`、`server_power_supply`、`coolant_distribution_unit`、`cold_plate`。
- **原标签 = 最终标签**：High / Medium / 首页是 / `occurred`。
- **A/B**：A=High/Medium/是/`occurred`；B=High/Medium/是/`confirmed_future`。
- **结论**：直接竞争整柜正式发布，证据充分。

### 6.5 Google Cloud Vera Rubin GA

- **样本/标题/来源**：`edge-01-google-ga` — Google Cloud and NVIDIA Announce General Availability of NVIDIA Vera Rubin Infrastructure；NVIDIA Newsroom，2026-10-21。
- **证据**：实例正式宣布下月GA，并计划扩展到欧洲。
- **productId**：间接关联 `server_complete_assembly`、`ai_rack_scale_integration`。
- **原标签 = 最终标签**：Medium / Medium / 首页是 / `confirmed_future`。
- **A/B**：A=Low/Low/是/`unknown`；B=Low/Low/是/`unknown`。
- **结论**：重大平台正式商业化可进首页，但必须保留未来计划阶段。

### 6.6 Marvell 3.2T Retimer / 1.6T AEC DSP

- **样本/标题/来源**：`edge-02-marvell-retimer` — Marvell Bolsters Connectivity Portfolio with New 3.2T Protocol-aware Retimer and Second-generation 1.6T AEC DSP；Marvell Newsroom，2026-10-13。
- **证据**：16 lanes 224G PAM4、3nm AEC DSP且已向客户送样。
- **productId**：`active_electrical_cable` 为直接产品；`aec_dsp`、`retimer_chip` 为上游器件。
- **原标签 = 最终标签**：High / Medium / 首页是 / `preparation_validation`。
- **A/B**：A=Low/Low/是/`unknown`；B=High/Medium/是/`occurred`。
- **结论**：正式客户送样可进首页，但不是量产或客户采用。

### 6.7 EPYC泄露基准

- **样本/标题/来源**：`edge-07-epyc-leak` — Leaked 256-core Zen 6c EPYC CPU destroys Zen 5 in early single-threaded benchmarks hints at 24% IPC gain；Tom's Hardware，2026-10-26。
- **证据**：非正式benchmark leak，只暗示IPC可能提升。
- **productId**：`cpu_chip` 上游，间接影响服务器需求。
- **原标签 = 最终标签**：Medium / Low / 首页否 / `rumor`。
- **A/B**：A=Low/Low/是/`unknown`；B=Low/Low/否/`unknown`。
- **结论**：传闻保留全集但不进首页。

### 6.8 NVIDIA Minerva软件

- **样本/标题/来源**：`hide-01-minerva-software` — NVIDIA Unveils Minerva to Bring End-to-End Observability for AI Factories；NVIDIA Newsroom，2026-10-22。
- **证据**：AIOps可观测性软件，没有硬件或供应链变化。
- **productId**：无直接映射。
- **原标签 = 最终标签**：Low / Low / 首页否 / `occurred`。
- **A/B**：均为Low/Low/首页是/`unknown`。
- **结论**：正确隐藏。

### 6.9 Siri语言扩展

- **样本/标题/来源**：`hide-02-siri-languages` — Siri AI is available in more languages starting today；Apple Newsroom，2026-10-26。
- **证据**：软件更新增加语言支持，无硬件或制造变化。
- **productId**：无。
- **原标签 = 最终标签**：Low / Low / 首页否 / `occurred`。
- **A/B**：均为Low/Low/首页是/`unknown`。
- **结论**：正确隐藏。

### 6.10 iPad mini规格更新

- **样本/标题/来源**：`hide-03-ipad-mini` — Apple gives iPad mini its biggest update ever；Apple Newsroom，2026-10-26。
- **证据**：OLED、亮度和GPU/AI性能更新，无供应商、产能或制造变化。
- **productId**：无可确认的具体项目；不能由Apple品牌推断供货。
- **原标签 = 最终标签**：Low / Low / 首页否 / `occurred`。
- **A/B**：均为Low/Low/首页是/`unknown`。
- **结论**：正确隐藏。

### 6.11 Marvell股息

- **样本/标题/来源**：`hide-04-marvell-dividend` — Marvell Technology, Inc. Declares Quarterly Dividend Payment；Marvell Newsroom，2026-09-25。
- **证据**：例行股息，保留摘要没有经营增量。
- **productId**：无。
- **原标签 = 最终标签**：Low / Low / 首页否 / `unknown`。
- **A/B**：A=Low/Low/首页是；B=Low/Low/首页否。
- **结论**：正确隐藏。

### 6.12 Apple时尚制作案例

- **样本/标题/来源**：`hide-05-apple-fashion` — Bünyamin Aydın’s new collection, “From Earth to Sky,” soars with iPad Pro；Apple Newsroom，2026-10-14。
- **证据**：既有设备用于拍摄和后期制作，是营销使用案例。
- **productId**：无新硬件或供应链映射。
- **原标签 = 最终标签**：Low / Low / 首页否 / `occurred`。
- **A/B**：A=Low/Low/首页否；B=Low/Low/首页是。
- **结论**：正确隐藏。

### 6.13 Office促销

- **样本/标题/来源**：`hide-06-office-promotion` — Get Microsoft Office Professional for $27.97 with No Subscription；TechPowerUp，2026-10-26。
- **证据**：个人软件许可证折扣，无硬件需求或企业部署。
- **productId**：无。
- **原标签 = 最终标签**：Low / Low / 首页否 / `occurred`。
- **A/B**：A=Low/Low/首页是；B=Low/Low/首页否。
- **结论**：正确隐藏。

### 6.14 Qotom工业mini-PC评测

- **样本/标题/来源**：`hide-08-mini-pc-review` — Qotom Q51551UT 4x 10GbE and 6x 2.5GbE Mini PC Review；ServeTheHome，2026-10-22。
- **证据**：普通产品评测，无订单、产能、客户采用或技术路线变化。
- **productId**：无直接服务器整机/整柜事件映射。
- **原标签 = 最终标签**：Low / Low / 首页否 / `occurred`。
- **A/B**：A=Low/Low/首页是；B=Low/Low/首页否。
- **结论**：正确隐藏。

## 7. A/B旧标签与新标签评价对比

### 7.1 核心准确率

| 指标 | A旧 | A新 | B旧 | B新 |
|---|---:|---:|---:|---:|
| Relevance准确率 | 60% | 60% | 60% | 60% |
| Priority准确率 | 60% | 60% | 70% | 75% |
| EventStage准确率 | 30% | 30% | 20% | 20% |
| Schema合法率 | 100% | 100% | 100% | 100% |
| Evidence合法率 | 100% | 100% | 100% | 100% |
| 业务一致性合格率 | 5% | 5% | 25% | 25% |
| 全字段参考匹配 | 1/20 | 1/20 | 2/20 | 2/20 |

### 7.2 首页指标：模型原始建议

| 组别 | Precision旧→新 | Recall旧→新 | 无关/隐藏新闻误放行旧→新 |
|---|---:|---:|---:|
| A | 36.8% → 42.1% | 100% → 100% | 12 → 11 |
| B | 46.7% → 53.3% | 100% → 100% | 8 → 7 |

### 7.3 首页指标：确定性约束后有效建议

| 组别 | Precision旧→新 | Recall旧→新 | 高价值漏判旧→新 | 隐藏新闻误放行旧→新 |
|---|---:|---:|---:|---:|
| A | 100% → 100% | 57.1% → 50.0% | 3 → 4 | 0 → 0 |
| B | 66.7% → 83.3% | 57.1% → 62.5% | 3 → 3 | 2 → 1 |

解释：CPO标签改为首页是后，A组原始建议与标签一致，但确定性约束因A模型给出Priority=Low而继续拦截，因此A组约束后新增一条高价值漏判。B组给出High/Medium，约束后可正确放行，原先对CPO的“误放行”转为true positive。

### 7.4 关键案例变化

- **NVIDIA扩产**：B组Priority=Medium现在与新标签一致；B仍把Relevance判成High，A仍为Low/Low。
- **CPO测试成本**：B组High/Medium和首页是与新标签一致，仅EventStage仍错误地判为`confirmed_future`；A组首页原始建议匹配，但Relevance/Priority和Stage仍不匹配。
- **硅光测试**：标签未改，A/B仍把Low/Low与首页是组合在一起，既不符合标签也存在跨字段一致性错误。
- **Marvell CXL**：标签保持隐藏，A/B原始首页建议仍是误放行。
- **面板级封装**：标签保持隐藏；B仍可能因知识库将其过度映射为High/Medium并放行。
- **U.2适配器**：B正确隐藏；A原始建议仍误放行。

## 8. 业务知识库是否带来实质改善

结论：**有局部实质改善，但结果明显混合，尚不能证明整体判断可靠。**

- B相对A的Priority准确率：75% vs 60%，提高15个百分点。
- B相对A的约束后首页Recall：62.5% vs 50%，提高12.5个百分点。
- B相对A的业务一致性：25% vs 5%，提高20个百分点。
- B相对A的Relevance准确率没有改善，均为60%。
- B的EventStage更差：20% vs 30%。
- B约束后首页Precision低于A：83.3% vs 100%，主要剩余误放行为证据不足的面板级封装。
- B仍严重漏判Vertiv Polar、Apple Manufacturing和Google Cloud GA，并对面板级封装存在过度归类。

因此，知识库改善了部分业务领域和Priority判断，也帮助CPO案例通过约束，但没有解决阶段识别、重要客户供应链和重大平台商业化等核心问题。

## 9. 后续复核清单

1. 补充硅光规模化测试全文或可靠长摘要，确认是否具体解释制造、成本、性能影响。
2. 补充面板级封装全文，确认其技术内容和立讯已确认封装能力边界。
3. Marvell CXL只有出现明确服务器系统设计、接口或整机/整柜需求变化证据时才重新考虑首页准入。
4. U.2适配器保持隐藏，不列为优先补抓对象。
5. 标签再次变化时，继续从原始A/B输出重新评价，不重新调用模型，也不复用过期评价结果。
