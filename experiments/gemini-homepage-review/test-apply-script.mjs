import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildGeminiCandidates, GEMINI_REVIEW_RULE_VERSION } from './cache.mjs';
import { validAppliedPromotion } from './decision.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-review-apply-'));
const dataPath = path.join(temporary, 'real-data.js');
const sitePath = path.join(temporary, 'site-real-data.js');
const storePath = path.join(temporary, 'latest.json');
const reportPath = path.join(temporary, 'run-result.json');
const now = new Date();
const metadata = { filterMode: 'v3', articleCount: 1,
  generatedAt: now.toISOString(), codeVersion: 'fixture' };
const article = {
  id: 'article-1', title: 'Rack systems begin shipping', summary: 'The first rack systems are now shipping.',
  sourceId: 'fixture', sourceUrl: 'https://example.com/1', publishedAt: now.toISOString().slice(0, 10),
  showByDefault: false, relevance: '低', importance: '低', tags: [],
  defaultFeedAudit: { defaultHideReason: 'low_relevance', eventStage: 'occurred' },
  unifiedTagging: { articleDomains: ['datacom'], mainEvent: null },
  v3Audit: { candidateId: 'candidate-1', decisionStatus: 'rejected', decisionGate: 'business_relevance',
    evidenceSufficiency: 'sufficient', admissionPath: 'none', profileHash: 'fixture-profile',
    candidateDecisions: [{ id: 'event-1', eventType: 'product', stage: 'initial_use',
      object: 'rack system', objectLevel: 'rack', domains: ['datacom'],
      evidence: 'The first rack systems are now shipping.', relevance: 'low', importance: 'medium' }] }
};
const candidate = buildGeminiCandidates([article], now)[0];
const store = { ruleVersion: GEMINI_REVIEW_RULE_VERSION, reviews: [{
  candidateId: candidate.candidateId, contentHash: candidate.contentHash,
  ruleVersion: GEMINI_REVIEW_RULE_VERSION, status: 'completed', reviewedAt: now.toISOString(),
  modelOutput: { candidateId: candidate.candidateId, verdict: 'SHOW', mainEventId: 'event-1',
    reason: 'Confirmed rack shipment has management relevance.', articleEvidence: 'now shipping' }
}] };
const source = `const radarGenerationMetadata = ${JSON.stringify(metadata)};\nconst radarGeneratedArticles = ${JSON.stringify([article])};\n`;
fs.writeFileSync(dataPath, source);
fs.writeFileSync(sitePath, source);
fs.writeFileSync(storePath, JSON.stringify(store));
fs.writeFileSync(reportPath, JSON.stringify({ manifestStatus: 'ready', sourceGeneration: metadata,
  reviewedAt: now.toISOString(), summary: { selected: 1, completed: 1, failed: 0, providerStopped: false } }));
const run = spawnSync(process.execPath, [path.join(root, 'scripts/apply_gemini_homepage_review.mjs')], {
  cwd: root, encoding: 'utf8', env: { ...process.env, NEWS_DATA_PATH: dataPath,
    SITE_NEWS_DATA_PATH: sitePath, GEMINI_REVIEW_STORE_PATH: storePath,
    GEMINI_RUN_REPORT_PATH: reportPath }
});
assert.equal(run.status, 0, run.stderr);
assert.equal(fs.readFileSync(dataPath, 'utf8'), fs.readFileSync(sitePath, 'utf8'));
const applied = new vm.Script(`${fs.readFileSync(dataPath, 'utf8')}\nradarGeneratedArticles`).runInNewContext({})[0];
assert.equal(applied.showByDefault, true);
assert.equal(applied.relevance, '中');
assert.equal(applied.importance, '中');
assert.equal(applied.unifiedTagging.mainEvent.id, 'event-1');
assert.equal(validAppliedPromotion(applied, now), true);
assert.equal(new vm.Script(`${fs.readFileSync(dataPath, 'utf8')}\nradarGenerationMetadata`).runInNewContext({}).homepageReviewMode, 'required');
fs.writeFileSync(dataPath, source);
fs.writeFileSync(sitePath, source);
fs.writeFileSync(reportPath, JSON.stringify({ manifestStatus: 'ready', sourceGeneration: metadata,
  reviewedAt: now.toISOString(), summary: { selected: 2, completed: 1, failed: 1, providerStopped: false } }));
const partial = spawnSync(process.execPath, [path.join(root, 'scripts/apply_gemini_homepage_review.mjs')], {
  cwd: root, encoding: 'utf8', env: { ...process.env, NEWS_DATA_PATH: dataPath,
    SITE_NEWS_DATA_PATH: sitePath, GEMINI_REVIEW_STORE_PATH: storePath,
    GEMINI_RUN_REPORT_PATH: reportPath }
});
assert.equal(partial.status, 0, 'Individual review failures must not block verified articles');
fs.writeFileSync(dataPath, source);
fs.writeFileSync(sitePath, source);
fs.writeFileSync(reportPath, JSON.stringify({ manifestStatus: 'skipped', sourceGeneration: metadata,
  reviewedAt: now.toISOString(), summary: { selected: 1, completed: 0, failed: 0, providerStopped: false } }));
const skipped = spawnSync(process.execPath, [path.join(root, 'scripts/apply_gemini_homepage_review.mjs')], {
  cwd: root, encoding: 'utf8', env: { ...process.env, NEWS_DATA_PATH: dataPath,
    SITE_NEWS_DATA_PATH: sitePath, GEMINI_REVIEW_STORE_PATH: storePath,
    GEMINI_RUN_REPORT_PATH: reportPath }
});
assert.notEqual(skipped.status, 0, 'Skipped cloud review must stop publication');
assert.equal(fs.readFileSync(dataPath, 'utf8'), source, 'A failed review must preserve the unpublished snapshot');
fs.rmSync(temporary, { recursive: true, force: true });
console.log('Cloud review application and root/site synchronization passed');
