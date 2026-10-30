import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(directory, "../..");
const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "qwen-profile-context-test-"));
const contextPath = path.join(temporaryDirectory, "profile.txt");
const manifestPath = path.join(temporaryDirectory, "profile.json");
const resultPath = path.join(temporaryDirectory, "model-output.json");

try {
  const build = spawnSync(process.execPath, [path.join(directory, "build-business-profile-context.mjs")], {
    encoding: "utf8",
    cwd: repositoryRoot,
    env: {
      ...process.env,
      BUSINESS_PROFILE_CONTEXT_OUTPUT: contextPath,
      BUSINESS_PROFILE_MANIFEST_OUTPUT: manifestPath,
      MAX_CONTEXT_TOKENS: "8192"
    }
  });
  assert.equal(build.status, 0, build.stderr || build.stdout);

  const [context, manifest, profile, labels] = await Promise.all([
    fs.readFile(contextPath, "utf8"),
    fs.readFile(manifestPath, "utf8").then(JSON.parse),
    fs.readFile(path.join(repositoryRoot, "config", "luxshare-business-profile.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(directory, "human-labels.json"), "utf8")
  ]);
  assert.equal(manifest.productCount, 51);
  assert.equal(manifest.estimates.maxContextTokens, 8192);
  assert.equal(manifest.containsUrls, false);
  assert.ok(manifest.estimates.estimatedWorstCaseTotal <= manifest.estimates.maxContextTokens);
  assert.equal(manifest.estimates.historicalMaxPromptTokens, 922);
  assert.ok(manifest.estimates.addedProfileMessageBytes > 0);
  assert.ok(manifest.estimates.conservativeWorstCaseTotal <= manifest.estimates.maxContextTokens);
  assert.ok(manifest.estimates.businessProfileTokens > 0);
  for (const product of profile.domains.flatMap((domain) => domain.products)) {
    assert.ok(context.includes(product.productName), `Missing product in compact profile: ${product.productId}`);
  }
  assert.equal(context.includes(labels.trim()), false, "Human labels must never be embedded in model context");
  assert.equal(context.includes("https://"), false);

  let capturedRequest = null;
  const responseResult = {
    relevance: "low",
    priority: "low",
    businessDomain: ["unrelated"],
    materialIncrement: { exists: false, type: "none", description: "Software promotion." },
    eventStage: "occurred",
    evidenceConfidence: "attributed_report",
    summary: "A consumer software license is offered at a discounted price.",
    defaultVisible: false,
    evidenceQuotes: ["Microsoft Office Professional 2021 for Windows lifetime license is on sale for $27.97"],
    abstain: false,
    uncertainties: []
  };
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    capturedRequest = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify(responseResult) } }],
      usage: { prompt_tokens: 500, completion_tokens: 80, total_tokens: 580 }
    }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    const run = await new Promise((resolve) => {
      const child = spawn(process.execPath, [path.join(directory, "run-eval.mjs")], {
        cwd: repositoryRoot,
        env: {
          ...process.env,
          LLM_BASE_URL: `http://127.0.0.1:${port}/v1`,
          MODEL: "mock-qwen-8b",
          CASE_IDS: "hide-06-office-promotion",
          RESULT_PATH: resultPath,
          EXPERIMENT_GROUP: "business_profile",
          BUSINESS_PROFILE_CONTEXT_PATH: contextPath,
          BUSINESS_PROFILE_MANIFEST_PATH: manifestPath
        }
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.on("close", (status) => resolve({ status, stdout, stderr }));
    });
    assert.equal(run.status, 0, run.stderr || run.stdout);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  assert.equal(capturedRequest.messages.length, 3);
  assert.equal(capturedRequest.messages[0].content, await fs.readFile(path.join(directory, "system-prompt.txt"), "utf8"));
  assert.ok(capturedRequest.messages[1].content.includes(context.trim()));
  assert.equal(capturedRequest.messages[1].content.includes(labels.trim()), false);

  const output = JSON.parse(await fs.readFile(resultPath, "utf8"));
  assert.equal(output.experimentGroup, "business_profile");
  assert.equal(output.businessProfile.profileVersion, profile.profileVersion);
  assert.equal(output.businessProfile.profileSha256, manifest.profileSha256);
  assert.equal(output.businessProfile.contextSha256, manifest.contextSha256);
  assert.equal(typeof output.runSignature, "string");
  assert.equal(output.runSignature.length, 64);

  const profileEvaluationPath = path.join(temporaryDirectory, "profile-evaluation.json");
  const baselineResultPath = path.join(temporaryDirectory, "baseline-output.json");
  const baselineEvaluationPath = path.join(temporaryDirectory, "baseline-evaluation.json");
  const comparisonPath = path.join(temporaryDirectory, "comparison.json");
  const baselineOutput = {
    ...output,
    experimentGroup: "baseline",
    businessProfile: null,
    runSignature: "baseline-test-signature"
  };
  await fs.writeFile(baselineResultPath, `${JSON.stringify(baselineOutput, null, 2)}\n`);
  for (const [input, evaluation] of [
    [resultPath, profileEvaluationPath],
    [baselineResultPath, baselineEvaluationPath]
  ]) {
    const validation = spawnSync(process.execPath, [path.join(directory, "validate-results.mjs")], {
      encoding: "utf8",
      cwd: repositoryRoot,
      env: { ...process.env, RESULT_PATH: input, EVALUATION_PATH: evaluation }
    });
    assert.equal(validation.status, 0, validation.stderr || validation.stdout);
  }
  const comparison = spawnSync(process.execPath, [path.join(directory, "compare-business-profile-ab.mjs")], {
    encoding: "utf8",
    cwd: repositoryRoot,
    env: {
      ...process.env,
      BASELINE_EVALUATION_PATH: baselineEvaluationPath,
      PROFILE_EVALUATION_PATH: profileEvaluationPath,
      COMPARISON_OUTPUT_PATH: comparisonPath
    }
  });
  assert.equal(comparison.status, 0, comparison.stderr || comparison.stdout);
  const comparisonPayload = JSON.parse(await fs.readFile(comparisonPath, "utf8"));
  assert.equal(comparisonPayload.cases.length, 1);
  assert.equal(comparisonPayload.cases[0].id, "hide-06-office-promotion");

  console.log("Qwen business-profile context tests passed");
} finally {
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
}
