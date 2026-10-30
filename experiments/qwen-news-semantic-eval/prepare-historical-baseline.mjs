import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.resolve(
  process.env.BASELINE_FIXTURE_DIR
    || path.join(directory, "fixtures", "qwen3-8b-run-40644621847-full")
);
const outputPath = process.env.RESULT_PATH;
const expectedModel = process.env.MODEL;
const expectedModelSha256 = process.env.MODEL_SHA256;
const expectedLlamaRef = process.env.LLAMA_REF;
const expectedInferenceProfile = process.env.BASELINE_INFERENCE_PROFILE;

if (!outputPath || !expectedModel || !expectedModelSha256 || !expectedLlamaRef || !expectedInferenceProfile) {
  throw new Error("RESULT_PATH, MODEL, MODEL_SHA256, LLAMA_REF and BASELINE_INFERENCE_PROFILE are required");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const manifestPath = path.join(fixtureDirectory, "manifest.json");
const modelOutputPath = path.join(fixtureDirectory, "model-output.json");
const [manifest, rawModelOutput, cases] = await Promise.all([
  fs.readFile(manifestPath, "utf8").then(JSON.parse),
  fs.readFile(modelOutputPath, "utf8"),
  fs.readFile(path.join(directory, "cases.json"), "utf8").then(JSON.parse)
]);
const payload = JSON.parse(rawModelOutput);

if (sha256(rawModelOutput) !== manifest.modelOutputSha256) {
  throw new Error("Historical model-output.json hash does not match its manifest");
}
if (payload.model !== expectedModel || manifest.modelId !== expectedModel) {
  throw new Error(`Historical model mismatch: ${payload.model}`);
}
if (manifest.modelSha256 !== expectedModelSha256) throw new Error("Historical model SHA mismatch");
if (manifest.llamaRef !== expectedLlamaRef) throw new Error("Historical llama.cpp ref mismatch");
if (manifest.inferenceProfile !== expectedInferenceProfile) throw new Error("Historical inference profile mismatch");

for (const fileName of [
  "cases.json",
  "human-labels.json",
  "response.schema.json",
  "system-prompt.txt"
]) {
  const value = await fs.readFile(path.join(directory, fileName));
  if (sha256(value) !== manifest.fixedInputSha256[fileName]) {
    throw new Error(`Historical fixed input differs: ${fileName}`);
  }
}

const expectedCaseIds = cases.map((item) => item.id);
if (payload.results?.length !== expectedCaseIds.length) {
  throw new Error(`Historical result count mismatch: ${payload.results?.length}`);
}
if (JSON.stringify(payload.caseIds) !== JSON.stringify(expectedCaseIds)) {
  throw new Error("Historical case ids or ordering do not match the fixed 20-case dataset");
}
if (payload.results.some((item) => item.error || !item.result)) {
  throw new Error("Historical baseline contains incomplete model results");
}

const caseById = new Map(cases.map((item) => [item.id, item]));
const inputKeys = [
  "sourceId",
  "publishedAt",
  "title",
  "url",
  "originalSummary",
  "bodyEvidence",
  "evidenceAvailability"
];
for (const result of payload.results) {
  const sourceCase = caseById.get(result.id);
  if (!sourceCase) throw new Error(`Unknown historical case id: ${result.id}`);
  for (const key of inputKeys) {
    if (JSON.stringify(result.input?.[key]) !== JSON.stringify(sourceCase[key])) {
      throw new Error(`Historical article input differs: ${result.id}.${key}`);
    }
  }
}

const prepared = {
  ...payload,
  experimentGroup: "historical_baseline",
  runSignature: null,
  businessProfile: null,
  historicalSource: {
    runId: manifest.sourceRunId,
    runHeadSha: manifest.sourceRunHeadSha,
    modelOutputSha256: manifest.modelOutputSha256,
    modelSha256: manifest.modelSha256,
    llamaRef: manifest.llamaRef,
    inferenceProfile: manifest.inferenceProfile,
    provenanceLimitations: manifest.limitations,
    reusedAt: new Date().toISOString()
  }
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(prepared, null, 2)}\n`);
console.log(`Prepared historical baseline from run ${manifest.sourceRunId}: ${expectedCaseIds.length} unchanged model results`);
