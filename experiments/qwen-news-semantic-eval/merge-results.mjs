import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const inputRoot = process.env.INPUT_ROOT;
const outputPath = process.env.RESULT_PATH;
const expectedCaseIds = (process.env.CASE_IDS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (!inputRoot || !outputPath) {
  throw new Error("INPUT_ROOT and RESULT_PATH are required");
}

async function findResultFiles(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findResultFiles(entryPath));
    else if (entry.isFile() && entry.name === "model-output.json") files.push(entryPath);
  }
  return files;
}

const files = (await findResultFiles(inputRoot)).sort();
if (!files.length) throw new Error(`No model-output.json files found under ${inputRoot}`);

const payloads = await Promise.all(files.map(async (file) => ({
  file,
  payload: JSON.parse(await fs.readFile(file, "utf8"))
})));
const models = new Set(payloads.map(({ payload }) => payload.model));
if (models.size !== 1) throw new Error(`Batch model mismatch: ${[...models].join(", ")}`);
const experimentGroups = new Set(payloads.map(({ payload }) => payload.experimentGroup || "historical_baseline"));
if (experimentGroups.size !== 1) {
  throw new Error(`Batch experiment group mismatch: ${[...experimentGroups].join(", ")}`);
}
const profileSignatures = new Set(payloads.map(({ payload }) => JSON.stringify(payload.businessProfile || null)));
if (profileSignatures.size !== 1) throw new Error("Batch business-profile metadata mismatch");
const batchRunSignatures = payloads.map(({ payload }) => payload.runSignature || null);

const resultById = new Map();
for (const { file, payload } of payloads) {
  for (const result of payload.results || []) {
    if (resultById.has(result.id)) {
      throw new Error(`Duplicate result ${result.id} in ${file}`);
    }
    resultById.set(result.id, result);
  }
}

const orderedIds = expectedCaseIds.length ? expectedCaseIds : [...resultById.keys()];
const missingIds = orderedIds.filter((id) => !resultById.has(id));
const unexpectedIds = [...resultById.keys()].filter((id) => !orderedIds.includes(id));
if (missingIds.length || unexpectedIds.length) {
  throw new Error(
    `Batch result mismatch; missing=${missingIds.join(",") || "none"}; unexpected=${unexpectedIds.join(",") || "none"}`
  );
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  model: [...models][0],
  experimentGroup: [...experimentGroups][0],
  runSignature: crypto.createHash("sha256").update(JSON.stringify(batchRunSignatures)).digest("hex"),
  batchRunSignatures,
  businessProfile: JSON.parse([...profileSignatures][0]),
  caseIds: orderedIds,
  sourceFiles: files.map((file) => path.relative(inputRoot, file)),
  results: orderedIds.map((id) => resultById.get(id))
}, null, 2)}\n`);
console.log(`Merged ${orderedIds.length} results from ${files.length} batches into ${outputPath}`);
