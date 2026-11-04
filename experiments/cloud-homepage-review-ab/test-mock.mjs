import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyEvidenceGate, buildCandidateInput, calculateMetrics, selectBalancedSamples, validateModelOutput } from "./lib.mjs";
import { createGeminiRequest, createGroqRequest, parseGeminiResponse, parseGroqResponse, requestProvider } from "./providers.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const [providers, samples, labels, schema, systemPrompt] = await Promise.all([
  fs.readFile(path.join(directory, "providers.json"), "utf8").then(JSON.parse),
  fs.readFile(path.join(directory, "samples.json"), "utf8").then(JSON.parse).then((value) => value.samples),
  fs.readFile(path.join(directory, "human-labels.json"), "utf8").then(JSON.parse).then((value) => value.labels),
  fs.readFile(path.join(directory, "response.schema.json"), "utf8").then(JSON.parse),
  fs.readFile(path.join(directory, "system-prompt.txt"), "utf8")
]);
assert.equal(samples.length, 30);
assert.equal(labels.filter(([, label]) => label === "KEEP").length, 20);
assert.equal(labels.filter(([, label]) => label === "HIDE").length, 10);
assert.equal(new Set(samples.map((sample) => sample.candidateId)).size, 30);
const twoSamples = selectBalancedSamples(samples, labels, 2);
assert.deepEqual(twoSamples.map((sample) => sample.candidateId), ["keep-nvidia-capacity", "hide-office-promo"]);
assert.deepEqual(twoSamples.map((sample) => labels.find(([id]) => id === sample.candidateId)[1]), ["KEEP", "HIDE"]);
assert.throws(() => selectBalancedSamples(samples, labels, 31), /1 to 30/);

const office = samples.find((sample) => sample.candidateId === "hide-office-promo");
const candidate = buildCandidateInput(office);
const output = { candidateId: office.candidateId, verdict: "HIDE", reason: "This is a price promotion.", articleEvidence: "on sale for $27.97" };
const validation = validateModelOutput(output, office);
assert.equal(validation.valid, true);
assert.equal(applyEvidenceGate(office, output, validation).effectiveVerdict, "HIDE");
assert.equal(applyEvidenceGate(samples[0], { ...output, candidateId: samples[0].candidateId, articleEvidence: "expand global manufacturing capacity" }, validateModelOutput({ ...output, candidateId: samples[0].candidateId, articleEvidence: "expand global manufacturing capacity" }, samples[0])).effectiveVerdict, "KEEP");
assert.equal(validateModelOutput({ ...output, articleEvidence: "not in source" }, office).valid, false);

const groqRequest = createGroqRequest({ config: providers.groq, schema, systemPrompt, candidate, apiKey: "test-only" });
const geminiRequest = createGeminiRequest({ config: providers.gemini, schema, systemPrompt, candidate, apiKey: "test-only" });
assert.equal(JSON.parse(groqRequest.init.body).response_format.json_schema.strict, true);
assert.equal(JSON.parse(geminiRequest.init.body).generationConfig.responseMimeType, "application/json");
assert.equal(groqRequest.init.body.includes("Pure software price promotion"), false);
assert.equal(geminiRequest.init.body.includes("Pure software price promotion"), false);
assert.ok(!groqRequest.url.includes("test-only") && !geminiRequest.url.includes("test-only"));
assert.equal(groqRequest.init.headers.authorization, "Bearer test-only");
assert.equal(geminiRequest.init.headers["x-goog-api-key"], "test-only");

assert.equal(parseGroqResponse({ model: "actual-groq", choices: [{ message: { content: JSON.stringify(output) } }], usage: { prompt_tokens: 90, completion_tokens: 30 } }, providers.groq.modelId).actualModelId, "actual-groq");
assert.equal(parseGeminiResponse({ modelVersion: "actual-gemini", candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] } }], usageMetadata: { promptTokenCount: 91, candidatesTokenCount: 31 } }, providers.gemini.modelId).usage.outputTokens, 31);

const mockFetch = async (_url, init) => {
  const body = JSON.parse(init.body);
  const isGroq = Boolean(body.messages);
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => isGroq
    ? { model: "mock-groq", choices: [{ finish_reason: "stop", message: { content: JSON.stringify(output) } }], usage: { prompt_tokens: 100, completion_tokens: 20 } }
    : { modelVersion: "mock-gemini", candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(output) }] } }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20 } } };
};
for (const provider of ["groq", "gemini"]) {
  const response = await requestProvider({ provider, providerConfig: providers[provider], schema, systemPrompt, candidate, apiKey: "test-only", fetchImpl: mockFetch, timeoutMs: 1000, maxRetries: 0 });
  assert.equal(JSON.parse(response.rawContent).verdict, "HIDE");
}

let rateLimitCalls = 0;
const rateLimited = await requestProvider({
  provider: "groq",
  providerConfig: providers.groq,
  schema,
  systemPrompt,
  candidate,
  apiKey: "test-only",
  fetchImpl: async () => {
    rateLimitCalls += 1;
    return { ok: false, status: 429, statusText: "Too Many Requests", headers: { get: () => "10" }, json: async () => ({ error: { message: "quota exhausted" } }) };
  },
  timeoutMs: 1000,
  maxRetries: 0
});
assert.equal(rateLimitCalls, 1);
assert.equal(rateLimited.error.status, 429);
assert.equal(rateLimited.retryCount, 0);

const result = { candidateId: office.candidateId, modelOutput: output, validation, gate: applyEvidenceGate(office, output, validation), requestLatencyMs: 100, clientWaitMs: 0, retryWaitMs: 0, retryCount: 0, usage: { inputTokens: 100, outputTokens: 20 } };
const metrics = calculateMetrics([result], labels);
assert.equal(metrics.raw.hidePrecision, 1);
assert.equal(metrics.evidenceGated.hideRecall, 1);
console.log("Cloud homepage review A/B mock tests passed");
