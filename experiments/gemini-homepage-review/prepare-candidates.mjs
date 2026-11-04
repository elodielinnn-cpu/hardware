import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import vm from "node:vm";
import { buildGeminiCandidates, GEMINI_REVIEW_RULE_VERSION, selectIncrementalCandidates } from "./cache.mjs";

const inputPath = path.resolve(process.env.NEWS_DATA_PATH || "real-data.js");
const siteInputPath = path.resolve(process.env.SITE_NEWS_DATA_PATH || "site/real-data.js");
const storePath = path.resolve(process.env.GEMINI_REVIEW_STORE_PATH || "outputs/gemini-homepage-review/latest.json");
const outputPath = path.resolve(process.env.GEMINI_REVIEW_CANDIDATES_PATH || "outputs/gemini-homepage-review/candidates.json");
const limit = Number(process.env.MAX_REVIEW_CANDIDATES || 12);

let manifest;
try {
  const [source, siteSource] = await Promise.all([fs.readFile(inputPath, "utf8"), fs.readFile(siteInputPath, "utf8")]);
  if (source !== siteSource) throw new Error("root_site_real_data_mismatch");
  const payload = new vm.Script(`${source}\n({ metadata: typeof radarGenerationMetadata === "undefined" ? null : radarGenerationMetadata, articles: radarGeneratedArticles });`).runInNewContext(Object.create(null));
  if (payload.metadata?.filterMode !== "v3") throw new Error(`expected_v3_found_${payload.metadata?.filterMode || "unknown"}`);
  if (!Array.isArray(payload.articles) || payload.metadata.articleCount !== payload.articles.length) throw new Error("article_count_mismatch");
  if (!payload.metadata.generatedAt || !payload.metadata.codeVersion) throw new Error("incomplete_generation_metadata");
  let store = null;
  try { store = JSON.parse(await fs.readFile(storePath, "utf8")); } catch {}
  const candidates = buildGeminiCandidates(payload.articles);
  const selection = selectIncrementalCandidates(candidates, store, limit);
  manifest = {
    schemaVersion: "1.0.0",
    status: "ready",
    mode: "shadow",
    ruleVersion: GEMINI_REVIEW_RULE_VERSION,
    preparedAt: new Date().toISOString(),
    sourceGeneration: payload.metadata,
    currentCandidateIds: candidates.map((item) => item.candidateId),
    totalHomepageCandidates: candidates.length,
    selectedCount: selection.selected.length,
    deferredCount: selection.deferred.length,
    cachedCount: selection.skipped.filter((item) => item.reason === "cached_unchanged").length,
    selected: selection.selected,
    deferred: selection.deferred,
    skipped: selection.skipped
  };
} catch (error) {
  manifest = {
    schemaVersion: "1.0.0",
    status: "skipped",
    mode: "shadow",
    ruleVersion: GEMINI_REVIEW_RULE_VERSION,
    preparedAt: new Date().toISOString(),
    skipReason: String(error.message || error).slice(0, 200),
    currentCandidateIds: [],
    selectedCount: 0,
    selected: [],
    deferred: [],
    skipped: []
  };
}
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ status: manifest.status, selected: manifest.selectedCount, cached: manifest.cachedCount || 0, deferred: manifest.deferredCount || 0, skipReason: manifest.skipReason || null }));
