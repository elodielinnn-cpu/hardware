import assert from "node:assert/strict";
import { buildGeminiCandidates, failureRecord, GEMINI_REVIEW_CACHE_MAX_AGE_MS, GEMINI_REVIEW_RULE_VERSION, geminiCandidateContentHash, selectIncrementalCandidates } from "./cache.mjs";
import { runGeminiReview } from "./run-review.mjs";

function article(id, overrides = {}) {
  return { id, title: `${id} title`, summary: `${id} summary`, sourceId: "fixture", sourceUrl: `https://example.com/${id}`, publishedAt: "2026-11-04", showByDefault: true, v3Audit: { candidateId: id, articleSubjects: [], relatedLuxshareProducts: [] }, ...overrides };
}
const candidates = buildGeminiCandidates([article("cached"), article("changed"), article("retry"), article("new"), article("hidden", { showByDefault: false })]);
assert.equal(candidates.length, 4);
const cached = candidates.find((item) => item.candidateId === "cached");
const changed = candidates.find((item) => item.candidateId === "changed");
const retry = candidates.find((item) => item.candidateId === "retry");
const cacheNow = new Date("2026-11-04T00:30:00Z");
assert.equal(geminiCandidateContentHash({ ...cached, url: "https://different.example" }), cached.contentHash, "URL changes must not trigger review");
assert.notEqual(geminiCandidateContentHash({ ...cached, summary: "changed summary" }), cached.contentHash, "Summary changes must trigger review");
const store = { reviews: [
  { candidateId: "cached", contentHash: cached.contentHash, ruleVersion: GEMINI_REVIEW_RULE_VERSION, status: "completed", reviewedAt: cacheNow.toISOString() },
  { candidateId: "changed", contentHash: "old-hash", ruleVersion: GEMINI_REVIEW_RULE_VERSION, status: "completed", reviewedAt: cacheNow.toISOString() },
  { candidateId: "retry", contentHash: retry.contentHash, ruleVersion: GEMINI_REVIEW_RULE_VERSION, status: "retryable", attempts: 1, reviewedAt: cacheNow.toISOString() }
] };
const selection = selectIncrementalCandidates(candidates, store, 12, cacheNow);
assert.deepEqual(selection.selected.map((item) => [item.candidateId, item.selectionReason]), [["retry", "retry"], ["changed", "content_changed"], ["new", "new_homepage_candidate"]]);
assert.equal(selection.skipped[0].reason, "cached_unchanged");
const manualStore = { reviews: [{ candidateId: "new", contentHash: candidates.find((item) => item.candidateId === "new").contentHash, ruleVersion: GEMINI_REVIEW_RULE_VERSION, status: "manual_review", attempts: 3, reviewedAt: cacheNow.toISOString() }] };
assert.equal(selectIncrementalCandidates(candidates.filter((item) => item.candidateId === "new"), manualStore, 12, cacheNow).skipped[0].reason, "retry_limit_reached");
const retryCandidate = { ...candidates.find((item) => item.candidateId === "new"), priorAttempts: 0 };
const firstFailure = failureRecord(retryCandidate, { type: "timeout", message: "timeout" }, cacheNow);
const secondFailure = failureRecord({ ...retryCandidate, priorAttempts: firstFailure.attempts }, { type: "timeout", message: "timeout" }, cacheNow);
const thirdFailure = failureRecord({ ...retryCandidate, priorAttempts: secondFailure.attempts }, { type: "timeout", message: "timeout" }, cacheNow);
assert.deepEqual([firstFailure.status, secondFailure.status, thirdFailure.status], ["retryable", "retryable", "manual_review"]);

const expiredAt = new Date(cacheNow.getTime() - GEMINI_REVIEW_CACHE_MAX_AGE_MS - 1).toISOString();
const expiredStore = { reviews: [{ candidateId: "cached", contentHash: cached.contentHash, ruleVersion: GEMINI_REVIEW_RULE_VERSION, status: "completed", reviewedAt: expiredAt }] };
assert.equal(selectIncrementalCandidates([cached], expiredStore, 12, cacheNow).selected[0].selectionReason, "new_homepage_candidate", "Expired cache records must not suppress review");
const invalidStore = { reviews: [{ candidateId: "cached", contentHash: cached.contentHash, ruleVersion: GEMINI_REVIEW_RULE_VERSION, status: "completed" }] };
assert.equal(selectIncrementalCandidates([cached], invalidStore, 12, cacheNow).selected.length, 1, "Invalid cache records must not suppress review");

const manifest = { status: "ready", sourceGeneration: { filterMode: "v3", articleCount: 4 }, currentCandidateIds: candidates.map((item) => item.candidateId), selected: selection.selected };
const providerConfig = { modelId: "gemini-mock" };
const mockRequest = async ({ candidate }) => ({
  actualModelId: "gemini-mock-actual",
  requestLatencyMs: 25,
  finishReason: "STOP",
  usage: { inputTokens: 100, outputTokens: 20 },
  rawContent: JSON.stringify({ candidateId: candidate.candidateId, verdict: "KEEP", reason: "Evidence supports retaining the V3 decision.", articleEvidence: candidate.title })
});
const success = await runGeminiReview({ manifest, previousStore: store, providerConfig, schema: {}, systemPrompt: "test", apiKey: "mock", request: mockRequest, now: new Date("2026-11-04T00:30:00Z") });
assert.equal(success.report.summary.completed, 3);
assert.equal(success.report.summary.shadowHideSuggestions, 0);
assert.equal(success.store.mode, "shadow");
assert.equal(success.store.reviews.find((item) => item.candidateId === "cached").status, "completed");

let calls = 0;
const quotaFailure = await runGeminiReview({
  manifest,
  previousStore: store,
  providerConfig,
  schema: {},
  systemPrompt: "test",
  apiKey: "mock",
  request: async () => { calls += 1; return { requestLatencyMs: 20, error: { type: "http", status: 429, message: "quota exhausted" } }; },
  now: new Date("2026-11-04T06:30:00Z")
});
assert.equal(calls, 1, "429 must stop further API requests");
assert.equal(quotaFailure.report.summary.providerStopped, true);
assert.equal(quotaFailure.report.summary.failed, 1);
assert.equal(quotaFailure.report.summary.deferred, 2);
assert.equal(quotaFailure.store.reviews.find((item) => item.candidateId === "retry" && item.contentHash === retry.contentHash).status, "retryable");

const batchCandidates = buildGeminiCandidates(Array.from({ length: 13 }, (_, index) => article(`batch-${String(index + 1).padStart(2, "0")}`)));
const firstBatch = selectIncrementalCandidates(batchCandidates, null, 12, cacheNow);
assert.equal(firstBatch.selected.length, 12);
assert.equal(firstBatch.deferred.length, 1);
const firstBatchManifest = { status: "ready", sourceGeneration: { filterMode: "v3", articleCount: 13 }, currentCandidateIds: batchCandidates.map((item) => item.candidateId), selected: firstBatch.selected };
const firstBatchResult = await runGeminiReview({ manifest: firstBatchManifest, previousStore: null, providerConfig, schema: {}, systemPrompt: "test", apiKey: "mock", request: mockRequest, now: cacheNow });
const secondBatch = selectIncrementalCandidates(batchCandidates, firstBatchResult.store, 12, new Date(cacheNow.getTime() + 6 * 60 * 60 * 1000));
assert.deepEqual(secondBatch.selected.map((item) => item.candidateId), [firstBatch.deferred[0].candidateId], "Deferred candidates must be selected on the next run");

const wholeBatchFailure = await runGeminiReview({
  manifest,
  previousStore: store,
  providerConfig,
  schema: {},
  systemPrompt: "test",
  apiKey: "mock",
  request: async () => ({ requestLatencyMs: 10, error: { type: "timeout", message: "request timed out" } }),
  now: new Date("2026-11-04T12:30:00Z")
});
assert.equal(wholeBatchFailure.report.summary.completed, 0);
assert.equal(wholeBatchFailure.report.summary.failed, manifest.selected.length);
assert.ok(wholeBatchFailure.store.reviews.filter((item) => item.status === "retryable").length >= manifest.selected.length, "A failed batch must remain retryable without changing V3 data");

const skipped = await runGeminiReview({ manifest: { status: "skipped", skipReason: "root_site_real_data_mismatch", selected: [], currentCandidateIds: [] }, previousStore: store, providerConfig, schema: {}, systemPrompt: "test", apiKey: "", request: () => { throw new Error("must not call API"); } });
assert.equal(skipped.report.usage.requests, 0);
assert.equal(skipped.report.skipReason, "root_site_real_data_mismatch");
assert.equal(skipped.store, store, "A skipped snapshot must preserve the restored cache object");
console.log("Gemini homepage review integration tests passed");
