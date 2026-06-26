import fs from "node:fs/promises";

const rootIndex = new URL("../index.html", import.meta.url);
const siteIndex = new URL("../site/index.html", import.meta.url);
const taxonomyPath = new URL("../taxonomy.js", import.meta.url);

async function getAsOfDate() {
  const taxonomy = await fs.readFile(taxonomyPath, "utf8");
  const match = taxonomy.match(/asOfDate:\s*"(\d{4})-(\d{2})-(\d{2})"/);
  if (!match) {
    throw new Error("Could not find taxonomy asOfDate.");
  }
  return `${match[1]}${match[2]}${match[3]}`;
}

async function updateIndex(fileUrl, version) {
  const html = await fs.readFile(fileUrl, "utf8");
  const updated = html
    .replace(/\.\/taxonomy\.js(?:\?v=[^"]*)?/g, `./taxonomy.js?v=${version}`)
    .replace(/\.\/real-data\.js(?:\?v=[^"]*)?/g, `./real-data.js?v=${version}`)
    .replace(/\.\/app\.js(?:\?v=[^"]*)?/g, `./app.js?v=${version}`);

  if (updated !== html) {
    await fs.writeFile(fileUrl, updated, "utf8");
  }
}

const version = await getAsOfDate();
await updateIndex(rootIndex, version);
await updateIndex(siteIndex, version);
console.log(`Updated asset versions to ${version}`);
