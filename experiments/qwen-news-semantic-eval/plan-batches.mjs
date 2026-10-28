import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const mode = process.env.EVAL_MODE || process.argv[2] || "smoke";
const batchSize = Number(process.env.BATCH_SIZE || 5);
const smokeCaseIds = (process.env.SMOKE_CASE_IDS
  || "high-04-apple-manufacturing,hide-06-office-promotion")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (!["smoke", "full"].includes(mode)) {
  throw new Error(`Unsupported EVAL_MODE: ${mode}`);
}
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5) {
  throw new Error(`BATCH_SIZE must be an integer from 1 to 5; received ${batchSize}`);
}

const cases = JSON.parse(await fs.readFile(path.join(directory, "cases.json"), "utf8"));
const allIds = cases.map((item) => item.id);
const unknownSmokeIds = smokeCaseIds.filter((id) => !allIds.includes(id));
if (unknownSmokeIds.length) {
  throw new Error(`Unknown smoke case ids: ${unknownSmokeIds.join(", ")}`);
}

const selectedIds = mode === "smoke" ? smokeCaseIds : allIds;
const batches = [];
for (let index = 0; index < selectedIds.length; index += batchSize) {
  const ids = selectedIds.slice(index, index + batchSize);
  batches.push({
    batchId: mode === "smoke" ? "smoke" : `batch-${String(batches.length + 1).padStart(2, "0")}`,
    caseIds: ids.join(","),
    caseCount: ids.length
  });
}

console.log(JSON.stringify({
  mode,
  caseIds: selectedIds,
  matrix: { include: batches }
}));
