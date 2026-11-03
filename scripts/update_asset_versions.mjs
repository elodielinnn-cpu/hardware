import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

function configuredFileUrl(environmentName, fallback) {
  return process.env[environmentName] ? pathToFileURL(path.resolve(process.env[environmentName])) : fallback;
}

const rootIndex = configuredFileUrl("ASSET_ROOT_INDEX_PATH", new URL("../index.html", import.meta.url));
const siteIndex = configuredFileUrl("ASSET_SITE_INDEX_PATH", new URL("../site/index.html", import.meta.url));
const taxonomyPath = configuredFileUrl("ASSET_TAXONOMY_PATH", new URL("../taxonomy.js", import.meta.url));

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
    .replace(/\n\s*<div class=["']command-box["']>[\s\S]*?<\/div>/g, "")
    .replace(/\.\/styles\.css(?:\?v=[^"]*)?/g, `./styles.css?v=${version}`)
    .replace(/\.\/taxonomy\.js(?:\?v=[^"]*)?/g, `./taxonomy.js?v=${version}`)
    .replace(/\.\/sources\.js(?:\?v=[^"]*)?/g, `./sources.js?v=${version}`)
    .replace(/\.\/articles\.js(?:\?v=[^"]*)?/g, `./articles.js?v=${version}`)
    .replace(/\.\/real-data\.js(?:\?v=[^"]*)?/g, `./real-data.js?v=${version}`)
    .replace(/\.\/data\.js(?:\?v=[^"]*)?/g, `./data.js?v=${version}`)
    .replace(/\.\/app\.js(?:\?v=[^"]*)?/g, `./app.js?v=${version}`);

  if (updated !== html) {
    await fs.writeFile(fileUrl, updated, "utf8");
  }
}

const runSuffix = process.env.ASSET_VERSION_SUFFIX || process.env.GITHUB_RUN_NUMBER || String(Date.now()).slice(-6);
if (!/^\d+$/.test(runSuffix)) {
  throw new Error("Asset version suffix must contain digits only.");
}
const version = `${await getAsOfDate()}-${runSuffix}`;
await updateIndex(rootIndex, version);
await updateIndex(siteIndex, version);
console.log(`Updated asset versions to ${version}`);
