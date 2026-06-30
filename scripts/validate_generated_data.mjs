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
const summaryCounts = new Map();

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
    if (incompleteEndingPattern.test(value.trim()) || incompleteNumberEndingPattern.test(value.trim()) || brokenEnglishTokenPattern.test(value.trim())) {
      throw new Error(`Generated data contains incomplete summary ending in ${field} for article ${article.id}: ${value}`);
    }
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
