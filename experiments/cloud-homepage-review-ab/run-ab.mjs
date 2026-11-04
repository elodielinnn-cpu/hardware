import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { applyEvidenceGate, buildCandidateInput, calculateMetrics, experimentHash, MAX_RETRIES, REQUEST_TIMEOUT_MS, selectBalancedSamples, validateModelOutput } from "./lib.mjs";
import { adapters, requestProvider } from "./providers.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const providerArg = process.argv.find((arg) => arg.startsWith("--provider="))?.split("=")[1] || "both";
const dryRun = args.has("--dry-run");
const sampleLimitText = process.argv.find((arg) => arg.startsWith("--sample-limit="))?.split("=")[1] || "30";
const sampleLimit = Number(sampleLimitText);
if (!["groq", "gemini", "both"].includes(providerArg)) throw new Error("--provider must be groq, gemini, or both");
const providers = providerArg === "both" ? ["groq", "gemini"] : [providerArg];

const [providerText, sampleText, labelText, schemaText, systemPrompt] = await Promise.all([
  fs.readFile(path.join(directory, "providers.json"), "utf8"),
  fs.readFile(path.join(directory, "samples.json"), "utf8"),
  fs.readFile(path.join(directory, "human-labels.json"), "utf8"),
  fs.readFile(path.join(directory, "response.schema.json"), "utf8"),
  fs.readFile(path.join(directory, "system-prompt.txt"), "utf8")
]);
const providerConfig = JSON.parse(providerText);
const samples = JSON.parse(sampleText).samples;
const labels = JSON.parse(labelText).labels;
const schema = JSON.parse(schemaText);
const labelIds = new Set(labels.map(([id]) => id));
if (samples.length !== 30 || labels.length !== 30 || samples.some((sample) => !labelIds.has(sample.candidateId))) throw new Error("Expected exactly 30 aligned samples and labels");
const selectedSamples = selectBalancedSamples(samples, labels, sampleLimit);

const runSignature = experimentHash([providerText, sampleText, labelText, schemaText, systemPrompt, String(MAX_RETRIES), String(REQUEST_TIMEOUT_MS), String(sampleLimit)]);
const plan = [];
for (let index = 0; index < selectedSamples.length; index += 1) {
  const order = providers.length === 2 && index % 2 ? [...providers].reverse() : providers;
  for (const provider of order) plan.push({ provider, sample: selectedSamples[index] });
}
if (dryRun) {
  console.log(JSON.stringify({ dryRun: true, providers, samples: selectedSamples.map((sample) => ({ candidateId: sample.candidateId, expectedVerdict: labels.find(([id]) => id === sample.candidateId)[1] })), requests: plan.length, runSignature, models: Object.fromEntries(providers.map((provider) => [provider, providerConfig[provider].modelId])), externalRequests: 0 }, null, 2));
  process.exit(0);
}

for (const provider of providers) {
  const keyName = providerConfig[provider].apiKeyEnvironmentVariable;
  if (!process.env[keyName]) throw new Error(`${keyName} is required; no request was sent`);
}

const outputRoot = path.resolve(process.env.CLOUD_REVIEW_OUTPUT_DIR || path.join(directory, "results"));
const runId = new Date().toISOString().replaceAll(":", "-");
const outputDirectory = path.join(outputRoot, runId);
const batchStartedAt = Date.now();
const results = [];
const lastRequestAt = { groq: 0, gemini: 0 };
const stoppedProviders = new Map();
for (const item of plan) {
  const { provider, sample } = item;
  if (stoppedProviders.has(provider)) {
    results.push({ provider, candidateId: sample.candidateId, title: sample.title, expectedVerdict: labels.find(([id]) => id === sample.candidateId)[1], error: { type: "provider_stopped", message: stoppedProviders.get(provider) }, clientWaitMs: 0, retryCount: 0, retryWaitMs: 0 });
    continue;
  }
  const interval = adapters[provider].minimumIntervalMs;
  const clientWaitMs = Math.max(0, lastRequestAt[provider] + interval - Date.now());
  if (clientWaitMs) await new Promise((resolve) => setTimeout(resolve, clientWaitMs));
  const candidate = buildCandidateInput(sample);
  const response = await requestProvider({ provider, providerConfig: providerConfig[provider], schema, systemPrompt, candidate, apiKey: process.env[providerConfig[provider].apiKeyEnvironmentVariable], fetchImpl: fetch, timeoutMs: REQUEST_TIMEOUT_MS, maxRetries: MAX_RETRIES });
  lastRequestAt[provider] = Date.now();
  const result = { provider, candidateId: sample.candidateId, title: sample.title, expectedVerdict: labels.find(([id]) => id === sample.candidateId)[1], clientWaitMs, ...response };
  if ([401, 403, 429].includes(response.error?.status)) stoppedProviders.set(provider, `stopped after HTTP ${response.error.status}`);
  if (!response.error) {
    const completed = provider === "groq" ? response.finishReason === "stop" : response.finishReason === "STOP";
    if (!completed) result.error = { type: "truncated", message: `incomplete output: ${response.finishReason || "unknown"}` };
    try {
      if (!result.error) {
        result.modelOutput = JSON.parse(response.rawContent);
        result.validation = validateModelOutput(result.modelOutput, sample);
        result.gate = applyEvidenceGate(sample, result.modelOutput, result.validation);
      }
    } catch (error) {
      result.error = { type: "invalid_json", message: String(error.message).slice(0, 300) };
    }
  }
  results.push(result);
}

const report = {
  schemaVersion: "1.0.0",
  runId,
  runSignature,
  createdAt: new Date().toISOString(),
  batchElapsedMs: Date.now() - batchStartedAt,
  freeTierIntent: true,
  providers: Object.fromEntries(providers.map((provider) => [provider, { configuredModelId: providerConfig[provider].modelId, actualModelIds: [...new Set(results.filter((item) => item.provider === provider).map((item) => item.actualModelId).filter(Boolean))], metrics: calculateMetrics(results.filter((item) => item.provider === provider), labels) }])),
  results
};
await fs.mkdir(outputDirectory, { recursive: true });
await fs.writeFile(path.join(outputDirectory, "evaluation.json"), `${JSON.stringify(report, null, 2)}\n`);
await fs.writeFile(path.join(outputDirectory, "comparison.md"), renderMarkdown(report));
console.log(JSON.stringify({ outputDirectory, providers: report.providers }, null, 2));

function renderMarkdown(report) {
  const lines = ["# Cloud homepage review A/B results", "", `Run: ${report.runId}`, "", "| Article | Human | Groq | Gemini | Groq ms | Gemini ms | Error |", "|---|---|---|---|---:|---:|---|"];
  for (const sample of selectedSamples) {
    const groq = results.find((item) => item.provider === "groq" && item.candidateId === sample.candidateId);
    const gemini = results.find((item) => item.provider === "gemini" && item.candidateId === sample.candidateId);
    lines.push(`| ${sample.title.replaceAll("|", "\\|")} | ${labels.find(([id]) => id === sample.candidateId)[1]} | ${formatVerdict(groq)} | ${formatVerdict(gemini)} | ${groq?.requestLatencyMs ?? "-"} | ${gemini?.requestLatencyMs ?? "-"} | ${groq?.error?.type || gemini?.error?.type || ""} |`);
  }
  lines.push("", "## Provider metrics", "", "| Provider | Actual model | Valid | Raw HIDE | Effective HIDE | Mean ms | P50 | P95 | Input tokens | Output tokens | 429 | Timeout | Truncated |", "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const provider of providers) {
    const item = report.providers[provider];
    const metrics = item.metrics;
    lines.push(`| ${provider} | ${item.actualModelIds.join(", ") || "-"} | ${metrics.technicallyValid}/${metrics.attempted} | ${metrics.rawHideCount} | ${metrics.effectiveHideCount} | ${metrics.latencyMs.mean ?? "-"} | ${metrics.latencyMs.p50 ?? "-"} | ${metrics.latencyMs.p95 ?? "-"} | ${metrics.tokens.input} | ${metrics.tokens.output} | ${metrics.rateLimited} | ${metrics.timeouts} | ${metrics.truncated} |`);
  }
  lines.push("", "Recommendation priority: KEEP false-hide risk, then HIDE recall, then total latency, then stability. No recommendation is emitted unless both providers complete real requests.", "");
  return `${lines.join("\n")}\n`;
}

function formatVerdict(item) {
  if (!item) return "-";
  if (item.error) return `ERROR:${item.error.type}`;
  return `${item.modelOutput?.verdict || "-"} / ${item.gate?.effectiveVerdict || "-"}`;
}
