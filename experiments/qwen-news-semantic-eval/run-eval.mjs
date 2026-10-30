import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const baseUrl = (process.env.LLM_BASE_URL || "http://127.0.0.1:8080/v1").replace(/\/$/, "");
const model = process.env.MODEL;
const articleTimeoutMs = Number(process.env.ARTICLE_TIMEOUT_MS || 300000);
const maxRetries = Math.min(2, Math.max(0, Number(process.env.MAX_RETRIES || 0)));
const experimentGroup = process.env.EXPERIMENT_GROUP || "baseline";
const businessProfileContextPath = process.env.BUSINESS_PROFILE_CONTEXT_PATH;
const businessProfileManifestPath = process.env.BUSINESS_PROFILE_MANIFEST_PATH;
const requestedCaseIds = new Set(
  (process.env.CASE_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

if (!model) {
  console.error("MODEL is required, for example Qwen/Qwen3-4B-GGUF:Q4_K_M");
  process.exit(1);
}
if (!["baseline", "business_profile"].includes(experimentGroup)) {
  console.error(`EXPERIMENT_GROUP must be baseline or business_profile; received ${experimentGroup}`);
  process.exit(1);
}
if (experimentGroup === "business_profile" && (!businessProfileContextPath || !businessProfileManifestPath)) {
  console.error("BUSINESS_PROFILE_CONTEXT_PATH and BUSINESS_PROFILE_MANIFEST_PATH are required for business_profile runs");
  process.exit(1);
}

const [cases, schema, systemPrompt] = await Promise.all([
  fs.readFile(path.join(directory, "cases.json"), "utf8").then(JSON.parse),
  fs.readFile(path.join(directory, "response.schema.json"), "utf8").then(JSON.parse),
  fs.readFile(path.join(directory, "system-prompt.txt"), "utf8")
]);
let businessProfileContext = "";
let businessProfileManifest = null;
if (experimentGroup === "business_profile") {
  [businessProfileContext, businessProfileManifest] = await Promise.all([
    fs.readFile(businessProfileContextPath, "utf8"),
    fs.readFile(businessProfileManifestPath, "utf8").then(JSON.parse)
  ]);
  const actualContextSha256 = crypto.createHash("sha256").update(businessProfileContext).digest("hex");
  if (actualContextSha256 !== businessProfileManifest.contextSha256) {
    console.error("Business profile context hash does not match its manifest");
    process.exit(1);
  }
}

const responseFormat = {
  type: "json_schema",
  json_schema: {
    name: "luxshare_news_review",
    strict: true,
    schema
  }
};

const selectedCases = requestedCaseIds.size
  ? cases.filter((item) => requestedCaseIds.has(item.id))
  : cases;

const missingCaseIds = [...requestedCaseIds].filter(
  (id) => !selectedCases.some((item) => item.id === id)
);
if (!selectedCases.length || missingCaseIds.length) {
  console.error(`Invalid CASE_IDS; missing: ${missingCaseIds.join(", ") || "all cases"}`);
  process.exit(1);
}

const inferenceConfiguration = {
  model,
  experimentGroup,
  temperature: 0,
  maxTokens: 900,
  enableThinking: false,
  articleTimeoutMs,
  maxRetries,
  caseIds: selectedCases.map((item) => item.id),
  cases: selectedCases,
  systemPrompt,
  schema,
  businessProfileSha256: businessProfileManifest?.profileSha256 || null,
  businessProfileContextSha256: businessProfileManifest?.contextSha256 || null
};
const runSignature = crypto
  .createHash("sha256")
  .update(JSON.stringify(inferenceConfiguration))
  .digest("hex");

const resultDirectory = path.join(directory, "results");
await fs.mkdir(resultDirectory, { recursive: true });
const safeModelName = model.replace(/[^a-z0-9._-]+/gi, "_");
const resultPath = process.env.RESULT_PATH || path.join(resultDirectory, `${safeModelName}-${experimentGroup}.json`);
const articleResultDirectory = process.env.ARTICLE_RESULT_DIR
  || path.join(path.dirname(resultPath), "articles");
await fs.mkdir(path.dirname(resultPath), { recursive: true });
await fs.mkdir(articleResultDirectory, { recursive: true });

async function writeJsonAtomic(filePath, value) {
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(temporaryPath, filePath);
}

const results = [];
const resumedCaseIds = [];
let previousResults = [];
try {
  const previousPayload = JSON.parse(await fs.readFile(resultPath, "utf8"));
  if (
    previousPayload.model === model
    && previousPayload.experimentGroup === experimentGroup
    && previousPayload.runSignature === runSignature
    && Array.isArray(previousPayload.results)
  ) {
    previousResults = previousPayload.results;
  }
} catch (error) {
  if (error.code !== "ENOENT") {
    console.warn(`Ignoring unreadable resume file ${resultPath}: ${String(error.message || error)}`);
  }
}
const previousById = new Map(
  previousResults
    .filter((entry) => entry?.result && !entry.error)
    .map((entry) => [entry.id, entry])
);

async function writeCheckpoint() {
  await writeJsonAtomic(resultPath, {
    generatedAt: new Date().toISOString(),
    model,
    experimentGroup,
    runSignature,
    businessProfile: businessProfileManifest
      ? {
          profileVersion: businessProfileManifest.profileVersion,
          profileSha256: businessProfileManifest.profileSha256,
          contextSha256: businessProfileManifest.contextSha256,
          productCount: businessProfileManifest.productCount,
          estimatedTokens: businessProfileManifest.estimates?.businessProfileTokens ?? null
        }
      : null,
    caseIds: selectedCases.map((item) => item.id),
    resumedCaseIds,
    results
  });
}

for (const item of selectedCases) {
  const modelInput = {
    sourceId: item.sourceId,
    publishedAt: item.publishedAt,
    title: item.title,
    url: item.url,
    originalSummary: item.originalSummary,
    bodyEvidence: item.bodyEvidence,
    evidenceAvailability: item.evidenceAvailability
  };

  if (previousById.has(item.id)) {
    const cachedResult = previousById.get(item.id);
    results.push(cachedResult);
    resumedCaseIds.push(item.id);
    await writeJsonAtomic(path.join(articleResultDirectory, `${item.id}.json`), cachedResult);
    await writeCheckpoint();
    console.log(`${item.id}: resumed from completed result`);
    continue;
  }

  let finalEntry = null;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), articleTimeoutMs);
    let rawResponse = null;
    let rawContent = null;

    try {
      const messages = [
        { role: "system", content: systemPrompt },
        ...(businessProfileContext
          ? [{
              role: "system",
              content: `Use the following versioned business profile as classification context. It does not override source-evidence requirements.\n\n${businessProfileContext}`
            }]
          : []),
        { role: "user", content: JSON.stringify(modelInput, null, 2) }
      ];
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.LLM_API_KEY ? { Authorization: `Bearer ${process.env.LLM_API_KEY}` } : {})
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 900,
          messages,
          response_format: responseFormat,
          chat_template_kwargs: { enable_thinking: false }
        }),
        signal: controller.signal
      });
      rawResponse = await response.json();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(rawResponse)}`);
      rawContent = rawResponse.choices?.[0]?.message?.content;
      if (!rawContent) throw new Error("Model response did not include choices[0].message.content");
      finalEntry = {
        id: item.id,
        model,
        input: modelInput,
        attempt,
        elapsedMs: Date.now() - startedAt,
        finishReason: rawResponse.choices?.[0]?.finish_reason || null,
        usage: rawResponse.usage || null,
        rawContent,
        rawResponse,
        result: JSON.parse(rawContent)
      };
      console.log(`${item.id}: ok (${finalEntry.elapsedMs} ms)`);
      break;
    } catch (error) {
      finalEntry = {
        id: item.id,
        model,
        input: modelInput,
        attempt,
        elapsedMs: Date.now() - startedAt,
        rawContent,
        rawResponse,
        error: String(error.message || error)
      };
      console.warn(`${item.id}: attempt ${attempt} failed - ${finalEntry.error}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  results.push(finalEntry);
  await writeJsonAtomic(path.join(articleResultDirectory, `${item.id}.json`), finalEntry);
  await writeCheckpoint();
}

await writeCheckpoint();
console.log(`Wrote ${resultPath}`);

if (results.some((item) => item.error)) process.exitCode = 1;
