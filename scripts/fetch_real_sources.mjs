import fs from "node:fs/promises";

const outputPath = new URL("../real-data.js", import.meta.url);
const taxonomyPath = new URL("../taxonomy.js", import.meta.url);
const collectionAsOfDate = process.argv[2] || getShanghaiDateString();

function getShanghaiDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
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
    exclude: /best|deal|coupon|discount|premium|review|hands-on|laptop|macbook|xps|desktop|gaming|console|undersea cable|deepseek|entity list|rtx remix|robot|gas turbines|naacp|lawsuit|pubg|consumer ryzen|memory encryption|rtx spark|consumer pcie/i
  },
  {
    sourceId: "techpowerup",
    sourceName: "TechPowerUp",
    feedUrls: ["https://www.techpowerup.com/rss/news"],
    fallbackIndustry: "核心零部件",
    limit: 8,
    include: /cpu|gpu|motherboard|memory|ssd|power|nvidia|amd|intel|server|data center|pcie|mini pc|processor|xeon|radeon|geforce/i,
    exclude: /review|giveaway|deal|discount|claude|kde|chromeos|software|ui polish|e-degree|mini pc|playstation|console|gaming|geforce|radeon|\(pr\)|cable matters|kvm|atx|mid-tower|case|gpu-z|exceria|raptor lake|portable|enclosure|driver|drivers|whql|arc gpu|pubg|rtx remix|ace ai|robot|gas turbines|lawsuit|consumer ryzen|memory encryption|rtx spark|consumer pcie/i
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
      /苹果|Apple|iPhone|iPad|Mac|AirPods|供应链|代工|工厂|印度|越南|OLED|面板|摄像头|光学|连接器|线束|立讯|富士康|鸿海|捷普|Jabil|和硕|纬创|广达|仁宝|英业达|比亚迪电子|歌尔|瑞声|舜宇|蓝思|三星显示|Samsung Display|AI\s*服务器|服务器|数据中心|液冷|电源|光模块|PCB|半导体|芯片|SOC|SoC|HBM/i,
    exclude: /游戏|手游|影视|直播|优惠|促销|补贴|降价|汽车|车主|充电桩|机器人|飞行汽车|无人机|应用更新|版本更新|微信|支付宝|鸿蒙应用|显卡驱动|耳机新品|音箱|电视|投影|steam deck|win11|蓝牙|被盗|防诈骗|官方支持文档|京东|自营|免息/i
  }
];

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
  if (/服务器|数据中心|ai服务器|集采|机柜|液冷|算力基础设施/.test(value)) {
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

function inferImportance(text, form) {
  const score = getLuxshareImpactScore(text, form);
  if (score >= 10) {
    return "高";
  }
  if (score >= 5) {
    return "中";
  }
  return "低";
}

function getLuxshareImpactScore(text, form = "") {
  const value = text.toLowerCase();
  if (isLowManagementValue(value)) {
    return 0;
  }

  let score = 0;
  if (["10-K", "10-Q"].includes(form)) {
    score += 7;
  }
  if (form === "8-K") {
    score += 3;
  }

  score += scoreText(value, [
    [/apple|苹果|iphone|ipad|mac|airpods|wearable|connector|camera module|摄像头|optical|光学|lens|assembly|supplier|supply chain|供应链|代工|印度|越南|oled|面板|三星显示/, 11],
    [/server|服务器|ai服务器|rack|机柜|data center|datacenter|数据中心|ai factory|ai infrastructure|pdu|busbar|power shelf|电源|liquid cooling|液冷|cdu|cooling|thermal|散热|interconnect|cable|线缆|线束|连接器/, 10],
    [/capex|capital expenditure|order|backlog|capacity|factory|expansion|manufacturing investment|guidance|revenue|margin/, 8],
    [/foxconn|hon hai|富士康|鸿海|quanta|广达|wiwynn|纬颖|inventec|英业达|wistron|纬创|pegatron|和硕|compal|仁宝|jabil|捷普|flex|byd electronic|比亚迪电子|goertek|歌尔|aac|瑞声|sunny optical|舜宇|lens technology|蓝思|luxshare|立讯/, 10],
    [/nvidia|blackwell|gpu|hbm|coherent|lumentum|amphenol|vertiv|supermicro|dell|hpe|arista|cisco|delta electronics|schneider|eaton/, 6],
    [/dram|nand|memory|ssd|advanced packaging|chiplet|foundry|tsmc|micron|sk hynix|samsung semiconductor/, 4],
    [/product launch|platform|processor|cpu|soc|pcie|ethernet|switch|storage/, 2]
  ]);

  if (/research paper|technical paper|survey|roundup|academic|university|et al|framework|modeling|simulation|lithography defect|fault injection/.test(value)) {
    score -= 8;
  }
  if (/swift package index|软件包|开源|开发者工具|app store|应用商店/.test(value)) {
    score -= 10;
  }
  if (/galaxy m|vivo y|nothing phone|iqoo|手机曝光|海外发布|涨价/.test(value) && !/苹果|apple|iphone|供应链|代工|工厂|三星显示|连接器|摄像头/.test(value)) {
    score -= 8;
  }
  if (/gaming|游戏|手游|console|playstation|mini pc|geforce now|diffusiongemma|local ai|sovereign ai|robotaxi|stockholder meeting|webinar|magazine|podcast|review|hands-on|keynote coverage|tape out|tapes out|laptop|macbook|xps|kvm|mid-tower|atx case|gpu-z|exceria|raptor lake|undersea cable|portable|enclosure|drivers?|whql|arc gpu|deepseek|entity list|rtx remix|pubg|ace ai|gas turbines|naacp|lawsuit|robots? that taught themselves|fab roadmap examined|built-in memory|consumer ryzen|memory encryption|rtx spark|consumer pcie|greenlake/.test(value)) {
    score -= 6;
  }

  return Math.max(score, 0);
}

function isLowManagementValue(value) {
  return /technical paper roundup|research bits|paper roundup|survey|academic paper|university|et al\.?|fault injection|timing analysis|radiation hydrodynamic|lithography defect|vision-language models|conference agenda|magazine|podcast|webinar|mini pc|playstation|console|游戏|手游|geforce now|summer sale|swift package index|软件包|开发者工具|应用商店|diffusiongemma|local ai|sovereign ai|keynote coverage|tape out|tapes out|laptop|macbook|xps|kvm|mid-tower|atx case|gpu-z|exceria|raptor lake|undersea cable|portable|enclosure|drivers?|whql|arc gpu|deepseek|entity list|rtx remix|pubg|ace ai|gas turbines|naacp|lawsuit|robots? that taught themselves|fab roadmap examined|built-in memory|consumer ryzen|memory encryption|rtx spark|consumer pcie|greenlake|防诈骗|被盗怎么办|官方支持文档|国补|免息|自营|优惠|促销|另类营销|下水玩|手机曝光|galaxy z flip|galaxy m|vivo y|nothing phone|steam machine|ldlc|rx 9060|发电装机容量/.test(value);
}

function shouldShowByDefault(article, rawText) {
  const value = `${article.title} ${rawText || ""}`.toLowerCase();
  if (isLowManagementValue(value)) {
    return false;
  }
  if (/stockholder meeting|annual meeting|shareholder meeting|geforce now summer sale|membership savings/.test(value)) {
    return false;
  }
  if (article.sourceId === "sec_edgar" && article.topic === "8-K" && !/capex|capital expenditure|data center|datacenter|server|ai|cloud|gpu|financing|acquisition|agreement|customer|order|capacity/.test(value)) {
    return false;
  }
  if (article.sourceId === "ithome" && !/供应链|代工|工厂|产能|量产|订单|集采|中标|服务器|ai\s*服务器|ai服务器|数据中心|芯片营收|芯片设计|微软|meta|字节跳动|印度|越南|苹果.*供应链|三星显示|oled|液冷|电源|光模块|连接器|线束|立讯|富士康|鸿海|捷普|jabil|广达|纬颖|英业达|服务器制造|安全芯片/.test(value)) {
    return false;
  }
  return article.relevance !== "低";
}

function getLowValueReason(article, rawText) {
  const value = `${article.title} ${rawText || ""}`.toLowerCase();
  if (isLowManagementValue(value)) {
    return "技术论文或研究合集，管理层决策价值低";
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
  if (/keynote coverage|tape out|tapes out|laptop|macbook|xps|kvm|mid-tower|atx case|gpu-z|exceria|raptor lake|undersea cable|portable|enclosure|drivers?|whql|arc gpu|deepseek|entity list|rtx remix|pubg|ace ai|gas turbines|naacp|lawsuit|robots? that taught themselves|fab roadmap examined|built-in memory|consumer ryzen|memory encryption|rtx spark|consumer pcie|greenlake/.test(value)) {
    return "泛产品或发布会信息，尚未形成明确订单、产能或供应链变化";
  }
  if (/robotaxi/.test(value)) {
    return "车载应用离当前 3C/机柜链条较远";
  }
  return "";
}

function inferRelevanceLabelFromScore(score) {
  if (score >= 10) {
    return "高";
  }
  if (score >= 5) {
    return "中";
  }
  return "低";
}

function conciseText(value = "", maxLength = 180) {
  const text = decodeHtml(value)
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength).replace(/[，。；,. ]+$/g, "")}。`;
}

function makeSummary(title, rawText = "") {
  const text = conciseText(rawText.replace(title, ""), 180);
  if (text && text.length > 20 && /[\u4e00-\u9fa5]/.test(text)) {
    return text;
  }
  return inferTitlePoint(title);
}

function inferTitlePoint(title) {
  const value = title.toLowerCase();
  if (/mlperf|benchmark|performance|training/.test(value)) {
    return "文章核心是硬件平台性能或能效出现新对比，重点看 GPU、服务器平台和数据中心部署效率是否变化。";
  }
  if (/memory|dram|nand|hbm|ssd/.test(value)) {
    return "文章核心是存储供需、价格或产品规格变化，重点看服务器内存、HBM、NAND 和终端 BOM 的传导。";
  }
  if (/xr|ar glasses|agents|agentic|physical ai/.test(value)) {
    return "文章核心是端侧或边缘 AI 交互形态升级，短期先看是否带来传感器、光学、连接器和终端组装规格变化。";
  }
  if (/server|data center|rack|switch|network|storage/.test(value)) {
    return "文章核心是数据中心硬件架构或部署变化，重点看服务器、网络、存储和机柜配套需求。";
  }
  if (/foundry|process|packaging|chiplet|wafer|semiconductor/.test(value)) {
    return "文章核心是半导体制造或封装技术变化，重点看先进制程、封装产能和关键零部件供给。";
  }
  if (/power|cooling|liquid|thermal|pdu|busbar/.test(value)) {
    return "文章核心是功耗和散热约束上升，重点看电源、液冷、PDU、Busbar 和机柜结构件需求。";
  }
  return "文章核心需要继续结合原文判断，当前先保留标题、时间、来源和原文链接。";
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
    const company = article.companies[0];
    if (company === "Apple") {
      return "Apple 10-Q 是观察下半年新品备货、服务收入、库存和供应链风险的硬信号，后续应抽取大中华区、存货和资本开支变化。";
    }
    if (company === "NVIDIA") {
      return "NVIDIA 10-Q 是判断 Blackwell 供给、数据中心收入、库存承诺和客户集中度的关键入口，优先服务 AI 服务器链条判断。";
    }
    if (company === "HPE") {
      return "HPE 10-Q 可用来验证 AI Factory 和服务器网络订单是否转化为收入、毛利和 backlog，而不是只看发布会口径。";
    }
    if (company === "Qualcomm") {
      return "Qualcomm 10-Q 主要用于判断手机 SoC、AI PC 和车载芯片需求是否真实回暖，影响终端 BOM 和备货节奏。";
    }
    return `${company} ${article.topic} 是财务验证入口，重点不在文件本身，而在资本开支、库存、订单能见度和客户风险是否变化。`;
  }

  const text = rawText.toLowerCase();
  if (/coherent|optical|transceiver|optics/.test(text)) {
    return "Coherent 扩建德州光器件产能，说明 AI 数据中心的瓶颈正在从 GPU 扩散到光互连和高速链路供给。";
  }
  if (/苹果|apple/.test(text) && /印度|india/.test(text) && /网络攻击|泄露|文件|调查|supply chain|供应链/.test(text)) {
    return "苹果印度供应链出现数据安全或合规事件，核心不是单次攻击，而是印度制造扩张后供应商治理、文件权限和客户审计压力上升。";
  }
  if (/苹果|apple|iphone/.test(text) && /折叠|foldable|量产|发布/.test(text)) {
    return "苹果折叠 iPhone 进入量产窗口，重点不是新品传闻，而是显示、铰链、结构件、连接器和组装良率会提前进入供应商验证。";
  }
  if (/三星显示|samsung display|oled/.test(text) && /苹果|apple|iphone/.test(text) && /越南|vietnam|量产|许可|工厂/.test(text)) {
    return "Samsung Display 获苹果折叠 iPhone OLED 量产许可并启动越南产线，说明苹果新形态终端供应链正在提前锁定显示和组装配套。";
  }
  if (/中国移动|移动/.test(text) && /服务器|集采|中标/.test(text)) {
    return "中国移动大规模服务器集采反映国内运营商算力基础设施采购仍在放量，需关注服务器整机、线缆、连接器和电源配套的国产供应链机会。";
  }
  if (/鸿海|foxconn|hon hai/.test(text) && /夏普|sharp|战略合作/.test(text)) {
    return "鸿海与夏普扩大合作说明头部 EMS 仍在通过显示、AI、EV 等平台扩张能力边界，立讯需要持续跟踪竞品的客户和产能布局。";
  }
  if (/jabil|捷普/.test(text) && /苹果|apple/.test(text) && /ai\s*服务器|ai服务器|服务器|server|印度|india/.test(text)) {
    return "Jabil 退出苹果印度工厂后转向印度 AI 服务器制造，说明印度制造正在从手机组装外溢到服务器硬件，EMS 竞争边界会重新划分。";
  }
  if (/供应链周报|苹果印度供应链/.test(text) || (/苹果|apple/.test(text) && /歌尔|蓝思|同异光电|xr|光学/.test(text))) {
    return "苹果链周度信息要重点看印度制造、XR 光学、显示和声学零部件的产能迁移，这些会影响立讯的客户份额和区域产能配置。";
  }
  if (/hpe ai factory|ai factory portfolio/.test(text)) {
    return "HPE 把 NVIDIA 平台继续包装成 AI Factory 方案，信号不是单机服务器发布，而是企业采购正在转向整套基础设施交付。";
  }
  if (/self-driving networks/.test(text)) {
    return "HPE 将园区、边缘和数据中心网络纳入 AI Factory 管理体系，说明 AI 机房交付越来越依赖网络自动化和整柜协同。";
  }
  if (/mlperf|benchmark|agentic ai infrastructure benchmark|blackwell|nvl/.test(text)) {
    return "Blackwell 在训练和 agentic AI 基准中强化能效叙事，竞争焦点从单卡性能转向单位功耗下的整机柜吞吐。";
  }
  if (/confidential computing|private cloud compute/.test(text)) {
    return "Apple Private Cloud Compute 引入 NVIDIA 机密计算能力，显示苹果 AI 不只发生在端侧，也在形成受控云端算力需求。";
  }
  if (/lg group|physical ai|mobility/.test(text)) {
    return "NVIDIA 与 LG 推进 AI Factory 合作，重点在制造、机器人和移动场景的物理 AI 基础设施，而不是普通企业 IT 升级。";
  }
  if (/globalfoundries|open standard|scale up/.test(text)) {
    return "GlobalFoundries 支持 AI scale-up 开放标准，反映非 NVIDIA 阵营也在争夺集群互连生态的话语权。";
  }
  if (/retail ssd market has almost disappeared|direct nand supply dries up/.test(text)) {
    return "Silicon Motion 指出零售 SSD 被挤压、PC OEM 转向第三方方案，背后是 NAND 供给被数据中心和大客户重新分配。";
  }
  if (/pcie 6\.0 ssd controller|nand shortages/.test(text)) {
    return "SMI 把 PCIe 6.0 SSD 控制器与 2027 年 NAND 短缺放在一起，信号是 AI 数据中心正在提前锁定存储供给。";
  }
  if (/cxmt|ymtc|chinese memory brands|homegrown/.test(text)) {
    return "中国内存品牌转向 CXMT 和 YMTC，说明国产存储替代正在从政策叙事进入品牌和 PC OEM 采购环节。";
  }
  if (/18a-p|foundry node|diamond rapids/.test(text)) {
    return "Intel 18A-P 进入风险生产，核心看 Diamond Rapids 是否按节奏推进，以及服务器平台切换是否带来新一轮配套设计。";
  }
  if (/panel packaging|cowos/.test(text)) {
    return "TSMC 表态面板级封装短期不会替代 CoWoS，说明 AI 大芯片供给仍受先进封装产能和良率约束。";
  }
  if (/sp7|epyc venice|lga9324|diamond rapids/.test(text)) {
    return "AMD SP7 和 Intel LGA9324-1 插座曝光，说明下一代 AI 服务器平台会带来主板、供电、散热和结构件重新设计。";
  }
  if (/graviton5/.test(text)) {
    return "AWS Graviton5 曝光表明云厂商继续自研服务器 CPU，长期会影响服务器主板、供电和整机设计的标准化路径。";
  }
  if (/geforce now|gaming|rtx/.test(text)) {
    return "消费端 GPU 或云游戏变化偏产品侧，只有在带来显卡、PC 或终端备货变化时才值得提高优先级。";
  }
  if (/robotaxi|automotive|autonomous vehicle|driving safety/.test(text)) {
    return "汽车智能化更多影响车载计算和边缘硬件，对立讯当前 3C 与机柜链条的直接影响较弱。";
  }
  if (/processor|xeon|epyc|graviton|socket|cpu/.test(text)) {
    return "云厂商和服务器 CPU 平台继续升级，重点看主板、供电、散热、连接器和整机设计是否随新平台切换。";
  }
  if (/hbm|dram|nand|memory/.test(text)) {
    return "存储供需变化正在被 AI 数据中心重新定价，HBM、服务器 DRAM 和 NAND 的紧缺会继续影响服务器与终端 BOM。";
  }
  if (/server|rack|switch|network|storage|liquid|cooling|power/.test(text)) {
    return "数据中心硬件升级正在从服务器扩展到网络、存储、供电和散热，真正的增量在整机柜配套能力。";
  }
  if (/semiconductor|chiplet|advanced packaging|eda|foundry|wafer/.test(text)) {
    return "半导体制造和封装信号要看是否改变 AI 芯片交付节奏，单纯技术进展如果没有产能落点，优先级应下降。";
  }
  return makeSummary(article.title, rawText);
}

function translateChineseTitle(title, article) {
  const value = `${title} ${article.summary || ""}`.toLowerCase();
  if (/黄仁勋|ai 工厂|ai factory/.test(value) && /英伟达|nvidia/.test(value)) {
    return "NVIDIA says the AI factory era is reshaping compute infrastructure";
  }
  if (/高通|qualcomm/.test(value) && /微软|microsoft/.test(value) && /meta/.test(value) && /数据中心|芯片营收|芯片/.test(value)) {
    return "Qualcomm targets $15bn data-center chip revenue after Microsoft and Meta wins";
  }
  if (/高通|qualcomm/.test(value) && /字节跳动|bytedance/.test(value) && /芯片设计/.test(value)) {
    return "Qualcomm reportedly discusses chip-design services for ByteDance";
  }
  if (/康宁|corning/.test(value) && /glass bridge|光互连|数据中心|ai/.test(value)) {
    return "Corning launches Glass Bridge optical interconnect technology for AI data centers";
  }
  if (/亚马逊|amazon/.test(value) && /印度|india/.test(value) && /投资|2030|480 亿|48/.test(value)) {
    return "Amazon increases India investment plan to $48bn by 2030";
  }
  if (/sambanova/.test(value) && /估值|筹集|融资|芯片/.test(value)) {
    return "SambaNova reportedly seeks funding at a $10bn valuation";
  }
  if (/我国发电装机容量|发电装机/.test(value)) {
    return "China's installed power-generation capacity passes 4bn kW";
  }
  if (/折叠.*iphone|foldable/.test(value)) {
    return "Apple foldable iPhone reportedly enters mass production window";
  }
  if (/中国移动.*服务器.*集采|服务器集采/.test(value)) {
    return "China Mobile awards RMB 3.2bn PC server procurement tender";
  }
  if (/鸿海.*夏普|foxconn.*sharp/.test(value)) {
    return "Foxconn and Sharp sign strategic cooperation memorandum";
  }
  if (/三星显示|samsung display/.test(value) && /oled|iphone|苹果/.test(value)) {
    return "Samsung Display advances Apple OLED production capacity";
  }
  if (/苹果.*印度|印度.*苹果|apple.*india/.test(value) && /攻击|泄露|调查|供应链/.test(value)) {
    return "Apple India supply chain faces data security and compliance pressure";
  }
  if (/jabil|捷普/.test(value) && /服务器|server|印度|india/.test(value)) {
    return "Jabil shifts India manufacturing focus toward AI servers";
  }
  if (/三星|samsung/.test(value) && /galaxy z flip|折叠/.test(value) && /骁龙|snapdragon/.test(value)) {
    return "Samsung Galaxy Z Flip8 models reportedly shift to Snapdragon chips";
  }
  if (/意法半导体|stmicroelectronics|st54m|后量子|nfc|esim/.test(value)) {
    return "STMicroelectronics launches ST54M mobile secure chip with post-quantum cryptography";
  }
  if (/创见|transcend|bics8|工业级|ssd|存储卡/.test(value)) {
    return "Transcend launches industrial SSD and memory-card products based on BiCS8 flash";
  }
  if (/steam deck/.test(value)) {
    return "Valve says Steam Deck 2 is waiting for a major chip efficiency step-up";
  }
  if (/win11|蓝牙|airpods|beats/.test(value)) {
    return "Microsoft improves Windows 11 Bluetooth experience for AirPods and Beats";
  }
  if (/nothing phone/.test(value)) {
    return "Nothing Phone model appears with Snapdragon 6 Gen 4 and 8GB memory";
  }
  if (/ssd|闪存|存储卡|nand/.test(value)) {
    return "Industrial SSD and flash storage supply signal";
  }
  return `${article.companies?.[0] || "Chinese hardware"} item pending source verification`;
}

function translateChineseSummary(summary, article) {
  const value = `${article.title} ${summary}`.toLowerCase();
  if (/黄仁勋|ai 工厂|ai factory/.test(value) && /英伟达|nvidia/.test(value)) {
    return "NVIDIA CEO Jensen Huang said the AI factory era is arriving and that AI agents are reshaping the computing landscape.";
  }
  if (/高通|qualcomm/.test(value) && /微软|microsoft/.test(value) && /meta/.test(value) && /数据中心|芯片营收|芯片/.test(value)) {
    return "Qualcomm said it has won Microsoft and Meta orders and expects data-center chip revenue to reach $15 billion by 2029.";
  }
  if (/高通|qualcomm/.test(value) && /字节跳动|bytedance/.test(value) && /芯片设计/.test(value)) {
    return "Qualcomm is reportedly discussing chip-design services for ByteDance, pointing to continued demand for custom AI-related silicon.";
  }
  if (/康宁|corning/.test(value) && /glass bridge|光互连|数据中心|ai/.test(value)) {
    return "Corning introduced Glass Bridge at an AI data-center optical communication and interconnect event in Seoul. The glass-based optical interconnect is designed to directly connect photonic integrated circuits with optical fiber for advanced architectures such as CPO and glass-core semiconductor packaging.";
  }
  if (/亚马逊|amazon/.test(value) && /印度|india/.test(value) && /投资|2030|480 亿|48/.test(value)) {
    return "Amazon said CEO Andy Jassy met Indian Prime Minister Narendra Modi in New Delhi and announced an additional $13 billion investment to expand AI and cloud infrastructure in India through 2030. Together with the previously announced $35 billion plan, Amazon's India investment plan reaches $48 billion.";
  }
  if (/sambanova/.test(value) && /估值|筹集|融资|芯片/.test(value)) {
    return "AI chip company SambaNova is reportedly seeking to raise $800 million to $1 billion at a valuation of about $10 billion.";
  }
  if (/我国发电装机容量|发电装机/.test(value)) {
    return "China's installed power-generation capacity exceeded 4 billion kilowatts by the end of May, according to the National Energy Administration.";
  }
  if (/折叠.*iphone|foldable/.test(value)) {
    return "Apple's second-generation wide foldable iPhone project is reportedly confirmed, while the iPhone Air 3 has not yet opened tooling.";
  }
  if (/中国移动.*服务器.*集采|服务器集采/.test(value)) {
    return "China Mobile's large PC server procurement tender was awarded, with the reported total value reaching about RMB 3.2 billion.";
  }
  if (/鸿海.*夏普|foxconn.*sharp/.test(value)) {
    return "Foxconn and Sharp signed a strategic cooperation memorandum covering display, AI, electric vehicles, and related platform-manufacturing opportunities.";
  }
  if (/三星显示|samsung display/.test(value) && /oled|iphone|苹果/.test(value)) {
    return "Samsung Display reportedly received Apple approval for foldable iPhone OLED mass production, with Vietnam capacity already starting production.";
  }
  if (/苹果.*印度|印度.*苹果|apple.*india/.test(value) && /攻击|泄露|调查|供应链/.test(value)) {
    return "An Apple-linked India contract manufacturer reportedly suffered a cyberattack, with about 200,000 files exposed.";
  }
  if (/jabil|捷普/.test(value) && /服务器|server|印度|india/.test(value)) {
    return "After selling an Apple-related India factory, Jabil is reportedly bringing AI server manufacturing to India.";
  }
  if (/三星|samsung/.test(value) && /galaxy z flip|折叠/.test(value) && /骁龙|snapdragon/.test(value)) {
    return "Samsung Galaxy Z Flip8 models for China and the US are reportedly expected to use Snapdragon chips.";
  }
  if (/意法半导体|stmicroelectronics|st54m|后量子|nfc|esim/.test(value)) {
    return "STMicroelectronics launched the ST54M mobile secure chip, integrating post-quantum cryptography, NFC, and eSIM functions.";
  }
  if (/创见|transcend|bics8|工业级|ssd|存储卡/.test(value)) {
    return "Transcend launched industrial SSD and memory-card products based on 3000 P/E BiCS8 flash.";
  }
  if (/steam deck|win11|蓝牙|airpods|beats|nothing phone/.test(value)) {
    return "The item is a consumer-product or software-experience update and does not currently indicate a supply-chain change.";
  }
  if (/ssd|闪存|存储卡|nand/.test(value)) {
    return "The article discusses SSD, NAND flash, or memory-card product and supply changes.";
  }
  return "Needs official-source verification before promotion into the executive feed.";
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

function summarizeChineseSource(title, rawText = "") {
  const cleaned = conciseText(rawText.replaceAll(title, ""), 180)
    .replace(/^IT之家\s*\d+\s*月\s*\d+\s*日消息[，,]?\s*/, "")
    .trim();
  if (cleaned && hasChinese(cleaned)) {
    return cleaned;
  }
  return inferTitlePoint(title);
}

function analyzeArticle(article, rawText, sourceName) {
  const text = `${article.title} ${rawText || ""}`;
  article.originalLanguage = article.originalLanguage || (hasChinese(article.title) ? "zh" : "en");
  article.signalCategory = classifyText(text, article.sourceId);
  article.industry = inferIndustry(text, article.industry);
  article.impactScore = getLuxshareImpactScore(text, article.topic);
  article.importance = inferImportance(text, article.topic);
  article.summary = article.originalLanguage === "zh" ? summarizeChineseSource(article.title, text) : summarizeArticle(article, text);
  article.whyItMatters = makeWhyItMatters(article);
  article.titleZh = article.originalLanguage === "zh" ? article.title : "";
  article.titleEn = article.originalLanguage === "zh" ? translateChineseTitle(article.title, article) : article.title;
  article.summaryZh = article.originalLanguage === "zh" ? article.summary : "";
  article.summaryEn = article.originalLanguage === "zh" ? translateChineseSummary(article.summary, article) : "";
  article.whyZh = article.originalLanguage === "zh" ? article.whyItMatters : "";
  article.whyEn = article.originalLanguage === "zh" ? translateChineseWhy(article.whyItMatters, article) : "";
  article.tags = extractTags(text, article.companies);
  article.relevance = inferRelevanceLabelFromScore(article.impactScore);
  article.showByDefault = shouldShowByDefault(article, text);
  const lowValueReason = getLowValueReason(article, text);
  if (lowValueReason) {
    article.lowValueReason = lowValueReason;
  }
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
  const articles = dedupeArticles(batches.flatMap((batch) => (batch.status === "fulfilled" ? batch.value : [])));
  const failures = batches
    .map((batch, index) => (batch.status === "rejected" ? `${tasks[index][0]}: ${batch.reason.message}` : ""))
    .filter(Boolean);

  const file = `// Generated by scripts/fetch_real_sources.mjs\nconst radarGeneratedArticles = ${JSON.stringify(articles, null, 2)};\n`;
  await fs.writeFile(outputPath, file, "utf8");
  await updateTaxonomyDate(collectionAsOfDate);

  console.log(`Generated ${articles.length} real articles at ${outputPath.pathname}`);
  if (failures.length) {
    console.warn("Fetch failures:");
    failures.forEach((failure) => console.warn(`- ${failure}`));
  }
}

async function updateTaxonomyDate(asOfDate) {
  const taxonomy = await fs.readFile(taxonomyPath, "utf8");
  const updated = taxonomy.replace(/asOfDate: "\d{4}-\d{2}-\d{2}"/, `asOfDate: "${asOfDate}"`);
  await fs.writeFile(taxonomyPath, updated, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
