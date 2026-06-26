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

console.log(`Validated ${articles.length} generated articles for ${today}.`);
