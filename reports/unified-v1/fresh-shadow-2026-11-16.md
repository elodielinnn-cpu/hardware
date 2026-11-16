# 新抓新闻影子回放（2026-11-16）

本次使用 `experiments/news-screening/run.mjs` 抓取 RSS 和网页正文，再以 `compare-fresh.mjs` 对同一批候选运行新版 V3。没有调用模型，也没有改动网站发布数据。逐篇结构化结果见 `fresh-shadow-2026-11-16.json`；该文件的 `modelRun` 为 `false`。

## 样本与结果

| 项目 | 数量 |
| --- | ---: |
| RSS 候选／排除明显 3C 后 | 56／48 |
| 网页正文／RSS 正文节选 | 38／10 |
| 旧试验筛选：入选／待定／排除 | 0／14／34 |
| 新版 V3 首页候选 | 1 |
| 未抽到主事件 | 33 |

ServeTheHome、StorageReview、Electrek、ADAS & Autonomous Vehicle International 可取到内容。DCD 返回验证页（HTTP 403），没有伪造正文。旧试验筛选器的“待定”是业务对应关系尚不清楚，不能直接当作首页候选。

新版唯一首页候选是 [Lenovo ThinkSystem SC755 V5 液冷机柜](https://www.storagereview.com/news/lenovo-thinksystem-sc755-v5-sr755-v5-de6800-amd-epyc-9006)：新服务器／机柜配置有明确发布事实，机柜集成与立讯的直接业务范围相符。它在旧试验筛选器中为“待定”，新版 V3 将其补回。没有把 [MetaRoCE 网卡展会展示](https://www.servethehome.com/this-is-the-meta-metaroce-network-adapter/)直接抬为首页。

## 发现与修正

- [HPE Cray E2000 新增混合存储配置](https://www.storagereview.com/news/hpe-cray-e2000-hybrid-32tb-sas-4-hdd-rack-management-controller)原本未抽出产品更新；现标为“新产品／已发布”，但与立讯的直接影响证据不足，仍不进首页。
- [MAN 自动驾驶电动巴士试验](https://www.autonomousvehicleinternational.com/news/mobility-solutions/man-launches-autonomous-e-bus-trials-in-munich.html)和 [Kodiak 自动驾驶卡车交付](https://www.autonomousvehicleinternational.com/videos/kodiak-delivers-first-autonomous-western-star-49x-trucks-to-atlas-energy.html)原本未识别汽车行业；现归入汽车，仍不因行业命中而自动入首页。
- 网站 `main` 当时发布数据中有 5 篇首页新闻，其中含一篇 iPhone 及一篇面向创作者的麦克风新闻。新版 V3 增加标题主导的 3C 排除，并限制语义标签只使用通信与数据中心、汽车两个行业。这两篇会被剔除；其余三篇因发布数据缺正文，不能据此影子回放判断去留。

## 上线判断

这批 48 篇没有出现明显的新版首页滥入；唯一入选项有具体服务器机柜发布和业务对象。它也显示事件抽取仍有缺口：33 篇无主事件，其中部分确属低价值或范围外，部分是具体行业事件未被现有表达式识别。因此可继续推进两个行业规则的上线准备，但应把“新抓新闻正文＋逐篇差异”保留为上线后的抽查方式；不能把本次 1/48 当成长期首页产出率。
