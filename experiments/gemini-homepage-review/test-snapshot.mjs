import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../..");
const fixture = `const radarGenerationMetadata = {"filterMode":"v3","generatedAt":"2026-11-04T08:00:00+08:00","codeVersion":"fixture","articleCount":1};\nconst radarGeneratedArticles = [{"id":"article-1","title":"Rack power deployment","summary":"A rack power system entered deployment.","sourceId":"fixture","sourceUrl":"https://example.com/1","publishedAt":"2026-11-04","showByDefault":true,"v3Audit":{"candidateId":"candidate-1","articleSubjects":[],"relatedLuxshareProducts":[]}}];\n`;

function runSnapshot(siteContents, storeContents = null) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-review-snapshot-"));
  const source = path.join(temp, "real-data.js");
  const siteSource = path.join(temp, "site-real-data.js");
  const output = path.join(temp, "candidates.json");
  fs.writeFileSync(source, fixture);
  fs.writeFileSync(siteSource, siteContents);
  const store = path.join(temp, "store.json");
  if (storeContents !== null) fs.writeFileSync(store, storeContents);
  const child = spawnSync(process.execPath, [path.join(directory, "prepare-candidates.mjs")], {
    cwd: root,
    env: { ...process.env, NEWS_DATA_PATH: source, SITE_NEWS_DATA_PATH: siteSource, GEMINI_REVIEW_CANDIDATES_PATH: output, GEMINI_REVIEW_STORE_PATH: store },
    encoding: "utf8"
  });
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(fs.readFileSync(output, "utf8"));
}

const valid = runSnapshot(fixture);
assert.equal(valid.status, "ready");
assert.equal(valid.selectedCount, 1);
const mismatched = runSnapshot(`${fixture}\n// incomplete copy`);
assert.equal(mismatched.status, "skipped");
assert.equal(mismatched.skipReason, "root_site_real_data_mismatch");
assert.equal(mismatched.selectedCount, 0);
const corruptCache = runSnapshot(fixture, "{not-json");
assert.equal(corruptCache.status, "ready");
assert.equal(corruptCache.selectedCount, 1, "A corrupt cache must fail open and keep the candidate eligible");
console.log("Gemini homepage review snapshot tests passed");
