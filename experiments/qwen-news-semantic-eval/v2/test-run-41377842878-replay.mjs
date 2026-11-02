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
const fixturePath = path.join(directory, "fixtures/run-41377842878/model-output.json");
const fixtureText = await fs.readFile(fixturePath, "utf8");
const fixtureHash = crypto.createHash("sha256").update(fixtureText).digest("hex");
const rawOutput = JSON.parse(fixtureText);
const cases = JSON.parse(await fs.readFile(path.join(experimentRoot, "cases.json"), "utf8"));
const article = cases.find((item) => item.id === "edge-06-cpo-test-cost");
assert.ok(article, "CPO source article must remain in cases.json");

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
assert.equal(formal.status, 1, formal.stderr || "Historical output must fail the corrected Schema");
const formalResult = JSON.parse(formal.stdout);
assert.equal(formalResult.valid, false);
assert.ok(formalResult.errors.some((error) => error.path.includes("/contexts/") && error.message.includes("insufficient")));
assert.ok(formalResult.errors.some((error) => error.path.includes("/claims/") && error.message.includes("not_applicable")));

const normalized = normalizeCompactModelOutput(rawOutput, sourceBinding, profileData);
const bindingValidation = validateSourceBinding(normalized.assessment, sourceBinding);
const decision = createDecisionEngine(profileData)(normalized.assessment, sourceBinding);
const errorCodes = new Set(normalized.normalization.errors.map((error) => error.code));

assert.equal(bindingValidation.articleIdMatches, true);
assert.equal(bindingValidation.inputHashMatches, true);
assert.deepEqual(bindingValidation.evidenceNotInSourceIds, []);
assert.deepEqual(bindingValidation.validEvidenceIds.sort(), ["e1", "e2"]);
assert.ok(errorCodes.has("non_material_context_should_be_omitted"));
assert.ok(errorCodes.has("strategic_context_without_material_event"));
assert.ok(errorCodes.has("related_product_cannot_be_direct_subject"));
assert.ok(errorCodes.has("unconfirmed_product_cannot_be_related_luxshare_product"));
assert.ok(errorCodes.has("limit_reason_not_supported_by_output"));
assert.deepEqual(normalized.normalization.limitSaturation, [{ field: "contexts", length: 2, limit: 2 }]);
assert.deepEqual(normalized.normalization.declaredLimitOmissions, ["evidence_limit_reached"]);
assert.deepEqual(normalized.normalization.structurallyPlausibleLimitDeclarations, []);
assert.equal(normalized.normalization.modelDeclaredIncomplete, true);
assert.equal(normalized.normalization.valid, false);
assert.equal(decision.decisionStatus, "needs_review");
assert.equal(decision.defaultVisible, false);

const fixtureTextAfterReplay = await fs.readFile(fixturePath, "utf8");
assert.equal(crypto.createHash("sha256").update(fixtureTextAfterReplay).digest("hex"), fixtureHash);

console.log(JSON.stringify({
  runId: "41377842878",
  schemaValidUnderCorrectedSchema: formalResult.valid,
  evidenceBindingValid: bindingValidation.evidenceNotInSourceIds.length === 0,
  normalizationValid: normalized.normalization.valid,
  normalizationErrorCodes: [...errorCodes].sort(),
  decisionStatus: decision.decisionStatus,
  defaultVisible: decision.defaultVisible,
  categories: {
    programDetectable: [
      "irrelevant strategic contexts",
      "unsupported limit declaration",
      "unconfirmed product represented as a Luxshare-related direct subject"
    ],
    requiresModelReExtraction: [
      "emit empty contexts",
      "use not_applicable for technical-analysis stage",
      "correct optical_engine role",
      "correct completeness declaration"
    ],
    requiresMoreSourceEvidence: [
      "whether the short retained summary proves sufficiently deep technical analysis"
    ]
  }
}, null, 2));
