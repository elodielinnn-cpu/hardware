import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const experimentRoot = path.resolve(directory, "..");
const v2ResultPath = process.env.V2_RESULT_PATH;
const outputPath = process.env.COMPARISON_PATH;
const historicalBPath = process.env.HISTORICAL_B_RESULT_PATH || "";
if (!v2ResultPath || !outputPath) throw new Error("V2_RESULT_PATH and COMPARISON_PATH are required");

const [labels, historicalA, v2, historicalB] = await Promise.all([
  fs.readFile(path.join(experimentRoot, "human-labels.json"), "utf8").then(JSON.parse),
  fs.readFile(path.join(experimentRoot, "fixtures", "qwen3-8b-run-40644621847-full", "model-output.json"), "utf8").then(JSON.parse),
  fs.readFile(v2ResultPath, "utf8").then(JSON.parse),
  historicalBPath
    ? fs.readFile(historicalBPath, "utf8").then(JSON.parse).catch(() => null)
    : Promise.resolve(null)
]);

const byId = (items) => new Map((items || []).map((item) => [item.id, item]));
const labelById = byId(labels);
const aById = byId(historicalA.results);
const bById = byId(historicalB?.results);
const v2ById = byId(v2.results);
const cases = v2.caseIds.map((id) => {
  const v2Entry = v2ById.get(id);
  const extraction = v2Entry?.parsedModelOutput;
  return {
    id,
    humanLabel: labelById.get(id) || null,
    historicalA: aById.get(id)?.result || null,
    historicalB: bById.get(id)?.result || null,
    v2ModelExtraction: extraction || null,
    v2ModelSuggestion: extraction?.modelAssessment || null,
    v2DeterministicDecision: v2Entry?.decision || null,
    technicalStatus: {
      error: v2Entry?.error || null,
      schemaValidation: v2Entry?.schemaValidation || null,
      sourceBindingValidation: v2Entry?.sourceBindingValidation || null
    },
    retrieval: v2Entry ? {
      mode: v2Entry.candidateProfile.selectionMode,
      candidateProductIds: v2Entry.candidateProfile.candidateProductIds,
      neighborProductIds: v2Entry.candidateProfile.neighborProductIds,
      trace: v2Entry.retrieval.trace
    } : null,
    performance: v2Entry ? {
      promptTokens: v2Entry.contextBudget.promptTokenCount,
      completionTokens: v2Entry.usage?.completion_tokens ?? null,
      totalTokens: v2Entry.usage?.total_tokens ?? null,
      elapsedMs: v2Entry.elapsedMs
    } : null
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  v2RunSignature: v2.runSignature,
  historicalA: { runId: "40644621847", available: true },
  historicalB: { runId: "40992830933", available: Boolean(historicalB) },
  note: historicalB
    ? "Historical B raw results were loaded without modification."
    : "Historical B raw results were unavailable; no values were inferred or copied from review reports.",
  cases
};
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);
