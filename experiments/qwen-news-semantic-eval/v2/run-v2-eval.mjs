import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createDecisionEngine, createSourceBinding, validateSourceBinding } from "./decision-engine.mjs";
import { normalizeCompactModelOutput } from "./normalize-model-output.mjs";
import { buildCandidateProfileContext, loadBusinessProfile, retrieveProductCandidates } from "./profile-retriever.mjs";
import { readEvaluationRuntime } from "./runtime-config.mjs";
import { smokeCaseIds } from "./smoke-cases.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const experimentRoot = path.resolve(directory, "..");
const repositoryRoot = path.resolve(directory, "../../..");
const runtime = readEvaluationRuntime(process.env, path.join(directory, "results", "smoke"));
const baseUrl = runtime.baseUrl;
const serverRoot = runtime.serverRoot;
const model = runtime.modelId;
const resultDirectory = runtime.resultDirectory;
const resultPath = path.join(resultDirectory, "model-output.json");
const contextSize = runtime.contextSize;
const maxOutputTokens = runtime.maxOutputTokens;
const chatWrapperReserveTokens = runtime.chatWrapperReserveTokens;
const articleTimeoutMs = runtime.articleTimeoutMs;
const tokenizerRequired = runtime.tokenizerRequired;
const python = runtime.python;
const requestedCaseIds = runtime.caseIds.length ? runtime.caseIds : smokeCaseIds;

if (new Set(requestedCaseIds).size !== requestedCaseIds.length) throw new Error("CASE_IDS contains duplicates");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function originalSourceDocument(item) {
  return {
    cohort: item.cohort,
    sourceId: item.sourceId,
    publishedAt: item.publishedAt,
    title: item.title,
    url: item.url,
    originalSummary: item.originalSummary,
    bodyEvidence: item.bodyEvidence,
    evidenceAvailability: item.evidenceAvailability
  };
}

function exactModelInput(item) {
  const sourceBinding = createSourceBinding(item.id, originalSourceDocument(item));
  return {
    articleId: item.id,
    inputHash: sourceBinding.inputHash,
    originalSourceDocument: sourceBinding.originalSourceDocument
  };
}

async function writeJsonAtomic(filePath, value) {
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(temporaryPath, filePath);
}

async function tokenize(content) {
  const response = await fetch(`${serverRoot}/tokenize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content, add_special: false })
  });
  if (!response.ok) throw new Error(`tokenize HTTP ${response.status}`);
  const payload = await response.json();
  if (Array.isArray(payload.tokens)) return payload.tokens.length;
  if (Number.isInteger(payload.count)) return payload.count;
  throw new Error("tokenize response did not contain tokens or count");
}

function formalSchemaValidation(schemaPath, documentPath) {
  const validation = spawnSync(python, [path.join(directory, "validate-schema.py"), schemaPath, documentPath], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env
  });
  let payload = null;
  try {
    payload = JSON.parse(validation.stdout.trim());
  } catch {
    payload = { valid: false, draft: "2020-12", errors: [{ path: "/", message: validation.stderr.trim() || "Schema validator returned unreadable output" }] };
  }
  return { ...payload, exitCode: validation.status };
}

const [cases, schemaText, systemPrompt, profileData] = await Promise.all([
  fs.readFile(path.join(experimentRoot, "cases.json"), "utf8").then(JSON.parse),
  fs.readFile(path.join(directory, "response.schema.json"), "utf8"),
  fs.readFile(path.join(directory, "system-prompt.txt"), "utf8"),
  loadBusinessProfile(
    path.join(repositoryRoot, "config/luxshare-business-profile.json"),
    path.join(directory, "product-relations.json")
  )
]);
const schema = JSON.parse(schemaText);
function countSchemaFields(value) {
  if (!value || typeof value !== "object") return { properties: 0, required: 0 };
  const nested = Object.values(value).map(countSchemaFields);
  return {
    properties: Object.keys(value.properties || {}).length + nested.reduce((sum, item) => sum + item.properties, 0),
    required: (value.required || []).length + nested.reduce((sum, item) => sum + item.required, 0)
  };
}
const schemaMetrics = { bytes: Buffer.byteLength(schemaText, "utf8"), ...countSchemaFields(schema) };
const selectedCases = requestedCaseIds.map((id) => cases.find((item) => item.id === id));
const missingCaseIds = requestedCaseIds.filter((id, index) => !selectedCases[index]);
if (missingCaseIds.length) throw new Error(`Unknown case IDs: ${missingCaseIds.join(", ")}`);
const decide = createDecisionEngine(profileData);
const responseFormat = { type: "json_schema", json_schema: { name: "luxshare_news_review_v2", strict: true, schema } };
const schemaTokenCount = await tokenize(schemaText).catch((error) => ({ error: String(error.message || error) }));
if (tokenizerRequired && typeof schemaTokenCount !== "number") throw new Error(`Tokenizer preflight unavailable: ${schemaTokenCount.error}`);

const inferenceConfiguration = {
  model,
  modelSha256: process.env.MODEL_SHA256 || null,
  llamaRef: process.env.LLAMA_REF || null,
  adapterVersion: "2.2.0-compact",
  caseIds: requestedCaseIds,
  caseInputSha256: Object.fromEntries(selectedCases.map((item) => [item.id, sha256(JSON.stringify(exactModelInput(item)))])),
  temperature: 0,
  maxOutputTokens,
  enableThinking: false,
  contextSize,
  chatWrapperReserveTokens,
  schemaSha256: sha256(schemaText),
  systemPromptSha256: sha256(systemPrompt),
  profileHash: profileData.profileHash,
  relationGraphHash: profileData.relationGraphHash
};
const runSignature = sha256(JSON.stringify(inferenceConfiguration));
const results = [];
await fs.mkdir(path.join(resultDirectory, "articles"), { recursive: true });

for (const item of selectedCases) {
  const startedAt = Date.now();
  const input = exactModelInput(item);
  const sourceBinding = createSourceBinding(input.articleId, input.originalSourceDocument);
  const retrieval = retrieveProductCandidates({
    title: item.title,
    summary: item.originalSummary,
    bodyEvidence: item.bodyEvidence.join("\n")
  }, profileData);
  const candidateProfile = buildCandidateProfileContext(retrieval, profileData);
  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "system",
      content: `Use only this versioned candidate business-profile context. It is classification context, not article evidence.\n${JSON.stringify(candidateProfile)}`
    },
    { role: "user", content: JSON.stringify(input, null, 2) }
  ];
  const tokenizablePrompt = messages.map((message) => `<|${message.role}|>\n${message.content}`).join("\n");
  let promptTokenCount = null;
  let tokenizationError = null;
  try {
    promptTokenCount = await tokenize(tokenizablePrompt);
  } catch (error) {
    tokenizationError = String(error.message || error);
  }
  const contextBudget = {
    contextSize,
    promptTokenCount,
    schemaTokenCount,
    maxOutputTokens,
    chatWrapperReserveTokens,
    available: typeof promptTokenCount === "number"
      ? contextSize - promptTokenCount - maxOutputTokens - chatWrapperReserveTokens
      : null,
    tokenizer: typeof promptTokenCount === "number" ? "llama.cpp /tokenize" : "unavailable",
    tokenizationError
  };

  let entry = {
    id: item.id,
    input,
    inputSha256: input.inputHash,
    sourceBinding: {
      articleId: sourceBinding.articleId,
      inputHash: sourceBinding.inputHash,
      originalSourceDocument: sourceBinding.originalSourceDocument
    },
    candidateProfile,
    retrieval,
    contextBudget,
    rawContent: null,
    rawResponse: null,
    parsedModelOutput: null,
    normalizedAssessment: null,
    normalization: null,
    schemaValidation: null,
    sourceBindingValidation: null,
    decision: null,
    usage: null,
    elapsedMs: 0,
    error: null
  };

  if (tokenizerRequired && promptTokenCount === null) {
    entry.error = { stage: "context_preflight", message: tokenizationError };
  } else if (contextBudget.available !== null && contextBudget.available < 0) {
    entry.error = { stage: "context_preflight", message: "Prompt and reserved output exceed context size" };
  } else {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), articleTimeoutMs);
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: maxOutputTokens,
          messages,
          response_format: responseFormat,
          chat_template_kwargs: { enable_thinking: false }
        }),
        signal: controller.signal
      });
      entry.rawResponse = await response.json();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(entry.rawResponse)}`);
      entry.rawContent = entry.rawResponse.choices?.[0]?.message?.content || null;
      entry.usage = entry.rawResponse.usage || null;
      if (!entry.rawContent) throw new Error("Model response did not contain message content");
      try {
        entry.parsedModelOutput = JSON.parse(entry.rawContent);
      } catch (error) {
        entry.error = { stage: "json_parse", message: String(error.message || error) };
      }
      if (entry.parsedModelOutput) {
        const parsedPath = path.join(resultDirectory, "articles", `${item.id}-parsed.json`);
        await writeJsonAtomic(parsedPath, entry.parsedModelOutput);
        entry.schemaValidation = formalSchemaValidation(path.join(directory, "response.schema.json"), parsedPath);
        if (!entry.schemaValidation.valid) {
          entry.error = { stage: "schema_validation", message: "Model JSON failed Draft 2020-12 validation" };
        } else {
          const normalized = normalizeCompactModelOutput(entry.parsedModelOutput, sourceBinding);
          entry.normalizedAssessment = normalized.assessment;
          entry.normalization = normalized.normalization;
          entry.sourceBindingValidation = validateSourceBinding(entry.normalizedAssessment, sourceBinding);
          if (!entry.sourceBindingValidation.articleIdMatches || !entry.sourceBindingValidation.inputHashMatches) {
            entry.error = { stage: "source_binding", message: "Model output article ID or program-owned source hash binding failed" };
          } else {
            entry.decision = decide(entry.normalizedAssessment, sourceBinding);
          }
        }
      }
    } catch (error) {
      if (!entry.error) entry.error = { stage: "inference", message: String(error.message || error) };
    } finally {
      clearTimeout(timeout);
    }
  }

  entry.elapsedMs = Date.now() - startedAt;
  await writeJsonAtomic(path.join(resultDirectory, "articles", `${item.id}.json`), entry);
  results.push(entry);
  await writeJsonAtomic(resultPath, {
    generatedAt: new Date().toISOString(),
    model,
    runSignature,
    configuration: inferenceConfiguration,
    schemaMetrics,
    schemaTokenCount,
    caseIds: requestedCaseIds,
    results
  });
  console.log(`${item.id}: ${entry.error ? `failed at ${entry.error.stage}` : "completed"} (${entry.elapsedMs} ms)`);
}

console.log(`Wrote ${resultPath}; completed=${results.filter((item) => !item.error).length}; failed=${results.filter((item) => item.error).length}`);
