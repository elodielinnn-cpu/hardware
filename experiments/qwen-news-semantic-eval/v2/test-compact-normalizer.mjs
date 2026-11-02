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
    sufficiency: { status: "sufficient", reasonCodes: [] },
    ...overrides
  };
}

function binding(id = "compact-case", summary = "The analysis identifies CPO test cost and manufacturing bottlenecks.") {
  return createSourceBinding(id, { title: "CPO test analysis", originalSummary: summary, bodyEvidence: [], evidenceAvailability: "reliable" });
}

{
  const normalized = normalizeCompactModelOutput(compact(), binding(), profileData);
  assert.equal(normalized.normalization.valid, true);
  assert.equal(normalized.assessment.claims[0].claimId, "c1");
  assert.equal(normalized.assessment.claims[0].factStatus, "not_applicable");
  assert.equal(normalized.assessment.evidenceUnits[0].origin, "feed_summary");
  assert.equal(normalized.outputIntegrity.structuredOutputComplete, true);
  assert.deepEqual(normalized.outputIntegrity.fieldLimits, { evidence: 4, products: 4, contexts: 2, claims: 3 });
  const decision = decide(normalized.assessment, binding());
  assert.equal(decision.decisionStatus, "accepted");
  assert.equal(decision.admissionPath, "core_direct_technical_analysis");
}

{
  const value = compact({ sufficiency: { status: "requires_full_text", reasonCodes: [] } });
  const normalized = normalizeCompactModelOutput(value, binding(), profileData);
  assert.ok(normalized.normalization.errors.some((error) => error.code === "semantic_status_reason_mismatch"));
}

{
  const value = compact({ sufficiency: { status: "sufficient", reasonCodes: ["other"] } });
  const normalized = normalizeCompactModelOutput(value, binding(), profileData);
  assert.ok(normalized.normalization.errors.some((error) => error.code === "sufficient_evidence_has_reason_codes"));
}

{
  const value = compact({
    products: [{
      productId: "active_electrical_cable", role: "related_luxshare_product", match: "affected_product",
      support: "explicit_impact", impacts: [], claimIndexes: [], evidenceIds: ["e1"]
    }]
  });
  const normalized = normalizeCompactModelOutput(value, binding(), profileData);
  assert.equal(normalized.normalization.valid, false);
  assert.ok(normalized.normalization.errors.some((error) => error.code === "related_product_impact_binding_incomplete"));
  assert.equal(normalized.assessment.evidenceSufficiency.status, "sufficient");
  assert.equal(decide(normalized.assessment, binding()).decisionStatus, "needs_review");
}

{
  const value = compact({ claims: compact().claims.concat([
    { type: "mass_production", subject: "Factory", object: "CPO", stage: "confirmed_future", confidence: "official", qualifiers: ["planned"], timeline: "2028", evidenceIds: ["e1"] }
  ]) });
  const normalized = normalizeCompactModelOutput(value, binding(), profileData);
  assert.deepEqual(normalized.assessment.claims.map((claim) => claim.claimId), ["c1", "c2"]);
  assert.equal(normalized.assessment.claims[1].factStatus, "formal_plan");
  assert.deepEqual(normalized.outputIntegrity.limitSaturation, []);
}

{
  const normalized = normalizeCompactModelOutput(compact(), binding(), profileData, {
    schemaValid: true,
    finishReason: "length",
    outputTruncated: true
  });
  assert.equal(normalized.normalization.valid, true);
  assert.equal(normalized.outputIntegrity.structuredOutputComplete, false);
  assert.equal(normalized.outputIntegrity.outputTruncated, true);
}

{
  const normalized = normalizeCompactModelOutput(compact(), binding(), profileData, {
    schemaValid: true,
    finishReason: null,
    technicalError: "request_timeout"
  });
  assert.equal(normalized.normalization.valid, true);
  assert.equal(normalized.outputIntegrity.structuredOutputComplete, false);
  assert.equal(normalized.outputIntegrity.outputTruncated, false);
  assert.equal(normalized.outputIntegrity.technicalError, "request_timeout");
}

{
  const value = compact({ evidence: [{ id: "e1", quote: "A fabricated quote not present in the article." }] });
  const normalized = normalizeCompactModelOutput(value, binding(), profileData);
  assert.equal(normalized.normalization.valid, false);
  assert.ok(normalized.normalization.errors.some((error) => error.code === "evidence_not_contained_in_source"));
}

{
  const value = compact({
    products: compact().products.map((product) => ({ ...product, evidenceIds: ["e2"] }))
  });
  const normalized = normalizeCompactModelOutput(value, binding(), profileData);
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
  const normalized = normalizeCompactModelOutput(value, source, profileData);
  const decision = decide(normalized.assessment, source);
  assert.equal(decision.decisionStatus, "needs_review");
  assert.ok(decision.reasonCodes.includes("event_stage_evidence_conflict"));
}

{
  const value = compact({ products: compact().products.map((product) => ({ ...product, productId: "not_a_real_product" })) });
  const normalized = normalizeCompactModelOutput(value, binding(), profileData);
  const decision = decide(normalized.assessment, binding());
  assert.equal(decision.decisionStatus, "needs_review");
  assert.ok(decision.reasonCodes.includes("unknown_product_id"));
}

{
  const value = compact({
    claims: [{
      type: "capacity_expansion", subject: "Supplier", object: "CPO capacity", stage: "occurred",
      confidence: "official", qualifiers: [], timeline: null, evidenceIds: ["e1"]
    }],
    contexts: [
      { type: "important_customer_supply_chain", materiality: "material", support: "explicit_event", claimIndexes: [0], evidenceIds: ["e1"] },
      { type: "major_industry_platform", materiality: "material", support: "explicit_event", claimIndexes: [0], evidenceIds: ["e1"] }
    ]
  });
  const normalized = normalizeCompactModelOutput(value, binding(), profileData);
  assert.equal(normalized.outputIntegrity.structuredOutputComplete, true);
  assert.deepEqual(normalized.outputIntegrity.limitSaturation, [{ field: "contexts", length: 2, limit: 2 }]);
  assert.equal(normalized.normalization.valid, true);
}

{
  const summary = "The analysis identifies CPO test cost and manufacturing bottlenecks. Known-good optical engines are required.";
  const value = compact({
    evidence: [
      { id: "e1", quote: "The analysis identifies CPO test cost and manufacturing bottlenecks." },
      { id: "e2", quote: "Known-good optical engines are required." }
    ],
    products: compact().products.map((product) => ({ ...product, evidenceIds: ["e1", "e2"] })),
    technical: {
      deep: false, support: "insufficient", dimensions: ["cost", "manufacturing_difficulty"],
      impacts: ["Test cost and known-good optical engines require fuller technical evidence."], evidenceIds: ["e1", "e2"]
    },
    sufficiency: { status: "requires_full_text", reasonCodes: ["requires_full_text"] }
  });
  const normalized = normalizeCompactModelOutput(value, binding("compact-case", summary), profileData);
  const decision = decide(normalized.assessment, binding("compact-case", summary));
  assert.equal(normalized.outputIntegrity.limitSaturation.length, 0, "Two evidence units are below capacity");
  assert.equal(normalized.assessment.evidenceSufficiency.status, "requires_full_text");
  assert.equal(decision.effectiveRelevance, "high");
  assert.equal(decision.effectivePriority, "medium");
  assert.equal(decision.decisionStatus, "needs_review");
  assert.equal(decision.defaultVisible, false);
  assert.ok(decision.reasonCodes.includes("technical_depth_requires_full_text"));
}

{
  const quote = "Failure localization and wafer-level test cost constrain CPO manufacturing yield and economics.";
  const source = createSourceBinding("compact-case", {
    title: "CPO manufacturing analysis",
    originalSummary: "",
    bodyEvidence: [quote],
    evidenceAvailability: "reliable"
  });
  const value = compact({
    evidence: [{ id: "e1", quote }],
    technical: {
      deep: true, support: "explicit_analysis", dimensions: ["cost", "manufacturing_difficulty", "yield"],
      impacts: ["Failure localization and test cost constrain manufacturing yield and economics."], evidenceIds: ["e1"]
    }
  });
  const normalized = normalizeCompactModelOutput(value, source, profileData);
  const decision = decide(normalized.assessment, source);
  assert.equal(normalized.assessment.evidenceUnits[0].origin, "official_body");
  assert.equal(decision.decisionStatus, "accepted");
  assert.equal(decision.effectivePriority, "medium");
  assert.equal(decision.admissionPath, "core_direct_technical_analysis");
}

{
  const value = compact({
    products: [{
      productId: "optical_engine", role: "related_luxshare_product", match: "direct_subject",
      support: "explicit_impact", impacts: ["design"], claimIndexes: [0], evidenceIds: ["e1"]
    }]
  });
  const normalized = normalizeCompactModelOutput(value, binding(), profileData);
  assert.ok(normalized.normalization.errors.some((error) => error.code === "related_product_cannot_be_direct_subject"));
  assert.ok(normalized.normalization.errors.some((error) => error.code === "unconfirmed_product_cannot_be_related_luxshare_product"));
  assert.equal(decide(normalized.assessment, binding()).decisionStatus, "needs_review");
}

console.log("V2 compact normalization tests passed");
