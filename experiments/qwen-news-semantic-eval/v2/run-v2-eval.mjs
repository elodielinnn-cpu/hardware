import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createDecisionEngine, createSourceBinding, validateSourceBinding } from "./decision-engine.mjs";
import { buildCandidateProfileContext, loadBusinessProfile, retrieveProductCandidates } from "./profile-retriever.mjs";
import { smokeCaseIds } from "./smoke-cases.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const experimentRoot = path.resolve(directory, "..");
const repositoryRoot = path.resolve(directory, "../../..");
const baseUrl = (process.env.LLM_BASE_URL || "http://127.0.0.1:8080/v1").replace(/\/$/, "");
const serverRoot = baseUrl.replace(/\/v1$/, "");
const model = process.env.MODEL;
const resultDirectory = path.resolve(process.env.RESULT_DIR || path.join(directory, "results", "smoke"));
const resultPath = path.join(resultDirectory, "model-output.json");
const contextSize = Number(process.env.CONTEXT_SIZE || 8192);
const maxOutputTokens = Number(process.env.MAX_OUTPUT_TOKENS || 1800);
const chatWrapperReserveTokens = Number(process.env.CHAT_WRAPPER_RESERVE_TOKENS || 256);
const articleTimeoutMs = Number(process.env.ARTICLE_TIMEOUT_MS || 300000);
const tokenizerRequired = process.env.TOKENIZER_REQUIRED !== "false";
const python = process.env.PYTHON || "python3";
const requestedCaseIds = (process.env.CASE_IDS || smokeCaseIds.join(","))
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (!model) throw new Error("MODEL is required");
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
  adapterVersion: "2.1.0",
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
        entry.sourceBindingValidation = validateSourceBinding(entry.parsedModelOutput, sourceBinding);
        if (!entry.schemaValidation.valid) {
          entry.error = { stage: "schema_validation", message: "Model JSON failed Draft 2020-12 validation" };
        } else if (!entry.sourceBindingValidation.articleIdMatches || !entry.sourceBindingValidation.inputHashMatches) {
          entry.error = { stage: "source_binding", message: "Model output article ID or program-owned source hash binding failed" };
        } else {
          entry.decision = decide(entry.parsedModelOutput, sourceBinding);
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
    schemaTokenCount,
    caseIds: requestedCaseIds,
    results
  });
  console.log(`${item.id}: ${entry.error ? `failed at ${entry.error.stage}` : "completed"} (${entry.elapsedMs} ms)`);
}

console.log(`Wrote ${resultPath}; completed=${results.filter((item) => !item.error).length}; failed=${results.filter((item) => item.error).length}`);
