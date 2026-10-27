import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const baseUrl = (process.env.LLM_BASE_URL || "http://127.0.0.1:8080/v1").replace(/\/$/, "");
const model = process.env.MODEL;
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

const [cases, schema, systemPrompt] = await Promise.all([
  fs.readFile(path.join(directory, "cases.json"), "utf8").then(JSON.parse),
  fs.readFile(path.join(directory, "response.schema.json"), "utf8").then(JSON.parse),
  fs.readFile(path.join(directory, "system-prompt.txt"), "utf8")
]);

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

const results = [];
for (const item of selectedCases) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300000);
  const modelInput = {
    sourceId: item.sourceId,
    publishedAt: item.publishedAt,
    title: item.title,
    url: item.url,
    originalSummary: item.originalSummary,
    bodyEvidence: item.bodyEvidence,
    evidenceAvailability: item.evidenceAvailability
  };

  try {
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
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(modelInput, null, 2) }
        ],
        response_format: { type: "json_schema", schema }
      }),
      signal: controller.signal
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(payload)}`);
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("Model response did not include choices[0].message.content");
    results.push({
      id: item.id,
      model,
      input: modelInput,
      elapsedMs: Date.now() - startedAt,
      finishReason: payload.choices?.[0]?.finish_reason || null,
      usage: payload.usage || null,
      result: JSON.parse(content)
    });
    console.log(`${item.id}: ok (${Date.now() - startedAt} ms)`);
  } catch (error) {
    results.push({
      id: item.id,
      model,
      input: modelInput,
      elapsedMs: Date.now() - startedAt,
      error: String(error.message || error)
    });
    console.warn(`${item.id}: failed - ${String(error.message || error)}`);
  } finally {
    clearTimeout(timeout);
  }
}

const resultDirectory = path.join(directory, "results");
await fs.mkdir(resultDirectory, { recursive: true });
const safeModelName = model.replace(/[^a-z0-9._-]+/gi, "_");
const resultPath = process.env.RESULT_PATH || path.join(resultDirectory, `${safeModelName}.json`);
await fs.mkdir(path.dirname(resultPath), { recursive: true });
await fs.writeFile(
  resultPath,
  `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    model,
    caseIds: selectedCases.map((item) => item.id),
    results
  }, null, 2)}\n`
);
console.log(`Wrote ${resultPath}`);

if (results.some((item) => item.error)) process.exitCode = 1;
