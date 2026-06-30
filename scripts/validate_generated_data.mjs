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
const genericFallbackSummary = /文章核心需要继续结合原文判断/;
const genericSummaryStart = /^(数据中心硬件升级正在|云厂商和服务器 CPU 平台继续|半导体制造和封装信号要看|存储供需变化正在被 AI 数据中心重新定价|文章核心是)/;
const brokenChineseSummaryStart = /^(?:\d+\s*(?:万亿元人民币|亿元人民币|亿美元|港元|韩元)[）)]|[）)]|，?其中|并|以及|\d+\s+和\s+USB-C)/u;
const coreIndustrySignal = /立讯|luxshare|apple\s*供应链|苹果.*供应链|iphone.*供应链|供应链|supply chain|供应商|supplier|零部件|component|富士康|foxconn|鸿海|代工|ems|jdm|odm|产能|扩产|量产|订单|服务器|数据中心|ai\s*服务器|ai服务器|半导体|芯片|晶圆|封装|soc|hbm|dram|nand|oled|pcb|连接器|线束|光模块|电源|液冷|散热|机柜|玻璃基板|mlcc|server|data center|datacenter|semiconductor|chip|wafer|packaging|connector|optical module|power supply|liquid cooling|rack|busbar|pdu|blackwell|gb300|gb200|nvl72|nvl4|gpu rack|ai accelerator/i;
const weakFactorySignal = /(?:工厂|factory)/i;
const factoryContextSignal = /代工|产能|扩产|量产|供应链|apple|苹果|iphone|服务器|数据中心|半导体|封装|组件|零部件/i;
const irrelevantConsumerOrSocialNoise = /偷窃|饼干|员工被控|解雇|劳动纠纷|机模曝光|驱动|模拟器|车型|大众汽车|就业岗位|裁员/i;
const defaultFeedNegativeSignal = /cuda emulator|emulator|zluda|drivers?|software tools?|open-source tools?|legacy gpu|returns to retail|retail graphics card|gaming gpu|world cup streams?|illegal streams?|domains seized|lunar orbit|aerospace|science program|research program|hollow-core fiber trial|lawsuit|patent dispute|consumer retail|retro hardware|vintage computer|apple ii(?: plus)?|6502 cpu|ev battery|blade battery|power battery|electric vehicle battery|automotive battery|car battery|game|streaming|模拟器|驱动|软件工具|开源工具|消费显卡|零售|返场|航天|月球轨道|科研项目|试验|非法直播|域名查封|专利诉讼|复古硬件|老电脑|复刻电脑|爱好者产品|新能源汽车电池|动力电池|刀片电池|车企电池|电动车电池|汽车电池|西咸基地|整车产能|车企产能|游戏|直播/i;
const explicitDefaultFeedBans = /cuda emulator|zluda|rtx 3060.*returns to retail|world cup streams?|lunar orbit|hollow-core fiber trial|apple ii(?: plus)?|6502 cpu|blade battery|power battery|刀片电池|动力电池|新能源汽车电池|车企产能|复古硬件|复刻电脑/i;
const genericCompanyOnlyPattern = /^(?:nvidia|amd|google|apple|microsoft|amazon|meta|openai|英伟达|苹果|谷歌|微软|亚马逊)(?:\\s|$)/i;
const strongCoreIndustrySignal = /data center rack|ai server|ai\s*服务器|liquid cooling|power supply|connector|optical module|hbm|advanced packaging|foundry capacity|apple supplier|ems|odm|jdm|luxshare|立讯|服务器|数据中心|液冷|电源|连接器|光模块|封装|代工|富士康|foxconn|鸿海|机柜|busbar|pdu|gb300|gb200|nvl72|blackwell|ai accelerator/i;
const summaryCounts = new Map();

function hasCoreIndustrySignal(value = "") {
  return coreIndustrySignal.test(value) || (weakFactorySignal.test(value) && factoryContextSignal.test(value));
}

function hasStrongCoreIndustrySignal(value = "") {
  return strongCoreIndustrySignal.test(value);
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
    if (incompleteEndingPattern.test(value.trim()) || incompleteNumberEndingPattern.test(value.trim()) || brokenEnglishTokenPattern.test(value.trim())) {
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
  if (article.relevance === "高" && !hasCoreIndustrySignal(articleText)) {
    throw new Error(`High relevance article lacks core industry signal: ${article.id}`);
  }
  if (article.sourceId === "ithome" && article.showByDefault === true && !hasCoreIndustrySignal(articleText)) {
    throw new Error(`IT之家 default-feed article lacks core industry signal: ${article.id}`);
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
