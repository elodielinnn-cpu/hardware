import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const baselinePath = process.env.BASELINE_EVALUATION_PATH;
const profilePath = process.env.PROFILE_EVALUATION_PATH;
const outputPath = process.env.COMPARISON_OUTPUT_PATH;

if (!baselinePath || !profilePath || !outputPath) {
  throw new Error("BASELINE_EVALUATION_PATH, PROFILE_EVALUATION_PATH and COMPARISON_OUTPUT_PATH are required");
}

const [baseline, profile] = await Promise.all([
  fs.readFile(baselinePath, "utf8").then(JSON.parse),
  fs.readFile(profilePath, "utf8").then(JSON.parse)
]);

if (baseline.model !== profile.model) {
  throw new Error(`Model mismatch: ${baseline.model} vs ${profile.model}`);
}

const baselineById = new Map(baseline.checks.map((item) => [item.id, item]));
const profileById = new Map(profile.checks.map((item) => [item.id, item]));
const baselineIds = [...baselineById.keys()];
const profileIds = [...profileById.keys()];
if (JSON.stringify(baselineIds) !== JSON.stringify(profileIds)) {
  throw new Error("A/B case ids or ordering differ");
}

const focusIds = new Set([
  "edge-02-marvell-retimer",
  "edge-01-google-ga",
  "high-01-nvidia-capacity",
  "edge-05-silicon-photonics-test",
  "edge-06-cpo-test-cost"
]);

function metricSnapshot(evaluation) {
  const metrics = evaluation.metrics;
  return {
    schemaValidity: metrics.schemaValidity,
    evidenceValidity: metrics.evidenceValidity,
    consistencyValidity: metrics.consistencyValidity,
    relevanceAccuracy: metrics.relevanceAccuracy,
    priorityAccuracy: metrics.priorityAccuracy,
    eventStageAccuracy: metrics.eventStageAccuracy,
    defaultVisible: metrics.defaultVisible,
    highValueMisses: metrics.highValueMisses,
    hiddenNewsFalsePositives: metrics.hiddenNewsFalsePositives,
    inferenceTiming: metrics.inferenceTiming,
    inferenceTokens: metrics.inferenceTokens || null
  };
}

function businessDomainWarnings(check) {
  return (check.consistencyErrors || []).filter((message) => message.includes("businessDomain"));
}

const cases = baselineIds.map((id) => {
  const a = baselineById.get(id);
  const b = profileById.get(id);
  return {
    id,
    focusCase: focusIds.has(id),
    baseline: {
      relevance: a.result?.relevance ?? null,
      priority: a.result?.priority ?? null,
      eventStage: a.result?.eventStage ?? null,
      defaultVisible: a.result?.defaultVisible ?? null,
      effectiveDefaultVisible: a.effectiveRecommendation?.defaultVisible ?? null,
      businessDomain: a.result?.businessDomain ?? null,
      schemaValid: a.schemaValid,
      evidenceValid: a.evidenceValid,
      consistencyValid: a.consistencyValid,
      businessDomainWarnings: businessDomainWarnings(a),
      referenceMismatches: a.referenceMismatches,
      elapsedMs: a.elapsedMs,
      usage: a.usage
    },
    businessProfile: {
      relevance: b.result?.relevance ?? null,
      priority: b.result?.priority ?? null,
      eventStage: b.result?.eventStage ?? null,
      defaultVisible: b.result?.defaultVisible ?? null,
      effectiveDefaultVisible: b.effectiveRecommendation?.defaultVisible ?? null,
      businessDomain: b.result?.businessDomain ?? null,
      schemaValid: b.schemaValid,
      evidenceValid: b.evidenceValid,
      consistencyValid: b.consistencyValid,
      businessDomainWarnings: businessDomainWarnings(b),
      referenceMismatches: b.referenceMismatches,
      elapsedMs: b.elapsedMs,
      usage: b.usage
    }
  };
});

const comparison = {
  generatedAt: new Date().toISOString(),
  model: baseline.model,
  baselineSource: {
    experimentGroup: baseline.experimentGroup,
    runSignature: baseline.runSignature
  },
  businessProfileSource: {
    experimentGroup: profile.experimentGroup,
    runSignature: profile.runSignature,
    businessProfile: profile.businessProfile
  },
  caveats: [
    "Human labels are evaluation references only and were not model inputs.",
    "businessDomain warnings are deterministic lexical review prompts, not proof that a domain assignment is semantically wrong.",
    "Historical model output is retained as historical output and is never represented as a new inference."
  ],
  metrics: {
    baseline: metricSnapshot(baseline),
    businessProfile: metricSnapshot(profile)
  },
  focusCases: cases.filter((item) => item.focusCase),
  cases
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(comparison, null, 2)}\n`);
console.log(`Compared ${cases.length} cases and wrote ${outputPath}`);
