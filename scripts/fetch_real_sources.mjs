import fs from "node:fs/promises";

const outputPath = new URL("../real-data.js", import.meta.url);
const taxonomyPath = new URL("../taxonomy.js", import.meta.url);
const collectionAsOfDate = process.argv[2] || getShanghaiDateString();
const collectionLastUpdatedAt = getShanghaiDateTimeString();

function getShanghaiDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function getShanghaiDateTimeString() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    })
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00+08:00`;
}

const secHeaders = {
  "User-Agent": "HardwareRadarMVP/0.1 elodie@example.com",
  Accept: "application/json,text/plain,*/*"
};

const watchlist = [
  { ticker: "NVDA", cik: "0001045810", company: "NVIDIA", industry: "数据中心硬件" },
  { ticker: "AAPL", cik: "0000320193", company: "Apple", industry: "3C 产品" },
  { ticker: "MSFT", cik: "0000789019", company: "Microsoft", industry: "数据中心硬件" },
  { ticker: "AMD", cik: "0000002488", company: "AMD", industry: "核心零部件" },
  { ticker: "INTC", cik: "0000050863", company: "Intel", industry: "核心零部件" },
  { ticker: "QCOM", cik: "0000804328", company: "Qualcomm", industry: "核心零部件" },
  { ticker: "AMZN", cik: "0001018724", company: "Amazon", industry: "数据中心硬件" },
  { ticker: "GOOGL", cik: "0001652044", company: "Google", industry: "数据中心硬件" },
  { ticker: "META", cik: "0001326801", company: "Meta", industry: "数据中心硬件" },
  { ticker: "DELL", cik: "0001571996", company: "Dell", industry: "数据中心硬件" },
  { ticker: "HPE", cik: "0001645590", company: "HPE", industry: "数据中心硬件" },
  { ticker: "SMCI", cik: "0001375365", company: "Supermicro", industry: "数据中心硬件" },
  { ticker: "MU", cik: "0000723125", company: "Micron", industry: "核心零部件" }
];

const editorialRssSources = [
  {
    sourceId: "eetimes",
    sourceName: "EE Times",
    feedUrls: ["https://www.eetimes.com/feed/"],
    fallbackIndustry: "核心零部件",
    limit: 10,
    include: /semiconductor|chip|packaging|connector|sensor|power|automotive|manufacturing|server|data center|memory|eda|gpu|processor/i,
    exclude: /magazine|podcast|webinar|opinion|tapes out|tape out|startup|claims huge/i
  },
  {
    sourceId: "semiconductor_engineering",
    sourceName: "Semiconductor Engineering",
    feedUrls: ["https://semiengineering.com/feed/"],
    fallbackIndustry: "核心零部件",
    limit: 10,
    include: /chip|semiconductor|advanced packaging|chiplet|eda|test|manufacturing|foundry|memory|interconnect|ai/i,
    exclude: /technical paper roundup|paper roundup|research bits|survey|academic|university|et al\.?|fault injection|timing analysis|lithography defect|conference agenda/i
  },
  {
    sourceId: "trendforce_news",
    sourceName: "TrendForce News",
    feedUrls: ["https://www.trendforce.com/news/rss"],
    fallbackIndustry: "核心零部件",
    limit: 10,
    include: /dram|nand|hbm|memory|panel|server|smartphone|ai|data center|optical|semiconductor/i
  },
  {
    sourceId: "tomshardware",
    sourceName: "Tom's Hardware",
    feedUrls: ["https://www.tomshardware.com/feeds/all"],
    fallbackIndustry: "核心零部件",
    limit: 8,
    include: /cpu|gpu|dram|ssd|power|cooling|ai|server|data center|memory|nvidia|amd|intel/i,
    exclude: /best|deal|coupon|discount|premium|review|hands-on|laptop|macbook|xps|desktop|gaming|console|undersea cable|deepseek|entity list|rtx remix|robot|gas turbines|naacp|lawsuit|pubg|consumer ryzen|memory encryption|rtx spark|consumer pcie|nova lake-s|oc sku|pl2 mode|windows defender|malware campaigns|cisa|scalper|scalpers|bundle|bundles|blowout|save|anniversary edition|5800x3d|b&h|slopfix|ai-generated code|code bloat|software team|messy repositories|tenda routers?|dog tracker|pet tracker|fi ultra/i
  },
  {
    sourceId: "techpowerup",
    sourceName: "TechPowerUp",
    feedUrls: ["https://www.techpowerup.com/rss/news"],
    fallbackIndustry: "核心零部件",
    limit: 8,
    include: /cpu|gpu|motherboard|memory|ssd|power|nvidia|amd|intel|server|data center|pcie|mini pc|processor|xeon|radeon|geforce/i,
    exclude: /review|giveaway|deal|discount|claude|kde|chromeos|software|ui polish|e-degree|mini pc|playstation|console|gaming|geforce|radeon|\(pr\)|cable matters|kvm|atx|mid-tower|case|gpu-z|exceria|raptor lake|portable|enclosure|driver|drivers|whql|arc gpu|pubg|rtx remix|ace ai|robot|gas turbines|lawsuit|consumer ryzen|memory encryption|rtx spark|consumer pcie|nova lake-s|oc sku|pl2 mode/i
  },
  {
    sourceId: "servethehome",
    sourceName: "ServeTheHome",
    feedUrls: ["https://www.servethehome.com/feed/"],
    fallbackIndustry: "数据中心硬件",
    limit: 10,
    include: /server|rack|switch|network|dpu|storage|liquid|cooling|gpu|accelerator|ai|data center|power/i,
    exclude: /keynote coverage|keynote live|live blog/i
  },
  {
    sourceId: "storagereview",
    sourceName: "StorageReview",
    feedUrls: ["https://www.storagereview.com/feed"],
    fallbackIndustry: "数据中心硬件",
    limit: 8,
    include: /enterprise|server|storage|ssd|gpu|ai|data center|network|infrastructure/i,
    exclude: /consumer|portable|giveaway/i
  },
  {
    sourceId: "ithome",
    sourceName: "IT之家",
    feedUrls: ["https://www.ithome.com/rss/"],
    fallbackIndustry: "3C 产品",
    limit: 20,
    filterTitleOnly: true,
    originalLanguage: "zh",
    include:
      /苹果|Apple|iPhone|iPad|Mac|AirPods|供应链|代工|产能|扩产|量产|订单|印度|越南|OLED|面板|摄像头|光学|连接器|线束|立讯|富士康|鸿海|捷普|Jabil|和硕|纬创|广达|仁宝|英业达|比亚迪电子|歌尔|瑞声|舜宇|蓝思|三星显示|Samsung Display|AI\s*服务器|服务器|数据中心|液冷|电源|光模块|PCB|半导体|芯片|SOC|SoC|HBM|DRAM|NAND|MLCC|玻璃基板/i,
    exclude: /游戏|手游|影视|直播|优惠|促销|补贴|降价|汽车|车主|充电桩|机器人|飞行汽车|无人机|应用更新|版本更新|微信|支付宝|鸿蒙应用|显卡驱动|驱动|模拟器|耳机新品|音箱|电视|投影|steam deck|win11|蓝牙|被盗|防诈骗|官方支持文档|京东|自营|免息|智能戒指|iring|galaxy ring|偷窃|饼干|员工被控|解雇|劳动纠纷|机模曝光|机模/i
  }
];

const sourceWeights = {
  nvidia_newsroom: 5,
  sec_edgar: 5,
  trendforce_news: 4,
  servethehome: 4,
  storagereview: 4,
  eetimes: 3,
  semiconductor_engineering: 3,
  ithome: 3,
  tomshardware: 2,
  techpowerup: 2
};

const sourceCategories = {
  nvidia_newsroom: "official",
  sec_edgar: "regulatory",
  trendforce_news: "research",
  servethehome: "discovery",
  storagereview: "discovery",
  eetimes: "discovery",
  semiconductor_engineering: "discovery",
  ithome: "discovery",
  tomshardware: "discovery",
  techpowerup: "discovery"
};

const topicUniverse = {
  aiInfrastructure: /nvidia|amd|broadcom|marvell|asic|gpu|hbm|ai server|ai服务器|accelerator|rack-scale|rack scale|nvl72|gb300|b300|blackwell|rubin|vera rubin|hyperscaler|training cluster|inference|ai infrastructure|ai factory|算力|智算/i,
  dataCenterHardware: /liquid cooling|液冷|cdu|cold plate|冷板|quick connector|快接|power supply|power module|电源|pdu|busbar|rack|机柜|optical module|光模块|800g|1\.6t|cpo|lpo|lro|copper interconnect|铜互连|high-speed connector|高速连接器|switch|networking|ethernet|infiniband|散热/i,
  threeC: /apple|iphone|ipad|mac|macbook|airpods|apple watch|watch|ai pc|smartphone|wearable|xr|vision pro|consumer electronics|3c|苹果|手机|折叠|oled|面板|摄像头|光学/i,
  luxshareEcosystem: /luxshare|luxshare precision|立讯|立讯精密|立讯ict|apple supplier|iphone supplier|airpods supplier/i,
  customersAndPlatforms: /nvidia|amd|broadcom|marvell|microsoft|meta|google|amazon|aws|openai|oracle|tesla|apple|微软|亚马逊|谷歌|英伟达/i,
  competitors: /foxconn|hon hai|鸿海|富士康|quanta|广达|wistron|纬创|wiwynn|纬颖|inventec|英业达|pegatron|和硕|byd electronics|比亚迪电子|goertek|歌尔|aac|瑞声|lens technology|蓝思|jabil|捷普|compal|仁宝/i,
  businessSignals: /capex|capital expenditure|资本开支|order|orders|订单|backlog|guidance|指引|revenue|营收|margin|毛利|shipment|shipments|出货|mass production|量产|ramp|爬坡|capacity|产能|expansion|扩产|customer validation|客户认证|qualification|认证|shortage|短缺|price hike|涨价|acquisition|收购|investment|投资|ipo|fundraising|融资|供应链|代工|中标|集采/i
};

const genericNewsPenalty = /celebrity|gaming review|rumor only|stock meme|price target only|technical analysis|crypto|纯股价|目标价|股价|概念|标题党|无来源|优惠|促销|评测|上手|开箱|游戏|手游|console|playstation|steam machine|geforce now|软件更新|应用更新|防诈骗|被盗怎么办|scalper|scalpers|bundle|bundles|blowout|save on|anniversary edition|5800x3d|b&h|智能戒指|iring|galaxy ring|bionemo|agent toolkit|agent framework|repository-level code evolution|nvidia research|telecom operations|scientific discovery|arc pro.*available|now available.*\\$|turns waves into watts|digital twins|file explorer|windows 11/i;
const coreIndustrySignal = /立讯|luxshare|apple\s*供应链|苹果.*供应链|iphone.*供应链|供应链|supply chain|供应商|supplier|零部件|component|富士康|foxconn|鸿海|代工|ems|jdm|odm|产能|扩产|量产|订单|服务器|数据中心|ai\s*服务器|ai服务器|半导体|芯片|晶圆|封装|soc|hbm|dram|nand|oled|pcb|连接器|线束|光模块|电源|液冷|散热|机柜|玻璃基板|mlcc|server|data center|datacenter|semiconductor|chip|wafer|packaging|connector|optical module|power supply|liquid cooling|rack|busbar|pdu|blackwell|gb300|gb200|nvl72|nvl4|gpu rack|ai accelerator|nm node|mass production|氧化镓|gallium oxide|ga2o3|外延|epitaxy|epitaxial|同质外延|homoepitaxy|化合物半导体|compound semiconductor|宽禁带|wide bandgap|超宽禁带|ultra-wide bandgap|衬底|substrate|声学|acoustic|speaker|microphone|audio module|camera module|lens|sensor module|vcsel|tof|sip|module packaging|fatp|final assembly|组装|整机组装|wiring harness|automotive harness|wire harness|汽车线束|高压线束|低压线束|automotive connector|automotive electronics|\bemi\b|\bemc\b|electromagnetic shielding|shielding|电磁屏蔽|电磁兼容/i;
const weakFactorySignal = /(?:工厂|factory)/i;
const factoryContextSignal = /代工|产能|扩产|量产|供应链|apple|苹果|iphone|服务器|数据中心|半导体|封装|组件|零部件/i;
const irrelevantConsumerOrSocialNoise = /偷窃|饼干|员工被控|解雇|劳动纠纷|诉讼八卦|机模曝光|机模|驱动|模拟器|游戏|手游|影视|直播|消费维权|车型|大众汽车|就业岗位|裁员/i;
const defaultFeedNegativeSignal = /cuda emulator|emulator|zluda|drivers?|software tools?|software stack|token cost|open-source tools?|legacy gpu|returns to retail|retail graphics card|gaming gpu|world cup streams?|illegal streams?|domains seized|lunar orbit|aerospace|science program|research program|hollow-core fiber trial|lawsuit|patent dispute|consumer retail|retro hardware|vintage computer|apple ii(?: plus)?|6502 cpu|ev battery|blade battery|power battery|electric vehicle battery|automotive battery|car battery|lithium carbonate|lithium mine|catl|game|streaming|file transfer tool|productivity app|lifetime deal|sponsored deal|paid promo|marketplace promo|app subscription deal|software subscription deal|cloud storage promo|for life with|just \$\d+|slopfix|ai-generated code|code bloat|software team|messy repositories|consumer router|home router|tenda router|hidden backdoor|router backdoor|consumer networking security|home network security|dog tracker|pet tracker|fi ultra|consumer iot tracker|wearable pet device|satellite pet tracker|rgb macropad|macropad|macro pad|developer peripheral|novelty hardware|demo hardware|keyboard accessory|programmable keyboard|software feature accessory|codex micro feature|模拟器|驱动|软件工具|软件栈|token cost|开源工具|消费显卡|零售|返场|航天|月球轨道|科研项目|试验|非法直播|域名查封|专利诉讼|复古硬件|老电脑|复刻电脑|爱好者产品|新能源汽车电池|锂矿|碳酸锂|宁德时代|动力电池|刀片电池|车企电池|电动车电池|汽车电池|锂矿|碳酸锂|宁德时代|西咸基地|整车产能|车企产能|游戏|直播|软件促销|软件订阅|软件优惠|终身订阅|家用路由器|消费路由器|路由器后门|家庭网络安全|宠物追踪器|狗狗追踪器|消费\s*iot|宠物设备|卫星宠物追踪/i;
const softwareOnlySignal = /software stack|inference software|token cost|软件栈/i;
const strongCoreIndustrySignal = /data center rack|ai server|ai\s*服务器|ai factory|gpu factory|physical ai|liquid cooling|power supply|connector|optical module|hbm|advanced packaging|foundry capacity|apple supplier|ems|odm|jdm|luxshare|立讯|服务器|数据中心|液冷|电源|连接器|光模块|封装|代工|富士康|foxconn|鸿海|机柜|busbar|pdu|gb300|gb200|nvl72|blackwell|rubin|vera rubin|gpu|ai accelerator|声学|acoustic|speaker|microphone|audio module|camera module|lens|sensor module|vcsel|tof|sip|module packaging|fatp|final assembly|组装|整机组装|wiring harness|automotive harness|wire harness|汽车线束|高压线束|低压线束|automotive connector|automotive electronics|\bemi\b|\bemc\b|electromagnetic shielding|shielding|电磁屏蔽|电磁兼容/i;
const luxshareBusinessFitSignal = /声学|acoustic|speaker|microphone|audio module|光学模组|optical module|camera module|lens|sensor module|vcsel|tof|封装|advanced packaging|sip|module packaging|fatp|final assembly|final assembly test and pack|组装|整机组装|rack|rack-scale|server rack|ai rack|机柜|整机柜|liquid cooling|cold plate|cdu|rear-door heat exchanger|散热|液冷|电源|power supply|power module|800v dc|busbar|connector|high-speed connector|copper interconnect|copper cable|dac|aec|optical interconnect|aoc|cpo|osfp|qsfp|连接器|铜连接|光连接|光模块|线缆|wiring harness|automotive harness|wire harness|线束|汽车线束|高压线束|低压线束|automotive connector|automotive electronics|\bemi\b|\bemc\b|electromagnetic shielding|shielding|电磁屏蔽|电磁兼容/i;
const automotiveNoiseSignal = /ev battery|blade battery|power battery|electric vehicle battery|automotive battery|car battery|lithium carbonate|lithium mine|catl|整车|整车产能|车企产能|新能源汽车电池|锂矿|碳酸锂|宁德时代|动力电池|刀片电池|车企电池|电动车电池|汽车电池|锂矿|碳酸锂|宁德时代|西咸基地/i;
const automotiveSignal = /\b(?:automotive|vehicle|vehicles|electric vehicle|ev|car|cars|cockpit|adas|autonomous driving|zonal architecture|48v|wire harness|wiring harness|vehicle electrical architecture|e\/e architecture)\b|汽车|整车|车企|新能源汽车|电动车|智驾|智能驾驶|自动驾驶|座舱|鸿蒙座舱|经销商|量产车|车载|车载电子|车载模组/i;
const aiDataCenterNonAutomotiveSignal = /\b(?:ai factor(?:y|ies)|gigascale ai factories|data center|datacenter|ai infrastructure|vera rubin|spectrum-6|gpu|networking|switch|ethernet|infiniband|blackwell|rubin|gb300|gb200|nvl|ai server)\b/i;
const memoryStorageNonAutomotiveSignal = /\b(?:ddr\d?|ddr5|dram|hbm|nand|lpddr|memory|ssd|storage|semiconductor pricing|price surge|prices surge|memory prices?)\b/i;
const explicitAutomotiveHardwareSignal = /\b(?:zonal architecture|48v|vehicle electrical architecture|e\/e architecture|wire harness|wiring harness|automotive harness|automotive connector|automotive electronics|adas hardware|sensor hardware|power distribution|high-voltage harness|charging (?:hardware|connector|module|inlet|system|architecture)|vehicle thermal|battery thermal)\b|线束|汽车线束|高压线束|低压线束|汽车连接器|车载电子|车载模组|电气架构|电源分配|电磁屏蔽|电磁兼容/i;
const automotiveLuxshareFitSignal = /zonal architecture|48v|vehicle electrical architecture|e\/e architecture|wiring harness|automotive harness|wire harness|power distribution|high-voltage harness|charging (?:hardware|connector|module|inlet|system|architecture)|vehicle thermal|battery thermal|adas hardware|sensor hardware|线束|汽车线束|高压线束|低压线束|汽车连接器|电气架构|电源分配|automotive connector|automotive electronics|\bemi\b|\bemc\b|electromagnetic shielding|shielding|电磁屏蔽|电磁兼容/i;
const semiconductorAutomotiveHardSignal = /\b(?:foundry|fab|semiconductor|chip|soc|ai chip|ai accelerator|node|wafer|tsmc|samsung foundry|intel foundry|mass produce|mass production|production|tape-out|tape out|advanced process|advanced node)\b|(?:\b[2345]\s*nm\b)/i;
const productLeakSignal = /爆料|渲染图|机模|外观|普通参数|参数爆料|跌落测试|prototype|render|dummy unit/i;
const hardSupplyChainSignal = /供应链|代工|供应商|产能|扩产|量产|订单|工厂|组装|整机组装|fatp|final assembly|光学模组|摄像头模组|camera module|audio module|连接器|线束|connector|harness|封装|packaging|氧化镓|gallium oxide|ga2o3|外延|epitaxy|epitaxial|同质外延|homoepitaxy|化合物半导体|compound semiconductor|宽禁带|wide bandgap|超宽禁带|ultra-wide bandgap|衬底|substrate/i;
const compoundSemiconductorHardSignal = /(?:氧化镓|gallium oxide|ga2o3|外延|epitaxy|epitaxial|同质外延|homoepitaxy|化合物半导体|compound semiconductor|宽禁带|wide bandgap|超宽禁带|ultra-wide bandgap|衬底|substrate|晶圆|wafer).*(?:量产线|production line|mass production line|6\s*英寸|8\s*英寸|6-inch|8-inch|半导体|semiconductor|晶圆|wafer|外延|epitaxy|epitaxial|氧化镓|gallium oxide|ga2o3)|(?:量产线|production line|mass production line|6\s*英寸|8\s*英寸|6-inch|8-inch).*(?:氧化镓|gallium oxide|ga2o3|外延|epitaxy|epitaxial|同质外延|homoepitaxy|化合物半导体|compound semiconductor|宽禁带|wide bandgap|超宽禁带|ultra-wide bandgap|衬底|substrate|晶圆|wafer|半导体|semiconductor)/i;
const ithomeHardSignal = /立讯|luxshare|歌尔|goertek|富士康|foxconn|和硕|pegatron|纬创|wistron|比亚迪电子|byd electronics|apple supplier|供应商|订单|量产|扩产|产能|产能爬坡|爬坡|良率|成本|涨价|降价|bom|供应链迁移|印度生产|越南生产|中国工厂转移|fatp|final assembly|camera module|optical module|acoustic module|connector|连接器|线束|光学模组|声学|封装|hbm|advanced packaging|液冷|机柜|电源|氧化镓|gallium oxide|ga2o3|外延|epitaxy|epitaxial|同质外延|homoepitaxy|化合物半导体|compound semiconductor|宽禁带|wide bandgap|超宽禁带|ultra-wide bandgap|衬底|substrate/i;
const ithomeLowValueSignal = /探秘|走进工厂|亲手组装|科普|体验|评测|拆解|维修|参数爆料|渲染图|机模|售价|促销|消费新品|趣闻|社会新闻|专利|patent|发售|预售|宣传物料曝光|参数曝光|国补价|售\s*\d|元起|欧元|移动电源|充电宝|平板|智能手表/i;
const weakDefaultFeedSignal = /\b(?:linux kernel patch|kernel patch|patch|weekly roundup|news roundup|roundup|gptfuzz|jailbreak|fuzzing|llm safety|llm security|ai safety|ai security testing|prompt injection|software-defined vehicle|sdv|vehicle trust|automotive cybersecurity|ota security|vehicle software security|rx 7900|rx 7900 xtx|radeon rx|geforce rtx consumer|engineering sample|gpu engineering sample|graphics card engineering sample|leaked gpu|gpu leak|graphics card leak|benchmark leak|overclocking|oc sku|desktop gpu|consumer gpu|gaming gpu|retail gpu|ifixit|teardown|repair team|repair video|factory tour|hands-on|hands on|assemble a battery|battery assembly video|file transfer tool|productivity app|lifetime deal|sponsored deal|paid promo|marketplace promo|app subscription deal|software subscription deal|slopfix|ai-generated code|code bloat|software team|messy repositories|consumer router|home router|tenda router|hidden backdoor|router backdoor|consumer networking security|home network security|dog tracker|pet tracker|fi ultra|consumer iot tracker|wearable pet device|satellite pet tracker|rgb macropad|macropad|macro pad|developer peripheral|novelty hardware|demo hardware|keyboard accessory|programmable keyboard|software feature accessory|codex micro feature)\b|week in review|edge ai acquisition|edge ai is for real|cloud storage promo|for life with|just \$\d+|openai(?:'s)? first hardware device|显卡工程样品|工程样品|显卡泄露|跑分泄露|消费显卡|游戏显卡|拆解|维修团队|维修视频|工厂探访|探秘|走进工厂|亲手组装|科普视频|生产线探秘|软件促销|软件订阅|软件优惠|终身订阅|家用路由器|消费路由器|路由器后门|家庭网络安全|宠物追踪器|狗狗追踪器|消费\s*iot|宠物设备|卫星宠物追踪/i;
const weakRoundupSignal = /\b(?:week in review|weekly roundup|news roundup|roundup)\b/i;
const strongBusinessLandingSignal = /data center hardware|data center gpu|epyc server|server platform|server gpu|gpu cluster|data center|datacenter|ai server|ai\s*服务器|ai accelerator|rack|rack-scale|gb200|gb300|b200|b300|h100|h200|mi300|mi350|mi400|instinct|rubin|vera rubin|nvl|nvlink|hbm|cowos|advanced packaging|advanced packaging capacity|memory-on-package|packaging capacity|csp deployment|cloud deployment|firmware resiliency|bmc|bios|secure boot|hardware root of trust|supply chain security|supplier|order|capacity|production ramp|mass production|yield|bom|cost|supply chain shift|india production|china factory transfer|vietnam production|apple supplier|luxshare|goertek|foxconn|pegatron|wistron|byd electronics|立讯|歌尔|富士康|和硕|纬创|比亚迪电子|ems|odm|jdm|fatp|final assembly|connector|cable|wire harness|power module|power supply|liquid cooling|cold plate|sensor module|camera module|optical module|acoustic module|audio module|automotive connector|automotive harness|electronic module|\bemi\b|\bemc\b|electromagnetic shielding|服务器|数据中心|机柜|整机柜|ai加速器|先进封装|先进封装产能|封装产能|固件韧性|硬件信任根|供应链安全|供应商|订单|产能|量产|爬坡|良率|成本|供应链迁移|印度生产|中国工厂转移|越南生产|连接器|线缆|线束|电源模块|电源|液冷|冷板|传感器模组|摄像头模组|光学模组|声学模组|汽车连接器|电子模组|电磁屏蔽|电磁兼容/i;
const technicalExplainerSignal = /\b(?:how to|guide|best practices?|explainer|primer|tutorial|thought leadership|white ?paper|opinion|perspective|framework|why|what is|technical overview|technical deep dive)\b|技术解读|科普|指南|最佳实践|白皮书|观点|深度解析/i;
const newsEventSignal = /\b(?:filed|launched|announced|unveiled|released|started mass production|mass production|capacity|production ramp|order|supplier|customer|acquisition|investment|capex|funding|shipment|vulnerability|breach|cyberattack|outage|recall|regulatory|sanctions|export control|filed 10-q|filed 8-k)\b|量产|扩产|订单|供应商|客户|收购|投资|资本开支|融资|出货|漏洞|攻击|停摆|制裁|出口管制/i;
const hobbyistRetroSignal = /ancient apollo-era|apollo-era|maker to construct|build his own memory|diy memory|retro computing|hobbyist|vintage|ancient tech|复古|爱好者|diy|自制内存|老技术/i;
const retroSecurityExperimentSignal = /gameboy advance|gameboy|password cracker|hashcat|hashes a second|retro security experiment|复古.*安全/i;
const explicitHobbyistDiySignal = /ancient apollo-era|apollo-era|maker to construct|build his own memory|hand-threaded magnetic core memory|salvaged russian computer parts|diy memory|自制内存|复古|爱好者/i;
const memoryHardSignal = /dram price|hbm|nand|server memory|data center memory|memory capacity|memory shortage|supplier|order|capacity|price hike|price increase|存储器价格|dram|服务器内存|数据中心内存|供应商|订单|产能|涨价/i;
const consumerGamingHardwareSignal = /ps5|playstation|xbox|nintendo|game console|disc drive|purchase cap|retail limit|gaming console|rtx 50 super|geforce rtx 50 super|游戏主机|光驱|购买限制|消费硬件零售/i;
const gameContentSignal = /video game|gaming title|game studio|game ip|racing game|need for speed|burnout|battlefield|criterion|electronic arts|ea games|esports?|game release|game development|halo|warframe|campaign evolved|goes gold|gta vi|grand theft auto|游戏工作室|赛车游戏|电竞/i;
const softwarePlatformSignal = /omniverse|free for production use|software platform|production use|software pricing|software license|platform free|软件平台|软件授权|软件免费|商业策略/i;
const developerPeripheralSignal = /rgb macropad|macropad|macro pad|developer peripheral|novelty hardware|demo hardware|keyboard accessory|programmable keyboard|software feature accessory|codex micro feature|openai(?:'s)? first hardware device/i;
const openAiHardwareLandingSignal = /openai.*(?:manufacturing partner|hardware supply chain|custom chip|ai accelerator|asic|server|data center|datacenter|stargate|capex|mass production|supplier|odm|ems|module|component|production ramp|shipment|bom)|(?:manufacturing partner|hardware supply chain|custom chip|ai accelerator|asic|server|data center|datacenter|stargate|capex|mass production|supplier|odm|ems|module|component|production ramp|shipment|bom).*openai/i;
const edgeAiModuleSignal = /jetson|jetson thor|edge ai module|embedded ai module|developer kit|dev kit|ai module lineup|robotics kit|compact ai module|edge ai appliance/i;
const edgeAiModuleLandingSignal = /ai server|data center|datacenter|data center gpu|server gpu|rack-scale|gb300|blackwell|rubin|vera rubin|customer deployment|hyperscaler deployment|industrial deployment|volume|shipment|mass production|production ramp|automotive module|factory deployment|robotics deployment|hardware supplier|module supplier|supplier|odm|ems|component supplier|capacity|bom|supermicro|dell|hpe|lenovo|edge server|enterprise deployment/i;
const edgeAiModuleGenericFallbackSignal = /supply-chain signal around capacity, production ramp or supplier positioning|industry signal that should be reviewed|demand, supply, cost, technology or customer implications/i;
const softwarePromoSignal = /transfr pro|send unlimited files|file transfer tool|productivity app|lifetime deal|sponsored deal|paid promo|marketplace promo|app subscription deal|software subscription deal|cloud storage promo|for life with|just \$\d+|slopfix|ai-generated code|code bloat|software team|messy repositories|软件促销|软件订阅|软件优惠|终身订阅/i;
const consumerSecuritySignal = /consumer router|home router|tenda router|hidden backdoor|router backdoor|consumer networking security|home network security|家用路由器|消费路由器|路由器后门|家庭网络安全/i;
const enterpriseSecurityLandingSignal = /data center firmware|server firmware|bmc|bios|hardware root of trust|supply chain security|enterprise server|server platform|cloud infrastructure|ai server|data center networking|rack infrastructure|enterprise networking|供应链安全|数据中心固件|服务器固件|企业级网络设备/i;
const consumerIotSatelliteSignal = /dog tracker|pet tracker|fi ultra|starlink satellite dog tracker|consumer iot tracker|wearable pet device|satellite pet tracker|宠物追踪器|狗狗追踪器|消费\s*iot|宠物设备|卫星宠物追踪/i;
const communicationsHardwareLandingSignal = /satellite communications infrastructure|enterprise iot module|automotive connectivity module|antenna module|rf module|supply chain|component supplier|module supplier|车载通信模组|通信模组|天线模组|rf\s*模组|供应商|订单|产能/i;
const nvidiaHardwareLandingSignal = /data center gpu|ai server|gpu deployment|cloud deployment|gb300|blackwell|rubin|vera rubin|ai accelerator|rack-scale|nvlink|hbm|cowos|supplier|order|capacity|csp deployment/i;
const consumerCoolingSignal = /noctua|consumer cooler|cpu cooler|pc cooler|desktop cooler|retail cooler|nl-lc1|猫头鹰|消费级散热|pc 散热器|桌面散热器|零售散热器/i;
const dataCenterCoolingLandingSignal = /data center|ai server|server|rack|rack-scale|cdu|cold plate|direct-to-chip|rear-door heat exchanger|immersion cooling|dell poweredge|supermicro|wiwynn|hyperscale|机柜|服务器|数据中心|整机柜|冷板|液冷服务器|直接到芯片|后门换热器/i;
const secFilingHardSignal = /\b(?:capex|capital expenditure|capital expenditures|inventory|inventories|customer concentration|major customer|supply risk|supplier risk|material agreement|material definitive agreement|revenue by segment|segment revenue|product revenue|gross margin|cost pressure|manufacturing|supply chain|ai infrastructure|data center|datacenter|server|gpu|capacity|order|customer agreement|purchase agreement|supply agreement)\b|资本开支|库存|客户集中度|供应风险|重大协议|分部收入|产品收入|毛利|成本压力|制造|供应链|数据中心|服务器|产能|订单/i;
const secBusinessRelevantItemSignal = /\bitem\s*(?:1\.01|2\.01|2\.02|7\.01|8\.01)\b/i;
const secBusinessContextSignal = /\b(?:agreement|acquisition|customer|order|capacity|financing|investment|supply|supplier|manufacturing|data center|datacenter|server|gpu|ai infrastructure|material)\b|协议|收购|客户|订单|产能|融资|投资|供应|供应商|制造|数据中心|服务器|重大/i;
const genericSecFilingAlert = /filing is kept as a regulatory alert only|filing item requires source review|requires source review before drawing conclusions/i;
const explicitDefaultFeedBans = /cuda emulator|zluda|rtx 3060.*returns to retail|world cup streams?|lunar orbit|hollow-core fiber trial|apple ii(?: plus)?|6502 cpu|blade battery|power battery|transfr pro|send unlimited files|lifetime deal|file transfer tool|software subscription deal|for life with|just \$\d+|slopfix|ai-generated code|code bloat|software team|messy repositories|tenda routers?|hidden backdoor|dog tracker|pet tracker|fi ultra|rgb macropad|macropad|macro pad|developer peripheral|novelty hardware|keyboard accessory|codex micro feature|刀片电池|动力电池|新能源汽车电池|锂矿|碳酸锂|宁德时代|车企产能|复古硬件|复刻电脑|软件促销|终身订阅|路由器后门|宠物追踪器|狗狗追踪器/i;
const genericCompanyOnlyPattern = /^(?:nvidia|amd|google|apple|microsoft|amazon|meta|openai|英伟达|苹果|谷歌|微软|亚马逊)(?:\s|$)/i;
const ithomeAutomotiveTitleSignal = /智己|奕境|量产车|整车|车企|汽车|新能源汽车|电动车|智驾|智能驾驶|自动驾驶|华为\s*ads|鸿蒙座舱|座舱|经销商|交付|门店|4s店/i;
const sportsOrEntertainmentSummarySignal = /足球|比赛|联赛|球员|进球|赛事|俱乐部|主场|客场|冠军|直播|影视|综艺|票房/i;
const briefingValueRules = [
  ["Demand signal", /demand|shipment|shipments|order|orders|backlog|procurement|purchase|qualification|customer validation|订单|需求|出货|集采|采购|客户认证|认证|ramp|爬坡/i],
  ["Supply signal", /supply|capacity|expansion|mass production|shortage|foundry|wafer|packaging|hbm|dram|nand|fab|production line|mass production line|epitaxy|epitaxial|substrate|compound semiconductor|wide bandgap|ultra-wide bandgap|gallium oxide|ga2o3|供应|产能|扩产|量产|量产线|短缺|晶圆|封装|外延|同质外延|衬底|化合物半导体|宽禁带|超宽禁带|氧化镓/i],
  ["Cost signal", /price|cost|bom|margin|price hike|涨价|成本|价格|毛利/i],
  ["Technology shift", /blackwell|gb300|gb200|rubin|nvl72|nvl4|liquid cooling|cold plate|cdu|busbar|pdu|connector|interconnect|optical module|cpo|pcie|epyc|dragonfly|ai accelerator|advanced packaging|hbm|rack-scale|800v dc|epitaxy|epitaxial|compound semiconductor|wide bandgap|ultra-wide bandgap|gallium oxide|ga2o3|液冷|冷板|电源|连接器|互连|光模块|先进封装|机柜|外延|同质外延|化合物半导体|宽禁带|超宽禁带|氧化镓/i],
  ["Customer move", /apple|nvidia|amd|qualcomm|microsoft|google|meta|amazon|aws|openai|oracle|dell|hpe|tesla|客户|苹果|英伟达|微软|谷歌|亚马逊/i],
  ["Competitor move", /foxconn|hon hai|富士康|鸿海|quanta|广达|wiwynn|纬颖|jabil|捷普|pegatron|和硕|wistron|纬创|inventec|英业达|compal|仁宝|byd electronic|比亚迪电子|goertek|歌尔|aac|瑞声|lens technology|蓝思|ems|odm|jdm/i],
  ["Risk event", /risk|shortage|attack|breach|leak|investigation|tariff|export control|geopolitical|风险|短缺|攻击|泄露|调查|关税|出口管制|合规/i],
  ["Capital allocation", /capex|capital expenditure|investment|invest|acquisition|merger|ipo|fundraising|financing|资本开支|投资|收购|并购|上市|融资/i]
];

function hasCoreIndustrySignal(value = "") {
  return coreIndustrySignal.test(value) || (weakFactorySignal.test(value) && factoryContextSignal.test(value));
}

function hasIrrelevantConsumerOrSocialNoise(value = "") {
  return irrelevantConsumerOrSocialNoise.test(value);
}

function hasDefaultFeedNegativeSignal(value = "") {
  return defaultFeedNegativeSignal.test(value);
}

function hasStrongCoreIndustrySignal(value = "") {
  return strongCoreIndustrySignal.test(value);
}

function hasLuxshareBusinessFit(value = "") {
  return luxshareBusinessFitSignal.test(value);
}

function hasAutomotiveValidationSignal(value = "") {
  if (!automotiveSignal.test(value)) {
    return false;
  }
  if ((aiDataCenterNonAutomotiveSignal.test(value) || memoryStorageNonAutomotiveSignal.test(value)) && !explicitAutomotiveHardwareSignal.test(value)) {
    return false;
  }
  return true;
}

function hasAutomotiveNoiseWithoutLuxshareFit(value = "") {
  return automotiveNoiseSignal.test(value) && !hasLuxshareBusinessFit(value) && !semiconductorAutomotiveHardSignal.test(value);
}

function hasSoftwareOnlySignal(value = "") {
  return softwareOnlySignal.test(value) && !hasLuxshareBusinessFit(value);
}

function hasProductLeakWithoutSupplyChainSignal(value = "") {
  return productLeakSignal.test(value) && !hardSupplyChainSignal.test(value);
}

function hasIthomeProductLeakTitleWithoutSupplyChainSignal(article = {}) {
  return article.sourceId === "ithome" && hasProductLeakWithoutSupplyChainSignal(article.title || "");
}

function hasIthomeHardSignal(value = "") {
  return ithomeHardSignal.test(value) || compoundSemiconductorHardSignal.test(value);
}

function hasIthomeLowValueSignal(value = "") {
  return ithomeLowValueSignal.test(value);
}

function isRawSecFiling(article = {}) {
  return article.sourceId === "sec_edgar";
}

function hasSecFilingHardSignal(value = "") {
  return secFilingHardSignal.test(value) || (secBusinessRelevantItemSignal.test(value) && secBusinessContextSignal.test(value));
}

function secFilingAlertSummary(article = {}) {
  const company = article.companies?.[0] || article.title?.split(" ")?.[0] || "This company";
  const form = article.topic || "SEC";
  return `${company} ${form} filing is kept as a regulatory alert only; no concrete business disclosure was extracted from the source.`;
}

function shouldHideIthomeByDefault(article = {}, value = "") {
  return article.sourceId === "ithome" && (!hasCoreIndustrySignal(value) || !hasIthomeHardSignal(value) || hasIthomeLowValueSignal(value));
}

function hasWeakDefaultFeedSignal(value = "") {
  return weakDefaultFeedSignal.test(value);
}

function hasStrongBusinessLandingSignal(value = "") {
  return strongBusinessLandingSignal.test(value);
}

function hasTechnicalExplainerWithoutNewsEvent(value = "") {
  return technicalExplainerSignal.test(value) && !newsEventSignal.test(value);
}

function hasWeakTopicWithoutLandingSignal(value = "") {
  const edgeLandingText = value.replace(edgeAiModuleGenericFallbackSignal, "");
  return explicitHobbyistDiySignal.test(value) ||
    retroSecurityExperimentSignal.test(value) ||
    (hobbyistRetroSignal.test(value) && !memoryHardSignal.test(value)) ||
    consumerGamingHardwareSignal.test(value) ||
    gameContentSignal.test(value) ||
    softwarePromoSignal.test(value) ||
    (developerPeripheralSignal.test(value) && !openAiHardwareLandingSignal.test(value)) ||
    (edgeAiModuleSignal.test(value) && !edgeAiModuleLandingSignal.test(edgeLandingText)) ||
    (consumerSecuritySignal.test(value) && !enterpriseSecurityLandingSignal.test(value)) ||
    (consumerIotSatelliteSignal.test(value) && !communicationsHardwareLandingSignal.test(value)) ||
    (softwarePlatformSignal.test(value) && !nvidiaHardwareLandingSignal.test(value)) ||
    (consumerCoolingSignal.test(value) && !dataCenterCoolingLandingSignal.test(value));
}

function hasQuarantineWeakTopicWithoutLandingSignal(value = "") {
  return explicitHobbyistDiySignal.test(value) ||
    retroSecurityExperimentSignal.test(value) ||
    (hobbyistRetroSignal.test(value) && !memoryHardSignal.test(value)) ||
    consumerGamingHardwareSignal.test(value) ||
    gameContentSignal.test(value) ||
    softwarePromoSignal.test(value) ||
    (developerPeripheralSignal.test(value) && !openAiHardwareLandingSignal.test(value)) ||
    (consumerSecuritySignal.test(value) && !enterpriseSecurityLandingSignal.test(value)) ||
    (consumerIotSatelliteSignal.test(value) && !communicationsHardwareLandingSignal.test(value)) ||
    (softwarePlatformSignal.test(value) && !nvidiaHardwareLandingSignal.test(value)) ||
    (consumerCoolingSignal.test(value) && !dataCenterCoolingLandingSignal.test(value));
}

function hasActionableWeakDefaultFeedException(article = {}, value = "") {
  if (!hasWeakDefaultFeedSignal(value)) {
    return true;
  }
  if (/vbios/i.test(value) && /rx 7900|radeon rx|engineering sample|gpu leak|graphics card leak|consumer gpu|gaming gpu/i.test(value)) {
    return false;
  }
  const title = article.title || "";
  if (weakRoundupSignal.test(title)) {
    return hasStrongBusinessLandingSignal(title);
  }
  return hasStrongBusinessLandingSignal(value);
}

function inferBriefingValue(value = "") {
  const values = briefingValueRules
    .filter(([, pattern]) => pattern.test(value))
    .map(([label]) => label);
  if (hasLuxshareBusinessFit(value)) {
    values.push("Luxshare business fit");
  }
  return Array.from(new Set(values));
}

const companyPatterns = [
  ["Apple", /\bapple\b|苹果|iphone|ipad|mac\b/i],
  ["Samsung", /\bsamsung\b|三星/i],
  ["Samsung Display", /三星显示|samsung display/i],
  ["Google", /\bgoogle\b|deepmind/i],
  ["Meta", /\bmeta\b/i],
  ["Amazon", /\bamazon\b|aws\b/i],
  ["Microsoft", /\bmicrosoft\b|azure\b/i],
  ["NVIDIA", /\bnvidia\b|blackwell|cuda|geforce/i],
  ["AMD", /\bamd\b|epyc|radeon/i],
  ["Intel", /\bintel\b|xeon/i],
  ["Qualcomm", /\bqualcomm\b|snapdragon/i],
  ["ByteDance", /\bbytedance\b|字节跳动/i],
  ["China Mobile", /china mobile|中国移动/i],
  ["Transcend", /\btranscend\b|创见/i],
  ["STMicroelectronics", /stmicroelectronics|意法半导体/i],
  ["Unisoc", /\bunisoc\b|紫光展锐/i],
  ["vivo", /\bvivo\b/i],
  ["Nothing", /\bnothing phone\b|\bnothing\b/i],
  ["MediaTek", /\bmediatek\b/i],
  ["Broadcom", /\bbroadcom\b/i],
  ["Marvell", /\bmarvell\b/i],
  ["Corning", /\bcorning\b|康宁/i],
  ["TSMC", /\btsmc\b|taiwan semiconductor/i],
  ["SK hynix", /\bsk hynix\b|hynix/i],
  ["Micron", /\bmicron\b/i],
  ["Supermicro", /\bsupermicro\b/i],
  ["Dell", /\bdell\b/i],
  ["HPE", /\bhpe\b|hewlett packard enterprise/i],
  ["Vertiv", /\bvertiv\b/i],
  ["Schneider Electric", /\bschneider electric\b/i],
  ["Eaton", /\beaton\b/i],
  ["Delta Electronics", /\bdelta electronics\b/i],
  ["Foxconn", /\bfoxconn\b|hon hai|富士康|鸿海/i],
  ["Quanta", /\bquanta\b|广达/i],
  ["Wiwynn", /\bwiwynn\b|纬颖/i],
  ["Wistron", /\bwistron\b|纬创/i],
  ["Inventec", /\binventec\b|英业达/i],
  ["Pegatron", /\bpegatron\b|和硕/i],
  ["Compal", /\bcompal\b|仁宝/i],
  ["Jabil", /\bjabil\b|捷普/i],
  ["BYD Electronic", /byd electronic|比亚迪电子/i],
  ["Goertek", /goertek|歌尔/i],
  ["AAC Technologies", /aac technologies|瑞声/i],
  ["Sunny Optical", /sunny optical|舜宇/i],
  ["Lens Technology", /lens technology|蓝思/i],
  ["Luxshare", /\bluxshare\b|立讯/i]
];

function decodeHtml(value = "") {
  return value
    .replaceAll("<![CDATA[", "")
    .replaceAll("]]>", "")
    .replace(/<[^>]*>/g, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replace(/\s+/g, " ")
    .trim();
}

function toDateString(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function daysBetweenDates(asOfDate, itemDate) {
  const asOf = new Date(`${asOfDate}T00:00:00`);
  const date = new Date(`${itemDate}T00:00:00`);
  if (Number.isNaN(asOf.getTime()) || Number.isNaN(date.getTime())) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.floor((asOf - date) / 86400000);
}

function isRecentEnough(dateString, maxAgeDays = 45) {
  const diff = daysBetweenDates(collectionAsOfDate, dateString);
  return diff >= 0 && diff <= maxAgeDays;
}

function createId(parts) {
  return parts
    .join("_")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96);
}

function normalizeTitle(title = "") {
  return decodeHtml(title)
    .toLowerCase()
    .replace(/\b(exclusive|breaking|update|analysis)\b/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreText(value, rules) {
  return rules.reduce((score, [pattern, weight]) => score + (pattern.test(value) ? weight : 0), 0);
}

function classifyText(text, sourceId = "") {
  const value = text.toLowerCase();
  if (sourceId === "sec_edgar" || /\b(10-k|10-q|8-k)\b|earnings|revenue|quarterly results|annual report|capex|capital expenditure|guidance/.test(value)) {
    return "财报";
  }
  if (/partnership|collaboration|agreement|acquisition|appoints|joins|stockholder meeting|annual meeting/.test(value)) {
    return "公司动态";
  }
  if (/gpu|server|rack|data center|datacenter|networking|hbm|memory|supply|cooling|power|nvl|dgx|blackwell|inference/.test(value)) {
    return "供应链";
  }
  return "产品";
}

function inferIndustry(text, fallback = "数据中心硬件") {
  const value = text.toLowerCase();

  if (/stockholder meeting|annual meeting|shareholder meeting/.test(value)) {
    return "财报/产业信号";
  }
  if (/服务器|数据中心|ai服务器|集采|机柜|液冷|算力基础设施|\bhpc\b|supercomputer|supercomputing|gpu rack|ai rack|poweredge|rack-scale|rack scale|jalapeño|jalapeno|inference processor|inferencing accelerator|dragonfly data center|computex.*rack|52u racks|diamond cooling/.test(value)) {
    return "数据中心硬件";
  }
  if (/折叠.*iphone|iphone|苹果|oled|三星显示|代工|印度|越南|供应链/.test(value)) {
    return "3C 产品";
  }

  const dataCenterScore = scoreText(value, [
    [/data center|datacenter|数据中心|ai infrastructure|cloud|server|服务器|rack|机柜|nvl|dgx|blackwell|inference|training/, 3],
    [/gpu|accelerated computing|confidential computing|networking|ethernet|infiniband/, 2],
    [/power|电源|cooling|散热|liquid|液冷|cluster|集采/, 1]
  ]);
  const componentScore = scoreText(value, [
    [/hbm|dram|memory|soc|cpu|chip|semiconductor|foundry|packaging|wafer/, 3],
    [/gpu|processor|silicon|interconnect/, 2]
  ]);
  const consumerScore = scoreText(value, [
    [/iphone|ipad|mac|smartphone|mobile|android|wearable|xr|ar|geforce now|gaming/, 3],
    [/\bpc\b|rtx|snapdragon|laptop/, 2]
  ]);

  if (dataCenterScore >= Math.max(componentScore, consumerScore) && dataCenterScore >= 3) {
    return "数据中心硬件";
  }
  if (componentScore >= Math.max(dataCenterScore, consumerScore) && componentScore >= 3) {
    return "核心零部件";
  }
  if (consumerScore >= 3) {
    return "3C 产品";
  }
  if (/server|rack|data center|datacenter|networking|ethernet|infiniband|cooling|power/.test(value)) {
    return "数据中心硬件";
  }
  return fallback;
}

function inferImportance(text, form, article = {}) {
  const score = getLuxshareImpactScore(text, form, article);
  if (score >= 10) {
    return "高";
  }
  if (score >= 5) {
    return "中";
  }
  return "低";
}

function getRecencyScore(dateString) {
  const ageDays = daysBetweenDates(collectionAsOfDate, dateString);
  if (!Number.isFinite(ageDays)) return 0.5;
  if (ageDays <= 1) return 5;
  if (ageDays <= 3) return 3;
  if (ageDays <= 7) return 1;
  return -2;
}

function sourceWeightFor(article = {}) {
  return sourceWeights[article.sourceId] || 2;
}

function getLuxshareImpactScore(text, form = "", article = {}) {
  const value = text.toLowerCase();
  if (isLowManagementValue(value)) {
    return 0;
  }
  if (isRawSecFiling(article) && !hasSecFilingHardSignal(value)) {
    return Math.max(sourceWeightFor(article) + getRecencyScore(article.publishedAt), 0);
  }

  let score = sourceWeightFor(article) + getRecencyScore(article.publishedAt);
  if (["10-K", "10-Q"].includes(form)) {
    score += 7;
  }
  if (form === "8-K") {
    score += 3;
  }

  const hasAi = topicUniverse.aiInfrastructure.test(value);
  const hasDcHardware = topicUniverse.dataCenterHardware.test(value);
  const hasThreeC = topicUniverse.threeC.test(value);
  const hasLuxshare = topicUniverse.luxshareEcosystem.test(value);
  const hasCustomer = topicUniverse.customersAndPlatforms.test(value);
  const hasCompetitor = topicUniverse.competitors.test(value);
  const hasBusinessSignal = topicUniverse.businessSignals.test(value);
  const briefingValue = article.briefingValue?.length ? article.briefingValue : inferBriefingValue(value);

  if (hasAi) score += 6;
  if (hasDcHardware) score += 7;
  if (hasThreeC) score += 3;
  if (hasLuxshare) score += 10;
  if (hasCustomer) score += 4;
  if (hasCompetitor) score += 4;
  if (hasBusinessSignal) score += 6;

  if (hasAi && hasDcHardware) score += 5;
  if (hasAi && (hasCustomer || hasCompetitor)) score += 4;
  if (hasDcHardware && (hasCustomer || hasCompetitor)) score += 3;
  if (hasThreeC && hasBusinessSignal) score += 4;
  if (hasThreeC && (hasCustomer || hasCompetitor) && /供应链|supplier|代工|工厂|产能|量产|认证|订单|价格|涨价|短缺|印度|越南|oled|显示|摄像头|光学|连接器|组装|assembly/.test(value)) {
    score += 5;
  }
  if (briefingValue.includes("Luxshare business fit")) score += 6;
  if (briefingValue.includes("Demand signal")) score += 6;
  if (briefingValue.includes("Supply signal")) score += 6;
  if (briefingValue.includes("Cost signal")) score += 5;
  if (briefingValue.includes("Technology shift")) score += 4;
  if (briefingValue.includes("Customer move")) score += 5;
  if (briefingValue.includes("Competitor move")) score += 5;
  if (briefingValue.includes("Risk event")) score += 5;
  if (briefingValue.includes("Capital allocation")) score += 6;
  if (/data center.*firmware resiliency|firmware resiliency.*data center/i.test(value)) {
    score += 6;
  }

  if (/research paper|technical paper|survey|roundup|academic|university|et al|framework|modeling|simulation|lithography defect|fault injection/.test(value)) {
    score -= 12;
  }
  if (/swift package index|软件包|开源|开发者工具|app store|应用商店/.test(value)) {
    score -= 10;
  }
  if (/galaxy m|vivo y|nothing phone|iqoo|手机曝光|海外发布|涨价/.test(value) && !/苹果|apple|iphone|供应链|代工|工厂|三星显示|连接器|摄像头/.test(value)) {
    score -= 8;
  }
  if (/gaming|游戏|手游|console|playstation|mini pc|geforce now|diffusiongemma|local ai|sovereign ai|robotaxi|stockholder meeting|webinar|magazine|podcast|review|hands-on|keynote coverage|tape out|tapes out|laptop|macbook|xps|kvm|mid-tower|atx case|gpu-z|exceria|raptor lake|undersea cable|portable|enclosure|drivers?|whql|arc gpu|deepseek|entity list|rtx remix|pubg|ace ai|gas turbines|naacp|lawsuit|robots? that taught themselves|fab roadmap examined|built-in memory|consumer ryzen|memory encryption|rtx spark|consumer pcie|nova lake-s|oc sku|pl2 mode|greenlake/.test(value)) {
    score -= 6;
  }
  if (genericNewsPenalty.test(value)) {
    score -= 8;
  }
  if (hasAutomotiveNoiseWithoutLuxshareFit(value)) {
    score -= 14;
  }
  if (hasSoftwareOnlySignal(value)) {
    score -= 14;
  }
  if (hasProductLeakWithoutSupplyChainSignal(value)) {
    score -= 14;
  }
  if (hasIthomeProductLeakTitleWithoutSupplyChainSignal(article)) {
    score -= 14;
  }
  if (!hasAi && !hasDcHardware && !hasThreeC && !hasLuxshare && !hasCompetitor && !hasBusinessSignal) {
    score -= 8;
  }

  return Math.max(score, 0);
}

function isLowManagementValue(value) {
  return gameContentSignal.test(value) || /technical paper roundup|research bits|paper roundup|survey|academic paper|university|et al\.?|fault injection|timing analysis|radiation hydrodynamic|lithography defect|vision-language models|conference agenda|magazine|podcast|webinar|mini pc|playstation|console|游戏|手游|geforce now|summer sale|swift package index|软件包|开发者工具|应用商店|diffusiongemma|local ai|sovereign ai|keynote coverage|tape out|tapes out|laptop|macbook|xps|kvm|mid-tower|atx case|gpu-z|exceria|raptor lake|undersea cable|portable|enclosure|drivers?|whql|arc gpu|deepseek|entity list|rtx remix|pubg|ace ai|gas turbines|naacp|lawsuit|robots? that taught themselves|fab roadmap examined|built-in memory|consumer ryzen|memory encryption|rtx spark|consumer pcie|nova lake-s|oc sku|pl2 mode|greenlake|file explorer|windows 11|bionemo|agent toolkit|agent framework|repository-level code evolution|nvidia research|scientific discovery|telecom operations|arc pro.*available|now available.*\$|turns waves into watts|digital twins|scalper|scalpers|bundle|bundles|blowout|anniversary edition|5800x3d|b&h|transfr pro|send unlimited files|lifetime deal|slopfix|ai-generated code|code bloat|software team|messy repositories|防诈骗|被盗怎么办|官方支持文档|国补|免息|自营|优惠|促销|另类营销|下水玩|手机曝光|galaxy z flip|galaxy m|vivo y|nothing phone|智能戒指|iring|galaxy ring|steam machine|ldlc|rx 9060|发电装机容量/.test(value);
}

function shouldShowByDefault(article, rawText) {
  const value = `${article.title} ${rawText || ""}`.toLowerCase();
  const briefingValue = article.briefingValue || inferBriefingValue(value);
  const hasBriefingValue = briefingValue.length > 0;
  const hasBusinessFit = briefingValue.includes("Luxshare business fit");
  if (isLowManagementValue(value)) {
    return false;
  }
  if (hasDefaultFeedNegativeSignal(value) && !hasStrongCoreIndustrySignal(value)) {
    return false;
  }
  if (hasAutomotiveNoiseWithoutLuxshareFit(value)) {
    return false;
  }
  if (hasSoftwareOnlySignal(value)) {
    return false;
  }
  if (!hasActionableWeakDefaultFeedException(article, value)) {
    return false;
  }
  if (hasWeakTopicWithoutLandingSignal(value)) {
    return false;
  }
  if (shouldHideIthomeByDefault(article, value)) {
    return false;
  }
  if (article.sourceId === "ithome" && (hasProductLeakWithoutSupplyChainSignal(value) || hasIthomeProductLeakTitleWithoutSupplyChainSignal(article))) {
    return false;
  }
  if (hasIrrelevantConsumerOrSocialNoise(value)) {
    return false;
  }
  if (!hasBriefingValue) {
    return false;
  }
  if (!hasCoreIndustrySignal(value) && !hasBusinessFit) {
    return false;
  }
  if ((article.impactScore || 0) < 8) {
    return false;
  }
  if (genericNewsPenalty.test(value)) {
    return false;
  }
  if (/stockholder meeting|annual meeting|shareholder meeting|geforce now summer sale|membership savings/.test(value)) {
    return false;
  }
  if (article.sourceId === "sec_edgar" && article.topic === "8-K" && !/capex|capital expenditure|data center|datacenter|server|ai|cloud|gpu|financing|acquisition|agreement|customer|order|capacity/.test(value)) {
    return false;
  }
  if (isRawSecFiling(article) && !hasSecFilingHardSignal(value)) {
    return false;
  }
  if (article.sourceId === "ithome" && !hasCoreIndustrySignal(value)) {
    return false;
  }
  return article.relevance === "高" || article.relevance === "中";
}

function getLowValueReason(article, rawText) {
  const value = `${article.title} ${rawText || ""}`.toLowerCase();
  if (isLowManagementValue(value)) {
    return "技术论文或研究合集，管理层决策价值低";
  }
  if (gameContentSignal.test(value)) {
    return "游戏内容或游戏工作室动态，不属于管理层硬件产业链简报";
  }
  if (/stockholder meeting|annual meeting|shareholder meeting/.test(value)) {
    return "股东会日程，对业务经营影响低";
  }
  if (/mini pc|playstation|console|geforce now|gaming/.test(value)) {
    return "消费硬件或娱乐内容，对立讯管理层当前决策价值低";
  }
  if (/diffusiongemma|local ai|sovereign ai/.test(value)) {
    return "单点模型或软件优化，对订单、产能和硬件链条影响不直接";
  }
  if (/keynote coverage|tape out|tapes out|laptop|macbook|xps|kvm|mid-tower|atx case|gpu-z|exceria|raptor lake|undersea cable|portable|enclosure|drivers?|whql|arc gpu|deepseek|entity list|rtx remix|pubg|ace ai|gas turbines|naacp|lawsuit|robots? that taught themselves|fab roadmap examined|built-in memory|consumer ryzen|memory encryption|rtx spark|consumer pcie|nova lake-s|oc sku|pl2 mode|greenlake/.test(value)) {
    return "泛产品或发布会信息，尚未形成明确订单、产能或供应链变化";
  }
  if (/robotaxi/.test(value)) {
    return "车载应用离当前 3C/机柜链条较远";
  }
  return "";
}

function inferRelevanceLabelFromScore(score, text = "", article = {}) {
  const briefingValue = article.briefingValue || inferBriefingValue(text);
  const hasBriefingValue = briefingValue.length > 0;
  const hasBusinessFit = briefingValue.includes("Luxshare business fit");
  if (isRawSecFiling(article) && !hasSecFilingHardSignal(text)) {
    return score >= 5 ? "中" : "低";
  }
  if (hasDefaultFeedNegativeSignal(text) && !hasStrongCoreIndustrySignal(text)) {
    return score >= 5 ? "中" : "低";
  }
  if (hasAutomotiveNoiseWithoutLuxshareFit(text)) {
    return score >= 5 ? "中" : "低";
  }
  if (hasSoftwareOnlySignal(text)) {
    return score >= 5 ? "中" : "低";
  }
  if (!hasActionableWeakDefaultFeedException(article, text)) {
    return score >= 5 ? "中" : "低";
  }
  if (hasTechnicalExplainerWithoutNewsEvent(text)) {
    return score >= 5 ? "中" : "低";
  }
  if (hasWeakTopicWithoutLandingSignal(text)) {
    return score >= 5 ? "中" : "低";
  }
  if (article.sourceId === "ithome" && (!hasIthomeHardSignal(text) || hasIthomeLowValueSignal(text))) {
    return score >= 5 ? "中" : "低";
  }
  if (hasProductLeakWithoutSupplyChainSignal(text) || hasIthomeProductLeakTitleWithoutSupplyChainSignal(article)) {
    return score >= 5 ? "中" : "低";
  }
  if (hasIrrelevantConsumerOrSocialNoise(text)) {
    return score >= 5 ? "中" : "低";
  }
  if (score >= 10 && hasBriefingValue && (hasCoreIndustrySignal(text) || hasBusinessFit)) {
    return "高";
  }
  if (score >= 5) {
    return "中";
  }
  return "低";
}

function conciseText(value = "", maxLength = 180) {
  const text = decodeHtml(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const safeText = trimToCompleteSentence(text, maxLength);
  return safeText;
}

function hasIncompleteEnding(value = "") {
  const text = value.trim().replace(/[。！？；.!?]+$/u, "").trim();
  return /(?:包括|其中|以及|而|与|和|在|向|投|非|Br|iPhone|\d+)$/u.test(text);
}

function hasBrokenChineseSummaryStart(value = "") {
  return /^(?:数据显示[，,]?\s*其中|报告称[，,]?\s*其中|，?其中|并且?|以及|同时|此外|另外|该|其|这也|这意味着)/u.test(value.trim());
}

const protectedSentenceDot = "\uE000";

function protectEnglishSentenceDots(value = "") {
  return value
    .replace(/(\d)\.(\d)/g, `$1${protectedSentenceDot}$2`)
    .replace(/\b(Wi-Fi)\s+(\d)/gi, `$1 ${protectedSentenceDot}$2`);
}

function unprotectEnglishSentenceDots(value = "") {
  return value.replaceAll(protectedSentenceDot, ".");
}

function hasBrokenEnglishSummaryStart(value = "") {
  const text = value.trim();
  return /^(?:\d+\s*nm\b|\d+\s*(?:gb\/s|tb\/s|mb\/s)\b|nm node\b|according to\b|reports from\b|recent reports from\b|[a-z][a-z]+(?:\s+[a-z][a-z]+){0,3}\b)/i.test(text) &&
    !/^(?:this|the|a|an|at|inside|intel|amd|nvidia|samsung|apple|sk hynix|asrock|jetcool|bytedance|goertek|infineon|ase|microsoft)\b/i.test(text);
}

function trimToCompleteSentence(value = "", maxLength = 180) {
  const text = value.trim();
  if (!text) {
    return "";
  }

  const isChineseText = hasChinese(text);
  const sentenceSource = isChineseText ? text : protectEnglishSentenceDots(text);
  const sentencePattern = isChineseText
    ? /[^。！？；]+[。！？；]+/gu
    : /[^.!?]+[.!?]+/gu;
  const matches = Array.from(sentenceSource.matchAll(sentencePattern));
  const completeSentences = matches
    .map((match) => ({
      sentence: unprotectEnglishSentenceDots(match[0].trim()),
      end: match.index + match[0].length
    }))
    .filter(({ sentence, end }) => end <= maxLength && !hasIncompleteEnding(sentence) && !hasBrokenEnglishSummaryStart(sentence) && !(isChineseText && hasBrokenChineseSummaryStart(sentence)));

  if (completeSentences.length) {
    return completeSentences.map(({ sentence }) => sentence).join(" ").trim();
  }

  if (text.length <= maxLength && !hasIncompleteEnding(text) && !hasBrokenEnglishSummaryStart(text) && !(isChineseText && hasBrokenChineseSummaryStart(text))) {
    return text;
  }

  return "";
}

function makeSummary(title, rawText = "") {
  const text = conciseText(rawText.replace(title, ""), 180);
  if (text && text.length > 20 && /[\u4e00-\u9fa5]/.test(text)) {
    return text;
  }
  return inferTitlePoint(title);
}

function cleanSummaryText(value = "") {
  return decodeHtml(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\bThe post\b[\s\S]*?\bappeared first on\b[\s\S]*?\.?$/i, "")
    .replace(/\b(Read more|Continue reading)\b[\s\S]*$/i, "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripCompleteTitlePrefix(title = "", summary = "") {
  const cleanTitle = cleanSummaryText(title);
  const cleanSummary = cleanSummaryText(summary);
  if (!cleanTitle || !cleanSummary) {
    return cleanSummary;
  }

  const exactPattern = new RegExp(`^${escapeRegex(cleanTitle).replace(/\s+/g, "\\s+")}\\s*(?:[:：.。\\-–—|]+\\s*)?`, "iu");
  const stripped = cleanSummary.replace(exactPattern, "").trim();
  if (stripped !== cleanSummary) {
    return stripped;
  }

  const lowerTitle = cleanTitle.toLowerCase();
  const lowerSummary = cleanSummary.toLowerCase();
  if (lowerSummary.startsWith(lowerTitle)) {
    return cleanSummary
      .slice(cleanTitle.length)
      .replace(/^\s*[:：.。\-–—|]+\s*/, "")
      .trim();
  }

  return cleanSummary;
}

function normalizeForReplay(value = "") {
  return cleanSummaryText(value)
    .toLowerCase()
    .replace(/^\[news\]\s*/i, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTitleReplay(title = "", summary = "") {
  const cleanTitle = normalizeForReplay(title);
  const cleanSummary = normalizeForReplay(summary);
  if (!cleanTitle || !cleanSummary) {
    return false;
  }
  if (cleanTitle === cleanSummary) {
    return true;
  }
  if (cleanSummary.startsWith(cleanTitle)) {
    return true;
  }

  let common = 0;
  const max = Math.min(cleanTitle.length, cleanSummary.length);
  while (common < max && cleanTitle[common] === cleanSummary[common]) {
    common += 1;
  }
  return common >= cleanTitle.length * 0.8 && cleanSummary.slice(common).trim().length < 48;
}

function fallbackSummaryFromTitle(title = "") {
  const value = title.toLowerCase();
  const subject = cleanSummaryText(title)
    .replace(/^\[news\]\s*/i, "")
    .replace(/[.:;,\-\s]+$/g, "")
    .trim();
  const prefix = subject ? `This update on ${subject}` : "This update";

  if (/advanced packaging|cowos|packaging|\base\b|substrate/.test(value)) {
    return `${prefix} points to tightening advanced-packaging supply and potential cost pressure for AI hardware programs.`;
  }
  if (/hbm|dram|nand|lpddr|memory|ssd/.test(value)) {
    return `${prefix} signals memory-supply pressure or architecture change that can affect AI servers, data-center hardware and BOM planning.`;
  }
  if (/gb300|gb200|blackwell|rubin|vera|rigel|arm cpu|epyc|versal|server platform|ai server|agi server|accelerator|nvl/.test(value)) {
    return `${prefix} highlights a data-center hardware platform shift that may affect server architecture, hardware demand and supplier positioning.`;
  }
  if (/liquid cooling|direct-to-chip|cold plate|cdu|cooling|thermal|poweredge/.test(value)) {
    return `${prefix} reflects continued adoption of thermal designs in AI server infrastructure, with implications for modules, power delivery and rack-level integration.`;
  }
  if (/supplier|order|capacity|production ramp|mass production|investment|expand|expansion|fab|wafer/.test(value)) {
    return `${prefix} is relevant as a supply-chain signal around capacity, production ramp or supplier positioning.`;
  }
  if (/semiconductor equipment|foundry|yield|node|process|18a|1\.4 nm|wide bandgap|gallium oxide|epitax/.test(value)) {
    return `${prefix} points to semiconductor supply-chain capacity or process progress that may affect upstream availability and technology roadmaps.`;
  }
  if (/\b(?:sec|10-q|8-k|filed)\b/.test(value)) {
    return `${prefix} requires source review before drawing conclusions about supply-chain exposure, financial risk or customer demand.`;
  }
  return `${prefix} is relevant as an industry signal that should be reviewed for demand, supply, cost, technology or customer implications.`;
}

function templateSummaryFromTitle(title, summary) {
  const cleanedSummary = stripCompleteTitlePrefix(title, summary);
  if (cleanedSummary && !isTitleReplay(title, cleanedSummary)) {
    return cleanedSummary;
  }
  return fallbackSummaryFromTitle(title);
}

function templateSummary(article, summary) {
  if (article.originalLanguage !== "zh") {
    return fallbackSummaryFromTitle(article.title);
  }
  return templateSummaryFromTitle(article.title, summary);
}

function extractRawEnglishSummary(article, rawText = "") {
  const title = decodeHtml(article.title || "").replace(/\s+/g, " ").trim();
  const source = cleanSummaryText(rawText);
  const withoutTitle = stripCompleteTitlePrefix(title, source);
  const summary = conciseText(withoutTitle, 260);
  if (!summary || summary.length < 48) {
    return "";
  }
  if (summary.toLowerCase() === title.toLowerCase()) {
    return "";
  }
  if (isTitleReplay(title, summary)) {
    return "";
  }
  if (hasBrokenEnglishSummaryStart(summary)) {
    return "";
  }
  if (/^(read more|continue reading|click here|subscribe|sign up)\b/i.test(summary)) {
    return "";
  }
  if ((summary.match(/\s+/g) || []).length < 7) {
    return "";
  }
  return summary;
}

function inferTitlePoint(title) {
  const value = title.toLowerCase();
  if (/mlperf|benchmark|performance|training/.test(value)) {
    return templateSummaryFromTitle(title, "This benchmark update is relevant as a performance and efficiency signal for GPU platforms, server architecture and data-center deployment economics.");
  }
  if (/memory|dram|nand|hbm|ssd/.test(value)) {
    return templateSummaryFromTitle(title, "This memory update is relevant as a supply, pricing or architecture signal for server memory, HBM, NAND and downstream BOM planning.");
  }
  if (/xr|ar glasses|agents|agentic|physical ai/.test(value)) {
    return templateSummaryFromTitle(title, "This product-platform update should be reviewed for sensor, optics, connector or final-assembly implications before raising its priority.");
  }
  if (/server|data center|rack|switch|network|storage/.test(value)) {
    return templateSummaryFromTitle(title, "This data-center hardware update may affect server architecture, network or storage design and deployment requirements.");
  }
  if (/foundry|process|packaging|chiplet|wafer|semiconductor/.test(value)) {
    return templateSummaryFromTitle(title, "This semiconductor update points to process, packaging or wafer-supply changes that may affect upstream availability and technology roadmaps.");
  }
  if (/power|cooling|liquid|thermal|pdu|busbar/.test(value)) {
    return templateSummaryFromTitle(title, "This power or thermal update is relevant to rack-level integration, cooling modules, power delivery and related component demand.");
  }
  return fallbackSummaryFromTitle(title);
}

function makeWhyItMatters(article) {
  const text = [
    article.title,
    article.summary,
    article.industry,
    article.signalCategory,
    ...article.companies,
    ...article.tags
  ].join(" ").toLowerCase();

  if (/coherent|optical|transceiver|optics|800g|1\.6t/.test(text)) {
    return "对立讯的意义在于高速互连从服务器内部延伸到光链路，需观察光器件产能、客户认证和连接方案是否改变。";
  }
  if (/apple|private cloud compute|iphone|airpods/.test(text)) {
    return "苹果链信号优先看两点：端侧硬件规格是否升级，以及云端 AI 投入是否带来新的服务器和互连需求。";
  }
  if (/印度|india|越南|vietnam/.test(text) && /苹果|apple|代工|工厂|供应链|jabil|捷普|foxconn|富士康|oled|三星显示/.test(text)) {
    return "对立讯来说，这是客户供应链区域化和竞品产能迁移信号，影响印度/越南产能布局、客户审计、订单分配和备选供应商策略。";
  }
  if (/hpe|ai factory|blackwell|nvl|mlperf|agentic ai|graviton|epyc|xeon|diamond rapids/.test(text)) {
    return "这类信息关系到 AI 服务器从单卡采购转向整机柜交付，立讯应关注电源、散热、线束、连接器和组装复杂度变化。";
  }
  if (/cxmt|ymtc|homegrown|china-produced ddr5|chinese memory brands/.test(text)) {
    return "国产存储进入品牌和 OEM 采购后，立讯需要关注客户物料认证、区域供应链配置和出口管制下的替代风险。";
  }
  if (/ssd|nand|dram|hbm|memory|silicon motion|smi/.test(text)) {
    return "存储供给被 AI 数据中心吸走时，会同时影响服务器 BOM 和消费电子备货成本，需看缺货是否传导到客户排产。";
  }
  if (/tsmc|cowos|panel packaging|advanced packaging|foundry|18a/.test(text)) {
    return "先进封装和制程节奏会决定 AI 芯片交付能力，间接影响服务器整机和机柜组件订单能见度。";
  }

  if (article.signalCategory === "财报") {
    return article.topic === "8-K"
      ? "8-K 只有在涉及客户、产能、融资、并购或重大合作时才值得升权；否则只作为背景信息保留。"
      : "10-K/10-Q 要重点抽取资本开支、库存、客户集中度、毛利和风险因素，不能只停留在 filing 本身。";
  }
  if (article.signalCategory === "公司动态") {
    return "公司动态需要判断是否改变客户关系、技术路线或订单归属；没有落到这些变量上就不应放大解读。";
  }
  if (article.industry === "数据中心硬件") {
    return "立讯需要把重点放在整机柜、供电、散热、高速线缆和连接器，而不是只看 GPU 或服务器品牌。";
  }
  if (article.industry === "核心零部件") {
    return "核心零部件信号要落到供给瓶颈、BOM 成本、客户认证和量产节奏上，否则容易变成技术噪音。";
  }
  return "产品信号只有在带来规格升级、备货变化或供应商切换时，才应进入管理层优先阅读。";
}

function summarizeArticle(article, rawText) {
  if (article.sourceId === "sec_edgar") {
    const text = `${article.title || ""} ${rawText || ""}`.toLowerCase();
    if (!hasSecFilingHardSignal(text)) {
      return secFilingAlertSummary(article);
    }
    const company = article.companies[0];
    if (article.topic !== "10-Q") {
      return `${company} ${article.topic} filing contains a business-relevant disclosure signal; review the filing for customer, agreement, capacity, financing or supply-chain implications before promoting conclusions.`;
    }
    if (company === "Apple") {
      return "Apple 10-Q contains a filing-level signal that should be reviewed for inventory, capex, customer demand, gross margin and supply-chain risk before drawing conclusions.";
    }
    if (company === "NVIDIA") {
      return "NVIDIA 10-Q contains a filing-level signal that should be reviewed for data-center revenue, inventory commitments, customer concentration and AI infrastructure supply exposure.";
    }
    if (company === "HPE") {
      return "HPE 10-Q contains a filing-level signal that should be reviewed for AI Factory demand, server-networking backlog, margins and data-center hardware order conversion.";
    }
    if (company === "Qualcomm") {
      return "Qualcomm 10-Q contains a filing-level signal that should be reviewed for handset SoC, AI PC and automotive-chip demand before inferring BOM or stocking changes.";
    }
    return `${company} ${article.topic} contains a filing-level signal; review capex, inventory, order visibility, gross margin and customer-risk disclosures before drawing conclusions.`;
  }

  const rawSummary = extractRawEnglishSummary(article, rawText);
  if (rawSummary) {
    return rawSummary;
  }

  const text = rawText.toLowerCase();
  if (/coherent|optical|transceiver|optics/.test(text)) {
    return templateSummary(article, "Coherent 扩建德州光器件产能，说明 AI 数据中心的瓶颈正在从 GPU 扩散到光互连和高速链路供给。");
  }
  if (/苹果|apple/.test(text) && /印度|india/.test(text) && /网络攻击|泄露|文件|调查|supply chain|供应链/.test(text)) {
    return templateSummary(article, "苹果印度供应链出现数据安全或合规事件，核心不是单次攻击，而是印度制造扩张后供应商治理、文件权限和客户审计压力上升。");
  }
  if (/苹果|apple|iphone/.test(text) && /折叠|foldable|量产|发布/.test(text)) {
    return templateSummary(article, "苹果折叠 iPhone 进入量产窗口，重点不是新品传闻，而是显示、铰链、结构件、连接器和组装良率会提前进入供应商验证。");
  }
  if (/三星显示|samsung display|oled/.test(text) && /苹果|apple|iphone/.test(text) && /越南|vietnam|量产|许可|工厂/.test(text)) {
    return templateSummary(article, "Samsung Display 获苹果折叠 iPhone OLED 量产许可并启动越南产线，说明苹果新形态终端供应链正在提前锁定显示和组装配套。");
  }
  if (/中国移动|移动/.test(text) && /服务器|集采|中标/.test(text)) {
    return templateSummary(article, "中国移动大规模服务器集采反映国内运营商算力基础设施采购仍在放量，需关注服务器整机、线缆、连接器和电源配套的国产供应链机会。");
  }
  if (/鸿海|foxconn|hon hai/.test(text) && /夏普|sharp|战略合作/.test(text)) {
    return templateSummary(article, "鸿海与夏普扩大合作说明头部 EMS 仍在通过显示、AI、EV 等平台扩张能力边界，立讯需要持续跟踪竞品的客户和产能布局。");
  }
  if (/jabil|捷普/.test(text) && /苹果|apple/.test(text) && /ai\s*服务器|ai服务器|服务器|server|印度|india/.test(text)) {
    return templateSummary(article, "Jabil 退出苹果印度工厂后转向印度 AI 服务器制造，说明印度制造正在从手机组装外溢到服务器硬件，EMS 竞争边界会重新划分。");
  }
  if (/供应链周报|苹果印度供应链/.test(text) || (/苹果|apple/.test(text) && /歌尔|蓝思|同异光电|xr|光学/.test(text))) {
    return templateSummary(article, "苹果链周度信息要重点看印度制造、XR 光学、显示和声学零部件的产能迁移，这些会影响立讯的客户份额和区域产能配置。");
  }
  if (/hpe ai factory|ai factory portfolio/.test(text)) {
    return templateSummary(article, "HPE 把 NVIDIA 平台继续包装成 AI Factory 方案，信号不是单机服务器发布，而是企业采购正在转向整套基础设施交付。");
  }
  if (/self-driving networks/.test(text)) {
    return templateSummary(article, "HPE 将园区、边缘和数据中心网络纳入 AI Factory 管理体系，说明 AI 机房交付越来越依赖网络自动化和整柜协同。");
  }
  if (/mlperf|benchmark|agentic ai infrastructure benchmark|blackwell|nvl/.test(text)) {
    return templateSummary(article, fallbackSummaryFromTitle(article.title));
  }
  if (/confidential computing|private cloud compute/.test(text)) {
    return templateSummary(article, "Apple Private Cloud Compute 引入 NVIDIA 机密计算能力，显示苹果 AI 不只发生在端侧，也在形成受控云端算力需求。");
  }
  if (/lg group|physical ai|mobility/.test(text)) {
    return templateSummary(article, "NVIDIA 与 LG 推进 AI Factory 合作，重点在制造、机器人和移动场景的物理 AI 基础设施，而不是普通企业 IT 升级。");
  }
  if (/globalfoundries|open standard|scale up/.test(text)) {
    return templateSummary(article, "GlobalFoundries 支持 AI scale-up 开放标准，反映非 NVIDIA 阵营也在争夺集群互连生态的话语权。");
  }
  if (/retail ssd market has almost disappeared|direct nand supply dries up/.test(text)) {
    return templateSummary(article, "Silicon Motion 指出零售 SSD 被挤压、PC OEM 转向第三方方案，背后是 NAND 供给被数据中心和大客户重新分配。");
  }
  if (/pcie 6\.0 ssd controller|nand shortages/.test(text)) {
    return templateSummary(article, "SMI 把 PCIe 6.0 SSD 控制器与 2027 年 NAND 短缺放在一起，信号是 AI 数据中心正在提前锁定存储供给。");
  }
  if (/cxmt|ymtc|chinese memory brands|homegrown/.test(text)) {
    return templateSummary(article, "中国内存品牌转向 CXMT 和 YMTC，说明国产存储替代正在从政策叙事进入品牌和 PC OEM 采购环节。");
  }
  if (/18a-p|foundry node|diamond rapids/.test(text)) {
    return templateSummary(article, "Intel 18A-P 进入风险生产，核心看 Diamond Rapids 是否按节奏推进，以及服务器平台切换是否带来新一轮配套设计。");
  }
  if (/panel packaging|cowos/.test(text)) {
    return templateSummary(article, "TSMC 表态面板级封装短期不会替代 CoWoS，说明 AI 大芯片供给仍受先进封装产能和良率约束。");
  }
  if (/sp7|epyc venice|lga9324|diamond rapids/.test(text)) {
    return templateSummary(article, "AMD SP7 和 Intel LGA9324-1 插座曝光，说明下一代 AI 服务器平台会带来主板、供电、散热和结构件重新设计。");
  }
  if (/graviton5/.test(text)) {
    return templateSummary(article, "AWS Graviton5 曝光表明云厂商继续自研服务器 CPU，长期会影响服务器主板、供电和整机设计的标准化路径。");
  }
  if (/geforce now|gaming|rtx/.test(text)) {
    return templateSummary(article, "消费端 GPU 或云游戏变化偏产品侧，只有在带来显卡、PC 或终端备货变化时才值得提高优先级。");
  }
  if (/robotaxi|automotive|autonomous vehicle|driving safety/.test(text)) {
    return templateSummary(article, "汽车智能化更多影响车载计算和边缘硬件，对立讯当前 3C 与机柜链条的直接影响较弱。");
  }
  if (/processor|xeon|epyc|graviton|socket|cpu/.test(text)) {
    return templateSummary(article, fallbackSummaryFromTitle(article.title));
  }
  if (/hbm|dram|nand|memory/.test(text)) {
    return templateSummary(article, fallbackSummaryFromTitle(article.title));
  }
  if (/server|rack|switch|network|storage|liquid|cooling|power/.test(text)) {
    return templateSummary(article, fallbackSummaryFromTitle(article.title));
  }
  if (/semiconductor|chiplet|advanced packaging|eda|foundry|wafer/.test(text)) {
    return templateSummary(article, fallbackSummaryFromTitle(article.title));
  }
  return makeSummary(article.title, rawText);
}

function translateChineseTitle(title, article) {
  return title;
}

function translateChineseSummary(summary, article) {
  return summary;
}

function translateChineseWhy(whyItMatters, article) {
  const value = `${article.title} ${article.summary} ${whyItMatters}`.toLowerCase();
  if (/鸿海|foxconn|jabil|捷普|ems|夏普|sharp/.test(value)) {
    return "This is a competitor and EMS capacity signal; track whether it changes customer coverage, geography, or product mix.";
  }
  if (/苹果|apple|iphone|oled|折叠/.test(value)) {
    return "For the Apple chain, the key is whether new device form factors change component specifications, assembly yield, or supplier qualification.";
  }
  if (/服务器|server|机柜|电源|线缆|连接器|数据中心/.test(value)) {
    return "For Luxshare, the focus should be rack integration, power, thermal, high-speed cable, and connector demand rather than only server brands.";
  }
  if (/印度|india|越南|vietnam|供应链|代工|工厂/.test(value)) {
    return "For Luxshare, this affects regional capacity planning, customer audits, order allocation, and backup supplier strategy.";
  }
  return "For Luxshare, track this only if it changes orders, specifications, qualification paths, customer allocation, or supply risk.";
}

function extractTags(text, companies = []) {
  const tagRules = [
    ["AI", /ai|artificial intelligence/i],
    ["GPU", /gpu|blackwell|cuda/i],
    ["Data Center", /data center|datacenter/i],
    ["Server", /server|rack/i],
    ["HBM", /hbm|memory|dram/i],
    ["Networking", /network|ethernet|infiniband/i],
    ["Smartphone", /iphone|smartphone|mobile|android/i],
    ["Filings", /10-k|10-q|8-k|filing/i],
    ["CAPEX", /capex|capital expenditure/i],
    ["Cloud", /cloud|inference/i],
    ["Automotive", /robotaxi|automotive|driving/i],
    ["Gaming", /geforce now|gaming/i],
    ["Packaging", /advanced packaging|chiplet|osat/i],
    ["Storage", /storage|ssd|nand/i],
    ["Power", /power|pdu|busbar|ups/i],
    ["Cooling", /cooling|liquid|cdu/i]
  ];
  const tags = tagRules.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag);
  return Array.from(new Set([...tags, ...companies.slice(0, 2)])).slice(0, 5);
}

function extractCompanies(text, fallback = []) {
  const companies = companyPatterns.filter(([, pattern]) => pattern.test(text)).map(([company]) => company);
  return Array.from(new Set([...companies, ...fallback])).slice(0, 6);
}

function fallbackChineseSummaryFromTitle(title = "") {
  const value = title.toLowerCase();
  const subject = cleanSummaryText(title)
    .replace(/[。！？；，、\s]+$/g, "")
    .trim();
  const prefix = subject ? `围绕“${subject}”，` : "";
  if (/立讯|luxshare|赴港|上市|港元|ipo/.test(value)) {
    return `${prefix}这条信息反映立讯资本市场与全球化布局进展，重点关注融资节奏、估值预期以及后续产能和客户合作空间。`;
  }
  if (/涨价|降价|成本|价格|报价/.test(value)) {
    return `${prefix}这条信息反映成本或价格变化信号，需要关注是否传导到客户备货、BOM 和供应链议价。`;
  }
  if (/产能|量产|扩产|供应商|订单|良率|爬坡/.test(value)) {
    return `${prefix}这条信息反映供应链产能、订单或供应商位置变化，需要关注客户认证和交付节奏。`;
  }
  if (/半导体|晶圆|封装|hbm|dram|nand|氧化镓|外延|设备|存储器/.test(value)) {
    return `${prefix}这条信息反映半导体供给或技术路线变化，需要关注上游产能、成本和交付节奏。`;
  }
  return `${prefix}这条信息已命中行业硬信号，需要结合原文确认其对需求、供给、成本或客户动作的影响。`;
}

function summarizeChineseSource(title, rawText = "") {
  const sourceText = rawText
    .replaceAll(title, "")
    .replace(/^IT之家\s*\d+\s*月\s*\d+\s*日消息[，,]?\s*/, "")
    .trim();
  const cleaned = conciseText(sourceText, 180);
  if (cleaned && hasChinese(cleaned)) {
    return cleaned;
  }
  return fallbackChineseSummaryFromTitle(title);
}

function analyzeArticle(article, rawText, sourceName) {
  const text = `${article.title} ${rawText || ""}`;
  article.originalLanguage = article.originalLanguage || (hasChinese(article.title) ? "zh" : "en");
  article.signalCategory = classifyText(text, article.sourceId);
  article.industry = inferIndustry(text, article.industry);
  article.sourceWeight = sourceWeightFor(article);
  article.sourceCategory = sourceCategories[article.sourceId] || "discovery";
  article.briefingValue = inferBriefingValue(text);
  article.impactScore = getLuxshareImpactScore(text, article.topic, article);
  article.importance = inferImportance(text, article.topic, article);
  article.summary = article.originalLanguage === "zh" ? summarizeChineseSource(article.title, text) : summarizeArticle(article, text);
  article.whyItMatters = makeWhyItMatters(article);
  article.titleZh = article.originalLanguage === "zh" ? article.title : "";
  article.titleEn = article.originalLanguage === "zh" ? translateChineseTitle(article.title, article) : article.title;
  article.summaryZh = article.originalLanguage === "zh" ? article.summary : "";
  article.summaryEn = article.originalLanguage === "zh" ? translateChineseSummary(article.summary, article) : "";
  article.whyZh = article.originalLanguage === "zh" ? article.whyItMatters : "";
  article.whyEn = article.originalLanguage === "zh" ? translateChineseWhy(article.whyItMatters, article) : "";
  article.tags = extractTags(text, article.companies);
  const displayDecisionText = [
    article.title,
    article.summary,
    ...(article.tags || []),
    ...(article.companies || [])
  ].filter(Boolean).join(" ");
  article.relevance = inferRelevanceLabelFromScore(article.impactScore, displayDecisionText, article);
  article.showByDefault = shouldShowByDefault(article, displayDecisionText);
  return article;
}

function hasChinese(value = "") {
  return /[\u4e00-\u9fa5]/.test(value);
}

async function fetchText(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
  return response.text();
}

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
  return response.json();
}

function parseRssItems(xml) {
  const rssItems = Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)).map((match) => {
    const item = match[0];
    const get = (tag) => {
      const result = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return decodeHtml(result?.[1] || "");
    };

    return {
      title: get("title"),
      link: get("link"),
      publishedAt: toDateString(get("pubDate")),
      description: get("description")
    };
  });

  const atomItems = Array.from(xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)).map((match) => {
    const item = match[0];
    const get = (tag) => {
      const result = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return decodeHtml(result?.[1] || "");
    };
    const href = item.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] || "";
    return {
      title: get("title"),
      link: decodeHtml(href),
      publishedAt: toDateString(get("updated") || get("published")),
      description: get("summary") || get("content")
    };
  });

  return [...rssItems, ...atomItems];
}

async function fetchEditorialRssArticles(sourceConfig) {
  const feeds = await Promise.all(sourceConfig.feedUrls.map((url) => fetchText(url)));
  const items = dedupeArticles(feeds.flatMap(parseRssItems))
    .filter((item) => item.title && item.link && item.publishedAt)
    .filter((item) => isRecentEnough(item.publishedAt, 45))
    .filter((item) => {
      const text = `${item.title} ${sourceConfig.filterTitleOnly ? "" : item.description} ${item.link}`;
      return (!sourceConfig.include || sourceConfig.include.test(text)) && (!sourceConfig.exclude || !sourceConfig.exclude.test(text));
    })
    .slice(0, sourceConfig.limit);

  const articles = await Promise.all(items.map(async (item) => {
      const pageText = sourceConfig.fetchArticlePage ? await fetchArticleText(item.link, sourceConfig.sourceId).catch(() => "") : "";
      const text = `${item.title} ${item.description} ${pageText}`;
      const companies = extractCompanies(text);
      return analyzeArticle({
        id: createId(["real", sourceConfig.sourceId, item.publishedAt, item.title]),
        title: item.title,
        signalCategory: "产品",
        industry: sourceConfig.fallbackIndustry,
        topic: "",
        companies: companies.length ? companies : [sourceConfig.sourceName],
        importance: "中",
        sourceId: sourceConfig.sourceId,
        sourceUrl: item.link,
        publishedAt: item.publishedAt,
        summary: "",
        whyItMatters: "",
        tags: [],
        dataSourceType: "真实采集",
        originalLanguage: sourceConfig.originalLanguage || (hasChinese(item.title) ? "zh" : "en")
      }, text, sourceConfig.sourceName);
    }));

  return articles;
}

async function fetchArticleText(url, sourceId) {
  const html = await fetchText(url, {
    "User-Agent": "Mozilla/5.0 HardwareRadar/0.1",
    Accept: "text/html,application/xhtml+xml"
  });
  return extractArticleText(html, sourceId);
}

function extractArticleText(html, sourceId) {
  const cleaned = decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
  );

  if (sourceId === "ithome") {
    const markers = [
      /IT之家\s*\d+\s*月\s*\d+\s*日消息[\s\S]{0,900}/,
      /据[\s\S]{0,700}/
    ];
    const match = markers.map((pattern) => cleaned.match(pattern)?.[0] || "").find((value) => value.length > 80);
    if (match) {
      return match.replace(/\s+/g, " ").trim();
    }
  }

  return cleaned.replace(/\s+/g, " ").slice(0, 1200).trim();
}

async function fetchNvidiaArticles() {
  const feedUrls = [
    "https://nvidianews.nvidia.com/releases.xml",
    "https://nvidianews.nvidia.com/cats/cloud.xml",
    "https://nvidianews.nvidia.com/cats/enterprise_hpc.xml",
    "https://nvidianews.nvidia.com/cats/ai_platforms_deployment.xml"
  ];

  const feeds = await Promise.all(feedUrls.map((url) => fetchText(url)));
  return dedupeArticles(feeds.flatMap(parseRssItems))
    .filter((item) => item.title && item.link && item.publishedAt)
    .filter((item) => isRecentEnough(item.publishedAt, 45))
    .slice(0, 12)
    .map((item) => {
      const text = `${item.title} ${item.description}`;
      return analyzeArticle({
        id: createId(["real", "nvidia", item.publishedAt, item.title]),
        title: item.title,
        signalCategory: "产品",
        industry: "数据中心硬件",
        topic: "",
        companies: ["NVIDIA"],
        importance: "中",
        sourceId: "nvidia_newsroom",
        sourceUrl: item.link,
        publishedAt: item.publishedAt,
        summary: "",
        whyItMatters: "",
        tags: [],
        dataSourceType: "真实采集"
      }, text, "NVIDIA Newsroom");
    });
}

function secFilingUrl(cik, accessionNumber, primaryDocument) {
  const cikNoLeadingZeros = String(Number(cik));
  const accessionNoDashes = accessionNumber.replaceAll("-", "");
  return `https://www.sec.gov/Archives/edgar/data/${cikNoLeadingZeros}/${accessionNoDashes}/${primaryDocument}`;
}

async function fetchSecArticles() {
  const forms = new Set(["10-K", "10-Q", "8-K"]);
  const results = [];

  for (const company of watchlist) {
    const paddedCik = company.cik.padStart(10, "0");
    const url = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;
    const data = await fetchJson(url, secHeaders);
    const recent = data.filings?.recent || {};
    const count = Math.min(recent.form?.length || 0, 20);

    for (let index = 0; index < count; index += 1) {
      const form = recent.form[index];
      if (!forms.has(form)) {
        continue;
      }

      const filingDate = recent.filingDate[index];
      const accessionNumber = recent.accessionNumber[index];
      const primaryDocument = recent.primaryDocument[index];
      const title = `${company.company} filed ${form}`;
      const text = `${title} ${recent.primaryDocDescription?.[index] || ""}`;
      const article = analyzeArticle({
        id: createId(["real", "sec", company.ticker, form, filingDate, accessionNumber]),
        title,
        signalCategory: "财报",
        industry: company.industry,
        topic: form,
        companies: [company.company],
        importance: inferImportance(text, form),
        sourceId: "sec_edgar",
        sourceUrl: secFilingUrl(company.cik, accessionNumber, primaryDocument),
        publishedAt: filingDate,
        summary: "",
        whyItMatters: "",
        tags: [],
        dataSourceType: "真实采集"
      }, `${text} filing`, "SEC EDGAR");
      results.push(article);
    }
  }

  return results.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 40);
}

function dedupeArticles(articles) {
  const seenUrl = new Set();
  const seenTitle = new Set();
  const seenSemantic = new Set();
  return articles.filter((article) => {
    const urlKey = (article.sourceUrl || article.link || "").replace(/[?#].*$/, "");
    const titleKey = normalizeTitle(article.title);
    const semanticKey = getSemanticDedupeKey(article);
    if (
      (urlKey && seenUrl.has(urlKey)) ||
      (titleKey && seenTitle.has(titleKey)) ||
      (semanticKey && seenSemantic.has(semanticKey))
    ) {
      return false;
    }
    if (urlKey) seenUrl.add(urlKey);
    if (titleKey) seenTitle.add(titleKey);
    if (semanticKey) seenSemantic.add(semanticKey);
    return true;
  });
}

function getSemanticDedupeKey(article) {
  const value = `${article.title} ${article.summary || ""}`.toLowerCase();
  if (/18a-p|diamond rapids/.test(value)) {
    return "intel_18a_diamond_rapids";
  }
  if (/hpe ai factory|ai factory portfolio/.test(value)) {
    return "hpe_ai_factory";
  }
  if (/blackwell.*agentic ai|agentic ai infrastructure benchmark/.test(value)) {
    return "blackwell_agentic_benchmark";
  }
  if (/retail ssd market|pcie 6\.0 ssd controller|nand shortages/.test(value)) {
    return "ai_datacenter_nand_shortage";
  }
  return "";
}

function getArticleValidationText(article = {}) {
  return [
    article.title,
    article.titleZh,
    article.titleEn,
    article.summary,
    article.summaryZh,
    article.summaryEn,
    ...(article.tags || []),
    ...(article.companies || [])
  ].filter(Boolean).join(" ");
}

function hasSummarySafetyIssue(article = {}, value = "") {
  const summary = cleanSummaryText(value);
  if (!summary) {
    return false;
  }
  if (/\b(?:The post|appeared first on|Read more|Continue reading)\b/i.test(summary)) {
    return true;
  }
  if (article.originalLanguage === "en" && (isTitleReplay(article.title || "", summary) || hasBrokenEnglishSummaryStart(summary))) {
    return true;
  }
  if (hasChinese(summary) && (hasBrokenChineseSummaryStart(summary) || hasIncompleteEnding(summary))) {
    return true;
  }
  return false;
}

function repairSummaryFields(article = {}) {
  const repaired = { ...article };
  let changed = false;
  const fallback = repaired.originalLanguage === "zh"
    ? fallbackChineseSummaryFromTitle(repaired.title || "")
    : fallbackSummaryFromTitle(repaired.title || "");

  for (const field of ["summary", "summaryZh", "summaryEn"]) {
    if (!repaired[field]) {
      continue;
    }
    let value = cleanSummaryText(repaired[field]);
    if (repaired.originalLanguage === "en") {
      value = stripCompleteTitlePrefix(repaired.title || "", value);
    }
    if (hasSummarySafetyIssue(repaired, value)) {
      value = fallback;
    }
    if (value !== repaired[field]) {
      repaired[field] = value;
      changed = true;
    }
  }

  if (!repaired.summary || hasSummarySafetyIssue(repaired, repaired.summary)) {
    repaired.summary = fallback;
    changed = true;
  }

  return { article: repaired, changed };
}

function getDefaultSummaryIssue(article = {}) {
  if (article.showByDefault !== true) {
    return "";
  }
  const title = article.titleZh || article.title || article.titleEn || "";
  const summary = article.summary || article.summaryZh || article.summaryEn || "";
  if (!summary) {
    return "默认 feed 文章缺少摘要";
  }
  if (normalizeForReplay(title) === normalizeForReplay(summary)) {
    return "默认 feed 摘要等于标题";
  }
  if (article.originalLanguage === "en" && isTitleReplay(title, summary)) {
    return "英文摘要复读标题";
  }
  if (article.originalLanguage === "en" && hasBrokenEnglishSummaryStart(summary)) {
    return "英文摘要存在残缺开头";
  }
  if (/\b(?:The post|appeared first on|Read more|Continue reading)\b/i.test(summary)) {
    return "摘要包含 RSS footer";
  }
  const cleanSummary = cleanSummaryText(summary);
  if (article.sourceId !== "sec_edgar") {
    if (hasChinese(cleanSummary) && cleanSummary.length < 20) {
      return "默认 feed 中文摘要过短";
    }
    if (!hasChinese(cleanSummary) && cleanSummary.length < 50) {
      return "默认 feed 英文摘要过短";
    }
  }
  return "";
}

function hasIthomeTitleSummaryMismatch(article = {}) {
  if (article.sourceId !== "ithome") {
    return false;
  }
  const title = `${article.title || ""} ${article.titleZh || ""}`;
  const summary = `${article.summary || ""} ${article.summaryZh || ""} ${article.summaryEn || ""}`;
  return ithomeAutomotiveTitleSignal.test(title) && sportsOrEntertainmentSummarySignal.test(summary);
}

function getArticleLevelValidationHideReason(article = {}) {
  const text = getArticleValidationText(article);
  const briefingValue = Array.isArray(article.briefingValue) ? article.briefingValue : [];
  const defaultSummaryIssue = getDefaultSummaryIssue(article);
  if (defaultSummaryIssue) {
    return defaultSummaryIssue;
  }
  if (article.showByDefault === true && briefingValue.length === 0) {
    return "默认 feed 文章缺少 briefingValue";
  }
  if (article.relevance === "高" && briefingValue.length === 0) {
    return "高相关文章缺少 briefingValue";
  }
  if (article.showByDefault === true && hasAutomotiveValidationSignal(text) && !automotiveLuxshareFitSignal.test(text) && !semiconductorAutomotiveHardSignal.test(text)) {
    return "汽车泛新闻缺少立讯汽车硬件或半导体硬信号";
  }
  if (article.showByDefault === true && hasSoftwareOnlySignal(text)) {
    return "软件栈信息缺少硬件或供应链落点";
  }
  if (article.showByDefault === true && !hasActionableWeakDefaultFeedException(article, text)) {
    return "弱信号文章未命中强业务落点";
  }
  if (article.relevance === "高" && !hasActionableWeakDefaultFeedException(article, text)) {
    return "弱信号文章不应标记高相关";
  }
  if (article.showByDefault === true && hasTechnicalExplainerWithoutNewsEvent(text)) {
    return "技术解读/指南类内容未绑定真实新闻事件";
  }
  if (article.relevance === "高" && hasTechnicalExplainerWithoutNewsEvent(text)) {
    return "技术解读/指南类内容不应标记高相关";
  }
  if (article.showByDefault === true && hasWeakTopicWithoutLandingSignal(text)) {
    return "弱相关主题未命中明确业务落点";
  }
  if (article.relevance === "高" && hasWeakTopicWithoutLandingSignal(text)) {
    return "弱相关主题不应标记高相关";
  }
  if (article.sourceId === "ithome" && article.showByDefault === true && !hasCoreIndustrySignal(text)) {
    return "IT之家默认文章缺少核心产业信号";
  }
  if (article.sourceId === "ithome" && article.showByDefault === true && !hasIthomeHardSignal(text)) {
    return "IT之家默认文章缺少硬供应链信号";
  }
  if (article.sourceId === "ithome" && article.showByDefault === true && hasIthomeLowValueSignal(text)) {
    return "低价值 IT之家文章不应进入默认 feed";
  }
  if (article.sourceId === "ithome" && article.relevance === "高" && !hasIthomeHardSignal(text)) {
    return "IT之家文章缺少硬信号，不应标记高相关";
  }
  if (article.sourceId === "ithome" && article.relevance === "高" && hasIthomeLowValueSignal(text)) {
    return "低价值 IT之家文章不应标记高相关";
  }
  if (hasIthomeTitleSummaryMismatch(article) && (article.showByDefault === true || article.relevance === "高")) {
    return "IT之家标题与摘要主题错配";
  }
  if (hasIrrelevantConsumerOrSocialNoise(text) && (article.relevance === "高" || article.showByDefault === true)) {
    return "消费/社会噪音不适合默认行业简报";
  }
  if (article.showByDefault === true && hasDefaultFeedNegativeSignal(text) && !hasStrongCoreIndustrySignal(text)) {
    return "命中默认 feed 禁入弱信号且缺少强产业信号";
  }
  if (article.showByDefault === true && explicitDefaultFeedBans.test(text)) {
    return "显式禁入内容不应进入默认 feed";
  }
  if (article.sourceId === "sec_edgar" && article.showByDefault === true && !hasSecFilingHardSignal(text)) {
    return "SEC 原始 filing 未抽到具体业务硬信号";
  }
  if (article.sourceId === "sec_edgar" && article.showByDefault === true && genericSecFilingAlert.test(article.summary || "")) {
    return "泛化 SEC filing alert 不应进入默认 feed";
  }
  if (article.sourceId === "sec_edgar" && article.relevance === "高" && !hasSecFilingHardSignal(text)) {
    return "SEC 原始 filing 缺少硬信号，不应标记高相关";
  }
  if (article.relevance === "高" && genericCompanyOnlyPattern.test(text) && !hasStrongCoreIndustrySignal(text)) {
    return "高相关判断仅依赖泛公司/技术词";
  }
  return "";
}

function getSafetyHideReason(article = {}) {
  const text = getArticleValidationText(article);
  const defaultSummaryIssue = getDefaultSummaryIssue(article);
  if (defaultSummaryIssue) {
    return defaultSummaryIssue;
  }
  if (/leather jacket|charity auction|trademark leather jacket/i.test(text)) {
    return "公司人物轶事或慈善拍卖，不属于硬件产业链信号";
  }
  if (isLowManagementValue(text)) {
    return getLowValueReason(article, text) || "管理层决策价值低";
  }
  if (isRawSecFiling(article) && !hasSecFilingHardSignal(text)) {
    return "SEC 原始 filing 未抽到具体业务硬信号";
  }
  if (hasQuarantineWeakTopicWithoutLandingSignal(text)) {
    return "弱相关主题未命中明确业务落点";
  }
  if (!hasActionableWeakDefaultFeedException(article, text)) {
    return "弱信号文章未命中强业务落点";
  }
  if (hasDefaultFeedNegativeSignal(text) && !hasStrongCoreIndustrySignal(text)) {
    return "命中默认 feed 禁入弱信号且缺少强产业信号";
  }
  if (hasSoftwareOnlySignal(text)) {
    return "软件栈信息缺少硬件或供应链落点";
  }
  if (hasIrrelevantConsumerOrSocialNoise(text)) {
    return "消费/社会噪音不适合默认行业简报";
  }
  if (article.sourceId === "ithome" && shouldHideIthomeByDefault(article, text)) {
    return "IT之家文章缺少明确硬信号或命中低价值内容";
  }
  if (article.showByDefault === true && automotiveNoiseSignal.test(text) && !luxshareBusinessFitSignal.test(text) && !semiconductorAutomotiveHardSignal.test(text)) {
    return "汽车泛新闻缺少立讯相关汽车硬件或半导体硬信号";
  }
  return "";
}

function evaluateArticleSafety(article = {}) {
  const validationReason = getArticleLevelValidationHideReason(article);
  if (validationReason) {
    return {
      shouldQuarantine: true,
      reason: validationReason,
      recommendedRelevance: article.relevance === "高" ? "中" : article.relevance || "低"
    };
  }

  const safetyReason = getSafetyHideReason(article);
  if (safetyReason) {
    return {
      shouldQuarantine: true,
      reason: safetyReason,
      recommendedRelevance: article.relevance === "高" ? "中" : article.relevance || "低"
    };
  }

  return {
    shouldQuarantine: false,
    reason: "",
    recommendedRelevance: article.relevance || "低"
  };
}

function applyArticleSafetyPass(articles) {
  const diagnostics = {
    droppedArticles: [],
    hiddenBySafetyPass: []
  };

  const safeArticles = articles.map((article) => {
    const { article: repairedArticle } = repairSummaryFields(article);
    let safeArticle = repairedArticle;
    const reasons = [];

    const safetyEvaluation = evaluateArticleSafety(safeArticle);
    if (safetyEvaluation.shouldQuarantine) {
      reasons.push(safetyEvaluation.reason);
    }

    let articleText = getArticleValidationText(safeArticle);
    if ((safeArticle.showByDefault === true || safeArticle.relevance === "高") && hasLuxshareBusinessFit(articleText) && !safeArticle.briefingValue?.includes("Luxshare business fit")) {
      if (safetyEvaluation.shouldQuarantine) {
        reasons.push("移除不可靠 Luxshare-fit 高相关触发条件");
      } else {
        safeArticle = {
          ...safeArticle,
          briefingValue: Array.from(new Set([...(safeArticle.briefingValue || []), "Luxshare business fit"]))
        };
      }
    }

    if (reasons.length) {
      safeArticle = {
        ...safeArticle,
        showByDefault: false,
        relevance: safetyEvaluation.recommendedRelevance || (safeArticle.relevance === "高" ? "中" : safeArticle.relevance),
        lowValueReason: safeArticle.lowValueReason || reasons.join("；")
      };
      diagnostics.hiddenBySafetyPass.push({
        id: safeArticle.id,
        title: safeArticle.title,
        reason: reasons.join("；")
      });
    }

    return safeArticle;
  });

  if (diagnostics.hiddenBySafetyPass.length > articles.length * 0.6) {
    console.warn(`Safety pass quarantined many articles: ${diagnostics.hiddenBySafetyPass.length}/${articles.length}`);
  }

  return { articles: safeArticles, diagnostics };
}

function applyBriefingSelection(articles) {
  return articles.map((article) => {
    const articleText = [
      article.title,
      article.titleZh,
      article.titleEn,
      article.summary,
      article.summaryZh,
      article.summaryEn,
      ...(article.tags || []),
      ...(article.companies || [])
    ].filter(Boolean).join(" ");
    const briefingValue = Array.isArray(article.briefingValue) ? article.briefingValue : [];
    const hasUnexplainedLuxshareFit = hasLuxshareBusinessFit(articleText) && !briefingValue.includes("Luxshare business fit");
    return {
      ...article,
      showByDefault:
        (article.relevance === "高" || article.relevance === "中") &&
        !article.lowValueReason &&
        briefingValue.length > 0 &&
        !hasWeakTopicWithoutLandingSignal(articleText) &&
        !hasUnexplainedLuxshareFit
    };
  });
}

async function main() {
  const tasks = [
    ["NVIDIA Newsroom", fetchNvidiaArticles],
    ["SEC EDGAR", fetchSecArticles],
    ...editorialRssSources.map((sourceConfig) => [
      sourceConfig.sourceName,
      () => fetchEditorialRssArticles(sourceConfig)
    ])
  ];
  const batches = await Promise.allSettled(tasks.map(([, task]) => task()));
  const dedupedArticles = dedupeArticles(batches.flatMap((batch) => (batch.status === "fulfilled" ? batch.value : [])));
  const safetyResult = applyArticleSafetyPass(dedupedArticles);
  const articles = applyBriefingSelection(safetyResult.articles);
  const failures = batches
    .map((batch, index) => (batch.status === "rejected" ? `${tasks[index][0]}: ${batch.reason.message}` : ""))
    .filter(Boolean);

  const file = `// Generated by scripts/fetch_real_sources.mjs\nconst radarGeneratedArticles = ${JSON.stringify(articles, null, 2)};\n`;
  await fs.writeFile(outputPath, file, "utf8");
  await updateTaxonomyDate(collectionAsOfDate, collectionLastUpdatedAt, getLatestArticleDate(articles));

  console.log(`Generated ${articles.length} real articles at ${outputPath.pathname}`);
  console.log(`droppedArticles: ${safetyResult.diagnostics.droppedArticles.length}`);
  console.log(`hiddenBySafetyPass: ${safetyResult.diagnostics.hiddenBySafetyPass.length}`);
  for (const item of safetyResult.diagnostics.droppedArticles) {
    console.log(`- dropped ${item.id}: ${item.title} — ${item.reason}`);
  }
  for (const item of safetyResult.diagnostics.hiddenBySafetyPass) {
    console.log(`- hidden ${item.id}: ${item.title} — ${item.reason}`);
  }
  if (failures.length) {
    console.warn("Fetch failures:");
    failures.forEach((failure) => console.warn(`- ${failure}`));
  }
}

function getLatestArticleDate(articles) {
  return articles.map((article) => article.publishedAt).filter(Boolean).sort().at(-1) || "";
}

function upsertTaxonomyStringField(taxonomy, fieldName, value) {
  const fieldPattern = new RegExp(`${fieldName}: "\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}:\\d{2}\\+08:00)?"`);
  if (fieldPattern.test(taxonomy)) {
    return taxonomy.replace(fieldPattern, `${fieldName}: "${value}"`);
  }
  return taxonomy.replace(/asOfDate: "\d{4}-\d{2}-\d{2}",/, `asOfDate: "${collectionAsOfDate}",\n  ${fieldName}: "${value}",`);
}

async function updateTaxonomyDate(asOfDate, lastUpdatedAt, latestArticleDate) {
  const taxonomy = await fs.readFile(taxonomyPath, "utf8");
  let updated = taxonomy.replace(/asOfDate: "\d{4}-\d{2}-\d{2}"/, `asOfDate: "${asOfDate}"`);
  updated = upsertTaxonomyStringField(updated, "lastUpdatedAt", lastUpdatedAt);
  updated = upsertTaxonomyStringField(updated, "latestArticleDate", latestArticleDate || asOfDate);
  await fs.writeFile(taxonomyPath, updated, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
