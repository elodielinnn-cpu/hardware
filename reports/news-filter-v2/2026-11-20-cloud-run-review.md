# 2026-11-20 云端新闻抓取与漏选复核

**对应运行：** [GitHub Actions #1020](https://github.com/elodielinnn-cpu/hardware/actions/runs/44685597188)，手动触发，成功结束。输入代码 `0eec36a7545807e31a61589c7f50bc6bc2334fac`；线上生成时间 `2026-11-20T14:07:00+08:00`；筛选模式 `v3`。本报告直接读取该轮之后 `main/real-data.js` 的公开成品，而非本机旧数据。

## 结论与口径

- 成品共 **137 篇**；按网站最近 7 天窗口（11 月 14–20 日）有 **106 篇**，其中 **2 篇入首页**、**11 篇待补证据**、**93 篇被规则拒绝**。
- `showByDefault=true` 的成品共有 5 篇，但 10 月 13 日、10 月 21 日和 11 月 13 日的 3 篇已超出最近 7 天，所以页面只显示 2 篇。这是时间窗口与首页准入两个不同条件。
- “漏选”在本报告中指**已经抓到、但当前规则未让它入首页，且值得人工复核**；不等于已经证明应入首页。另列两条确认不在本轮成品中的外部新闻。
- 本轮抓取漏斗附件需要 GitHub 登录才可下载，公开接口返回 401；因此无法从成品确认每个源的原始条数、失败详情或正文请求失败数。下表的“抓到”只表示进入最终成品，零条来源不能自动判为抓取失败。

## 首页实际入选的两篇

| 日期 | 新闻 | 当前主因 | 人工意见 |
| --- | --- | --- | --- |
| 2026-11-18 | [(PR) NVIDIA Expands Commitments With Supply Chain Partners to Support AI Infrastructure Buildout](https://www.techpowerup.com/354985/nvidia-expands-commitments-with-supply-chain-partners-to-support-ai-infrastructure-buildout) | strategic_business_change；中相关、中重要 |  |
| 2026-11-17 | [Vertiv advances 800 VDC power architectures to support growing AI data center demands](https://www.vertiv.com/en-us/about/news-and-events/corporate-news/2026/vertiv-advances-800-vdc-power-architectures-to-support-growing-ai-data-center-demands/) | product_technology_change；高相关、中重要 |  |

## 已抓到、优先复核的漏选候选

下表保留程序的真实结果，并说明为什么值得复核。建议在“人工意见”列填“入首页 / 留全集 / 待补证据”，再附一句理由。

| 日期 | 新闻来源与原文 | 程序结果 | 复核点 | 人工意见 |
| --- | --- | --- | --- | --- |
| 2026-11-19 | [Nvidia Reports $115.8B in Quarterly Revenue Under Interim CEO](https://www.eetimes.com/nvidia-reports-115-8b-in-quarterly-revenue-under-interim-ceo/) | 未入首页；未抽到事件/工程结论、业务关联低、重要性低 | 财报媒体解读已抓到；标题有经营事实，但程序未抽出事件，判低相关/低重要。建议复核是否应作为本轮财报主卡。 |  |
| 2026-11-17 | [NVIDIA Announces Financial Results for Third Quarter Fiscal 2027](https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-third-quarter-fiscal-2027) | 待补证据；程序判行业范围外、未抽到事件/工程结论、证据不足 | 官方财报已抓到但只有摘要占位句；官方正文有数据中心收入、指引和机柜交付事实。优先补正文证据。 |  |
| 2026-11-17 | [(PR) NVIDIA Reports Q3 2026 Earnings of $115.8 Billion](https://www.techpowerup.com/354965/nvidia-reports-q3-2026-earnings-of-usd-115-8-billion) | 未入首页；程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 | 财报转载含金额与同比，但未抽到经营事件。应与 EE Times 和官方稿合并为一组。 |  |
| 2026-11-16 | [NVIDIA and Lambda Disclose First Production Co-Packaged Optics Cluster… It is FINALLY real](https://www.servethehome.com/nvidia-and-lambda-disclose-first-production-co-packaged-optics-cluster-it-is-finally-real/) | 未入首页；未抽到事件/工程结论、重要性低 | 媒体明确描述逾 1 万 GPU 的生产集群已部署 CPO；程序判无事件/低重要，疑似漏选。 |  |
| 2026-11-16 | [Marvell and Penguin Solutions Collaborate to Address Data Center AI Memory and Accelerate Inference at Scale](https://investor.marvell.com/news-events/press-releases/detail/1044/marvell-and-penguin-solutions-collaborate-to-address-data-center-ai-memory-and-accelerate-inference-at-scale) | 未入首页；未抽到事件/工程结论、重要性低 | 官方合作公告含 CXL 与光互连、资格验证和预计送样阶段；程序未抽到主事件。 |  |
| 2026-11-19 | [Detachable Fiber Connectors Pose New Challenges For Photonics](https://semiengineering.com/detachable-fiber-connectors-pose-new-challenges-for-photonics/) | 未入首页；未抽到事件/工程结论、重要性低 | 光互连制造与标准化分析；程序承认直接相关却判无工程结论，需复核文章是否有足够具体结论。 |  |
| 2026-11-19 | [AI Accelerators Drive Changes In Power Delivery Networks](https://semiengineering.com/ai-accelerators-drive-changes-in-power-delivery-networks/) | 未入首页；程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 | 供电网络工程分析；程序判行业范围外，需复核系统级供电影响。 |  |
| 2026-11-18 | [(PR) Supermicro Ships First All-Flash Storage Servers, Delivering PCIe Gen 6 Performance and Broad Software-Defined Storage Support](https://www.techpowerup.com/354989/supermicro-ships-first-all-flash-storage-servers-delivering-pcie-gen-6-performance-and-broad-software-defined-storage-support) | 未入首页；重要性低 | 已出货事实存在，但程序选中后续 CPU 版本作主对象；需按整篇主事件复核。 |  |
| 2026-11-19 | [Intel 18A yields hit 70% as company signs Microsoft as EMIB customer](https://www.tomshardware.com/tech-industry/semiconductors/intel-18a-yields-hit-70-percent-as-company-signs-microsoft-as-emib-customer-the-first-company-to-publicly-commit-to-intels-new-packaging-technology) | 未入首页；程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 | 微软成为 EMIB 客户及良率变化，程序未抽出事件；与立讯业务关联仍需独立判断。 |  |
| 2026-11-15 | [SK hynix Bets on HBM4 Demand Beyond NVIDIA With New Equipment Orders](https://www.techpowerup.com/354861/sk-hynix-bets-on-hbm4-demand-beyond-nvidia-with-new-equipment-orders) | 未入首页；程序判行业范围外、未抽到事件/工程结论、业务关联低 | 有设备订单/产能信号，但需核对是否只是传闻或与两项业务间接相关。 |  |
| 2026-11-19 | [(PR) DapuStor Introduces the R6 E1.S Liquid-Cooled Enterprise NVMe SSD](https://www.techpowerup.com/355035/dapustor-introduces-the-r6-e1-s-liquid-cooled-enterprise-nvme-ssd) | 未入首页；重要性低 | 液冷企业 SSD 被判直接相关却低重要；候选对象抽成泛泛工作负载，需复核具体散热创新。 |  |
| 2026-11-16 | [Vertiv ATLAS proves AI infrastructure ahead of silicon](https://www.vertiv.com/en-us/about/news-and-events/corporate-news/2026/vertiv-atlas-proves-ai-infrastructure-ahead-of-silicon/) | 未入首页；未抽到事件/工程结论、业务关联低、重要性低 | 官方稿摘要是占位句；先补正文，再评是否为实际验证还是宣传。 |  |
| 2026-11-16 | [Dell Exascale Adds 32-Drive Liquid-Cooled Storage for AI Racks, and a 512-Core Air-Cooled PowerEdge M8825](https://www.storagereview.com/news/dell-exascale-liquid-cooled-storage-poweredge-m8825-openmanage-rack-scale-sc26) | 未入首页；未抽到事件/工程结论、业务关联低、重要性低 | 液冷存储文章已抓到，摘要仍是占位句；当前未抽到事件，需要重新取证。 |  |
| 2026-11-20 | [美光：2027 年存储芯片已有 75% 库存售罄，供需形势会比今年更加紧张](https://www.ithome.com/1/029/786.htm) | 未入首页；程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 | 存储芯片供需报道已抓到，但程序判行业范围外；应核对是否有服务器内存、数据中心采购或产能的具体影响，不能只凭涨价推定立讯相关。 |  |

### 已确认在外部、但本轮未收录的媒体解读

- [美联社：阿里巴巴 AI 云业务增长、AI 基础设施资本开支和出口限制风险](https://apnews.com/article/922a7ccb3ee1b1336af112ace0e3b288)（11 月 19 日）。本轮成品没有此 URL，且来源清单没有 AP；这是**来源覆盖缺口**，但是否进首页还需按数据中心业务影响判断。
- [美联社：NVIDIA 季度业绩、数据中心收入与管理层变化](https://apnews.com/article/3026bcbe04ab57b844884382e583422a)（11 月 17 日）。本轮成品没有此 URL，可作为财报媒体解读候选；与已抓到的官方财报和 EE Times 应合并成**同一财报事件**。

## 根因定位：为什么只有两篇

1. **主事件漏抽比“来源太少”更直接。** NVIDIA 财报已有官方、EE Times 和 TechPowerUp 三个来源，但三篇的 `mainEvent` 均为空，最终被判“无事件/低相关/低重要”。同样的问题出现在 CPO 生产部署、Marvell 合作等新闻。代码的事件识别依赖标题、摘要及可用正文片段；公开成品没有保留完整送入文本，因此目前不能断定是正文未送入，还是句式规则未命中。
2. **正文与摘要状态不可靠。** 106 篇中，`v3Audit.inputStatus` 为 `unknown` 的有 93 篇，`summary_only` 11 篇，`full_text` 2 篇。这些字段不能据此证明 93 篇都没有正文，但确实不能用它们审计正文成功率。NVIDIA 官方财报和 Dell 液冷稿的公开摘要仍是占位句。
3. **行业与业务价值仍有混用。** 供电网络文章被判行业范围外；部分光互连文章已判高相关，却被“无事件/低重要”排除。可因管理价值不足留在全集，但拒绝理由必须指向真正原因。
4. **时间窗口进一步缩小可见数。** 5 篇内容准入只有 2 篇在最近 7 天。

## 财报解读的落地建议

- **先修已存在的媒体解读漏选。** 以本轮 NVIDIA 财报为固定样本，把官方财报的“数据中心收入 / 指引 / 供货与机柜进展”作为事实层，EE Times 的产业解读作为解读层；事件识别应至少抽到一次“经营变化”，并明确其对数据中心需求的影响。官网原始数字与媒体判断分别标注来源。
- **再扩一个可稳定抓取的独立媒体来源。** AP/Reuters 等可作发现候选，但应先验证免费可用的入口、正文可达性与转载许可；目前 Reuters/AP 不在配置中。不能只加一个关键词或把所有财报自动放首页。
- **同一财报只显示一张首页卡。** 卡片以官方数据为准，附 1 条媒体解读链接和其独有结论；新闻全集仍保留各篇来源。媒体标题仅谈股价或人事时，不应替代行业意义。

## 来源覆盖（最近 7 天进入成品的条数）

| 来源 ID | 成品条数 |
| --- | ---: |
| `techpowerup` | 38 |
| `tomshardware` | 19 |
| `semiconductor_engineering` | 10 |
| `storagereview` | 10 |
| `nvidia_newsroom` | 9 |
| `eetimes` | 7 |
| `ithome` | 6 |
| `sec_edgar` | 2 |
| `vertiv_news` | 2 |
| `servethehome` | 2 |
| `marvell_newsroom` | 1 |

配置为 active、但本轮成品没有新闻的来源：`trendforce_news`、`intel_newsroom`、`amd_newsroom`、`qualcomm_news`、`mediatek_press`、`samsung_newsroom`、`micron_blog`、`foxconn_press`、`microsoft_ir`、`amazon_ir`、`meta_news`、`federal_reserve`。这表示**成品覆盖为零**，原因可能是当期无条目、前置过滤、抓取失败或去重；本轮公开成品不足以区分。

另需注意：成品里仍有剃须刀、平板等 3C 新闻，虽未入首页，但与“3C 不进入抓取结果”的既定边界不符。

## 本轮 106 篇完整清单

“程序理由”是从 `v3Audit.reasonCodes` 提取的主要拒绝条件；一篇可能同时有多项。最后一列留给人工复核。

| 日期 | 来源 | 新闻原文 | 程序去向 | 程序理由 | 人工意见 |
| --- | --- | --- | --- | --- | --- |
| 2026-11-20 | ithome | [美光：2027 年存储芯片已有 75% 库存售罄，供需形势会比今年更加紧张](https://www.ithome.com/1/029/786.htm) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-20 | ithome | [消息称 AMD "Zen 6" 主流桌面处理器要到 COMPUTEX 2027 后方能面世](https://www.ithome.com/1/029/794.htm) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、传闻 |  |
| 2026-11-20 | ithome | [小米推出米家便携电动剃须刀 Pro 直柄多效版，众筹价 329 元](https://www.ithome.com/1/029/824.htm) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-20 | ithome | [三星自研 AI 新进展：Gauss 4 现身 One UI 9.5 代码](https://www.ithome.com/1/029/833.htm) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-20 | ithome | [三星 One UI 9.5 测试 Days：把通话、出行和支付等串成每日时间线](https://www.ithome.com/1/029/829.htm) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-20 | ithome | [OPPO Pad Air6 平板开售：2.8K 120Hz 柔光屏，国补后 2209.15 元起](https://www.ithome.com/1/029/792.htm) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-19 | semiconductor_engineering | [What Is Driving Silicon Wafer Demand Recovery?](https://semiengineering.com/what-is-driving-silicon-wafer-demand-recovery/) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-19 | tomshardware | [Three 'e-waste' Nvidia V100s hit 100 tokens per second on Qwen 3.6 35B in a $1,042 homelab rig](https://www.tomshardware.com/tech-industry/artificial-intelligence/three-e-waste-nvidia-v100s-hit-100-tokens-per-second-on-qwen-3-6-35b-in-a-usd1-042-homelab-rig-decommissioned-gpus-outpace-a-usd5-399-m5-max-mac-studio-at-long-contexts) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-19 | techpowerup | [TSMC Reportedly Reviews Customer Finances, Asks Some Chip Buyers to Pay Upfront](https://www.techpowerup.com/355020/tsmc-reportedly-reviews-customer-finances-asks-some-chip-buyers-to-pay-upfront) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、传闻 |  |
| 2026-11-19 | semiconductor_engineering | [Simulation of Plasma Chambers for Predictive Simulation of Semiconductor Manufacturing](https://semiengineering.com/simulation-of-plasma-chambers-for-predictive-simulation-of-semiconductor-manufacturing/) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-19 | storagereview | [SC26 Roundup: Record-Low TOP500 Turnover, Supermicro Ships PCIe Gen6 Flash, and VAST Adds Job-Level QoS](https://www.storagereview.com/news/sc26-roundup-top500-aic-msi-marvell-compal) | 未入首页 | 业务关联低、重要性低 |  |
| 2026-11-19 | tomshardware | [Pakistan undersea cable fault causes internet failure near Strait of Hormuz](https://www.tomshardware.com/networking/pakistan-undersea-cable-fault-causes-internet-failure-near-strait-of-hormuz-fault-detected-offshore-weeks-after-iran-threatened-infrastructure-in-the-region) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-19 | eetimes | [Nvidia Reports $115.8B in Quarterly Revenue Under Interim CEO](https://www.eetimes.com/nvidia-reports-115-8b-in-quarterly-revenue-under-interim-ceo/) | 未入首页 | 未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-19 | nvidia_newsroom | [NVIDIA Announces Upcoming Event for Financial Community](https://nvidianews.nvidia.com/news/nvidia-announces-upcoming-event-for-financial-community-6929322) | 待补证据 | 程序判行业范围外、未抽到事件/工程结论、证据不足 |  |
| 2026-11-19 | eetimes | [Memory R&D Is a High-Stakes Game](https://www.eetimes.com/memory-rd-is-a-high-stakes-game/) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-19 | tomshardware | [Intel Diamond Rapids shows signs of life in SC26 demo running live server](https://www.tomshardware.com/pc-components/cpus/intel-diamond-rapids-shows-signs-of-life-in-sc26-demo-running-live-server-next-gen-xeon-7-cpu-breaks-cover-at-partner-booths-no-showcase-from-intel) | 未入首页 | 未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-19 | tomshardware | [Intel 18A yields hit 70% as company signs Microsoft as EMIB customer](https://www.tomshardware.com/tech-industry/semiconductors/intel-18a-yields-hit-70-percent-as-company-signs-microsoft-as-emib-customer-the-first-company-to-publicly-commit-to-intels-new-packaging-technology) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-19 | semiconductor_engineering | [How Virtual Twins And Machine Learning Optimize DRAM Yield](https://semiengineering.com/how-virtual-twins-and-machine-learning-optimize-dram-yield/) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-19 | semiconductor_engineering | [From Metrology To Autonomy: Scaling Yield, Quality, And Innovation](https://semiengineering.com/from-metrology-to-autonomy-scaling-yield-quality-and-innovation/) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-19 | semiconductor_engineering | [Detachable Fiber Connectors Pose New Challenges For Photonics](https://semiengineering.com/detachable-fiber-connectors-pose-new-challenges-for-photonics/) | 未入首页 | 未抽到事件/工程结论、重要性低 |  |
| 2026-11-19 | tomshardware | [DDR6 RAM shrinks by 44% while delivering 4 times more bandwidth than DDR5 — JEDEC previews 12.8 GT/s modules with up to 1 terabyte of capacity per slot](https://www.tomshardware.com/pc-components/ram/ddr6-ram-shrinks-by-44-percent-while-delivering-4x-ddr5s-baseline-bandwidth-jedec-previews-12-8-gt-s-modules-with-up-to-1-terabyte-of-capacity-per-slot) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-19 | semiconductor_engineering | [Can AI Make Its Own Manufacturing Decisions?](https://semiengineering.com/can-ai-make-its-own-manufacturing-decisions/) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-19 | techpowerup | [Block Ads, Encrypt Traffic—This AdGuard Bundle is $44 This Week](https://www.techpowerup.com/354892/block-ads-encrypt-traffic-this-adguard-bundle-is-usd-44-this-week) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-19 | semiconductor_engineering | [Beyond Pass/Fail: Characterizing Silicon Margin With PVTW](https://semiengineering.com/beyond-pass-fail-characterizing-silicon-margin-with-pvtw/) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-19 | techpowerup | [AMD Stock Dives 15% Over Shortseller Report Alleging Export Control Violations to China, Rebounds Later](https://www.techpowerup.com/355036/amd-stock-dives-15-over-shortseller-report-alleging-export-control-violations-to-china-rebounds-later) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-19 | techpowerup | [AMD "Zen 6" for Desktop Reportedly Pushed to Computex 2027](https://www.techpowerup.com/355030/amd-zen-6-for-desktop-reportedly-pushed-to-computex-2027) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、传闻 |  |
| 2026-11-19 | tomshardware | [AI data center power demand will double by 2030 thanks to $4 trillion in spending, adding an entire Great Britain to energy strain](https://www.tomshardware.com/tech-industry/data-centers/ai-data-center-power-demand-will-double-by-2030-thanks-to-usd4-trillion-in-spending-adding-an-entire-great-britain-to-energy-strain-93-large-ai-factories-with-projected-capacity-of-around-50-gigawatts) | 未入首页 | 未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-19 | semiconductor_engineering | [AI Accelerators Drive Changes In Power Delivery Networks](https://semiengineering.com/ai-accelerators-drive-changes-in-power-delivery-networks/) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-19 | techpowerup | [(PR) Patriot Launches AI Matrix SSD and DRAM Series Engineered for Local AI Workloads](https://www.techpowerup.com/355024/patriot-launches-ai-matrix-ssd-and-dram-series-engineered-for-local-ai-workloads) | 未入首页 | 业务关联低、重要性低 |  |
| 2026-11-19 | techpowerup | [(PR) NAND Flash Prices Set to Decline in 2027 as Chinese CSP Order Cuts Outweigh North American Demand Growth](https://www.techpowerup.com/355022/nand-flash-prices-set-to-decline-in-2027-as-chinese-csp-order-cuts-outweigh-north-american-demand-growth) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低 |  |
| 2026-11-19 | techpowerup | [(PR) DapuStor Introduces the R6 E1.S Liquid-Cooled Enterprise NVMe SSD](https://www.techpowerup.com/355035/dapustor-introduces-the-r6-e1-s-liquid-cooled-enterprise-nvme-ssd) | 未入首页 | 重要性低 |  |
| 2026-11-18 | tomshardware | [The Downfall of Jensen Huang — a timeline of allegations and scandals that brought down the king of AI infrastructure](https://www.tomshardware.com/tech-industry/the-downfall-of-jensen-huang) | 未入首页 | 未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-18 | eetimes | [Qnity at One: Randy King on Shrink, Stack and the Materials Behind AI](https://www.eetimes.com/qnity-at-one-randy-king-on-shrink-stack-and-the-materials-behind-ai/) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-18 | tomshardware | [Nvidia says it’s ‘absurd’ to assume it predicted the agentic moment during Vera’s development](https://www.tomshardware.com/pc-components/cpus/nvidia-says-its-absurd-to-assume-it-predicted-the-agentic-moment-during-veras-development-product-intuition-helped-drive-cpu-design-superior-memory-bandwidth-will-play-critical-role-in-future-ai-agents-cpu-boss-claims) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-18 | tomshardware | [Nvidia promises employee pay raises, equity before December to quell unrest in wake of Jensen Huang scandal](https://www.tomshardware.com/tech-industry/big-tech/nvidia-promises-employee-pay-raises-equity-before-december-to-quell-unrest-in-wake-of-jensen-huang-scandal-at-first-all-hands-meeting-since-ceos-departure-staff-offered-perks-told-were-going-to-be-fine) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-18 | storagereview | [MinIO AIStor Memory Reaches GA at SC26 as Datadog Certifies AIStor for On-Premises BYOC Logs](https://www.storagereview.com/news/minio-announces-aistor-memory-is-ga-and-datadog-byoc-lakehouse-certification) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-18 | storagereview | [Microchip Flashtec NVMe 4016 Controller Features 16 NAND Channels and Over 14 GB/s](https://www.storagereview.com/news/microchip-flashtec-nvme-4016-controller-features-16-nand-channels-and-over-14-gb-s) | 未入首页 | 未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-18 | techpowerup | [Lenovo Legion Go Beam Handheld Leaks Sans Iconic Trackpad](https://www.techpowerup.com/355009/lenovo-legion-go-beam-handheld-leaks-sans-iconic-trackpad) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、传闻 |  |
| 2026-11-18 | tomshardware | [Leaked Ohio bill could allow AI data center companies to seize private land for their buildouts using eminent domain law](https://www.tomshardware.com/tech-industry/data-centers/leaked-ohio-bill-could-allow-ai-data-center-companies-to-seize-private-land-for-their-buildouts-using-eminent-domain-law-proposed-law-would-expand-list-of-beneficiaries) | 未入首页 | 未抽到事件/工程结论、业务关联低、传闻 |  |
| 2026-11-18 | eetimes | [Koduri’s Oxmiq Offers IP, Tools for Indian Teams to Design AI Chips](https://www.eetimes.com/koduri-oxmiq-offers-ip-tools-for-indian-teams-to-design-ai-chips/) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-18 | storagereview | [Hammerspace Data System Launches With OFP, a 1U DPU Flash Tray Rated at 390GB/s and Up to 9.83PB](https://www.storagereview.com/news/hammerspace-data-system-open-flash-platform-ofp-dpu-flash-xsight-e1) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-18 | sec_edgar | [HPE filed 8-K](https://www.sec.gov/Archives/edgar/data/1645590/000164559026000092/hpe-20261118.htm) | 待补证据 | 程序判行业范围外、未抽到事件/工程结论、证据不足 |  |
| 2026-11-18 | tomshardware | [Elon Musk’s SpaceXAI suffers chemical spill at Mississippi AI data center](https://www.tomshardware.com/tech-industry/data-centers/elon-musks-spacexai-suffers-chemical-spill-at-mississippi-ai-data-center-up-to-6-000-gallons-of-propylene-glycol-heat-transfer-fluid-lost-environment-agency-says-no-threat-to-residents) | 未入首页 | 未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-18 | eetimes | [Edge AI Moves Agricultural Intelligence from the Cloud to the Field](https://www.eetimes.com/edge-ai-moves-agricultural-intelligence-from-the-cloud-to-the-field/) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-18 | storagereview | [DDN EXAScaler 7 Adds a Software-Defined Option, Starting on the AI2200 With Third-Party Appliances to Follow](https://www.storagereview.com/news/ddn-exascaler-7-software-defined-lustre-ai2200-qualified-servers) | 未入首页 | 未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-18 | tomshardware | [China threatens 'countermeasures' in the face of new AI GPU rental and export restrictions](https://www.tomshardware.com/pc-components/gpus/china-threatens-countermeasures-on-the-face-of-new-ai-gpu-rental-and-export-restrictions-beijing-threatens-retaliation-ahead-of-thursdays-xi-jinping-meeting-sino-american-trade-war-may-be-renewed-for-a-new-season) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低 |  |
| 2026-11-18 | semiconductor_engineering | [Can AI Agents Really Shift Chip Design Left?](https://semiengineering.com/can-ai-agents-really-shift-chip-design-left/) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-18 | semiconductor_engineering | [Blog Review: Nov. 18](https://semiengineering.com/blog-review-nov-18-3/) | 未入首页 | 未抽到事件/工程结论、重要性低 |  |
| 2026-11-18 | eetimes | [Beyond One Turn: How a Single-Chip Multiturn Position Sensor Is Reshaping Actuator Design](https://www.eetimes.com/beyond-one-turn-how-a-single-chip-multiturn-position-sensor-is-reshaping-actuator-design/) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-18 | techpowerup | [(PR) Supermicro Ships First All-Flash Storage Servers, Delivering PCIe Gen 6 Performance and Broad Software-Defined Storage Support](https://www.techpowerup.com/354989/supermicro-ships-first-all-flash-storage-servers-delivering-pcie-gen-6-performance-and-broad-software-defined-storage-support) | 未入首页 | 重要性低 |  |
| 2026-11-18 | techpowerup | [(PR) NVIDIA Expands Commitments With Supply Chain Partners to Support AI Infrastructure Buildout](https://www.techpowerup.com/354985/nvidia-expands-commitments-with-supply-chain-partners-to-support-ai-infrastructure-buildout) | 入首页 | 其他 |  |
| 2026-11-18 | techpowerup | [(PR) JEDEC Previews Next-Generation DDR6 DRAM](https://www.techpowerup.com/354995/jedec-previews-next-generation-ddr6-dram) | 未入首页 | 业务关联低、重要性低 |  |
| 2026-11-18 | techpowerup | [(PR) HighPoint Enters Enterprise Networking Marketplace with Rocket 9500A 25GbE and 100GbE NIC Series](https://www.techpowerup.com/354997/highpoint-enters-enterprise-networking-marketplace-with-rocket-9500a-25gbe-and-100gbe-nic-series) | 未入首页 | 未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-18 | tomshardware | [$3.26 million in SpaceX AI data center revenue will be pumped back into the City of Memphis](https://www.tomshardware.com/tech-industry/data-centers/usd3-26-million-in-spacex-ai-data-center-revenue-will-be-pumped-back-into-the-city-of-memphis-up-to-usd25-000-on-offer-to-low-income-residents-for-repairs-and-home-improvements) | 未入首页 | 业务关联低、重要性低 |  |
| 2026-11-17 | vertiv_news | [Vertiv advances 800 VDC power architectures to support growing AI data center demands](https://www.vertiv.com/en-us/about/news-and-events/corporate-news/2026/vertiv-advances-800-vdc-power-architectures-to-support-growing-ai-data-center-demands/) | 入首页 | 其他 |  |
| 2026-11-17 | techpowerup | [U.S. Departments of Commerce and Justice Issue Rare Joint-Statement on the NVIDIA-Megaspeed Investigation](https://www.techpowerup.com/354921/u-s-departments-of-commerce-and-justice-issue-rare-joint-statement-on-the-nvidia-megaspeed-investigation) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-17 | techpowerup | [U.S. Cracks Down on China Renting AI GPUs Through Overseas Data Centers](https://www.techpowerup.com/354927/u-s-cracks-down-on-china-renting-ai-gpus-through-overseas-data-centers) | 未入首页 | 业务关联低、重要性低 |  |
| 2026-11-17 | tomshardware | [Taipei 101 lit up in support of Jensen Huang](https://www.tomshardware.com/tech-industry/big-tech/taipei-101-lit-up-in-support-of-jensen-huang-skyscraper-adorned-with-messages-of-support-following-resignation-as-nvidia-ceo) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-17 | tomshardware | [Phison Pascari X201P 15.36TB SSD Review: Fast PCIe 5.0 write performance for AI and ingest servers](https://www.tomshardware.com/pc-components/ssds/phison-pascari-x201p-15-36tb-ssd-review) | 未入首页 | 未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-17 | techpowerup | [Overclocker Tries to Revive SkyOC BCLK Overclocking via BIOS Mod](https://www.techpowerup.com/354909/overclocker-tries-to-revive-skyoc-bclk-overclocking-via-bios-mod) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-17 | tomshardware | [Nvidia claims its Vera CPU can gain up to 39% performance boost via software optimization at SC26 — architectural fine-tuning is needed to fully unleash custom Olympus cores](https://www.tomshardware.com/pc-components/cpus/nvidia-claims-its-vera-cpu-can-gain-up-to-39-percent-performance-boost-via-software-optimization-at-sc26-architectural-fine-tuning-is-needed-to-fully-unleash-custom-olympus-cores) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-17 | sec_edgar | [NVIDIA filed 8-K](https://www.sec.gov/Archives/edgar/data/1045810/000104581026000088/nvda-20261117.htm) | 待补证据 | 程序判行业范围外、未抽到事件/工程结论、证据不足 |  |
| 2026-11-17 | nvidia_newsroom | [NVIDIA Expands Commitments With Supply Chain Partners to Support AI Infrastructure Buildout](https://nvidianews.nvidia.com/news/nvidia-expands-commitments-with-supply-chain-partners-to-support-ai-infrastructure-buildout) | 待补证据 | 未抽到事件/工程结论、证据不足 |  |
| 2026-11-17 | servethehome | [NVIDIA Announces Rubin HPC: Science-Focused Server GPU to Arrive in 2028](https://www.servethehome.com/nvidia-announces-rubin-hpc-science-focused-server-gpu-to-arrive-in-2028/) | 未入首页 | 未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-17 | nvidia_newsroom | [NVIDIA Announces Financial Results for Third Quarter Fiscal 2027](https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-third-quarter-fiscal-2027) | 待补证据 | 程序判行业范围外、未抽到事件/工程结论、证据不足 |  |
| 2026-11-17 | eetimes | [Marc Hijink on ASML’s Culture, Supply Chain, and Geopolitics](https://www.eetimes.com/marc-hijink-on-asmls-culture-supply-chain-and-geopolitics/) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-17 | tomshardware | [Jensen Huang says he would be ‘honored’ to return as Nvidia CEO](https://www.tomshardware.com/tech-industry/big-tech/jensen-huang-says-he-would-be-honored-to-return-as-nvidia-ceo-first-statement-since-resignation-follows-support-from-billionaires-investors-and-some-employees) | 未入首页 | 业务关联低、重要性低 |  |
| 2026-11-17 | techpowerup | [Intel Publishes Benchmarks for D270 "Crescent Island" GPU, Claims Wins Over RTX PRO 6000](https://www.techpowerup.com/354944/intel-publishes-benchmarks-for-d270-crescent-island-gpu-claims-wins-over-rtx-pro-6000) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-17 | techpowerup | [Intel Prepares "Razor Lake" in Three Flavors: S, U, and L](https://www.techpowerup.com/354941/intel-prepares-razor-lake-in-three-flavors-s-u-and-l) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-17 | nvidia_newsroom | [Ian Buck Kicks Off NVIDIA’s Week at SC26 as Science Enters the Age of Agents](https://blogs.nvidia.com/blog/ian-buck-sc26/) | 待补证据 | 程序判行业范围外、未抽到事件/工程结论、证据不足 |  |
| 2026-11-17 | storagereview | [IBM Quantum Co-Design Platform With Fermilab and NVIDIA Targets Modular Systems, Plus a 79x Accuracy Gain on Fe4S4](https://www.storagereview.com/news/ibm-fermilab-nvidia-quantum-co-design-platform-slurm-qrmi-fe4s4-79x) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-17 | tomshardware | [How we test enterprise SSDs](https://www.tomshardware.com/pc-components/ssds/how-we-test-enterprise-ssds-our-new-test-suite-pushes-enterprise-and-data-center-ssds-to-their-limits) | 未入首页 | 业务关联低、重要性低 |  |
| 2026-11-17 | techpowerup | [GPD Publishes Full WIN Mini Ultra Specs, Pricing Still Under Wraps](https://www.techpowerup.com/354917/gpd-publishes-full-win-mini-ultra-specs-pricing-still-under-wraps) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-17 | tomshardware | [AMD attacks Nvidia's FP64 emulation at SC26, touts native double-precision on Instinct MI430X](https://www.tomshardware.com/pc-components/gpus/amd-attacks-nvidias-fp64-emulation-at-sc26-touts-native-double-precision-on-instinct-mi430x-says-ozaki-schemes-fit-less-than-10-percent-of-hpc-workloads-and-triple-memory-use-and-emulated-fp64-is-a-poor-fit-for-many-hpc-workloads) | 未入首页 | 未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-17 | techpowerup | [AMD CES 2027 Invite Hints at Possible Ryzen Zen 6 "Olympic Ridge" Reveal](https://www.techpowerup.com/354964/amd-ces-2027-invite-hints-at-possible-ryzen-zen-6-olympic-ridge-reveal) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-17 | techpowerup | [(PR) Q.ANT Unveils NPU Gen 2+: Photonic Fourier Transforms Power Large Language Model](https://www.techpowerup.com/354936/q-ant-unveils-npu-gen-2-photonic-fourier-transforms-power-large-language-model) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-17 | techpowerup | [(PR) NVIDIA Reports Q3 2026 Earnings of $115.8 Billion](https://www.techpowerup.com/354965/nvidia-reports-q3-2026-earnings-of-usd-115-8-billion) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-17 | techpowerup | [(PR) Meet Kandao Focus & Focus SE: 4K AI Webcams](https://www.techpowerup.com/354934/meet-kandao-focus-focus-se-4k-ai-webcams) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-17 | techpowerup | [(PR) Kensington Launches the Expert Mouse Pro TB900 EQ Trackball](https://www.techpowerup.com/354935/kensington-launches-the-expert-mouse-pro-tb900-eq-trackball) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-17 | techpowerup | [(PR) ASUS Showcases Full-Stack AI Infrastructure at SC26, Featuring Intel and AMD Platforms](https://www.techpowerup.com/354960/asus-showcases-full-stack-ai-infrastructure-at-sc26-featuring-intel-and-amd-platforms) | 未入首页 | 未抽到事件/工程结论 |  |
| 2026-11-17 | techpowerup | [(PR) AMD Completes Acquisition of Taalas to Advance AI Inference Innovation](https://www.techpowerup.com/354943/amd-completes-acquisition-of-taalas-to-advance-ai-inference-innovation) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-16 | vertiv_news | [Vertiv ATLAS proves AI infrastructure ahead of silicon](https://www.vertiv.com/en-us/about/news-and-events/corporate-news/2026/vertiv-atlas-proves-ai-infrastructure-ahead-of-silicon/) | 未入首页 | 未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-16 | techpowerup | [ORICO Introduces FlashMem FM9800 SSDs with Dedicated AI Cache](https://www.techpowerup.com/354910/orico-introduces-flashmem-fm9800-ssds-with-dedicated-ai-cache) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-16 | servethehome | [NVIDIA and Lambda Disclose First Production Co-Packaged Optics Cluster… It is FINALLY real](https://www.servethehome.com/nvidia-and-lambda-disclose-first-production-co-packaged-optics-cluster-it-is-finally-real/) | 未入首页 | 未抽到事件/工程结论、重要性低 |  |
| 2026-11-16 | nvidia_newsroom | [NVIDIA Sweeps MLPerf Training and Endpoints as Vera Rubin Debuts With Leading Performance](https://blogs.nvidia.com/blog/mlperf-training-endpoints-vera-rubin/) | 待补证据 | 程序判行业范围外、未抽到事件/工程结论、证据不足 |  |
| 2026-11-16 | storagereview | [NVIDIA SC26: Rubin HPC GPU With 50,000 CUDA Cores Due in 2028, 192-CPU Vera Racks in Early 2027, and a 13,000x Quantum Decoder](https://www.storagereview.com/news/nvidia-sc26-rubin-hpc-gpu-vera-cpu-hpc-rack-nemotron-for-science-quantum) | 未入首页 | 业务关联低 |  |
| 2026-11-16 | nvidia_newsroom | [NVIDIA Expands Slurm to Bring Quantum Computing Into Supercomputing](https://blogs.nvidia.com/blog/slurm-quantum-computing-supercomputing/) | 待补证据 | 程序判行业范围外、未抽到事件/工程结论、证据不足 |  |
| 2026-11-16 | nvidia_newsroom | [NVIDIA DGX Spark Developer Kit Turns a Desk Into a Supercomputing Lab](https://blogs.nvidia.com/blog/dgx-spark-hpc-developer-kit-sc26/) | 待补证据 | 未抽到事件/工程结论、证据不足 |  |
| 2026-11-16 | techpowerup | [Microsoft Explains Last Week's 365 Outage](https://www.techpowerup.com/354904/microsoft-explains-last-weeks-365-outage) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-16 | marvell_newsroom | [Marvell and Penguin Solutions Collaborate to Address Data Center AI Memory and Accelerate Inference at Scale](https://investor.marvell.com/news-events/press-releases/detail/1044/marvell-and-penguin-solutions-collaborate-to-address-data-center-ai-memory-and-accelerate-inference-at-scale) | 未入首页 | 未抽到事件/工程结论、重要性低 |  |
| 2026-11-16 | techpowerup | [Linux Kernel Gets AMD Capacity-Aware Scheduling for Zen 6 Heterogeneous CPU Architectures](https://www.techpowerup.com/354915/linux-kernel-gets-amd-capacity-aware-scheduling-for-zen-6-heterogeneous-cpu-architectures) | 未入首页 | 未抽到事件/工程结论、重要性低 |  |
| 2026-11-16 | nvidia_newsroom | [Lambda Boosts AI Factory Resiliency and Efficiency With NVIDIA Photonics](https://blogs.nvidia.com/blog/lambda-photonics/) | 待补证据 | 未抽到事件/工程结论、证据不足 |  |
| 2026-11-16 | techpowerup | [KDE Plasma 6.9 Cuts Overhead with On-Demand XWayland Implementation](https://www.techpowerup.com/354914/kde-plasma-6-9-cuts-overhead-with-on-demand-xwayland-implementation) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-16 | nvidia_newsroom | [How the World’s Most Advanced AI Infrastructure Supply Chain Invents the Future](https://blogs.nvidia.com/blog/ai-infrastructure-supply-chain/) | 待补证据 | 未抽到事件/工程结论、证据不足 |  |
| 2026-11-16 | storagereview | [HPE Lux AI Cluster Debuts at No. 14 on the TOP500 With 220.79 Petaflops on AMD Instinct MI355X GPUs](https://www.storagereview.com/news/hpe-lux-ai-cluster-top500-no-14-220-79-petaflops-ornl-genesis-mission) | 未入首页 | 未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-16 | storagereview | [Dell Exascale Adds 32-Drive Liquid-Cooled Storage for AI Racks, and a 512-Core Air-Cooled PowerEdge M8825](https://www.storagereview.com/news/dell-exascale-liquid-cooled-storage-poweredge-m8825-openmanage-rack-scale-sc26) | 未入首页 | 未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-16 | storagereview | [Cornelis CN6000 Doubles Omni-Path to 800G With a PCIe 6.0 SuperNIC and 48-Port Switch](https://www.storagereview.com/news/cornelis-cn6000-800g-omni-path-supernic-switch) | 未入首页 | 业务关联低、重要性低 |  |
| 2026-11-16 | techpowerup | [(PR) Penguin Solutions Unveils Industry's First Photonics-Based HBM-Class Memory Appliance](https://www.techpowerup.com/354895/penguin-solutions-unveils-industrys-first-photonics-based-hbm-class-memory-appliance) | 未入首页 | 业务关联低 |  |
| 2026-11-16 | techpowerup | [(PR) NVIDIA Announces Rubin HPC GPU to Accelerate Agents for Science, Engineering and Analytics](https://www.techpowerup.com/354900/nvidia-announces-rubin-hpc-gpu-to-accelerate-agents-for-science-engineering-and-analytics) | 未入首页 | 业务关联低 |  |
| 2026-11-16 | techpowerup | [(PR) MSI Powers the Next Era of AI Infrastructure at SC26](https://www.techpowerup.com/354898/msi-powers-the-next-era-of-ai-infrastructure-at-sc26) | 未入首页 | 未抽到事件/工程结论、重要性低 |  |
| 2026-11-16 | techpowerup | [(PR) Kingston Technology Highlights Enterprise Solutions for HPC, AI Applications at Supercomputing 2026](https://www.techpowerup.com/354897/kingston-technology-highlights-enterprise-solutions-for-hpc-ai-applications-at-supercomputing-2026) | 未入首页 | 未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-16 | techpowerup | [(PR) ASUS Announces ExpertCenter P300 Mini Tower](https://www.techpowerup.com/354881/asus-announces-expertcenter-p300-mini-tower) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-16 | techpowerup | [(PR) AMD-Powered Lux Supercomputer Opens to Scientific Users at Oak Ridge](https://www.techpowerup.com/354907/amd-powered-lux-supercomputer-opens-to-scientific-users-at-oak-ridge) | 未入首页 | 未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-15 | techpowerup | [Samsung, SK hynix, and Micron Fail to Get DRAM Antitrust Suit Dismissed](https://www.techpowerup.com/354863/samsung-sk-hynix-and-micron-fail-to-get-dram-antitrust-suit-dismissed) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |
| 2026-11-15 | techpowerup | [SK hynix Bets on HBM4 Demand Beyond NVIDIA With New Equipment Orders](https://www.techpowerup.com/354861/sk-hynix-bets-on-hbm4-demand-beyond-nvidia-with-new-equipment-orders) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低 |  |
| 2026-11-14 | techpowerup | [TSMC Confirms Employee Data Leak, Points to Cloud Provider](https://www.techpowerup.com/354835/tsmc-confirms-employee-data-leak-points-to-cloud-provider) | 未入首页 | 程序判行业范围外、未抽到事件/工程结论、业务关联低、重要性低 |  |

## 本轮复核后最值得执行的一步

先以 NVIDIA 财报、Lambda 生产 CPO 集群、Marvell × Penguin 合作、Vertiv 800 VDC 四组为回归样本，修正“正文证据可追溯 → 主事件抽取 → 业务关联 → 首页价值”的通用流程；同时排除 3C 于成品。再补一个经过可用性验证的财报媒体来源并回跑这 106 篇。
