import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createDecisionEngine, createSourceBinding, validateSourceBinding } from "./decision-engine.mjs";
import { normalizeCompactModelOutput } from "./normalize-model-output.mjs";
import { loadBusinessProfile } from "./profile-retriever.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const experimentRoot = path.resolve(directory, "..");
const repositoryRoot = path.resolve(directory, "../../..");
const fixturePath = path.join(directory, "fixtures/run-41381394905/model-output.json");
const fixtureText = await fs.readFile(fixturePath, "utf8");
const fixtureHash = crypto.createHash("sha256").update(fixtureText).digest("hex");
const rawOutput = JSON.parse(fixtureText);
const cases = JSON.parse(await fs.readFile(path.join(experimentRoot, "cases.json"), "utf8"));
const article = cases.find((item) => item.id === "edge-06-cpo-test-cost");
assert.ok(article);

const profileData = await loadBusinessProfile(
  path.join(repositoryRoot, "config/luxshare-business-profile.json"),
  path.join(directory, "product-relations.json")
);
const sourceBinding = createSourceBinding(article.id, {
  title: article.title,
  originalSummary: article.originalSummary,
  bodyEvidence: article.bodyEvidence,
  evidenceAvailability: article.evidenceAvailability
});

const formal = spawnSync(process.env.PYTHON || "python3", [
  path.join(directory, "validate-schema.py"),
  path.join(directory, "response.schema.json"),
  fixturePath
], { encoding: "utf8", env: process.env });
assert.equal(formal.status, 1, formal.stderr || "Historical engineering-state fields must fail the new Schema");
const formalResult = JSON.parse(formal.stdout);
assert.equal(formalResult.valid, false);
assert.ok(formalResult.errors.some((error) => error.path.startsWith("/sufficiency")));

const normalized = normalizeCompactModelOutput(rawOutput, sourceBinding, profileData, {
  schemaValid: false,
  finishReason: "stop",
  outputTruncated: false
});
const bindingValidation = validateSourceBinding(normalized.assessment, sourceBinding);
const decision = createDecisionEngine(profileData)(normalized.assessment, sourceBinding);
const errorCodes = new Set(normalized.normalization.errors.map((error) => error.code));

assert.deepEqual(bindingValidation.evidenceNotInSourceIds, []);
assert.deepEqual(bindingValidation.validEvidenceIds.sort(), ["e1", "e2"]);
assert.ok(errorCodes.has("model_reported_engineering_completion"));
assert.ok(errorCodes.has("model_reported_engineering_capacity"));
assert.equal(errorCodes.has("strategic_context_without_material_event"), false);
assert.equal(errorCodes.has("unconfirmed_product_cannot_be_related_luxshare_product"), false);
assert.equal(normalized.normalization.semanticEvidenceStatus, "unable_to_assess");
assert.equal(normalized.normalization.semanticStatusSource, "legacy_ambiguous");
assert.deepEqual(normalized.assessment.evidenceSufficiency.gaps, [], "Legacy capacity codes must not become semantic evidence gaps");
assert.equal(normalized.outputIntegrity.outputTruncated, false);
assert.equal(normalized.outputIntegrity.structuredOutputComplete, false, "New Schema rejects the legacy engineering fields");
assert.deepEqual(normalized.outputIntegrity.limitSaturation, []);
assert.equal(decision.effectiveRelevance, "high");
assert.equal(decision.effectivePriority, "medium");
assert.equal(decision.decisionStatus, "needs_review");
assert.equal(decision.defaultVisible, false);
assert.ok(decision.reasonCodes.includes("technical_depth_requires_full_text"));

const fixtureTextAfterReplay = await fs.readFile(fixturePath, "utf8");
assert.equal(crypto.createHash("sha256").update(fixtureTextAfterReplay).digest("hex"), fixtureHash);

console.log(JSON.stringify({
  runId: "41381394905",
  replayClassification: "historical_replay_not_new_inference",
  countsAsNewSchemaInferenceSuccess: false,
  schemaValidUnderSemanticOnlySchema: formalResult.valid,
  sourceEvidenceBindingValid: bindingValidation.evidenceNotInSourceIds.length === 0,
  semanticEvidenceStatus: normalized.normalization.semanticEvidenceStatus,
  semanticStatusSource: normalized.normalization.semanticStatusSource,
  outputIntegrity: normalized.outputIntegrity,
  normalizationErrorCodes: [...errorCodes].sort(),
  decision: {
    relevance: decision.effectiveRelevance,
    priority: decision.effectivePriority,
    status: decision.decisionStatus,
    defaultVisible: decision.defaultVisible,
    reasonCodes: decision.reasonCodes
  }
}, null, 2));
