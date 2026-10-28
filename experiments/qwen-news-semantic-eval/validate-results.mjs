import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const resultPath = process.env.RESULT_PATH;
const evaluationPath = process.env.EVALUATION_PATH
  || path.join(directory, "results", "evaluation.json");

if (!resultPath) {
  console.error("RESULT_PATH is required");
  process.exit(1);
}

const [payload, cases, labels, schema] = await Promise.all([
  fs.readFile(resultPath, "utf8").then(JSON.parse),
  fs.readFile(path.join(directory, "cases.json"), "utf8").then(JSON.parse),
  fs.readFile(path.join(directory, "human-labels.json"), "utf8").then(JSON.parse),
  fs.readFile(path.join(directory, "response.schema.json"), "utf8").then(JSON.parse)
]);

function validateSchema(value, definition, location = "result") {
  const errors = [];
  const actualType = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
  if (definition.type && actualType !== definition.type) {
    return [`${location}: expected ${definition.type}, received ${actualType}`];
  }
  if (definition.enum && !definition.enum.includes(value)) {
    errors.push(`${location}: value is not in the allowed enum`);
  }
  if (definition.type === "object") {
    for (const key of definition.required || []) {
      if (!(key in value)) errors.push(`${location}.${key}: required property is missing`);
    }
    if (definition.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in (definition.properties || {}))) {
          errors.push(`${location}.${key}: unexpected property`);
        }
      }
    }
    for (const [key, childDefinition] of Object.entries(definition.properties || {})) {
      if (key in value) errors.push(...validateSchema(value[key], childDefinition, `${location}.${key}`));
    }
  }
  if (definition.type === "array") {
    if (definition.maxItems !== undefined && value.length > definition.maxItems) {
      errors.push(`${location}: exceeds maxItems ${definition.maxItems}`);
    }
    if (definition.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) {
      errors.push(`${location}: duplicate items are not allowed`);
    }
    value.forEach((item, index) => {
      errors.push(...validateSchema(item, definition.items || {}, `${location}[${index}]`));
    });
  }
  return errors;
}

const caseById = new Map(cases.map((item) => [item.id, item]));
const labelById = new Map(labels.map((item) => [item.id, item]));
const checks = [];

for (const entry of payload.results || []) {
  const sourceCase = caseById.get(entry.id);
  const reference = labelById.get(entry.id);
  const schemaErrors = entry.result ? validateSchema(entry.result, schema) : [];
  const evidenceErrors = [];
  const referenceMismatches = [];

  if (!sourceCase) schemaErrors.push(`Unknown case id: ${entry.id}`);
  if (!reference) schemaErrors.push(`Missing reference label: ${entry.id}`);
  if (entry.error) schemaErrors.push(`Inference error: ${entry.error}`);
  if (!entry.result && !entry.error) schemaErrors.push("Model result is missing");

  if (sourceCase && entry.result) {
    const evidenceSources = [sourceCase.originalSummary, ...(sourceCase.bodyEvidence || [])];
    if (!entry.result.abstain && !(entry.result.evidenceQuotes || []).length) {
      evidenceErrors.push("At least one exact evidence quote is required when abstain=false");
    }
    for (const quote of entry.result.evidenceQuotes || []) {
      if (!quote.trim() || !evidenceSources.some((source) => source.includes(quote))) {
        evidenceErrors.push(`Unsupported evidence quote: ${JSON.stringify(quote)}`);
      }
    }
  }

  if (reference && entry.result) {
    for (const key of ["relevance", "priority", "eventStage", "defaultVisible"]) {
      if (entry.result[key] !== reference[key]) {
        referenceMismatches.push(`${key}: expected ${reference[key]}, received ${entry.result[key]}`);
      }
    }
  }

  checks.push({
    id: entry.id,
    elapsedMs: entry.elapsedMs,
    usage: entry.usage || null,
    schemaValid: schemaErrors.length === 0,
    evidenceValid: evidenceErrors.length === 0,
    referenceMatch: referenceMismatches.length === 0,
    schemaErrors,
    evidenceErrors,
    referenceMismatches,
    result: entry.result || null
  });
}

const expectedIds = payload.caseIds || [];
const returnedIds = new Set(checks.map((item) => item.id));
const missingIds = expectedIds.filter((id) => !returnedIds.has(id));
const summary = {
  expected: expectedIds.length,
  returned: checks.length,
  schemaValid: checks.filter((item) => item.schemaValid).length,
  evidenceValid: checks.filter((item) => item.evidenceValid).length,
  referenceMatches: checks.filter((item) => item.referenceMatch).length,
  technicalFailures: checks.filter((item) => !item.schemaValid || !item.evidenceValid).length,
  semanticMismatches: checks.filter((item) => !item.referenceMatch).length,
  missingIds,
  technicalValidationPassed: false,
  semanticEvaluationPassed: false
};

const technicalFailure = missingIds.length
  || checks.length !== expectedIds.length
  || checks.some((item) => !item.schemaValid || !item.evidenceValid);
summary.technicalValidationPassed = !technicalFailure;
summary.semanticEvaluationPassed = checks.length === expectedIds.length
  && checks.every((item) => item.referenceMatch);

await fs.mkdir(path.dirname(evaluationPath), { recursive: true });
await fs.writeFile(
  evaluationPath,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), model: payload.model, summary, checks }, null, 2)}\n`
);
console.log(JSON.stringify(summary, null, 2));

// Semantic disagreement is an evaluation result, not an experiment infrastructure failure.
if (technicalFailure) process.exitCode = 1;
