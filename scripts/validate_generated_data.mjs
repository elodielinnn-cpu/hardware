import fs from "node:fs/promises";

const dataPath = new URL("../real-data.js", import.meta.url);
const taxonomyPath = new URL("../taxonomy.js", import.meta.url);

function getShanghaiDateString() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(new Date());
}

const dataFile = await fs.readFile(dataPath, "utf8");
const taxonomy = await fs.readFile(taxonomyPath, "utf8");
const json = dataFile.match(/const radarGeneratedArticles = ([\s\S]*?);\n/)?.[1];

if (!json) {
  throw new Error("real-data.js does not contain radarGeneratedArticles.");
}

const articles = JSON.parse(json);
if (articles.length < 50) {
  throw new Error(`Only ${articles.length} articles generated. Refusing to publish partial data.`);
}

const today = getShanghaiDateString();
if (!taxonomy.includes(`asOfDate: "${today}"`)) {
  throw new Error(`taxonomy.js asOfDate is not ${today}.`);
}

const badText = /IT之家 supply-chain signal|This Chinese-source item is retained|customer orders, regional capacity allocation/;
if (badText.test(dataFile)) {
  throw new Error("Generated data contains old Chinese-source placeholder text.");
}

const placeholderText = /pending source verification|Needs official-source verification before promotion into the executive feed|Industrial SSD and flash storage supply signal/i;
const placeholderArticle = articles.find((article) => placeholderText.test(`${article.titleEn || ""} ${article.summaryEn || ""}`));
if (placeholderArticle) {
  throw new Error(`Generated data contains placeholder English text in article ${placeholderArticle.id}.`);
}

const incompleteEndingPattern = /(?:包括|其中|以及|而|与|和|在|向|投|非|Br|iPhone)[。.!?；]*$/u;
const incompleteNumberEndingPattern = /(?:^|[\s，,为])\d+[。；]*$/u;
const brokenEnglishTokenPattern = /\b[A-Z][a-z]?。$/u;
const brokenEnglishSummaryStart = /^(?:\d+\s*nm\b|\d+\s*(?:gb\/s|tb\/s|mb\/s)\b|nm node\b|according to\b|reports from\b|recent reports from\b|[a-z][a-z]+(?:\s+[a-z][a-z]+){0,3}\b)/i;
const validEnglishSummaryStart = /^(?:this|the|a|an|at|inside|intel|amd|nvidia|samsung|apple|sk hynix|asrock|jetcool|bytedance|goertek|infineon|ase|microsoft)\b/i;
const genericFallbackSummary = /文章核心需要继续结合原文判断/;
const genericSummaryStart = /^(数据中心硬件升级正在|云厂商和服务器 CPU 平台继续|半导体制造和封装信号要看|存储供需变化正在被 AI 数据中心重新定价|文章核心是)/;
const brokenChineseSummaryStart = /^(?:\d+\s*(?:万亿元人民币|亿元人民币|亿美元|港元|韩元)[）)]|[）)]|数据显示[，,]?\s*其中|报告称[，,]?\s*其中|，?其中|并且?|以及|同时|此外|另外|该|其|这也|这意味着|\d+\s+和\s+USB-C)/u;
const coreIndustrySignal = /立讯|luxshare|apple\s*供应链|苹果.*供应链|iphone.*供应链|供应链|supply chain|供应商|supplier|零部件|component|富士康|foxconn|鸿海|代工|ems|jdm|odm|产能|扩产|量产|订单|服务器|数据中心|ai\s*服务器|ai服务器|半导体|芯片|晶圆|封装|soc|hbm|dram|nand|oled|pcb|连接器|线束|光模块|电源|液冷|散热|机柜|玻璃基板|mlcc|server|data center|datacenter|semiconductor|chip|wafer|packaging|connector|optical module|power supply|liquid cooling|rack|busbar|pdu|blackwell|gb300|gb200|nvl72|nvl4|gpu rack|ai accelerator|nm node|mass production|氧化镓|gallium oxide|ga2o3|外延|epitaxy|epitaxial|同质外延|homoepitaxy|化合物半导体|compound semiconductor|宽禁带|wide bandgap|超宽禁带|ultra-wide bandgap|衬底|substrate|声学|acoustic|speaker|microphone|audio module|camera module|lens|sensor module|vcsel|tof|sip|module packaging|fatp|final assembly|组装|整机组装|wiring harness|automotive harness|wire harness|汽车线束|高压线束|低压线束|automotive connector|automotive electronics|\bemi\b|\bemc\b|electromagnetic shielding|shielding|电磁屏蔽|电磁兼容/i;
const weakFactorySignal = /(?:工厂|factory)/i;
const factoryContextSignal = /代工|产能|扩产|量产|供应链|apple|苹果|iphone|服务器|数据中心|半导体|封装|组件|零部件/i;
const irrelevantConsumerOrSocialNoise = /偷窃|饼干|员工被控|解雇|劳动纠纷|机模曝光|驱动|模拟器|车型|大众汽车|就业岗位|裁员/i;
const defaultFeedNegativeSignal = /cuda emulator|emulator|zluda|drivers?|software tools?|software stack|token cost|open-source tools?|legacy gpu|returns to retail|retail graphics card|gaming gpu|world cup streams?|illegal streams?|domains seized|lunar orbit|aerospace|science program|research program|hollow-core fiber trial|lawsuit|patent dispute|consumer retail|retro hardware|vintage computer|apple ii(?: plus)?|6502 cpu|ev battery|blade battery|power battery|electric vehicle battery|automotive battery|car battery|lithium carbonate|lithium mine|catl|game|streaming|file transfer tool|productivity app|lifetime deal|sponsored deal|paid promo|marketplace promo|app subscription deal|software subscription deal|cloud storage promo|for life with|just \$\d+|slopfix|ai-generated code|code bloat|software team|messy repositories|consumer router|home router|tenda router|hidden backdoor|router backdoor|consumer networking security|home network security|dog tracker|pet tracker|fi ultra|consumer iot tracker|wearable pet device|satellite pet tracker|模拟器|驱动|软件工具|软件栈|token cost|开源工具|消费显卡|零售|返场|航天|月球轨道|科研项目|试验|非法直播|域名查封|专利诉讼|复古硬件|老电脑|复刻电脑|爱好者产品|新能源汽车电池|锂矿|碳酸锂|宁德时代|动力电池|刀片电池|车企电池|电动车电池|汽车电池|锂矿|碳酸锂|宁德时代|西咸基地|整车产能|车企产能|游戏|直播|软件促销|软件订阅|软件优惠|终身订阅|家用路由器|消费路由器|路由器后门|家庭网络安全|宠物追踪器|狗狗追踪器|消费\s*iot|宠物设备|卫星宠物追踪/i;
const explicitDefaultFeedBans = /cuda emulator|zluda|rtx 3060.*returns to retail|world cup streams?|lunar orbit|hollow-core fiber trial|apple ii(?: plus)?|6502 cpu|blade battery|power battery|transfr pro|send unlimited files|lifetime deal|file transfer tool|software subscription deal|for life with|just \$\d+|slopfix|ai-generated code|code bloat|software team|messy repositories|tenda routers?|hidden backdoor|dog tracker|pet tracker|fi ultra|刀片电池|动力电池|新能源汽车电池|锂矿|碳酸锂|宁德时代|车企产能|复古硬件|复刻电脑|软件促销|终身订阅|路由器后门|宠物追踪器|狗狗追踪器/i;
const genericCompanyOnlyPattern = /^(?:nvidia|amd|google|apple|microsoft|amazon|meta|openai|英伟达|苹果|谷歌|微软|亚马逊)(?:\\s|$)/i;
const compoundSemiconductorHardSignal = /(?:氧化镓|gallium oxide|ga2o3|外延|epitaxy|epitaxial|同质外延|homoepitaxy|化合物半导体|compound semiconductor|宽禁带|wide bandgap|超宽禁带|ultra-wide bandgap|衬底|substrate|晶圆|wafer).*(?:量产线|production line|mass production line|6\s*英寸|8\s*英寸|6-inch|8-inch|半导体|semiconductor|晶圆|wafer|外延|epitaxy|epitaxial|氧化镓|gallium oxide|ga2o3)|(?:量产线|production line|mass production line|6\s*英寸|8\s*英寸|6-inch|8-inch).*(?:氧化镓|gallium oxide|ga2o3|外延|epitaxy|epitaxial|同质外延|homoepitaxy|化合物半导体|compound semiconductor|宽禁带|wide bandgap|超宽禁带|ultra-wide bandgap|衬底|substrate|晶圆|wafer|半导体|semiconductor)/i;
const ithomeHardSignal = /立讯|luxshare|歌尔|goertek|富士康|foxconn|和硕|pegatron|纬创|wistron|比亚迪电子|byd electronics|apple supplier|供应商|订单|量产|扩产|产能|产能爬坡|爬坡|良率|成本|涨价|降价|bom|供应链迁移|印度生产|越南生产|中国工厂转移|fatp|final assembly|camera module|optical module|acoustic module|connector|连接器|线束|光学模组|声学|封装|hbm|advanced packaging|液冷|机柜|电源|氧化镓|gallium oxide|ga2o3|外延|epitaxy|epitaxial|同质外延|homoepitaxy|化合物半导体|compound semiconductor|宽禁带|wide bandgap|超宽禁带|ultra-wide bandgap|衬底|substrate/i;
const ithomeLowValueSignal = /探秘|走进工厂|亲手组装|科普|体验|评测|拆解|维修|参数爆料|渲染图|机模|售价|促销|消费新品|趣闻|社会新闻|专利|patent/i;
const strongCoreIndustrySignal = /data center rack|ai server|ai\s*服务器|liquid cooling|power supply|connector|optical module|hbm|advanced packaging|foundry capacity|apple supplier|ems|odm|jdm|luxshare|立讯|服务器|数据中心|液冷|电源|连接器|光模块|封装|代工|富士康|foxconn|鸿海|机柜|busbar|pdu|gb300|gb200|nvl72|blackwell|ai accelerator|声学|acoustic|speaker|microphone|audio module|camera module|lens|sensor module|vcsel|tof|sip|module packaging|fatp|final assembly|组装|整机组装|wiring harness|automotive harness|wire harness|汽车线束|高压线束|低压线束|automotive connector|automotive electronics|\bemi\b|\bemc\b|electromagnetic shielding|shielding|电磁屏蔽|电磁兼容/i;
const luxshareBusinessFitSignal = /声学|acoustic|speaker|microphone|audio module|光学模组|optical module|camera module|lens|sensor module|vcsel|tof|封装|advanced packaging|sip|module packaging|fatp|final assembly|final assembly test and pack|组装|整机组装|rack|rack-scale|server rack|ai rack|机柜|整机柜|liquid cooling|cold plate|cdu|rear-door heat exchanger|散热|液冷|电源|power supply|power module|800v dc|busbar|connector|high-speed connector|copper interconnect|copper cable|dac|aec|optical interconnect|aoc|cpo|osfp|qsfp|连接器|铜连接|光连接|光模块|线缆|wiring harness|automotive harness|wire harness|线束|汽车线束|高压线束|低压线束|automotive connector|automotive electronics|\bemi\b|\bemc\b|electromagnetic shielding|shielding|电磁屏蔽|电磁兼容/i;
const weakDefaultFeedSignal = /\b(?:linux kernel patch|kernel patch|patch|weekly roundup|news roundup|roundup|gptfuzz|jailbreak|fuzzing|llm safety|llm security|ai safety|ai security testing|prompt injection|software-defined vehicle|sdv|vehicle trust|automotive cybersecurity|ota security|vehicle software security|rx 7900|rx 7900 xtx|radeon rx|geforce rtx consumer|engineering sample|gpu engineering sample|graphics card engineering sample|leaked gpu|gpu leak|graphics card leak|benchmark leak|overclocking|oc sku|desktop gpu|consumer gpu|gaming gpu|retail gpu|ifixit|teardown|repair team|repair video|factory tour|hands-on|hands on|assemble a battery|battery assembly video|file transfer tool|productivity app|lifetime deal|sponsored deal|paid promo|marketplace promo|app subscription deal|software subscription deal|slopfix|ai-generated code|code bloat|software team|messy repositories|consumer router|home router|tenda router|hidden backdoor|router backdoor|consumer networking security|home network security|dog tracker|pet tracker|fi ultra|consumer iot tracker|wearable pet device|satellite pet tracker)\b|week in review|edge ai acquisition|edge ai is for real|cloud storage promo|for life with|just \$\d+|显卡工程样品|工程样品|显卡泄露|跑分泄露|消费显卡|游戏显卡|拆解|维修团队|维修视频|工厂探访|探秘|走进工厂|亲手组装|科普视频|生产线探秘|软件促销|软件订阅|软件优惠|终身订阅|家用路由器|消费路由器|路由器后门|家庭网络安全|宠物追踪器|狗狗追踪器|消费\s*iot|宠物设备|卫星宠物追踪/i;
const weakRoundupSignal = /\b(?:week in review|weekly roundup|news roundup|roundup)\b/i;
const strongBusinessLandingSignal = /data center hardware|data center gpu|epyc server|server platform|server gpu|gpu cluster|data center|datacenter|ai server|ai\s*服务器|ai accelerator|rack|rack-scale|gb200|gb300|b200|b300|h100|h200|mi300|mi350|mi400|instinct|rubin|vera rubin|nvl|nvlink|hbm|cowos|advanced packaging|advanced packaging capacity|memory-on-package|packaging capacity|csp deployment|cloud deployment|firmware resiliency|bmc|bios|secure boot|hardware root of trust|supply chain security|supplier|order|capacity|production ramp|mass production|yield|bom|cost|supply chain shift|india production|china factory transfer|vietnam production|apple supplier|luxshare|goertek|foxconn|pegatron|wistron|byd electronics|立讯|歌尔|富士康|和硕|纬创|比亚迪电子|ems|odm|jdm|fatp|final assembly|connector|cable|wire harness|power module|power supply|liquid cooling|cold plate|sensor module|camera module|optical module|acoustic module|audio module|automotive connector|automotive harness|electronic module|\bemi\b|\bemc\b|electromagnetic shielding|服务器|数据中心|机柜|整机柜|ai加速器|先进封装|先进封装产能|封装产能|固件韧性|硬件信任根|供应链安全|供应商|订单|产能|量产|爬坡|良率|成本|供应链迁移|印度生产|中国工厂转移|越南生产|连接器|线缆|线束|电源模块|电源|液冷|冷板|传感器模组|摄像头模组|光学模组|声学模组|汽车连接器|电子模组|电磁屏蔽|电磁兼容/i;
const technicalExplainerSignal = /\b(?:how to|guide|best practices?|explainer|primer|tutorial|thought leadership|white ?paper|opinion|perspective|framework|why|what is|technical overview|technical deep dive)\b|技术解读|科普|指南|最佳实践|白皮书|观点|深度解析/i;
const newsEventSignal = /\b(?:filed|launched|announced|unveiled|released|started mass production|mass production|capacity|production ramp|order|supplier|customer|acquisition|investment|capex|funding|shipment|vulnerability|breach|cyberattack|outage|recall|regulatory|sanctions|export control|filed 10-q|filed 8-k)\b|量产|扩产|订单|供应商|客户|收购|投资|资本开支|融资|出货|漏洞|攻击|停摆|制裁|出口管制/i;
const hobbyistRetroSignal = /ancient apollo-era|apollo-era|maker to construct|build his own memory|diy memory|retro computing|hobbyist|vintage|ancient tech|复古|爱好者|diy|自制内存|老技术/i;
const explicitHobbyistDiySignal = /ancient apollo-era|apollo-era|maker to construct|build his own memory|hand-threaded magnetic core memory|salvaged russian computer parts|diy memory|自制内存|复古|爱好者/i;
const memoryHardSignal = /dram price|hbm|nand|server memory|data center memory|memory capacity|memory shortage|supplier|order|capacity|price hike|price increase|存储器价格|dram|服务器内存|数据中心内存|供应商|订单|产能|涨价/i;
const consumerGamingHardwareSignal = /ps5|playstation|xbox|nintendo|game console|disc drive|purchase cap|retail limit|gaming console|游戏主机|光驱|购买限制|消费硬件零售/i;
const gameContentSignal = /video game|gaming title|game studio|game ip|racing game|need for speed|burnout|battlefield|criterion|electronic arts|ea games|esports?|game release|game development|halo|warframe|campaign evolved|goes gold|游戏工作室|赛车游戏|电竞/i;
const softwarePlatformSignal = /omniverse|free for production use|software platform|production use|software pricing|software license|platform free|软件平台|软件授权|软件免费|商业策略/i;
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
const automotiveSignal = /automotive|vehicle|\bcar\b|\bev\b|汽车|整车|车企|新能源汽车|电动车/i;
const automotiveLuxshareFitSignal = /wiring harness|automotive harness|wire harness|线束|汽车线束|高压线束|低压线束|automotive connector|automotive electronics|\bemi\b|\bemc\b|electromagnetic shielding|shielding|电磁屏蔽|电磁兼容/i;
const semiconductorAutomotiveHardSignal = /\b(?:foundry|fab|semiconductor|chip|soc|ai chip|ai accelerator|node|wafer|tsmc|samsung foundry|intel foundry|mass produce|mass production|production|tape-out|tape out|advanced process|advanced node)\b|(?:\b[2345]\s*nm\b)/i;
const softwareOnlySignal = /software stack|inference software|token cost|软件栈/i;
const rssFooterSignal = /\b(?:The post|appeared first on|Read more|Continue reading)\b/i;
const summaryCounts = new Map();

function cleanSummaryText(value = "") {
  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\bThe post\b[\s\S]*?\bappeared first on\b[\s\S]*?\.?$/i, "")
    .replace(/\b(Read more|Continue reading)\b[\s\S]*$/i, "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

function isShortDefaultSummary(article, summary = "") {
  if (article.sourceId === "sec_edgar") {
    return false;
  }
  const text = cleanSummaryText(summary);
  if (/[\u4e00-\u9fa5]/.test(text)) {
    return text.length < 20;
  }
  return text.length < 50;
}

function hasBrokenEnglishSummaryStart(value = "") {
  const text = cleanSummaryText(value);
  return brokenEnglishSummaryStart.test(text) && !validEnglishSummaryStart.test(text);
}

function hasCoreIndustrySignal(value = "") {
  return coreIndustrySignal.test(value) || (weakFactorySignal.test(value) && factoryContextSignal.test(value));
}

function hasStrongCoreIndustrySignal(value = "") {
  return strongCoreIndustrySignal.test(value);
}

function hasSecFilingHardSignal(value = "") {
  const text = String(value).replace(genericSecFilingAlert, "");
  return secFilingHardSignal.test(text) || (secBusinessRelevantItemSignal.test(text) && secBusinessContextSignal.test(text));
}

function hasLuxshareBusinessFit(value = "") {
  return luxshareBusinessFitSignal.test(value);
}

function hasActionableWeakDefaultFeedException(article = {}, value = "") {
  if (!weakDefaultFeedSignal.test(value)) {
    return true;
  }
  if (/vbios/i.test(value) && /rx 7900|radeon rx|engineering sample|gpu leak|graphics card leak|consumer gpu|gaming gpu/i.test(value)) {
    return false;
  }
  const title = article.title || "";
  if (weakRoundupSignal.test(title)) {
    return strongBusinessLandingSignal.test(title);
  }
  return strongBusinessLandingSignal.test(value);
}

function hasTechnicalExplainerWithoutNewsEvent(value = "") {
  return technicalExplainerSignal.test(value) && !newsEventSignal.test(value);
}

function hasWeakTopicWithoutLandingSignal(value = "") {
  return explicitHobbyistDiySignal.test(value) ||
    (hobbyistRetroSignal.test(value) && !memoryHardSignal.test(value)) ||
    consumerGamingHardwareSignal.test(value) ||
    gameContentSignal.test(value) ||
    softwarePromoSignal.test(value) ||
    (consumerSecuritySignal.test(value) && !enterpriseSecurityLandingSignal.test(value)) ||
    (consumerIotSatelliteSignal.test(value) && !communicationsHardwareLandingSignal.test(value)) ||
    (softwarePlatformSignal.test(value) && !nvidiaHardwareLandingSignal.test(value)) ||
    (consumerCoolingSignal.test(value) && !dataCenterCoolingLandingSignal.test(value));
}

for (const article of articles) {
  for (const field of ["summary", "summaryZh", "summaryEn"]) {
    const value = article[field];
    if (!value) {
      continue;
    }
    if (value.includes("。。")) {
      throw new Error(`Generated data contains duplicate Chinese punctuation in ${field} for article ${article.id}.`);
    }
    if (genericFallbackSummary.test(value)) {
      throw new Error(`Generated data contains generic fallback summary in ${field} for article ${article.id}.`);
    }
    if (genericSummaryStart.test(value.trim())) {
      throw new Error(`Generated data contains over-generic summary in ${field} for article ${article.id}: ${value}`);
    }
    if (brokenChineseSummaryStart.test(value.trim())) {
      throw new Error(`Generated data contains broken Chinese summary start in ${field} for article ${article.id}: ${value}`);
    }
    const trimmed = value.trim();
    const hasChineseText = /[\u4e00-\u9fa5]/.test(trimmed);
    if (incompleteEndingPattern.test(trimmed) || (hasChineseText && incompleteNumberEndingPattern.test(trimmed)) || brokenEnglishTokenPattern.test(trimmed)) {
      throw new Error(`Generated data contains incomplete summary ending in ${field} for article ${article.id}: ${value}`);
    }
  }
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
  const briefingValue = article.briefingValue || [];
  if (!Array.isArray(briefingValue)) {
    throw new Error(`Article briefingValue must be an array: ${article.id}`);
  }
  if (article.showByDefault === true && briefingValue.length === 0) {
    throw new Error(`Default-feed article lacks briefingValue: ${article.id}`);
  }
  if (article.showByDefault === true) {
    const title = article.titleZh || article.title || article.titleEn || "";
    const summary = article.summary || article.summaryZh || article.summaryEn || "";
    if (!summary) {
      throw new Error(`Default-feed article lacks summary: ${article.id}`);
    }
    if (normalizeForReplay(title) === normalizeForReplay(summary)) {
      throw new Error(`Default-feed summary equals title: ${article.id}`);
    }
    if (article.originalLanguage === "en" && isTitleReplay(title, summary)) {
      throw new Error(`Default-feed English summary repeats title without enough new facts: ${article.id}`);
    }
    if (article.originalLanguage === "en" && hasBrokenEnglishSummaryStart(summary)) {
      throw new Error(`Default-feed English summary has broken start: ${article.id}: ${summary}`);
    }
    if (rssFooterSignal.test(summary)) {
      throw new Error(`Default-feed summary contains RSS footer text: ${article.id}`);
    }
    if (isShortDefaultSummary(article, summary)) {
      throw new Error(`Default-feed summary is too short: ${article.id}`);
    }
  }
  if (article.relevance === "高" && briefingValue.length === 0) {
    throw new Error(`High relevance article lacks briefingValue: ${article.id}`);
  }
  if (article.showByDefault === true && automotiveSignal.test(articleText) && !automotiveLuxshareFitSignal.test(articleText) && !semiconductorAutomotiveHardSignal.test(articleText)) {
    throw new Error(`Automotive article entered default feed without Luxshare-fit automotive signal: ${article.id}`);
  }
  if (article.showByDefault === true && softwareOnlySignal.test(articleText) && !hasLuxshareBusinessFit(articleText)) {
    throw new Error(`Software-stack article entered default feed without Luxshare-fit signal: ${article.id}`);
  }
  if (article.showByDefault === true && !hasActionableWeakDefaultFeedException(article, articleText)) {
    throw new Error(`Weak-signal article entered default feed without strong business landing: ${article.id}`);
  }
  if (article.relevance === "高" && !hasActionableWeakDefaultFeedException(article, articleText)) {
    throw new Error(`Weak-signal article marked high relevance without strong business landing: ${article.id}`);
  }
  if (article.showByDefault === true && hasTechnicalExplainerWithoutNewsEvent(articleText)) {
    throw new Error(`Technical explainer article entered default feed without news event: ${article.id}`);
  }
  if (article.relevance === "高" && hasTechnicalExplainerWithoutNewsEvent(articleText)) {
    throw new Error(`Technical explainer article marked high relevance without news event: ${article.id}`);
  }
  if (article.showByDefault === true && hasWeakTopicWithoutLandingSignal(articleText)) {
    throw new Error(`Weak topic article entered default feed without required landing signal: ${article.id}`);
  }
  if (article.relevance === "高" && hasWeakTopicWithoutLandingSignal(articleText)) {
    throw new Error(`Weak topic article marked high relevance without required landing signal: ${article.id}`);
  }
  if ((article.showByDefault === true || article.relevance === "高") && hasLuxshareBusinessFit(articleText) && !briefingValue.includes("Luxshare business fit")) {
    throw new Error(`Luxshare-fit article lacks Luxshare business fit briefingValue: ${article.id}`);
  }
  if (article.relevance === "高" && !hasCoreIndustrySignal(articleText)) {
    throw new Error(`High relevance article lacks core industry signal: ${article.id}`);
  }
  if (article.sourceId === "ithome" && article.showByDefault === true && !hasCoreIndustrySignal(articleText)) {
    throw new Error(`IT之家 default-feed article lacks core industry signal: ${article.id}`);
  }
  if (
    article.sourceId === "ithome" &&
    article.showByDefault === true &&
    !ithomeHardSignal.test(articleText) &&
    !compoundSemiconductorHardSignal.test(articleText)
  ) {
    throw new Error(`IT之家 default-feed article lacks hard supply-chain signal: ${article.id}`);
  }
  if (article.sourceId === "ithome" && article.showByDefault === true && ithomeLowValueSignal.test(articleText)) {
    throw new Error(`Low-value IT之家 article entered default feed: ${article.id}`);
  }
  if (
    article.sourceId === "ithome" &&
    article.relevance === "高" &&
    !ithomeHardSignal.test(articleText) &&
    !compoundSemiconductorHardSignal.test(articleText)
  ) {
    throw new Error(`IT之家 article marked high relevance without hard supply-chain signal: ${article.id}`);
  }
  if (article.sourceId === "ithome" && article.relevance === "高" && ithomeLowValueSignal.test(articleText)) {
    throw new Error(`Low-value IT之家 article marked high relevance: ${article.id}`);
  }
  if (irrelevantConsumerOrSocialNoise.test(articleText) && (article.relevance === "高" || article.showByDefault === true)) {
    throw new Error(`Irrelevant/noise article promoted into feed: ${article.id}`);
  }
  if (article.showByDefault === true && defaultFeedNegativeSignal.test(articleText) && !hasStrongCoreIndustrySignal(articleText)) {
    throw new Error(`Default-feed article contains negative signal without strong core industry signal: ${article.id}`);
  }
  if (article.showByDefault === true && explicitDefaultFeedBans.test(articleText)) {
    throw new Error(`Explicitly banned title entered default feed: ${article.id}`);
  }
  if (article.sourceId === "sec_edgar" && article.showByDefault === true && !hasSecFilingHardSignal(articleText)) {
    throw new Error(`SEC filing entered default feed without concrete filing signal: ${article.id}`);
  }
  if (article.sourceId === "sec_edgar" && article.showByDefault === true && genericSecFilingAlert.test(article.summary || "")) {
    throw new Error(`SEC filing with generic alert summary entered default feed: ${article.id}`);
  }
  if (article.sourceId === "sec_edgar" && article.relevance === "高" && !hasSecFilingHardSignal(articleText)) {
    throw new Error(`SEC filing marked high relevance without concrete filing signal: ${article.id}`);
  }
  if (article.relevance === "高" && genericCompanyOnlyPattern.test(articleText) && !hasStrongCoreIndustrySignal(articleText)) {
    throw new Error(`High relevance article appears to rely on generic company/technology signal only: ${article.id}`);
  }
  if (article.summary) {
    summaryCounts.set(article.summary, (summaryCounts.get(article.summary) || 0) + 1);
  }
}

const repeatedSummary = Array.from(summaryCounts.entries()).find(([, count]) => count > 2);
if (repeatedSummary) {
  const [summary, count] = repeatedSummary;
  throw new Error(`Generated data contains repeated summary ${count} times: ${summary}`);
}

console.log(`Validated ${articles.length} generated articles for ${today}.`);
