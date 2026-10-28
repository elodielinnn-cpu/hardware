import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "qwen-news-eval-test-"));
const resultPath = path.join(temporaryDirectory, "model-output.json");
const evaluationPath = path.join(temporaryDirectory, "evaluation.json");
const requests = [];

const responses = {
  "high-04-apple-manufacturing": {
    relevance: "high",
    priority: "high",
    businessDomain: ["customer_supply_chain", "upstream_materials_components"],
    materialIncrement: {
      exists: true,
      type: "capital_investment",
      description: "Named supplier investment and a multiyear component-production commitment."
    },
    eventStage: "confirmed_future",
    evidenceConfidence: "official",
    summary: "Apple reported supplier investment and a multiyear U.S. component-production commitment.",
    defaultVisible: true,
    evidenceQuotes: ["The multiyear agreement will produce more than 15 billion U.S.-made chips."],
    abstain: false,
    uncertainties: []
  },
  "hide-06-office-promotion": {
    relevance: "low",
    priority: "low",
    businessDomain: ["unrelated"],
    materialIncrement: {
      exists: false,
      type: "none",
      description: "Consumer software license promotion without hardware or manufacturing impact."
    },
    eventStage: "occurred",
    evidenceConfidence: "attributed_report",
    summary: "A lifetime Microsoft Office license is being promoted at a discounted retail price.",
    defaultVisible: false,
    evidenceQuotes: ["Microsoft Office Professional 2021 for Windows lifetime license is on sale for $27.97"],
    abstain: false,
    uncertainties: []
  }
};

const server = http.createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  requests.push(body);
  const input = JSON.parse(body.messages.at(-1).content);
  const id = input.title.includes("American Manufacturing Program")
    ? "high-04-apple-manufacturing"
    : "hide-06-office-promotion";
  const content = JSON.stringify(responses[id]);
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({
    choices: [{ finish_reason: "stop", message: { content } }],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    timings: { prompt_ms: 1, predicted_ms: 1 }
  }));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

try {
  const run = await new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(directory, "run-eval.mjs")], {
      env: {
        ...process.env,
        LLM_BASE_URL: `http://127.0.0.1:${port}/v1`,
        MODEL: "mock-qwen",
        CASE_IDS: "high-04-apple-manufacturing,hide-06-office-promotion",
        RESULT_PATH: resultPath
      }
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.equal(request.response_format.type, "json_schema");
    assert.equal(request.response_format.schema, undefined);
    assert.equal(request.response_format.json_schema.name, "luxshare_news_review");
    assert.equal(request.response_format.json_schema.strict, true);
    assert.equal(request.response_format.json_schema.schema.additionalProperties, false);
    assert.deepEqual(request.chat_template_kwargs, { enable_thinking: false });
  }

  const output = JSON.parse(await fs.readFile(resultPath, "utf8"));
  assert.equal(output.results.length, 2);
  for (const result of output.results) {
    assert.equal(typeof result.rawContent, "string");
    assert.equal(typeof result.rawResponse, "object");
    for (const inputKey of ["sourceId", "publishedAt", "title", "url", "originalSummary", "bodyEvidence"]) {
      assert.equal(inputKey in result.result, false);
    }
  }

  const requestsBeforeResume = requests.length;
  const resumeRun = await new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(directory, "run-eval.mjs")], {
      env: {
        ...process.env,
        LLM_BASE_URL: `http://127.0.0.1:${port}/v1`,
        MODEL: "mock-qwen",
        CASE_IDS: "high-04-apple-manufacturing,hide-06-office-promotion",
        RESULT_PATH: resultPath
      }
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
  assert.equal(resumeRun.status, 0, resumeRun.stderr || resumeRun.stdout);
  assert.equal(requests.length, requestsBeforeResume, "Completed cases must not be inferred twice");
  const resumedOutput = JSON.parse(await fs.readFile(resultPath, "utf8"));
  assert.deepEqual(
    resumedOutput.resumedCaseIds,
    ["high-04-apple-manufacturing", "hide-06-office-promotion"]
  );

  const validate = (inputPath, outputPath) => spawnSync(
    process.execPath,
    [path.join(directory, "validate-results.mjs")],
    { encoding: "utf8", env: { ...process.env, RESULT_PATH: inputPath, EVALUATION_PATH: outputPath } }
  );

  const validRun = validate(resultPath, evaluationPath);
  assert.equal(validRun.status, 0, validRun.stderr || validRun.stdout);
  const validEvaluation = JSON.parse(await fs.readFile(evaluationPath, "utf8"));
  assert.equal(validEvaluation.summary.technicalValidationPassed, true);
  assert.equal(validEvaluation.summary.consistencyValidationPassed, true);
  assert.equal(validEvaluation.summary.semanticEvaluationPassed, true);
  assert.equal(validEvaluation.metrics.relevanceAccuracy.rate, 1);
  assert.equal(validEvaluation.metrics.priorityAccuracy.rate, 1);
  assert.equal(validEvaluation.metrics.eventStageAccuracy.rate, 1);
  assert.equal(validEvaluation.metrics.defaultVisible.rawModel.precision, 1);
  assert.equal(validEvaluation.metrics.defaultVisible.rawModel.recall, 1);
  assert.equal(validEvaluation.metrics.defaultVisible.constrained.precision, 1);
  assert.equal(validEvaluation.metrics.defaultVisible.constrained.recall, 1);

  const semanticMismatchPath = path.join(temporaryDirectory, "semantic-mismatch.json");
  output.results[0].result.relevance = "low";
  await fs.writeFile(semanticMismatchPath, `${JSON.stringify(output, null, 2)}\n`);
  const semanticRun = validate(semanticMismatchPath, path.join(temporaryDirectory, "semantic-evaluation.json"));
  assert.equal(semanticRun.status, 0, semanticRun.stderr || semanticRun.stdout);
  const semanticEvaluation = JSON.parse(await fs.readFile(
    path.join(temporaryDirectory, "semantic-evaluation.json"),
    "utf8"
  ));
  assert.equal(semanticEvaluation.summary.technicalValidationPassed, true);
  assert.equal(semanticEvaluation.summary.semanticEvaluationPassed, false);

  const technicalFailurePath = path.join(temporaryDirectory, "technical-failure.json");
  output.results[0].result.defaultVisible = "true";
  await fs.writeFile(technicalFailurePath, `${JSON.stringify(output, null, 2)}\n`);
  const technicalRun = validate(technicalFailurePath, path.join(temporaryDirectory, "technical-evaluation.json"));
  assert.equal(technicalRun.status, 1, "Invalid field types must fail technical validation");

  const realFixturePath = path.join(
    directory,
    "fixtures",
    "qwen3-8b-run-40625841827.json"
  );
  const realFixtureBefore = await fs.readFile(realFixturePath, "utf8");
  const realEvaluationPath = path.join(temporaryDirectory, "qwen3-8b-real-evaluation.json");
  const realRun = validate(realFixturePath, realEvaluationPath);
  assert.equal(realRun.status, 0, realRun.stderr || realRun.stdout);
  const realEvaluation = JSON.parse(await fs.readFile(realEvaluationPath, "utf8"));
  assert.equal(realEvaluation.summary.technicalValidationPassed, true);
  assert.equal(realEvaluation.summary.consistencyValidationPassed, false);
  assert.equal(realEvaluation.summary.semanticEvaluationPassed, false);
  assert.equal(realEvaluation.metrics.defaultVisible.rawModel.precision, 0.5);
  assert.equal(realEvaluation.metrics.defaultVisible.rawModel.recall, 1);
  assert.equal(realEvaluation.metrics.defaultVisible.constrained.precision, 1);
  assert.equal(realEvaluation.metrics.defaultVisible.constrained.recall, 1);
  assert.deepEqual(
    realEvaluation.metrics.hiddenNewsFalsePositives.rawModel,
    ["hide-06-office-promotion"]
  );
  assert.deepEqual(realEvaluation.metrics.hiddenNewsFalsePositives.constrained, []);

  const apple = realEvaluation.checks.find((item) => item.id === "high-04-apple-manufacturing");
  assert.equal(apple.schemaValid, true);
  assert.equal(apple.evidenceValid, true);
  assert.equal(apple.result.relevance, "high");
  assert.equal(apple.result.priority, "medium");
  assert.equal(apple.result.defaultVisible, true);
  assert.equal(
    apple.consistencyErrors.some((error) => error.includes('businessDomain "power"')),
    true
  );
  assert.equal(
    apple.consistencyErrors.some((error) => error.includes('businessDomain "liquid_cooling"')),
    true
  );
  assert.deepEqual(
    apple.referenceMismatches,
    ["priority: expected high, received medium"]
  );
  assert.equal(
    apple.consistencyErrors.some((error) => error.includes("defaultVisible")),
    false,
    "A supported high/medium article must not be rejected solely for being high/medium"
  );

  const office = realEvaluation.checks.find((item) => item.id === "hide-06-office-promotion");
  assert.equal(office.schemaValid, true);
  assert.equal(office.evidenceValid, true);
  assert.equal(office.result.defaultVisible, true, "The raw model result must remain unchanged");
  for (const expectedError of [
    "defaultVisible must be false when relevance is low",
    "defaultVisible must be false when priority is low",
    "defaultVisible must be false when abstain is true",
    "defaultVisible lacks material increment"
  ]) {
    assert.equal(
      office.consistencyErrors.some((error) => error.includes(expectedError)),
      true,
      `Missing consistency error: ${expectedError}`
    );
  }
  assert.equal(
    office.consistencyErrors.some((error) => error.includes('businessDomain "advanced_packaging"')),
    true
  );
  assert.equal(
    office.consistencyErrors.some((error) => error.includes('businessDomain "ems_odm_manufacturing"')),
    true
  );
  assert.deepEqual(
    office.referenceMismatches,
    [
      "eventStage: expected occurred, received unknown",
      "defaultVisible: expected false, received true"
    ]
  );

  const stageConflictPayload = JSON.parse(realFixtureBefore);
  stageConflictPayload.results[0].result.eventStage = "occurred";
  const stageConflictPath = path.join(temporaryDirectory, "stage-conflict.json");
  const stageConflictEvaluationPath = path.join(temporaryDirectory, "stage-conflict-evaluation.json");
  await fs.writeFile(stageConflictPath, `${JSON.stringify(stageConflictPayload, null, 2)}\n`);
  const stageConflictRun = validate(stageConflictPath, stageConflictEvaluationPath);
  assert.equal(stageConflictRun.status, 0, stageConflictRun.stderr || stageConflictRun.stdout);
  const stageConflictEvaluation = JSON.parse(await fs.readFile(stageConflictEvaluationPath, "utf8"));
  assert.equal(
    stageConflictEvaluation.checks[0].consistencyErrors.some(
      (error) => error.includes("only describes a future event")
    ),
    true
  );

  const emptyDomainPayload = JSON.parse(realFixtureBefore);
  emptyDomainPayload.caseIds = ["hide-06-office-promotion"];
  emptyDomainPayload.results = [emptyDomainPayload.results[1]];
  emptyDomainPayload.results[0].result.businessDomain = [];
  emptyDomainPayload.results[0].result.defaultVisible = false;
  const emptyDomainPath = path.join(temporaryDirectory, "empty-domain.json");
  const emptyDomainEvaluationPath = path.join(temporaryDirectory, "empty-domain-evaluation.json");
  await fs.writeFile(emptyDomainPath, `${JSON.stringify(emptyDomainPayload, null, 2)}\n`);
  const emptyDomainRun = validate(emptyDomainPath, emptyDomainEvaluationPath);
  assert.equal(emptyDomainRun.status, 0, emptyDomainRun.stderr || emptyDomainRun.stdout);
  const emptyDomainEvaluation = JSON.parse(await fs.readFile(emptyDomainEvaluationPath, "utf8"));
  assert.equal(emptyDomainEvaluation.checks[0].consistencyValid, true);
  assert.equal(await fs.readFile(realFixturePath, "utf8"), realFixtureBefore);

  console.log("Qwen experiment mock harness passed");
} finally {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
}
