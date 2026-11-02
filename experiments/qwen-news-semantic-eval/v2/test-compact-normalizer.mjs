import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDecisionEngine, createSourceBinding } from "./decision-engine.mjs";
import { normalizeCompactModelOutput } from "./normalize-model-output.mjs";
import { loadBusinessProfile } from "./profile-retriever.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(directory, "../../..");
const profileData = await loadBusinessProfile(
  path.join(repositoryRoot, "config/luxshare-business-profile.json"),
  path.join(directory, "product-relations.json")
);
const decide = createDecisionEngine(profileData);

function compact(overrides = {}) {
  return {
    articleId: "compact-case",
    evidence: [{ id: "e1", quote: "The analysis identifies CPO test cost and manufacturing bottlenecks." }],
    products: [{
      productId: "cpo_solution", role: "article_subject", match: "direct_subject", support: "explicit_impact",
      impacts: ["cost", "manufacturing"], claimIndexes: [0], evidenceIds: ["e1"]
    }],
    contexts: [],
    claims: [{
      type: "technical_analysis", subject: "CPO analysis", object: "test cost", stage: "not_applicable",
      confidence: "attributed_report", qualifiers: [], timeline: null, evidenceIds: ["e1"]
    }],
    technical: {
      deep: true, support: "explicit_analysis", dimensions: ["cost", "manufacturing_difficulty"],
      impacts: ["Test cost constrains CPO manufacturing."], evidenceIds: ["e1"]
    },
    sufficiency: { status: "sufficient", complete: true, reviewCodes: [] },
    ...overrides
  };
}

function binding(id = "compact-case", summary = "The analysis identifies CPO test cost and manufacturing bottlenecks.") {
  return createSourceBinding(id, { title: "CPO test analysis", originalSummary: summary, bodyEvidence: [], evidenceAvailability: "reliable" });
}

{
  const normalized = normalizeCompactModelOutput(compact(), binding());
  assert.equal(normalized.normalization.valid, true);
  assert.equal(normalized.assessment.claims[0].claimId, "c1");
  assert.equal(normalized.assessment.claims[0].factStatus, "not_applicable");
  assert.equal(normalized.assessment.evidenceUnits[0].origin, "feed_summary");
  const decision = decide(normalized.assessment, binding());
  assert.equal(decision.decisionStatus, "accepted");
  assert.equal(decision.admissionPath, "core_direct_technical_analysis");
}

{
  const value = compact({
    products: [{
      productId: "active_electrical_cable", role: "related_luxshare_product", match: "affected_product",
      support: "explicit_impact", impacts: [], claimIndexes: [], evidenceIds: ["e1"]
    }]
  });
  const normalized = normalizeCompactModelOutput(value, binding());
  assert.equal(normalized.normalization.valid, false);
  assert.ok(normalized.normalization.errors.some((error) => error.code === "related_product_impact_binding_incomplete"));
  assert.equal(normalized.assessment.evidenceSufficiency.status, "partial");
  assert.equal(decide(normalized.assessment, binding()).decisionStatus, "needs_review");
}

{
  const value = compact({ claims: compact().claims.concat([
    { type: "mass_production", subject: "Factory", object: "CPO", stage: "confirmed_future", confidence: "official", qualifiers: ["planned"], timeline: "2028", evidenceIds: ["e1"] }
  ]) });
  const normalized = normalizeCompactModelOutput(value, binding());
  assert.deepEqual(normalized.assessment.claims.map((claim) => claim.claimId), ["c1", "c2"]);
  assert.equal(normalized.assessment.claims[1].factStatus, "formal_plan");
  assert.deepEqual(normalized.normalization.limitSaturation, []);
}

{
  const value = compact({
    claims: [{ type: "mass_production", subject: "Factory", object: "CPO", stage: "occurred", confidence: "official", qualifiers: [], timeline: "2028", evidenceIds: ["e1"] }],
    sufficiency: { status: "sufficient", complete: false, reviewCodes: ["claim_limit_reached"] }
  });
  const normalized = normalizeCompactModelOutput(value, binding());
  assert.equal(normalized.assessment.evidenceSufficiency.status, "partial");
  assert.equal(decide(normalized.assessment, binding()).decisionStatus, "needs_review");
}

{
  const value = compact({ evidence: [{ id: "e1", quote: "A fabricated quote not present in the article." }] });
  const normalized = normalizeCompactModelOutput(value, binding());
  assert.equal(normalized.normalization.valid, false);
  assert.ok(normalized.normalization.errors.some((error) => error.code === "evidence_not_contained_in_source"));
}

{
  const value = compact({
    products: compact().products.map((product) => ({ ...product, evidenceIds: ["e2"] }))
  });
  const normalized = normalizeCompactModelOutput(value, binding());
  assert.equal(normalized.normalization.valid, false);
  assert.ok(normalized.normalization.errors.some((error) => error.code === "unknown_evidence_id"));
  assert.equal(decide(normalized.assessment, binding()).decisionStatus, "needs_review");
}

{
  const source = binding("compact-case", "The company plans to begin mass production in 2028.");
  const value = compact({
    evidence: [{ id: "e1", quote: "The company plans to begin mass production in 2028." }],
    claims: [{
      type: "mass_production", subject: "Company", object: "production", stage: "occurred",
      confidence: "official", qualifiers: [], timeline: "2028", evidenceIds: ["e1"]
    }],
    products: compact().products.map((product) => ({ ...product, claimIndexes: [0], evidenceIds: ["e1"] }))
  });
  const normalized = normalizeCompactModelOutput(value, source);
  const decision = decide(normalized.assessment, source);
  assert.equal(decision.decisionStatus, "needs_review");
  assert.ok(decision.reasonCodes.includes("event_stage_evidence_conflict"));
}

{
  const value = compact({ products: compact().products.map((product) => ({ ...product, productId: "not_a_real_product" })) });
  const normalized = normalizeCompactModelOutput(value, binding());
  const decision = decide(normalized.assessment, binding());
  assert.equal(decision.decisionStatus, "needs_review");
  assert.ok(decision.reasonCodes.includes("unknown_product_id"));
}

console.log("V2 compact normalization tests passed");
