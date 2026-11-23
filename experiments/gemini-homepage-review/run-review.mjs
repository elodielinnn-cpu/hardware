import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { shortenVerifiedEvidence, validateDecision } from './decision.mjs';
import { requestProvider } from "../cloud-homepage-review-ab/providers.mjs";
import { failureRecord, GEMINI_REVIEW_RULE_VERSION, mergeGeminiReviewStore } from "./cache.mjs";

const manifestPath = path.resolve(process.env.GEMINI_REVIEW_CANDIDATES_PATH || "outputs/gemini-homepage-review/candidates.json");
const storePath = path.resolve(process.env.GEMINI_REVIEW_STORE_PATH || "outputs/gemini-homepage-review/latest.json");
const outputDirectory = path.resolve(process.env.GEMINI_REVIEW_OUTPUT_DIR || "outputs/gemini-homepage-review");
const timeoutMs = Number(process.env.GEMINI_ARTICLE_TIMEOUT_MS || 45_000);
const maxInputTokens = Number(process.env.GEMINI_RUN_INPUT_TOKEN_BUDGET || 50_000);
const maxOutputTokens = Number(process.env.GEMINI_RUN_OUTPUT_TOKEN_BUDGET || 3_000);

export async function runGeminiReview({ manifest, previousStore, providerConfig, schema, systemPrompt, apiKey, request = requestProvider, now = new Date() }) {
  const results = [];
  const records = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let providerStopped = false;
  if (manifest.status !== "ready" || !manifest.selected?.length) {
    return buildResult({ manifest, previousStore, results, records, inputTokens, outputTokens, providerStopped, providerConfig, now });
  }
  if (!apiKey) throw new Error("GEMINI_API_KEY is required when candidates are selected");

  for (const candidate of manifest.selected) {
    if (providerStopped || inputTokens >= maxInputTokens || outputTokens >= maxOutputTokens) {
      results.push({ candidateId: candidate.candidateId, status: "deferred", reason: providerStopped ? "provider_stopped" : "run_token_budget" });
      continue;
    }
    const response = await request({
      provider: "gemini",
      providerConfig,
      schema,
      systemPrompt,
      candidate: { candidateId: candidate.candidateId, title: candidate.title,
        summary: candidate.summary, programDecision: candidate.programDecision,
        candidateEvents: candidate.candidateEvents, source: candidate.source },
      apiKey,
      fetchImpl: fetch,
      timeoutMs,
      maxRetries: 0
    });
    inputTokens += response.usage?.inputTokens || 0;
    outputTokens += response.usage?.outputTokens || 0;
    const result = { candidateId: candidate.candidateId, contentHash: candidate.contentHash, selectionReason: candidate.selectionReason, requestLatencyMs: response.requestLatencyMs || 0, actualModelId: response.actualModelId || null, usage: response.usage || null, rawContent: response.rawContent || null, error: response.error || null };
    if (response.error) {
      records.push(failureRecord(candidate, response.error, now));
      results.push({ ...result, status: "failed" });
      if ([401, 403, 429].includes(response.error.status)) providerStopped = true;
      continue;
    }
    try {
      if (response.finishReason !== "STOP") throw Object.assign(new Error(`incomplete output: ${response.finishReason || "unknown"}`), { type: "truncated" });
      const modelOutput = shortenVerifiedEvidence(candidate, JSON.parse(response.rawContent));
      const technical = validateDecision(candidate, modelOutput);
      if (!technical.valid) throw Object.assign(new Error(technical.errors.join(",")), { type: "validation" });
      records.push({
        candidateId: candidate.candidateId,
        articleId: candidate.articleId,
        contentHash: candidate.contentHash,
        ruleVersion: GEMINI_REVIEW_RULE_VERSION,
        status: "completed",
        attempts: candidate.priorAttempts + 1,
        reviewedAt: now.toISOString(),
        modelId: response.actualModelId || providerConfig.modelId,
        modelOutput,
        technicalValidation: technical,
        reviewVerdict: modelOutput.verdict,
        mainEventId: modelOutput.mainEventId
      });
      results.push({ ...result, status: "completed", modelOutput, technicalValidation: technical });
    } catch (error) {
      const normalizedError = { type: error.type || (error instanceof SyntaxError ? "invalid_json" : "validation"), message: String(error.message || error).slice(0, 300) };
      records.push(failureRecord(candidate, normalizedError, now));
      results.push({ ...result, status: "failed", error: normalizedError });
    }
  }
  return buildResult({ manifest, previousStore, results, records, inputTokens, outputTokens, providerStopped, providerConfig, now });
}

function buildResult({ manifest, previousStore, results, records, inputTokens, outputTokens, providerStopped, providerConfig, now }) {
  const store = manifest.status === "skipped"
    ? previousStore || { schemaVersion: "1.0.0", ruleVersion: GEMINI_REVIEW_RULE_VERSION, mode: "active", updatedAt: now.toISOString(), reviews: [] }
    : mergeGeminiReviewStore(previousStore, records, manifest.currentCandidateIds || [], now);
  return {
    store,
    report: {
      schemaVersion: "1.0.0",
      mode: "active",
      ruleVersion: GEMINI_REVIEW_RULE_VERSION,
      reviewedAt: now.toISOString(),
      sourceGeneration: manifest.sourceGeneration || null,
      manifestStatus: manifest.status,
      skipReason: manifest.skipReason || null,
      configuredModelId: providerConfig.modelId,
      actualModelIds: [...new Set(results.map((item) => item.actualModelId).filter(Boolean))],
      budget: { maxRequests: Number(process.env.MAX_REVIEW_CANDIDATES || 12), maxInputTokens, maxOutputTokens, timeoutMs },
      usage: { requests: results.filter((item) => item.requestLatencyMs !== undefined && item.status !== "deferred").length, inputTokens, outputTokens },
      summary: {
        selected: manifest.selected?.length || 0,
        completed: results.filter((item) => item.status === "completed").length,
        failed: results.filter((item) => item.status === "failed").length,
        deferred: results.filter((item) => item.status === "deferred").length,
        showRecommendations: results.filter((item) => item.modelOutput?.verdict === 'SHOW').length,
        hideRecommendations: results.filter((item) => item.modelOutput?.verdict === 'HIDE').length,
        providerStopped
      },
      results
    }
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const directory = path.resolve("experiments/cloud-homepage-review-ab");
  const [manifest, previousStore, providerFile, schema, systemPrompt] = await Promise.all([
    fs.readFile(manifestPath, "utf8").then(JSON.parse),
    fs.readFile(storePath, "utf8").then(JSON.parse).catch(() => null),
    fs.readFile(path.join(directory, "providers.json"), "utf8").then(JSON.parse),
    fs.readFile(new URL('./decision.schema.json', import.meta.url), "utf8").then(JSON.parse),
    fs.readFile(new URL('./decision-prompt.txt', import.meta.url), "utf8")
  ]);
  const effectiveManifest = !process.env.GEMINI_API_KEY && manifest.selected?.length
    ? { ...manifest, status: 'skipped', skipReason: 'gemini_api_key_missing' } : manifest;
  const outcome = await runGeminiReview({ manifest: effectiveManifest, previousStore,
    providerConfig: providerFile.gemini, schema, systemPrompt, apiKey: process.env.GEMINI_API_KEY || "" });
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.writeFile(storePath, `${JSON.stringify(outcome.store, null, 2)}\n`);
  await fs.writeFile(path.join(outputDirectory, "run-result.json"), `${JSON.stringify(outcome.report, null, 2)}\n`);
  console.log(JSON.stringify(outcome.report.summary));
}
