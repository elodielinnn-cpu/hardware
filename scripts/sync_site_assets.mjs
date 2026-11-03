import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

function readOption(name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : path.resolve(args[index + 1]);
}

const rootDirectory = readOption("--root", repositoryRoot);
const siteDirectory = readOption("--site", path.join(rootDirectory, "site"));
const writeMode = args.includes("--write");
const checkMode = args.includes("--check");

if (writeMode === checkMode) {
  throw new Error("Choose exactly one mode: --write or --check.");
}

const sourceAssets = [
  "index.html",
  "app.js",
  "data.js",
  "styles.css",
  "sources.js",
  "articles.js"
];
const deployedAssets = [...sourceAssets, "real-data.js", "taxonomy.js"];

async function copySourceAssets() {
  await fs.mkdir(siteDirectory, { recursive: true });
  for (const fileName of sourceAssets) {
    await fs.copyFile(path.join(rootDirectory, fileName), path.join(siteDirectory, fileName));
  }
  console.log(`Synchronized ${sourceAssets.length} static assets to ${siteDirectory}`);
}

async function checkAssets() {
  const mismatches = [];
  for (const fileName of deployedAssets) {
    try {
      const [rootFile, siteFile] = await Promise.all([
        fs.readFile(path.join(rootDirectory, fileName)),
        fs.readFile(path.join(siteDirectory, fileName))
      ]);
      if (!rootFile.equals(siteFile)) mismatches.push(fileName);
    } catch (error) {
      mismatches.push(`${fileName} (${error.code || error.message})`);
    }
  }
  if (mismatches.length) {
    throw new Error(`Root/site deployment assets are not synchronized: ${mismatches.join(", ")}`);
  }
  console.log(`Verified ${deployedAssets.length} synchronized root/site deployment assets.`);
}

if (writeMode) await copySourceAssets();
if (checkMode) await checkAssets();
