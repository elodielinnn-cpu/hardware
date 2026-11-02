import fs from "node:fs/promises";
import path from "node:path";

function required(env, name) {
  const value = String(env[name] || "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function positiveInteger(env, name, fallback) {
  const raw = env[name] ?? fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer; received ${JSON.stringify(raw)}`);
  }
  return value;
}

export function readEvaluationRuntime(env, defaultResultDirectory) {
  const modelId = required(env, "MODEL_ID");
  const baseUrl = String(env.LLM_BASE_URL || "http://127.0.0.1:8080/v1").replace(/\/$/, "");
  let parsedBaseUrl;
  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    throw new Error(`LLM_BASE_URL must be a valid URL; received ${JSON.stringify(baseUrl)}`);
  }
  if (!["http:", "https:"].includes(parsedBaseUrl.protocol)) {
    throw new Error(`LLM_BASE_URL must use http or https; received ${parsedBaseUrl.protocol}`);
  }
  const caseIds = String(env.CASE_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const resultDirectory = path.resolve(env.RESULT_DIR || defaultResultDirectory);
  return {
    modelId,
    baseUrl,
    serverRoot: baseUrl.replace(/\/v1$/, ""),
    resultDirectory,
    contextSize: positiveInteger(env, "CONTEXT_SIZE", 8192),
    maxOutputTokens: positiveInteger(env, "MAX_OUTPUT_TOKENS", 1800),
    chatWrapperReserveTokens: positiveInteger(env, "CHAT_WRAPPER_RESERVE_TOKENS", 256),
    articleTimeoutMs: positiveInteger(env, "ARTICLE_TIMEOUT_MS", 300000),
    tokenizerRequired: env.TOKENIZER_REQUIRED !== "false",
    python: String(env.PYTHON || "python3"),
    caseIds
  };
}

async function assertAccessible(filePath, mode, label) {
  try {
    await fs.access(filePath, mode);
  } catch (error) {
    throw new Error(`${label} is not accessible at ${filePath}: ${error.code || error.message}`);
  }
}

export async function validateWorkflowRuntime(env, repositoryRoot) {
  const runtime = readEvaluationRuntime(env, path.join(repositoryRoot, "experiments/qwen-news-semantic-eval/v2/results/smoke"));
  const modelPath = path.resolve(required(env, "MODEL_PATH"));
  const llamaServer = path.resolve(required(env, "LLAMA_SERVER"));
  const modelSha256 = required(env, "MODEL_SHA256");
  if (!/^[a-f0-9]{64}$/i.test(modelSha256)) throw new Error("MODEL_SHA256 must be a 64-character hexadecimal SHA-256");
  if (modelPath === modelSha256 || path.basename(modelPath) === modelSha256) {
    throw new Error("MODEL_PATH must be the verified GGUF file path, not MODEL_SHA256");
  }
  if (path.extname(modelPath).toLowerCase() !== ".gguf") throw new Error(`MODEL_PATH must point to a .gguf file; received ${modelPath}`);
  await assertAccessible(modelPath, 4, "MODEL_PATH");
  const modelStat = await fs.stat(modelPath);
  if (!modelStat.isFile() || modelStat.size === 0) throw new Error(`MODEL_PATH must be a non-empty regular file: ${modelPath}`);
  await assertAccessible(llamaServer, 1, "LLAMA_SERVER");
  const serverStat = await fs.stat(llamaServer);
  if (!serverStat.isFile()) throw new Error(`LLAMA_SERVER must be a regular executable file: ${llamaServer}`);
  await fs.mkdir(runtime.resultDirectory, { recursive: true });
  await assertAccessible(runtime.resultDirectory, 2, "RESULT_DIR");

  const requiredRepositoryPaths = [
    "config/luxshare-business-profile.json",
    "experiments/qwen-news-semantic-eval/cases.json",
    "experiments/qwen-news-semantic-eval/v2/response.schema.json",
    "experiments/qwen-news-semantic-eval/v2/system-prompt.txt",
    "experiments/qwen-news-semantic-eval/v2/validate-schema.py"
  ];
  for (const relativePath of requiredRepositoryPaths) {
    await assertAccessible(path.join(repositoryRoot, relativePath), 4, relativePath);
  }
  if (runtime.caseIds.length === 0) throw new Error("CASE_IDS must contain at least one article ID");
  if (new Set(runtime.caseIds).size !== runtime.caseIds.length) throw new Error("CASE_IDS contains duplicates");
  if (runtime.maxOutputTokens + runtime.chatWrapperReserveTokens >= runtime.contextSize) {
    throw new Error("CONTEXT_SIZE must exceed MAX_OUTPUT_TOKENS plus CHAT_WRAPPER_RESERVE_TOKENS");
  }
  const endpoint = new URL(runtime.baseUrl);
  if (!["127.0.0.1", "localhost", "::1"].includes(endpoint.hostname)) {
    throw new Error(`V2 smoke inference must use a loopback LLM_BASE_URL; received ${endpoint.hostname}`);
  }
  return {
    ...runtime,
    modelPath,
    llamaServer,
    modelSha256,
    modelBytes: modelStat.size
  };
}
