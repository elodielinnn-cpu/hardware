import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const run = (script, env = {}) => spawnSync(process.execPath, [path.join(directory, script)], {
  encoding: "utf8",
  env: { ...process.env, ...env }
});

const smokeRun = run("plan-batches.mjs", { EVAL_MODE: "smoke" });
assert.equal(smokeRun.status, 0, smokeRun.stderr || smokeRun.stdout);
const smoke = JSON.parse(smokeRun.stdout);
assert.equal(smoke.caseIds.length, 2);
assert.equal(smoke.matrix.include.length, 1);
assert.equal(smoke.matrix.include[0].caseCount, 2);

const fullRun = run("plan-batches.mjs", { EVAL_MODE: "full", BATCH_SIZE: "5" });
assert.equal(fullRun.status, 0, fullRun.stderr || fullRun.stdout);
const full = JSON.parse(fullRun.stdout);
assert.equal(full.caseIds.length, 20);
assert.equal(new Set(full.caseIds).size, 20);
assert.equal(full.matrix.include.length, 4);
assert.equal(full.matrix.include.every((batch) => batch.caseCount <= 5), true);

const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "qwen-batch-tools-"));
try {
  const fixture = JSON.parse(await fs.readFile(
    path.join(directory, "fixtures", "qwen3-8b-run-40625841827.json"),
    "utf8"
  ));
  for (let index = 0; index < fixture.results.length; index += 1) {
    const batchDirectory = path.join(temporaryDirectory, `batch-${index + 1}`);
    await fs.mkdir(batchDirectory, { recursive: true });
    await fs.writeFile(path.join(batchDirectory, "model-output.json"), `${JSON.stringify({
      generatedAt: fixture.generatedAt,
      model: fixture.model,
      caseIds: [fixture.results[index].id],
      results: [fixture.results[index]]
    }, null, 2)}\n`);
  }

  const mergedPath = path.join(temporaryDirectory, "merged", "model-output.json");
  const mergeRun = run("merge-results.mjs", {
    INPUT_ROOT: temporaryDirectory,
    RESULT_PATH: mergedPath,
    CASE_IDS: fixture.caseIds.join(",")
  });
  assert.equal(mergeRun.status, 0, mergeRun.stderr || mergeRun.stdout);
  const merged = JSON.parse(await fs.readFile(mergedPath, "utf8"));
  assert.deepEqual(merged.caseIds, fixture.caseIds);
  assert.deepEqual(merged.results, fixture.results);
} finally {
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
}

console.log("Qwen batch planning and merge tests passed");
