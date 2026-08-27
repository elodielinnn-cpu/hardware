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
const gameContentSignal = /video game|gaming title|game studio|game ip|racing game|need for speed|burnout|battlefield|criterion|electronic arts|ea games|esports?|game release|game development|game launch|players?|concurrent players?|fps|rpg|steam|console|halo|warframe|campaign evolved|goes gold|gta vi|grand theft auto|palworld|dlss.*gaming|gaming.*dlss|geforce driver.*gaming|游戏工作室|赛车游戏|电竞/i;
const softwarePlatformSignal = /omniverse|free for production use|software platform|production use|software pricing|software license|platform free|软件平台|软件授权|软件免费|商业策略/i;
const nvidiaSoftwareEcosystemSignal = /\b(?:dlss|graphics demo|simulation demo|siggraph graphics|siggraph|nemotron|open models?|cosmos|robotics software|ai agent framework|developer software|sdk|benchmark-only|model benchmark|graphics and simulation)\b/i;
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
const nvidiaHardwareLandingSignal = /data center|datacenter|ai factory|ai infrastructure|data center gpu|ai server|gpu deployment|cloud deployment|gb300|blackwell|rubin|vera rubin|ai accelerator|rack-scale|rack scale|nvlink|spectrum|ethernet|infiniband|networking|network switch|ethernet switch|spectrum switch|hbm|cowos|ddr|nand|ssd|memory|semiconductor|foundry|packaging|advanced packaging|cpo|power supply|power delivery|800vdc|800v dc|liquid cooling|server|production|shipment|deployment|customer capex|plant|manufacturing plant|factory deployment|industrial deployment|hardware supplier|supplier|order|capacity|csp deployment/i;
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
  ["Technology shift", /new architectur(?:e|al)|next-generation architecture|platform shift|technology roadmap|blackwell|gb300|gb200|rubin|nvl72|nvl4|liquid cooling|cold plate|cdu|busbar|pdu|connector|interconnect|optical module|cpo|pcie|epyc|dragonfly|ai accelerator|advanced packaging|hbm|ddr\d*|rdimm|mrdimm|rack-scale|800v dc|epitaxy|epitaxial|compound semiconductor|wide bandgap|ultra-wide bandgap|gallium oxide|ga2o3|新架构|新工艺|新材料|技术路线|液冷|冷板|电源|连接器|互连|光模块|先进封装|机柜|外延|同质外延|化合物半导体|宽禁带|超宽禁带|氧化镓/i],
  ["Risk event", /risk|shortage|attack|breach|investigation|tariff|export control|geopolitical|风险|短缺|攻击|调查|关税|出口管制|合规/i]
];

const customerEntitySignal = /\b(?:customer|apple|nvidia|amd|qualcomm|microsoft|google|meta|amazon|aws|openai|oracle|dell|hpe|tesla)\b|客户|苹果|英伟达|微软|谷歌|亚马逊/i;
const competitorEntitySignal = /\b(?:foxconn|hon hai|quanta|wiwynn|jabil|pegatron|wistron|inventec|compal|byd electronic|goertek|aac|lens technology|ems|odm|jdm)\b|富士康|鸿海|广达|纬颖|捷普|和硕|纬创|英业达|仁宝|比亚迪电子|歌尔|瑞声|蓝思/i;
const customerActionSignal = /\b(?:adopt(?:s|ed|ing)?|deploy(?:s|ed|ing|ment)?|order(?:s|ed|ing)?|purchase(?:s|d|ing)?|procure(?:s|d|ment)?|qualif(?:y|ies|ied|ication)|validate(?:s|d|ion)?|ramp(?:s|ed|ing)?|ship(?:s|ped|ment|ments)?|launch(?:es|ed|ing)?|select(?:s|ed|ion)?|switch(?:es|ed|ing)?|award(?:s|ed)?|contract(?:s|ed)?|mass produc(?:e|es|ed|tion)|standardiz(?:e|es|ed|ation))\b|采用|部署|订单|采购|集采|认证|量产|爬坡|出货|选用|切换|中标|合同|备货/i;
const competitorActionSignal = /\b(?:open(?:s|ed|ing)?|build(?:s|ing)?|expand(?:s|ed|ing|ion)?|invest(?:s|ed|ing|ment)?|acquir(?:e|es|ed|ing)|win(?:s|ning)?|order(?:s|ed)?|contract(?:s|ed)?|ramp(?:s|ed|ing)?|mass produc(?:e|es|ed|tion)|capacity|plant|factory|manufactur(?:e|es|ed|ing))\b|开工|开厂|建厂|扩产|投资|收购|订单|中标|合同|量产|爬坡|产能|工厂|制造|招工/i;
const customerMoveSignal = /(?:\b(?:customer|apple|nvidia|amd|qualcomm|microsoft|google|meta|amazon|aws|openai|oracle|dell|hpe|tesla)\b|客户|苹果|英伟达|微软|谷歌|亚马逊).{0,100}(?:adopt(?:s|ed|ing)?|deploy(?:s|ed|ing|ment)?|order(?:s|ed|ing)?|purchase(?:s|d|ing)?|procure(?:s|d|ment)?|qualif(?:y|ies|ied|ication)|validate(?:s|d|ion)?|ramp(?:s|ed|ing)?|ship(?:s|ped|ment|ments)?|launch(?:es|ed|ing)?|select(?:s|ed|ion)?|switch(?:es|ed|ing)?|award(?:s|ed)?|contract(?:s|ed)?|mass produc(?:e|es|ed|tion)|standardiz(?:e|es|ed|ation)|采用|部署|订单|采购|集采|认证|量产|爬坡|出货|选用|切换|中标|合同|备货)/i;
const competitorMoveSignal = /(?:\b(?:foxconn|hon hai|quanta|wiwynn|jabil|pegatron|wistron|inventec|compal|byd electronic|goertek|aac|lens technology|ems|odm|jdm)\b|富士康|鸿海|广达|纬颖|捷普|和硕|纬创|英业达|仁宝|比亚迪电子|歌尔|瑞声|蓝思).{0,100}(?:open(?:s|ed|ing)?|build(?:s|ing)?|expand(?:s|ed|ing|ion)?|invest(?:s|ed|ing|ment)?|acquir(?:e|es|ed|ing)|win(?:s|ning)?|order(?:s|ed)?|contract(?:s|ed)?|ramp(?:s|ed|ing)?|mass produc(?:e|es|ed|tion)|capacity|plant|factory|manufactur(?:e|es|ed|ing)|开工|开厂|建厂|扩产|投资|收购|订单|中标|合同|量产|爬坡|产能|工厂|制造|招工)/i;
const negatedCustomerMoveSignal = /\b(?:no|not|without)\s+(?:customer\s+)?(?:adoption|deployment|order|purchase|qualification|validation|shipment|mass production)\b|尚无客户采用|没有客户采用|未获客户采用|尚未部署|尚未量产/i;
const capitalAllocationSignal = /\b(?:capex|capital expenditure|investment|invests|invested|acquisition|acquires|acquired|merger|ipo|fundraising|financing)\b|资本开支|投资|收购|并购|上市|融资/i;
const directLuxshareChainSignal = /\b(?:optical module|optical wafer|cpo|co-packaged optics|optical interconnect|high-speed interconnect|connector|high-speed cable|copper cable|wire harness|wiring harness|acoustic|speaker|microphone|camera module|lens module|liquid cooling|cold plate|cdu|thermal management|power supply|power module|power delivery architecture|pdu|busbar|server system|server manufacturing|server assembly|ai server system|server rack|ai rack|rack-scale system|rack-scale architecture|integrated rack|full-rack system|fatp|final assembly|advanced packaging|automotive electrical architecture|vehicle electrical architecture|zonal architecture|48v|high-voltage harness|emi|emc)\b|光模块|光学晶圆|共封装光学|光互连|高速互连|连接器|高速线缆|铜缆|线束|声学|扬声器|麦克风|摄像头模组|光学模组|镜头模组|液冷|冷板|热管理|电源|供电架构|服务器整机|AI\s*服务器整机|服务器制造|服务器组装|机柜系统|整机柜|整机组装|先进封装|汽车电气架构|区域架构|高压线束|电磁屏蔽|电磁兼容/i;
const customerProductChainSignal = /\b(?:iphone|airpods|apple watch|vision pro|ai server|ai systems?|data center server|gpu rack|server rack|rack-scale platform|ai factory|cpo|optical module|liquid cooling|power delivery|800vdc)\b|苹果供应链|iPhone\s*供应链|AI\s*服务器|AI\s*系统|数据中心服务器|整机柜|光模块|液冷|电源|连接器|声学|光学|线束/i;
const memoryComponentSignal = /\b(?:ddr\d?|dram|hbm|nand|lpddr|server memory|enterprise ssd|data center memory)\b|服务器内存|企业级\s*SSD|数据中心内存|存储器/i;
const adjacentDataCenterComponentSignal = /\b(?:smartnic|dpu|network interface card|network adapter|nic|gpu|ai accelerator|accelerator card|cpu|server processor|server memory|ddr\d?|dram|mrdimm|rdimm|enterprise ssd|enterprise storage|storage array|storage appliance|add-in card|board-level specification|board specification)\b|智能网卡|数据处理器|网卡|AI\s*加速卡|加速卡|服务器处理器|服务器内存|企业级\s*SSD|企业存储|存储阵列|板卡参数/i;
const adjacentComponentBusinessLandingSignal = /\b(?:luxshare|customer demand|customer order|manufacturing order|contract manufacturing|odm opportunity|ems opportunity|bom change|bom impact|supply shortage impact|procurement impact|supplier change|volume production order)\b|立讯|客户需求|客户订单|制造订单|代工机会|BOM\s*(?:变化|影响)|短缺影响|采购影响|供应商切换|量产订单/i;
const systemLevelDataCenterArchitectureSignal = /(?:\b(?:gpu[- ]to[- ]rack|rack-scale architecture|system-level architecture|system-level design|integrated rack architecture|full-rack architecture)\b|整机柜架构|系统级架构|系统级设计).{0,180}(?:\b(?:power delivery|power architecture|interconnect|connector|cable|liquid cooling|thermal management)\b|供电|电源架构|互连|连接器|线缆|液冷|热管理)|(?:\b(?:power delivery|power architecture|interconnect|connector|cable|liquid cooling|thermal management)\b|供电|电源架构|互连|连接器|线缆|液冷|热管理).{0,180}(?:\b(?:gpu[- ]to[- ]rack|rack-scale architecture|system-level architecture|system-level design|integrated rack architecture|full-rack architecture)\b|整机柜架构|系统级架构|系统级设计)/i;
const manufacturingPolicyImpactSignal = /(?:climate|energy|environmental|trade|tariff|export|气候|能源|环保|贸易|关税|出口).{0,100}(?:electronics manufacturing|electronic components?|supply chain|customer production|manufacturing cost|电子制造|电子元件|供应链|客户生产|制造成本)|(?:electronics manufacturing|electronic components?|supply chain|customer production|manufacturing cost|电子制造|电子元件|供应链|客户生产|制造成本).{0,100}(?:climate|energy|environmental|trade|tariff|export|气候|能源|环保|贸易|关税|出口)/i;
const supplyCostImpactSignal = /\b(?:shortage|supply constraint|allocation|price hike|price increase|prices? surge|cost pressure|bom increase|capacity constraint|delivery delay|inventory correction)\b|短缺|供应受限|配额|涨价|价格上涨|成本压力|BOM\s*上涨|产能受限|交付延迟|库存调整/i;
const materialBusinessActionSignal = /\b(?:order|orders|backlog|ship|ships|shipped|shipment|shipments|mass production|capacity|expansion|production ramp|supplier change|supply chain shift|manufacturing transfer|plant|factory|fab|customer validation|qualification|deployment|adoption)\b|订单|在手订单|出货|量产|产能|扩产|产能爬坡|供应商切换|供应链调整|产能迁移|工厂|晶圆厂|客户认证|部署|采用/i;
const technologyIncrementSignal = /\b(?:new|next-generation|next generation|novel|breakthrough|architecture|roadmap|new material|new process|process node|performance improvement|efficiency improvement|power reduction|cost reduction|yield improvement|higher density|smaller footprint)\b|新技术|新方向|新架构|新材料|新工艺|新路线|突破|性能提升|效率提升|功耗降低|成本降低|良率提升|密度提升|尺寸缩小/i;
const quantifiedScaleSignal = /\b(?:at scale|large-scale|mass deployment|volume production|hundreds of thousands|millions?|record shipments?|national ai infrastructure|major customer)\b|规模部署|大规模|批量生产|数十万|百万|创纪录出货|国家级\s*AI\s*基础设施|主要客户/i;
const significantPriceSupplySignal = /(?:price|cost|价格|成本).{0,24}(?:surge|jump|increase|rise|上涨|大涨|攀升|\d+(?:\.\d+)?\s*%)|(?:shortage|supply constraint|短缺|供应受限)/i;
const majorCapacityAllocationSignal = /\b(?:new plant|new factory|opens? .*plant|capacity expansion|manufacturing transfer|supply chain shift|major investment|capex program|acquisition)\b|新工厂|新厂|扩产|产能迁移|供应链调整|重大投资|资本开支计划|收购/i;
const scaledCustomerChangeSignal = /(?:customer|apple|nvidia|amd|microsoft|google|meta|amazon|aws|openai|oracle|dell|hpe|客户|苹果|英伟达|微软|谷歌|亚马逊).{0,80}(?:at scale|mass deployment|major order|platform switch|大规模|规模部署|重大订单|平台切换)|(?:at scale|mass deployment|major order|platform switch|大规模|规模部署|重大订单|平台切换).{0,80}(?:customer|apple|nvidia|amd|microsoft|google|meta|amazon|aws|openai|oracle|dell|hpe|客户|苹果|英伟达|微软|谷歌|亚马逊)/i;
const quantifiedBreakthroughSignal = /(?:performance|efficiency|power|cost|yield|性能|效率|功耗|成本|良率).{0,40}(?:\d+(?:\.\d+)?\s*%|\d+(?:\.\d+)?x|record|breakthrough|提升|降低|突破)/i;
const majorOrderSignal = /(?:order|orders|backlog|contract|订单|在手订单|合同).{0,60}(?:\$|€|£|¥|krw|rmb|cny|\d+(?:\.\d+)?\s*(?:billion|million|trillion|bn|mn|b|m|亿|万亿)|record|创新高)|(?:\$|€|£|¥|krw|rmb|cny|\d+(?:\.\d+)?\s*(?:billion|million|trillion|bn|mn|b|m|亿|万亿)).{0,60}(?:order|orders|backlog|contract|订单|在手订单|合同)/i;
const quantifiedCapitalExpansionSignal = /(?:investment|capex|expansion|投资|资本开支|扩产).{0,60}(?:\$|€|£|¥|krw|rmb|cny|\d+(?:\.\d+)?\s*(?:billion|million|trillion|bn|mn|b|m|亿|万亿))|(?:\$|€|£|¥|krw|rmb|cny|\d+(?:\.\d+)?\s*(?:billion|million|trillion|bn|mn|b|m|亿|万亿)).{0,60}(?:investment|capex|expansion|投资|资本开支|扩产)/i;
const technologyProductionSignal = /(?:cpo|co-packaged optics|advanced packaging|optical wafer|compound semiconductor|wide bandgap|gallium oxide|wafer|共封装光学|先进封装|光学晶圆|化合物半导体|宽禁带|氧化镓|晶圆).{0,100}(?:enters? mass production|starts? mass production|commenced production|volume production|mass-production line|进入量产|开始量产|投产|量产线)|(?:enters? mass production|starts? mass production|commenced production|volume production|mass-production line|进入量产|开始量产|投产|量产线).{0,100}(?:cpo|co-packaged optics|advanced packaging|optical wafer|compound semiconductor|wide bandgap|gallium oxide|wafer|共封装光学|先进封装|光学晶圆|化合物半导体|宽禁带|氧化镓|晶圆)/i;
const nationalScaleProjectSignal = /\b(?:national ai infrastructure|sovereign ai infrastructure|government-led ai infrastructure|national computing infrastructure)\b|国家级\s*(?:AI|人工智能|算力)\s*基础设施|国家人工智能基础设施/i;
const nationalProjectHardwareLandingSignal = /\b(?:server manufacturing|server supplier|server order|rack|rack-scale|power supply|power distribution|liquid cooling|connector|interconnect|optical module|cpo|co-packaged optics)\b|服务器制造|服务器供应商|服务器订单|机柜|整机柜|电源|液冷|连接器|互连|光模块|共封装光学/i;
const dataCenterSecurityOrGeopoliticalSignal = /(?:data center|datacenter|cloud site|数据中心|云设施).{0,120}(?:cyberattack|attack|breach|missile|war|geopolitical|security incident|攻击|导弹|战争|地缘|安全事件)|(?:cyberattack|attack|breach|missile|war|geopolitical|security incident|攻击|导弹|战争|地缘|安全事件).{0,120}(?:data center|datacenter|cloud site|数据中心|云设施)/i;
const explicitHardwareBusinessConsequenceSignal = /\b(?:hardware supply (?:change|disruption|shortage)|capex (?:change|cut|increase|delay)|expansion (?:change|delay|cancellation)|equipment procurement|hardware replacement|replacement demand|supply chain disruption|delivery disruption|cost increase|capital spending change)\b|硬件供应变化|资本开支调整|扩建调整|设备采购变化|硬件替换需求|供应链中断|成本影响|交付影响/i;
const adjacentMaterialProductionSignal = /(?:gallium oxide|ga2o3|compound semiconductor|wide bandgap|ultra-wide bandgap|new material|氧化镓|化合物半导体|宽禁带|超宽禁带|新材料).{0,120}(?:mass production|production line|comes online|commenced production|volume production|量产|量产线|投产)|(?:mass production|production line|comes online|commenced production|volume production|量产|量产线|投产).{0,120}(?:gallium oxide|ga2o3|compound semiconductor|wide bandgap|ultra-wide bandgap|new material|氧化镓|化合物半导体|宽禁带|超宽禁带|新材料)/i;
const adjacentMaterialValidationSignal = /\b(?:major customer adoption|customer qualification|customer order|volume shipment|commercial shipment|mainstream process shift|replaces? silicon|replaces? silicon carbide)\b|主要客户采用|客户认证|明确订单|规模出货|商业出货|主流技术路线切换|替代硅|替代碳化硅/i;
const largeComponentContractSignal = /(?:mlcc|passive component|capacitor|resistor|inductor|被动元件|电容|电阻|电感).{0,120}(?:contract|agreement|订单|合同).{0,80}(?:\$|€|£|¥|krw|rmb|cny|\d+(?:\.\d+)?\s*(?:billion|million|trillion|bn|mn|b|m|亿|万亿))|(?:\$|€|£|¥|krw|rmb|cny|\d+(?:\.\d+)?\s*(?:billion|million|trillion|bn|mn|b|m|亿|万亿)).{0,80}(?:contract|agreement|订单|合同).{0,120}(?:mlcc|passive component|capacitor|resistor|inductor|被动元件|电容|电阻|电感)/i;
const componentContractImpactSignal = /\b(?:named customer|apple|iphone|airpods|automotive platform|vehicle platform|ai server platform|server platform)\b|明确客户|苹果|iPhone|AirPods|汽车平台|车型平台|AI\s*服务器平台|服务器平台|(?:supply|price|capacity|供应|价格|产能).{0,40}(?:impact|change|shortage|constraint|increase|decrease|影响|变化|短缺|受限|上涨|下降)/i;
const consumerProductSignal = /\b(?:consumer monitor|monitor|display|television|smartphone|mobile phone|tablet|laptop|desktop pc|consumer pc|headphones?|earbuds?|keyboard|mouse|accessor(?:y|ies))\b|消费显示器|显示器|电视|手机|平板|笔记本|台式机|消费电脑|耳机|键盘|鼠标|配件/i;
const routineConsumerProductUpdateSignal = /\b(?:launch(?:es|ed)?|introduc(?:es|ed)?|unveil(?:s|ed)?|price|priced at|specification|specs?|resolution|refresh rate|usb|hdmi|type-c|power supply|connector|connection|panel|module)\b|推出|发布|售价|价格|参数|规格|外观|分辨率|刷新率|内置电源|接口|连接|面板|模组/i;
const consumerProductBusinessIncrementSignal = /\b(?:new architecture|new material|new process|new manufacturing process|structural redesign|supplier change|supply chain shift|customer qualification|major order|production ramp|capacity expansion|manufacturing transfer|odm|ems|fatp|mass production)\b|新架构|新材料|新工艺|新制造工艺|结构革新|供应商切换|供应链调整|客户认证|重大订单|产能爬坡|扩产|产能迁移|代工|整机组装|量产/i;
const componentBusinessImpactSignal = /(?:connector|power supply|display module|optical module|acoustic module|连接器|电源|显示模组|光学模组|声学模组).{0,80}(?:redesign|architecture|supplier|order|production|capacity|cost reduction|performance improvement|重新设计|架构|供应商|订单|量产|产能|成本降低|性能提升)/i;
const consumerHardwareProductSignal = /\b(?:aio liquid cooler|all-in-one liquid cooler|cpu liquid cooler|pc liquid cooler|consumer cooler|motherboard|consumer motherboard|chipset add-in card|consumer add-in card|graphics card|gaming gpu|consumer gpu|retail gpu|sdxc|memory card|consumer storage|pc accessory|pc component)\b|一体式水冷|消费级水冷|消费级散热器|主板|消费级扩展卡|游戏显卡|消费级显卡|存储卡|装机配件/i;
const consumerRetailActivitySignal = /\b(?:launch(?:es|ed)?|introduc(?:es|ed)?|unveil(?:s|ed)?|release(?:s|d)?|retail|marketplace|buyer|refund(?:ed)?|order canc(?:el|ell)(?:ed|ation)?|single order|msrp|priced? at|prices?|raise prices?|higher prices?|price hike|price increase|specification|specs?|interface|cooling feature)\b|推出|发布|零售|商城|买家|退款|单笔订单|订单取消|建议零售价|售价|涨价|价格上涨|参数|规格|接口|散热|普通功能/i;
const consumerHardwareIndustryLandingSignal = /\b(?:data center|datacenter|enterprise|server|hyperscale|industrial|upstream component shortage|critical component shortage|wafer shortage|memory shortage|supplier change|supply chain shift|enterprise procurement|customer procurement|major order|mass production|production ramp|capacity expansion|manufacturing transfer|new material|new process|new architecture|bom impact|delivery impact)\b|数据中心|企业级|服务器|工业|上游关键部件短缺|关键部件短缺|晶圆短缺|存储器短缺|供应商切换|供应链调整|企业采购|客户采购|重大订单|量产|产能爬坡|扩产|产能迁移|新材料|新工艺|新架构|BOM\s*影响|交付影响/i;
const consumerPcCoolingContextSignal = /(?:\b(?:liquid cooling|liquid cooler|cooler)\b|液冷|水冷).{0,80}(?:\b(?:cpu|vrm|m\.2|desktop|pc build|motherboard)\b|处理器|主板|装机|风扇)|(?:\b(?:cpu|vrm|m\.2|desktop|pc build|motherboard)\b|处理器|主板|装机|风扇).{0,80}(?:\b(?:liquid cooling|liquid cooler|cooler)\b|液冷|水冷)/i;
const consumerGpuRetailContextSignal = /\bgpu\b.{0,180}\b(?:retail|marketplace|buyer|refund(?:ed)?|single order|msrp|graphics card order)\b|\b(?:retail|marketplace|buyer|refund(?:ed)?|single order|msrp|graphics card order)\b.{0,180}\bgpu\b/i;
const softwareProductSignal = /\b(?:software|ide|coding tool|developer tool|developer software|productivity app|software subscription|app subscription|coding agent)\b|软件|集成开发环境|编程工具|开发者工具|生产力应用|软件订阅/i;
const softwarePromotionTermsSignal = /\b(?:deal|discount|sale|promo(?:tion)?|lifetime|for life|subscription offer|coupon|save\s+\$?\d+)\b|(?:\$|€|£|¥)\s*\d+(?:\.\d+)?|促销|折扣|优惠|终身授权|终身订阅|订阅优惠/i;
const softwareHardwareBusinessLandingSignal = /\b(?:hardware demand|ai infrastructure investment|data center investment|enterprise deployment|enterprise procurement|customer deployment|hardware procurement|semiconductor supply chain|electronics manufacturing supply chain)\b|硬件需求|AI\s*基础设施投入|数据中心投入|企业部署|企业采购|客户部署|硬件采购|半导体供应链|电子制造供应链/i;
const unconfirmedInformationSignal = /\b(?:rumou?red|reportedly|leak(?:ed)?|exposed|exposure|prototype rumou?r|unconfirmed|report claims?|sources? claim)\b|传闻|曝光|爆料|据称|消息称|尚未确认|未经确认/i;
const formalConfirmationSignal = /\b(?:officially confirmed|officially announced|company confirmed|company announced|confirmed by|announced by)\b|正式确认|官方确认|官方宣布|公司确认|公司宣布/i;
const industrialValidationSignal = /\b(?:mass production|customer adoption|customer qualification|major order|volume shipment|commercial shipment|supply chain shift|supplier change)\b|量产|客户采用|客户认证|明确订单|重大订单|规模出货|商业出货|供应链变化|供应商切换/i;
const storageMarketOutlookSignal = /(?:\b(?:nand|dram|ddr\d?|lpddr\d?|ssd|storage|memory)\b|存储|存储器).{0,120}(?:forecast|outlook|prediction|cycle|trend|price|shortage|supply|demand|expected|预测|展望|周期|趋势|价格|短缺|供给|需求|预计)|(?:forecast|outlook|prediction|cycle|trend|price|shortage|supply|demand|expected|预测|展望|周期|趋势|价格|短缺|供给|需求|预计).{0,120}(?:\b(?:nand|dram|ddr\d?|lpddr\d?|ssd|storage|memory)\b|存储|存储器)/i;
const storageDownstreamImpactSignal = /(?:\b(?:server|iphone|smartphone|pc|customer|procurement|purchase|order|delivery|bom|supply chain)\b|服务器|手机|客户|采购|订单|交付|BOM|供应链).{0,100}(?:cost impact|cost increase|procurement change|order change|delivery impact|supply disruption|成本影响|成本上涨|采购变化|订单变化|交付影响|供应中断)|(?:cost impact|cost increase|procurement change|order change|delivery impact|supply disruption|成本影响|成本上涨|采购变化|订单变化|交付影响|供应中断).{0,100}(?:\b(?:server|iphone|smartphone|pc|customer|procurement|purchase|order|delivery|bom|supply chain)\b|服务器|手机|客户|采购|订单|交付|BOM|供应链)/i;
const upstreamManufacturingMaterialSignal = /\b(?:glass fiber cloth|fiberglass cloth|epitaxial wafer|epi wafer|resin|copper foil|substrate material|pcb substrate|electronic manufacturing raw material|upstream material)\b|玻纤布|玻璃纤维布|外延片|外延晶圆|树脂|铜箔|基板材料|PCB\s*基板|电子制造上游原材料|上游材料/i;
const upstreamMaterialMarketChangeSignal = /(?:\b(?:glass fiber cloth|fiberglass cloth|epitaxial wafer|epi wafer|resin|copper foil|substrate material|pcb substrate|electronic manufacturing raw material|upstream material)\b|玻纤布|玻璃纤维布|外延片|外延晶圆|树脂|铜箔|基板材料|PCB\s*基板|电子制造上游原材料|上游材料).{0,120}(?:price|inflation|cost|shortage|tight supply|supply constraint|supply demand|forecast|涨价|价格|成本|短缺|供应紧张|供需|预测)|(?:price|inflation|cost|shortage|tight supply|supply constraint|supply demand|forecast|涨价|价格|成本|短缺|供应紧张|供需|预测).{0,120}(?:\b(?:glass fiber cloth|fiberglass cloth|epitaxial wafer|epi wafer|resin|copper foil|substrate material|pcb substrate|electronic manufacturing raw material|upstream material)\b|玻纤布|玻璃纤维布|外延片|外延晶圆|树脂|铜箔|基板材料|PCB\s*基板|电子制造上游原材料|上游材料)/i;
const explicitMaterialTransmissionSignal = /\b(?:supplier price notice|formal price notice|procurement price increase|purchase cost increase|customer price adjustment|delivery disruption|production disruption|capacity reduction|material substitution|alternative material|procurement strategy change|supply chain disruption)\b|明确涨价通知|供应商涨价通知|采购价格上涨|采购成本上涨|产品报价调整|客户价格调整|交付中断|生产中断|产能下降|替代材料切换|材料替代|采购策略变化|供应链中断/i;
const materialProductImpactSignal = /(?:\b(?:luxshare|apple|iphone|airpods|server|rack|connector|optical module|display module|pcb|customer|order|delivery|capacity|manufacturing)\b|立讯|苹果|iPhone|AirPods|服务器|机柜|连接器|光模块|显示模组|PCB|客户|订单|交付|产能|制造).{0,100}(?:cost impact|price impact|shortage impact|supply impact|delivery risk|capacity risk|procurement impact|成本影响|报价影响|短缺影响|供应影响|交付风险|产能风险|采购影响)|(?:cost impact|price impact|shortage impact|supply impact|delivery risk|capacity risk|procurement impact|成本影响|报价影响|短缺影响|供应影响|交付风险|产能风险|采购影响).{0,100}(?:\b(?:luxshare|apple|iphone|airpods|server|rack|connector|optical module|display module|pcb|customer|order|delivery|capacity|manufacturing)\b|立讯|苹果|iPhone|AirPods|服务器|机柜|连接器|光模块|显示模组|PCB|客户|订单|交付|产能|制造)/i;
const companyProjectSupportSignal = /(?:\b(?:oracle|amazon|aws|microsoft|google|meta|apple|nvidia|amd|tesla)\b|甲骨文|亚马逊|微软|谷歌|苹果|英伟达).{0,140}(?:data center project|power guarantee|power infrastructure guarantee|infrastructure guarantee|project financing|energy agreement|power agreement|construction support|local policy support|subsidy|tax incentive|数据中心项目|电力(?:基础设施|基建)?担保|基础设施担保|项目融资|能源协议|电力协议|建设支持|地方政策支持|补贴|税收优惠)|(?:data center project|power guarantee|power infrastructure guarantee|infrastructure guarantee|project financing|energy agreement|power agreement|construction support|local policy support|subsidy|tax incentive|数据中心项目|电力(?:基础设施|基建)?担保|基础设施担保|项目融资|能源协议|电力协议|建设支持|地方政策支持|补贴|税收优惠).{0,140}(?:\b(?:oracle|amazon|aws|microsoft|google|meta|apple|nvidia|amd|tesla)\b|甲骨文|亚马逊|微软|谷歌|苹果|英伟达)/i;
const explicitDataCenterDemandImpactSignal = /\b(?:server procurement|rack procurement|equipment procurement|power equipment order|liquid cooling order|connector order|optical module order|hardware purchase|construction schedule|buildout schedule|capacity schedule|procurement pace|deployment pace)\b|服务器采购|机柜采购|设备采购|电源设备订单|液冷订单|连接器订单|光模块订单|硬件采购|建设节奏|扩建节奏|产能节奏|采购节奏|部署节奏/i;
const routineAppleProductionRampSignal = /(?:iphone|苹果).{0,80}(?:量产|production ramp|ramp).{0,80}(?:富士康|foxconn|招工|hiring)|(?:富士康|foxconn).{0,80}(?:招工|hiring).{0,80}(?:iphone|苹果)/i;
const matureTechnicalExplainerTitleSignal = /^(?:how\b|what is\b|why\b)|\b(?:explainer|primer|guide to|introduction to|fundamentals of|basics of|overview of|choosing the right|selecting the right|design considerations?|selection criteria|violations?|trade-?offs?|versus|vs\.)\b|\bscaling\b.{0,100}\bwithout\b|^(?:如何|什么是|为何|为什么)|(?:原理|基础科普|入门|技术综述|选型指南|设计指南|实施指南|常见问题|违规项|方法比较)/i;
const explicitTechnicalNewsIncrementSignal = /\b(?:new (?:technology|architecture|standard|product|material|process)|next-generation architecture|standard (?:published|released|ratified|approved)|officially (?:published|released|ratified|approved|announced)|mass production|volume production|customer adoption|customer qualification|commercial deployment|production deployment|supplier change|supply chain shift|supply chain disruption|component shortage|capacity constraint|manufacturing change|price increase|performance breakthrough|efficiency breakthrough|yield breakthrough)\b|(?:performance|efficiency|power|cost|yield).{0,40}(?:\d+(?:\.\d+)?\s*%|\d+(?:\.\d+)?x|record|breakthrough)|新技术|新架构|新标准(?:发布|获批)|正式发布|正式批准|新产品|新材料|新工艺|量产|客户采用|客户认证|商业部署|供应商切换|供应链调整|供应链中断|关键部件短缺|产能受限|制造变化|价格上涨|性能突破|效率突破|功耗突破|成本突破|良率突破/i;
const defaultFeedIncrementRules = [
  ["量产", /\b(?:mass[- ]production|volume production|production ramp|enters? production|starts? production|commenced production)\b|量产|投产|产能爬坡/i],
  ["规模部署", /\b(?:commercial deployment|mass deployment|large-scale deployment|deployed at scale|rollout at scale|volume deployment)\b|规模部署|大规模部署|商业部署|批量部署/i],
  ["明确订单或合同", /\b(?:major order|customer order|purchase order|supply order|contract award|awarded a contract|wins? a contract|secures? a contract|signs? a contract|signed contract|supply contract|purchase agreement|definitive agreement)\b|明确订单|重大订单|采购订单|供货合同|中标|签署合同|正式合同|采购协议|\b(?:order|contract|订单|合同)\b.{0,60}(?:\$|€|£|¥|krw|rmb|cny|\d+(?:\.\d+)?\s*(?:billion|million|trillion|bn|mn|b|m|亿|万亿))/i],
  ["客户采用", /\b(?:customer adoption|customer qualification|customer validation|selected by|adopted by|customer deployment|customer rollout|design win)\b|客户采用|客户认证|客户验证|客户部署|定点/i],
  ["明确价格变化", /(?:spot prices?|contract prices?|selling prices?|purchase prices?|现货价格|合约价格|售价|采购价格).{0,48}(?:gain|gains|rise|rose|rises|increase|increased|jump|surge|fall|fell|decline|drop|上涨|上调|下降|下调|跌)|(?:price|prices|价格).{0,32}(?:\d+(?:\.\d+)?\s*%|gain|gains|rise|rose|rises|increase|increased|jump|surge|fall|fell|decline|drop|上涨|上调|下降|下调|跌)/i],
  ["供需变化或短缺", /\b(?:shortage|supply shortage|supply constraint|tight supply|supply disruption|demand surge|demand decline|inventory correction|allocation)\b|短缺|供应紧张|供应受限|供应中断|需求激增|需求下降|库存调整|配额/i],
  ["新技术路线或新架构", /\b(?:new technology route|new technical route|new architecture|next-generation architecture|architecture shift|platform transition|roadmap shift|new process architecture)\b|新技术路线|新技术方向|新架构|架构切换|平台切换|路线转变|工艺架构变化/i],
  ["新标准正式发布", /\b(?:standard (?:published|released|ratified|approved)|specification (?:published|released|ratified|approved)|official standard)\b|新标准正式发布|标准正式发布|标准获批|规范正式发布/i],
  ["CAPEX、扩产或新工厂", /\b(?:capex|capital expenditure|capacity expansion|new factory|new plant|factory expansion|plant expansion|fab expansion|builds? a factory|opens? a factory)\b|资本开支|扩产|产能扩张|新工厂|新建工厂|新厂|建厂|晶圆厂扩建/i],
  ["实质竞争格局变化", /\b(?:acquires?|acquisition|overtakes?|surpasses?|loses? market share|gains? market share|market share (?:rose|fell|increased|declined)|supplier displacement|replaces? .*supplier)\b|收购|并购|超越|反超|市场份额上升|市场份额下降|份额大幅变化|供应商替代|取代.{0,24}供应商/i],
  ["明确风险事件", /\b(?:recall|production halt|factory shutdown|supply disruption|delivery disruption|sanction|export control|regulatory ban|material breach|major outage)\b|召回|停产|工厂停摆|供应中断|交付中断|制裁|出口管制|监管禁令|重大违约|重大停机/i],
  ["客户自研路线变化", /\b(?:in-house (?:cpu|gpu|chip|processor|accelerator|silicon)|custom (?:cpu|gpu|chip|processor|accelerator|silicon)|self-developed (?:cpu|gpu|chip|processor|accelerator|silicon)|develops? its own (?:cpu|gpu|chip|processor|accelerator|silicon))\b|自研\s*(?:CPU|GPU|芯片|处理器|加速器)|自主研发\s*(?:CPU|GPU|芯片|处理器|加速器)/i],
  ["供应链或产能迁移", /\b(?:supply chain shift|supplier switch|supplier change|manufacturing transfer|capacity transfer|production transfer|moves? production|shifts? production)\b|供应链迁移|供应链调整|供应商切换|供应商变更|制造迁移|产能迁移|生产迁移/i]
];

function hasCoreIndustrySignal(value = "") {
  return coreIndustrySignal.test(value) || (weakFactorySignal.test(value) && factoryContextSignal.test(value));
}

function hasCustomerMove(value = "") {
  return customerMoveSignal.test(value) && !negatedCustomerMoveSignal.test(value);
}

function hasCompetitorMove(value = "") {
  return competitorMoveSignal.test(value);
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
    isPureSoftwarePromotionWithoutHardwareLanding(value) ||
    isOrdinaryConsumerHardwareWithoutIncrement(value) ||
    (developerPeripheralSignal.test(value) && !openAiHardwareLandingSignal.test(value)) ||
    (edgeAiModuleSignal.test(value) && !edgeAiModuleLandingSignal.test(edgeLandingText)) ||
    (consumerSecuritySignal.test(value) && !enterpriseSecurityLandingSignal.test(value)) ||
    (consumerIotSatelliteSignal.test(value) && !communicationsHardwareLandingSignal.test(value)) ||
    (nvidiaSoftwareEcosystemSignal.test(value) && !nvidiaHardwareLandingSignal.test(value)) ||
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
    isPureSoftwarePromotionWithoutHardwareLanding(value) ||
    isOrdinaryConsumerHardwareWithoutIncrement(value) ||
    (developerPeripheralSignal.test(value) && !openAiHardwareLandingSignal.test(value)) ||
    (consumerSecuritySignal.test(value) && !enterpriseSecurityLandingSignal.test(value)) ||
    (consumerIotSatelliteSignal.test(value) && !communicationsHardwareLandingSignal.test(value)) ||
    (nvidiaSoftwareEcosystemSignal.test(value) && !nvidiaHardwareLandingSignal.test(value)) ||
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
  if (hasCustomerMove(value)) {
    values.push("Customer move");
  }
  if (hasCompetitorMove(value)) {
    values.push("Competitor move");
  }
  if (capitalAllocationSignal.test(value)) {
    values.push("Capital allocation");
  }
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

function hasExplicitLuxshareImpactChain(value = "") {
  return directLuxshareChainSignal.test(value) ||
    memoryComponentSignal.test(value) && supplyCostImpactSignal.test(value) ||
    hasCustomerMove(value) && customerProductChainSignal.test(value) ||
    hasCompetitorMove(value) && customerProductChainSignal.test(value) ||
    manufacturingPolicyImpactSignal.test(value);
}

function isAdjacentDataCenterComponentWithoutDirectLanding(value = "") {
  return adjacentDataCenterComponentSignal.test(value) &&
    !/\bhbm\b/i.test(value) &&
    !adjacentComponentBusinessLandingSignal.test(value) &&
    !systemLevelDataCenterArchitectureSignal.test(value);
}

function isOrdinaryConsumerProductWithoutIncrement(value = "") {
  const hasEnterpriseOrIndustrialContext = /\b(?:data center|datacenter|server|rack|enterprise|industrial|automotive|ai accelerator)\b|数据中心|服务器|机柜|企业级|工业|汽车|AI\s*加速器/i.test(value);
  return consumerProductSignal.test(value) &&
    routineConsumerProductUpdateSignal.test(value) &&
    !consumerProductBusinessIncrementSignal.test(value) &&
    !componentBusinessImpactSignal.test(value) &&
    !hasEnterpriseOrIndustrialContext;
}

function isOrdinaryConsumerHardwareWithoutIncrement(value = "") {
  const evidenceText = value.replace(edgeAiModuleGenericFallbackSignal, "");
  return (
    consumerHardwareProductSignal.test(evidenceText) ||
    consumerPcCoolingContextSignal.test(evidenceText) ||
    consumerGpuRetailContextSignal.test(evidenceText)
  ) &&
    consumerRetailActivitySignal.test(evidenceText) &&
    !consumerHardwareIndustryLandingSignal.test(evidenceText);
}

function isPureSoftwarePromotionWithoutHardwareLanding(value = "") {
  const evidenceText = value.replace(edgeAiModuleGenericFallbackSignal, "");
  return softwareProductSignal.test(evidenceText) &&
    softwarePromotionTermsSignal.test(evidenceText) &&
    !softwareHardwareBusinessLandingSignal.test(evidenceText);
}

function hasConfirmedIndustrialValidation(value = "") {
  return formalConfirmationSignal.test(value) &&
    (industrialValidationSignal.test(value) || quantifiedBreakthroughSignal.test(value));
}

function isIndirectStorageMarketSignal(value = "") {
  return storageMarketOutlookSignal.test(value) && !storageDownstreamImpactSignal.test(value);
}

function isIndirectUpstreamMaterialSignal(value = "") {
  return upstreamManufacturingMaterialSignal.test(value) &&
    upstreamMaterialMarketChangeSignal.test(value) &&
    !explicitMaterialTransmissionSignal.test(value) &&
    !materialProductImpactSignal.test(value);
}

function isCompanyProjectWithoutLuxshareImpact(value = "") {
  return companyProjectSupportSignal.test(value) && !explicitDataCenterDemandImpactSignal.test(value);
}

function isScaleSignalWithoutBusinessImpact(value = "") {
  return nationalScaleProjectSignal.test(value) && !nationalProjectHardwareLandingSignal.test(value) ||
    adjacentMaterialProductionSignal.test(value) && !adjacentMaterialValidationSignal.test(value) && !quantifiedBreakthroughSignal.test(value) ||
    largeComponentContractSignal.test(value) && !componentContractImpactSignal.test(value);
}

function getDefaultFeedIncrementReason(article = {}, rawText = "") {
  // Use source evidence only. Generated summaries and briefing labels must not create homepage eligibility.
  const headlineText = [
    article.title,
    article.titleZh,
    article.titleEn
  ].filter(Boolean).join(" ");
  const evidenceText = [
    headlineText,
    rawText
  ].filter(Boolean).join(" ");
  const isStaticMarketShareDescription = /\b(?:continues?|remains?|retains?|holds?)\b.{0,50}\bmarket share (?:lead|leadership)|\bmarket share (?:lead|leader|leadership|ranking)\b|(?:继续|保持|稳居).{0,30}市场份额(?:领先|首位)|市场份额排名/i.test(headlineText);
  const hasMaterialShareChange = /\b(?:overtakes?|surpasses?|loses? market share|gains? market share|market share (?:rose|fell|increased|declined))\b|超越|反超|市场份额上升|市场份额下降|份额大幅变化/i.test(headlineText);
  if (isStaticMarketShareDescription && !hasMaterialShareChange) {
    return "";
  }
  return defaultFeedIncrementRules.find(([, pattern]) => pattern.test(evidenceText))?.[0] || "";
}

function isDefaultFeedScoreEligible(article = {}, incrementReason = "") {
  if (article.relevance === "高") {
    return article.importance === "高" || article.importance === "中";
  }
  if (article.relevance !== "中") {
    return false;
  }
  if (article.importance === "高") {
    return true;
  }
  return article.importance === "中" && Boolean(incrementReason);
}

function inferImportance(text, form, article = {}, relevance = article.relevance || inferRelevance(text, article)) {
  const value = String(text || "").toLowerCase();
  if (
    relevance === "低" ||
    isLowManagementValue(value) ||
    isMatureTechnicalExplainer(article, value) ||
    isOrdinaryConsumerProductWithoutIncrement(value) ||
    isOrdinaryConsumerHardwareWithoutIncrement(value) ||
    isPureSoftwarePromotionWithoutHardwareLanding(value)
  ) {
    return "低";
  }

  if (isCompanyProjectWithoutLuxshareImpact(value)) {
    return "低";
  }

  if (isIndirectStorageMarketSignal(value)) {
    return "中";
  }

  if (isIndirectUpstreamMaterialSignal(value)) {
    return "中";
  }

  if (dataCenterSecurityOrGeopoliticalSignal.test(value) && !explicitHardwareBusinessConsequenceSignal.test(value)) {
    return "低";
  }

  if (isScaleSignalWithoutBusinessImpact(value)) {
    return "中";
  }

  if (isAdjacentDataCenterComponentWithoutDirectLanding(value)) {
    return "中";
  }

  if (unconfirmedInformationSignal.test(value) && !hasConfirmedIndustrialValidation(value)) {
    return "中";
  }

  if (routineAppleProductionRampSignal.test(value) && !majorOrderSignal.test(value) && !majorCapacityAllocationSignal.test(value)) {
    return "中";
  }

  const hasExplicitImpactChain = hasExplicitLuxshareImpactChain(value);
  const hasHighManagementSignal =
    significantPriceSupplySignal.test(value) ||
    majorCapacityAllocationSignal.test(value) && hasExplicitImpactChain ||
    majorOrderSignal.test(value) && hasExplicitImpactChain ||
    quantifiedCapitalExpansionSignal.test(value) && hasExplicitImpactChain ||
    technologyProductionSignal.test(value) && (directLuxshareChainSignal.test(value) || adjacentMaterialValidationSignal.test(value)) ||
    scaledCustomerChangeSignal.test(value) && hasExplicitImpactChain ||
    quantifiedBreakthroughSignal.test(value) && hasMeaningfulTechnologyIncrement(value) ||
    capitalAllocationSignal.test(value) && quantifiedScaleSignal.test(value) && hasExplicitImpactChain ||
    quantifiedScaleSignal.test(value) && materialBusinessActionSignal.test(value) && hasExplicitImpactChain ||
    (directLuxshareChainSignal.test(value) && /\b(?:enters? mass production|starts? mass production|volume production|mass deployment)\b|进入量产|开始量产|批量生产|规模部署/i.test(value));

  if (hasHighManagementSignal) {
    return "高";
  }

  if (
    materialBusinessActionSignal.test(value) ||
    customerActionSignal.test(value) ||
    competitorActionSignal.test(value) ||
    technologyIncrementSignal.test(value) ||
    supplyCostImpactSignal.test(value) ||
    briefingValueRules.some(([, pattern]) => pattern.test(value))
  ) {
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
  const relevance = inferRelevance(text, article);
  return relevance === "高" ? 20 : relevance === "中" ? 10 : 0;
}

function isLowManagementValue(value) {
  return gameContentSignal.test(value) || /technical paper roundup|research bits|paper roundup|survey|academic paper|university|et al\.?|fault injection|timing analysis|radiation hydrodynamic|lithography defect|vision-language models|conference agenda|magazine|podcast|webinar|mini pc|playstation|console|游戏|手游|geforce now|summer sale|swift package index|软件包|开发者工具|应用商店|diffusiongemma|local ai|sovereign ai|keynote coverage|tape out|tapes out|laptop|macbook|xps|kvm|mid-tower|atx case|gpu-z|exceria|raptor lake|undersea cable|portable|enclosure|drivers?|whql|arc gpu|deepseek|entity list|rtx remix|pubg|ace ai|gas turbines|naacp|lawsuit|robots? that taught themselves|fab roadmap examined|built-in memory|consumer ryzen|memory encryption|rtx spark|consumer pcie|nova lake-s|oc sku|pl2 mode|greenlake|file explorer|windows 11|bionemo|agent toolkit|agent framework|repository-level code evolution|nvidia research|scientific discovery|telecom operations|arc pro.*available|now available.*\$|turns waves into watts|digital twins|scalper|scalpers|bundle|bundles|blowout|anniversary edition|5800x3d|b&h|transfr pro|send unlimited files|lifetime deal|slopfix|ai-generated code|code bloat|software team|messy repositories|防诈骗|被盗怎么办|官方支持文档|国补|免息|自营|优惠|促销|另类营销|下水玩|手机曝光|galaxy z flip|galaxy m|vivo y|nothing phone|智能戒指|iring|galaxy ring|steam machine|ldlc|rx 9060|发电装机容量/.test(value);
}

function shouldShowByDefault(article, rawText) {
  const value = `${article.title} ${rawText || ""}`.toLowerCase();
  const briefingValue = article.briefingValue || inferBriefingValue(value);
  const hasBriefingValue = briefingValue.length > 0;
  const incrementReason = article._defaultFeedIncrementReason || getDefaultFeedIncrementReason(article, rawText);
  if (!isDefaultFeedScoreEligible(article, incrementReason)) {
    return false;
  }
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
  if (!["高", "中"].includes(article.relevance) || !["高", "中"].includes(article.importance)) {
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
  return true;
}

function getLowValueReason(article, rawText) {
  const value = `${article.title} ${rawText || ""}`.toLowerCase();
  if (isPureSoftwarePromotionWithoutHardwareLanding(value)) {
    return "纯软件、IDE 或个人开发者促销缺少硬件需求和企业采购落点";
  }
  if (isOrdinaryConsumerHardwareWithoutIncrement(value)) {
    return "普通消费硬件新品、零售价格或参数信息缺少产业链增量";
  }
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

function hasMeaningfulTechnologyIncrement(value = "") {
  return technologyIncrementSignal.test(value) && (
    directLuxshareChainSignal.test(value) ||
    customerProductChainSignal.test(value) ||
    hasCoreIndustrySignal(value)
  );
}

function isMatureTechnicalExplainer(article = {}, value = "") {
  const title = article.title || article.titleEn || article.titleZh || "";
  const isExplainer = technicalExplainerSignal.test(value) || matureTechnicalExplainerTitleSignal.test(title);
  return isExplainer &&
    !explicitTechnicalNewsIncrementSignal.test(value) &&
    !customerActionSignal.test(value) &&
    !competitorActionSignal.test(value);
}

function inferRelevance(text = "", article = {}) {
  const value = String(text).toLowerCase();
  if (
    isLowManagementValue(value) ||
    isRawSecFiling(article) && !hasSecFilingHardSignal(value) ||
    hasDefaultFeedNegativeSignal(value) && !hasStrongCoreIndustrySignal(value) ||
    hasAutomotiveNoiseWithoutLuxshareFit(value) ||
    hasSoftwareOnlySignal(value) ||
    hasProductLeakWithoutSupplyChainSignal(value) ||
    hasIthomeProductLeakTitleWithoutSupplyChainSignal(article) ||
    hasIrrelevantConsumerOrSocialNoise(value) ||
    isOrdinaryConsumerProductWithoutIncrement(value) ||
    isOrdinaryConsumerHardwareWithoutIncrement(value) ||
    isPureSoftwarePromotionWithoutHardwareLanding(value)
  ) {
    return "低";
  }

  if (isCompanyProjectWithoutLuxshareImpact(value)) {
    return "低";
  }

  if (isIndirectStorageMarketSignal(value)) {
    return "中";
  }

  if (isIndirectUpstreamMaterialSignal(value)) {
    return "中";
  }

  if (dataCenterSecurityOrGeopoliticalSignal.test(value) && !explicitHardwareBusinessConsequenceSignal.test(value)) {
    return "低";
  }

  if (isScaleSignalWithoutBusinessImpact(value)) {
    return "中";
  }

  if (isAdjacentDataCenterComponentWithoutDirectLanding(value)) {
    return "中";
  }

  const hasDirectChain = directLuxshareChainSignal.test(value);
  const hasCustomerProductChain = customerProductChainSignal.test(value);
  const hasCustomerAction = hasCustomerMove(value);
  const hasCompetitorAction = hasCompetitorMove(value);
  const hasBusinessAction = materialBusinessActionSignal.test(value) || supplyCostImpactSignal.test(value);
  const hasTechnologyIncrement = hasMeaningfulTechnologyIncrement(value);
  const explicitlyNamesLuxshare = topicUniverse.luxshareEcosystem.test(value);

  if (
    explicitlyNamesLuxshare ||
    hasDirectChain && (hasBusinessAction || hasTechnologyIncrement) ||
    memoryComponentSignal.test(value) && supplyCostImpactSignal.test(value) ||
    hasCustomerAction && hasCustomerProductChain ||
    hasCompetitorAction && hasCustomerProductChain
  ) {
    return "高";
  }

  if (
    hasDirectChain ||
    hasCustomerProductChain ||
    hasCustomerAction ||
    hasCompetitorAction ||
    hasTechnologyIncrement ||
    manufacturingPolicyImpactSignal.test(value) ||
    hasCoreIndustrySignal(value)
  ) {
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
  article.briefingValue = (
    isOrdinaryConsumerProductWithoutIncrement(text) ||
    isOrdinaryConsumerHardwareWithoutIncrement(text) ||
    isPureSoftwarePromotionWithoutHardwareLanding(text)
  ) ? [] : inferBriefingValue(text);
  article.relevance = inferRelevance(text, article);
  article.impactScore = getLuxshareImpactScore(text, article.topic, article);
  article.importance = inferImportance(text, article.topic, article, article.relevance);
  article.businessDropReason = isMatureTechnicalExplainer(article, text)
    ? "成熟技术科普缺少新路线、新突破、新应用或新事实"
    : "";
  article.summary = article.originalLanguage === "zh" ? summarizeChineseSource(article.title, text) : summarizeArticle(article, text);
  article.whyItMatters = makeWhyItMatters(article);
  article.titleZh = article.originalLanguage === "zh" ? article.title : "";
  article.titleEn = article.originalLanguage === "zh" ? translateChineseTitle(article.title, article) : article.title;
  article.summaryZh = article.originalLanguage === "zh" ? article.summary : "";
  article.summaryEn = article.originalLanguage === "zh" ? translateChineseSummary(article.summary, article) : "";
  article.whyZh = article.originalLanguage === "zh" ? article.whyItMatters : "";
  article.whyEn = article.originalLanguage === "zh" ? translateChineseWhy(article.whyItMatters, article) : "";
  article.tags = extractTags(text, article.companies);
  article._defaultFeedIncrementReason = getDefaultFeedIncrementReason(article, rawText);
  article.showByDefault = shouldShowByDefault(article, rawText);
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

function warningMessage(error) {
  return error?.message || String(error);
}

function warnSkippedFeed(sourceId, url, error) {
  console.warn(`Feed skipped for ${sourceId}: ${url} — ${warningMessage(error)}`);
}

function warnSkippedArticle(sourceId, item, error) {
  const label = item?.title || item?.link || item?.sourceUrl || item?.id || "unknown article";
  console.warn(`Article skipped for ${sourceId}: ${label} — ${warningMessage(error)}`);
}

async function fetchFeedTexts(sourceId, feedUrls = []) {
  const feedResults = await Promise.allSettled(feedUrls.map(async (url) => ({
    url,
    text: await fetchText(url)
  })));
  const feeds = [];
  for (const result of feedResults) {
    if (result.status === "fulfilled") {
      feeds.push(result.value);
    } else {
      const url = feedUrls[feedResults.indexOf(result)] || "unknown feed";
      warnSkippedFeed(sourceId, url, result.reason);
    }
  }
  if (!feeds.length) {
    console.warn(`Source skipped after all feeds failed: ${sourceId}`);
  }
  return feeds;
}

function parseFeedItems(sourceId, feeds = []) {
  const items = [];
  for (const feed of feeds) {
    try {
      items.push(...parseRssItems(feed.text));
    } catch (error) {
      warnSkippedFeed(sourceId, feed.url, error);
    }
  }
  return items;
}

async function settleArticles(sourceId, items, createArticle) {
  const results = await Promise.allSettled(items.map((item) => createArticle(item)));
  const articles = [];
  for (const [index, result] of results.entries()) {
    if (result.status === "fulfilled" && result.value) {
      articles.push(result.value);
    } else if (result.status === "rejected") {
      warnSkippedArticle(sourceId, items[index], result.reason);
    }
  }
  return articles;
}

async function fetchEditorialRssArticles(sourceConfig) {
  const feeds = await fetchFeedTexts(sourceConfig.sourceId, sourceConfig.feedUrls);
  const items = dedupeArticles(parseFeedItems(sourceConfig.sourceId, feeds))
    .filter((item) => item.title && item.link && item.publishedAt)
    .filter((item) => isRecentEnough(item.publishedAt, 45))
    .filter((item) => {
      const text = `${item.title} ${sourceConfig.filterTitleOnly ? "" : item.description} ${item.link}`;
      return (!sourceConfig.include || sourceConfig.include.test(text)) && (!sourceConfig.exclude || !sourceConfig.exclude.test(text));
    })
    .slice(0, sourceConfig.limit);

  const articles = await settleArticles(sourceConfig.sourceId, items, async (item) => {
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
    });

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

  const feeds = await fetchFeedTexts("nvidia_newsroom", feedUrls);
  const items = dedupeArticles(parseFeedItems("nvidia_newsroom", feeds))
    .filter((item) => item.title && item.link && item.publishedAt)
    .filter((item) => isRecentEnough(item.publishedAt, 45))
    .slice(0, 12);

  return settleArticles("nvidia_newsroom", items, async (item) => {
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
    try {
      const paddedCik = company.cik.padStart(10, "0");
      const url = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;
      const data = await fetchJson(url, secHeaders);
      const recent = data.filings?.recent || {};
      const count = Math.min(recent.form?.length || 0, 20);

      for (let index = 0; index < count; index += 1) {
        try {
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
        } catch (error) {
          warnSkippedArticle("sec_edgar", { title: `${company.company} filing`, link: accessionNumber }, error);
        }
      }
    } catch (error) {
      console.warn(`Source skipped for sec_edgar company ${company.ticker}: ${warningMessage(error)}`);
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

function getArticleDropReason(article = {}) {
  if (article.businessDropReason) {
    return article.businessDropReason;
  }
  const title = article.title || article.titleEn || article.titleZh || "";
  if (matureTechnicalExplainerTitleSignal.test(title) && !technologyIncrementSignal.test(title) && !newsEventSignal.test(title)) {
    return "成熟技术科普标题缺少新路线、新突破、新应用或新事实";
  }
  return "";
}

function normalizeRenderableArticle(article = {}) {
  if (!article || typeof article !== "object") {
    return { article: null, warning: "文章对象无效" };
  }

  const normalized = { ...article };
  const title = normalized.title || normalized.titleEn || normalized.titleZh || "";
  const sourceId = normalized.sourceId || normalized.source || "";
  const publishedAt = normalized.publishedAt || normalized.date || "";
  const warnings = [];

  if (!title) {
    return { article: null, warning: "文章缺少标题" };
  }
  if (!sourceId) {
    return { article: null, warning: "文章缺少 sourceId" };
  }
  if (!normalized.sourceUrl) {
    return { article: null, warning: "文章缺少 sourceUrl" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) {
    return { article: null, warning: "文章 publishedAt 无效" };
  }

  normalized.title = normalized.title || title;
  normalized.sourceId = sourceId;
  normalized.publishedAt = publishedAt;
  if (!normalized.id) {
    normalized.id = createId(["real", sourceId, publishedAt, title]);
    warnings.push("文章缺少 id，已生成安全 id");
  }
  if (!["高", "中", "低"].includes(normalized.relevance)) {
    normalized.relevance = "低";
    warnings.push("文章 relevance 无效，已降为低");
  }
  if (!["高", "中", "低"].includes(normalized.importance)) {
    normalized.importance = "低";
    normalized.showByDefault = false;
    warnings.push("文章 importance 无效，已降为低并隐藏");
  }
  if (typeof normalized.showByDefault !== "boolean") {
    normalized.showByDefault = false;
    warnings.push("文章 showByDefault 无效，已隐藏");
  }
  if (!Array.isArray(normalized.briefingValue)) {
    normalized.briefingValue = [];
    normalized.showByDefault = false;
    warnings.push("文章 briefingValue 非数组，已重置并隐藏");
  }
  if (!Array.isArray(normalized.tags)) {
    normalized.tags = [];
  }
  if (!Array.isArray(normalized.companies)) {
    normalized.companies = [];
  }

  return { article: normalized, warning: warnings.join("；") };
}

function applyArticleSafetyPass(articles) {
  const diagnostics = {
    droppedArticles: [],
    hiddenBySafetyPass: [],
    articleWarnings: []
  };

  const safeArticles = [];
  for (const article of articles) {
    try {
    const normalized = normalizeRenderableArticle(article);
    if (!normalized.article) {
      diagnostics.droppedArticles.push({
        id: article?.id || "unknown",
        title: article?.title || article?.titleEn || article?.titleZh || "unknown article",
        reason: normalized.warning
      });
      console.warn(`Article dropped by structural safety: ${article?.title || article?.id || "unknown"} — ${normalized.warning}`);
      continue;
    }
    if (normalized.warning) {
      diagnostics.articleWarnings.push({
        id: normalized.article.id,
        title: normalized.article.title,
        reason: normalized.warning
      });
      console.warn(`Article repaired by structural safety: ${normalized.article.title} — ${normalized.warning}`);
    }

    const dropReason = getArticleDropReason(normalized.article);
    if (dropReason) {
      diagnostics.droppedArticles.push({
        id: normalized.article.id,
        title: normalized.article.title,
        reason: dropReason
      });
      console.warn(`Article dropped by business relevance: ${normalized.article.title} — ${dropReason}`);
      continue;
    }
    delete normalized.article.businessDropReason;

    const { article: repairedArticle } = repairSummaryFields(normalized.article);
    let safeArticle = repairedArticle;
    const reasons = [];

    const safetyEvaluation = evaluateArticleSafety(safeArticle);
    if (safetyEvaluation.shouldQuarantine) {
      reasons.push(safetyEvaluation.reason);
    }

    if (reasons.length) {
      const relevance = safetyEvaluation.recommendedRelevance || (safeArticle.relevance === "高" ? "中" : safeArticle.relevance);
      safeArticle = {
        ...safeArticle,
        showByDefault: false,
        relevance,
        importance: relevance === "低" ? "低" : safeArticle.importance,
        lowValueReason: safeArticle.lowValueReason || reasons.join("；")
      };
      diagnostics.hiddenBySafetyPass.push({
        id: safeArticle.id,
        title: safeArticle.title,
        reason: reasons.join("；")
      });
    }

    safeArticles.push(safeArticle);
    } catch (error) {
      diagnostics.droppedArticles.push({
        id: article?.id || "unknown",
        title: article?.title || article?.titleEn || article?.titleZh || "unknown article",
        reason: warningMessage(error)
      });
      warnSkippedArticle(article?.sourceId || "unknown", article, error);
    }
  }

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
      ...(article.tags || []),
      ...(article.companies || [])
    ].filter(Boolean).join(" ");
    const briefingValue = Array.isArray(article.briefingValue) ? article.briefingValue : [];
    const hasUnexplainedLuxshareFit = hasLuxshareBusinessFit(articleText) && !briefingValue.includes("Luxshare business fit");
    const incrementReason = article._defaultFeedIncrementReason || getDefaultFeedIncrementReason(article);
    const { _defaultFeedIncrementReason, ...publicArticle } = article;
    return {
      ...publicArticle,
      showByDefault:
        isDefaultFeedScoreEligible(article, incrementReason) &&
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
  console.log(`articleWarnings: ${safetyResult.diagnostics.articleWarnings.length}`);
  console.log(`hiddenBySafetyPass: ${safetyResult.diagnostics.hiddenBySafetyPass.length}`);
  for (const item of safetyResult.diagnostics.droppedArticles) {
    console.log(`- dropped ${item.id}: ${item.title} — ${item.reason}`);
  }
  for (const item of safetyResult.diagnostics.articleWarnings) {
    console.log(`- repaired ${item.id}: ${item.title} — ${item.reason}`);
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
