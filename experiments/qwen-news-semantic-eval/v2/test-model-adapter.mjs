import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const experimentRoot = path.resolve(directory, "..");
const repositoryRoot = path.resolve(directory, "../../..");
const cases = JSON.parse(await fs.readFile(path.join(experimentRoot, "cases.json"), "utf8"));
const item = cases.find((entry) => entry.id === "edge-02-marvell-retimer");
const labelsText = await fs.readFile(path.join(experimentRoot, "human-labels.json"), "utf8");
const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "qwen-v2-adapter-test-"));
const capturedRequests = [];

const modelOutput = {
  articleId: item.id,
  evidenceUnits: [
    { evidenceId: "e1", origin: "title", text: item.title },
    { evidenceId: "e2", origin: "official_body", text: item.bodyEvidence[1] }
  ],
  productMatches: [{
    productId: "aec_dsp",
    productRole: "article_subject",
    matchType: "upstream_input",
    relationshipBasis: "explicit_article_evidence",
    impactDimensions: ["interface", "performance", "power"],
    claimIds: ["c1"],
    evidenceIds: ["e1", "e2"],
    reason: "The article directly describes the AEC DSP and customer sampling status.",
    confidence: "high"
  }],
  strategicContexts: [],
  claims: [{
    claimId: "c1",
    eventType: "customer_sampling",
    subject: "Marvell",
    object: "Alaska A 1.6T AEC DSP",
    eventStage: "sampling_validation",
    evidenceConfidence: "official",
    qualifiers: ["now sampling to customers"],
    timeline: null,
    factStatus: "validation",
    evidenceIds: ["e2"]
  }],
  technicalAnalysis: {
    isDeep: false,
    evidenceBasis: "insufficient",
    dimensions: [],
    specificImpacts: [],
    evidenceIds: []
  },
  evidenceSufficiency: { status: "sufficient", gaps: [] },
  factualSummary: "Marvell says its second-generation 1.6T AEC DSP is now sampling to customers.",
  modelAssessment: {
    relevance: "medium",
    priority: "medium",
    modelHomepageRecommendation: false,
    reason: "This is an upstream DSP sampling milestone, not downstream cable adoption."
  },
  uncertainties: []
};

const server = http.createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const payload = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
  capturedRequests.push({ url: request.url, payload });
  response.setHeader("content-type", "application/json");
  if (request.url === "/tokenize") {
    response.end(JSON.stringify({ tokens: Array.from({ length: Math.max(1, Math.ceil(String(payload.content || "").length / 4)) }, (_, index) => index) }));
    return;
  }
  if (request.url === "/v1/chat/completions") {
    response.end(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify(modelOutput) } }],
      usage: { prompt_tokens: 1200, completion_tokens: 500, total_tokens: 1700 }
    }));
    return;
  }
  response.statusCode = 404;
  response.end(JSON.stringify({ error: "not found" }));
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    server.off("error", reject);
    resolve();
  });
});
const { port } = server.address();
try {
  const result = await new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(directory, "run-v2-eval.mjs")], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        LLM_BASE_URL: `http://127.0.0.1:${port}/v1`,
        MODEL: "mock-qwen3-8b",
        CASE_IDS: item.id,
        RESULT_DIR: temporaryDirectory,
        CONTEXT_SIZE: "8192",
        MAX_OUTPUT_TOKENS: "1800",
        TOKENIZER_REQUIRED: "true"
      }
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const completionRequest = capturedRequests.find((entry) => entry.url === "/v1/chat/completions")?.payload;
  assert.ok(completionRequest, "chat completion request was not captured");
  assert.equal(completionRequest.temperature, 0);
  assert.equal(completionRequest.chat_template_kwargs.enable_thinking, false);
  assert.equal(completionRequest.response_format.type, "json_schema");
  assert.equal(completionRequest.response_format.json_schema.strict, true);
  const userInput = JSON.parse(completionRequest.messages.at(-1).content);
  assert.equal(userInput.articleId, item.id);
  assert.match(userInput.inputHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(userInput.originalSourceDocument, {
    cohort: item.cohort,
    sourceId: item.sourceId,
    publishedAt: item.publishedAt,
    title: item.title,
    url: item.url,
    originalSummary: item.originalSummary,
    bodyEvidence: item.bodyEvidence,
    evidenceAvailability: item.evidenceAvailability
  });
  assert.equal(completionRequest.messages.some((message) => message.content.includes(labelsText.trim())), false);
  const contextMessage = JSON.parse(completionRequest.messages[1].content.split("\n").slice(1).join("\n"));
  assert.equal(contextMessage.selectionMode, "candidate_subset");
  assert.ok(contextMessage.candidateProductIds.includes("aec_dsp"));
  assert.ok(contextMessage.products.length < 51);

  const output = JSON.parse(await fs.readFile(path.join(temporaryDirectory, "model-output.json"), "utf8"));
  assert.equal(output.results.length, 1);
  assert.equal(output.results[0].schemaValidation.valid, true, JSON.stringify(output.results[0].schemaValidation.errors));
  assert.equal(output.results[0].sourceBindingValidation.articleIdMatches, true);
  assert.equal(output.results[0].sourceBindingValidation.inputHashMatches, true);
  assert.deepEqual(output.results[0].sourceBindingValidation.evidenceNotInSourceIds, []);
  assert.equal(output.results[0].decision.decisionStatus, "rejected");
  assert.ok(output.results[0].decision.reasonCodes.includes("upstream_sampling_without_adoption"));
  assert.equal(output.results[0].rawContent, JSON.stringify(modelOutput));
  assert.equal(typeof output.results[0].contextBudget.promptTokenCount, "number");
  const comparisonPath = path.join(temporaryDirectory, "comparison.json");
  const comparison = spawnSync(process.execPath, [path.join(directory, "build-comparison-report.mjs")], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      V2_RESULT_PATH: path.join(temporaryDirectory, "model-output.json"),
      COMPARISON_PATH: comparisonPath
    }
  });
  assert.equal(comparison.status, 0, comparison.stderr || comparison.stdout);
  const report = JSON.parse(await fs.readFile(comparisonPath, "utf8"));
  assert.equal(report.cases[0].id, item.id);
  assert.ok(report.cases[0].humanLabel);
  assert.ok(report.cases[0].historicalA);
  assert.equal(report.historicalB.available, false);
  assert.deepEqual(report.cases[0].v2DeterministicDecision, output.results[0].decision);
  console.log("V2 model adapter mock test passed");
} finally {
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
}
