import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDecisionEngine, createSourceBinding } from "./decision-engine.mjs";
import { loadBusinessProfile, retrieveProductCandidates } from "./profile-retriever.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(directory, "../../..");
const profileData = await loadBusinessProfile(
  path.join(repositoryRoot, "config/luxshare-business-profile.json"),
  path.join(directory, "product-relations.json")
);
const decide = createDecisionEngine(profileData);
const schema = JSON.parse(await fs.readFile(path.join(directory, "response.schema.json"), "utf8"));
const sourceBindings = new WeakMap();

assert.equal(schema.properties.modelAssessment.properties.modelHomepageRecommendation.type, "boolean");
assert.equal(schema.properties.claims.items.properties.eventStage.enum.includes("sampling_validation"), true);
assert.equal(Object.hasOwn(schema.properties, "sourceDocument"), false);
assert.equal(Object.hasOwn(schema.properties.evidenceUnits.items.properties, "articleId"), false);
assert.equal(profileData.products.length, 51);

const retrievedAec = retrieveProductCandidates({
  title: "Marvell unveils second-generation 1.6T AEC DSP",
  summary: "The protocol-aware DSP is intended for active electrical cables in AI racks."
}, profileData);
assert.equal(retrievedAec.primaryCandidates[0].productId, "aec_dsp");
assert.ok(retrievedAec.primaryCandidates.some((item) => item.productId === "active_electrical_cable"));
assert.ok(retrievedAec.neighborCandidates.some((item) => item.productId === "active_copper_cable"));
assert.equal(retrievedAec.fullProfileFallback, false);
assert.equal(retrievedAec.fallbackDoesNotRejectArticle, true);

const noMatch = retrieveProductCandidates({ title: "Quarterly office lease promotion", summary: "No hardware event." }, profileData);
assert.equal(noMatch.fullProfileFallback, true);
assert.ok(noMatch.trace.some((item) => item.step === "full_profile_fallback"));

const ambiguousOptical = retrieveProductCandidates({ title: "New optical module announced", summary: "An optical module was introduced." }, profileData);
assert.equal(ambiguousOptical.fullProfileFallback, true);
assert.ok(ambiguousOptical.conflicts.length > 0);

function assessment({
  id,
  evidence,
  products = [],
  contexts = [],
  claims = [],
  technical = null,
  sufficiency = "sufficient",
  modelRelevance = "medium",
  modelPriority = "medium",
  modelVisible = true
}) {
  const evidenceUnits = evidence.map((text, index) => ({ evidenceId: `e${index + 1}`, origin: index ? "feed_summary" : "title", text }));
  const modelOutput = {
    articleId: id,
    evidenceUnits,
    productMatches: products.map((product, index) => ({
      productId: product.id,
      productRole: product.role || "article_subject",
      matchType: product.matchType || "affected_product",
      relationshipBasis: product.basis || "explicit_article_evidence",
      impactDimensions: product.impacts || ["design"],
      claimIds: product.claimIds || claims.map((_, claimIndex) => `c${claimIndex + 1}`),
      evidenceIds: product.evidenceIds || [`e${Math.min(index + 1, evidence.length)}`],
      reason: product.reason || "The cited evidence connects the article to this product.",
      confidence: product.confidence || "high"
    })),
    strategicContexts: contexts.map((context) => ({
      contextType: context.type,
      materiality: context.materiality,
      evidenceBasis: context.basis || "explicit_event",
      description: context.description || "A specific strategic event is described.",
      claimIds: context.claimIds || claims.map((_, claimIndex) => `c${claimIndex + 1}`),
      evidenceIds: context.evidenceIds || ["e1"]
    })),
    claims: claims.map((claim, index) => ({
      claimId: `c${index + 1}`,
      eventType: claim.type,
      subject: claim.subject || "Company",
      object: claim.object || "",
      eventStage: claim.stage,
      evidenceConfidence: claim.confidence || "official",
      qualifiers: claim.qualifiers || [],
      timeline: claim.timeline ?? null,
      factStatus: claim.factStatus || (claim.stage === "occurred" ? "fact" : claim.stage === "confirmed_future" ? "formal_plan" : claim.stage === "sampling_validation" ? "validation" : claim.stage === "rumor" ? "unconfirmed" : "unknown"),
      evidenceIds: claim.evidenceIds || [`e${Math.min(index + 1, evidence.length)}`]
    })),
    technicalAnalysis: technical || { isDeep: false, evidenceBasis: "insufficient", dimensions: [], specificImpacts: [], evidenceIds: [] },
    evidenceSufficiency: { status: sufficiency, gaps: sufficiency === "sufficient" ? [] : ["Full technical or commercial evidence is missing."] },
    factualSummary: evidence.join(" "),
    modelAssessment: { relevance: modelRelevance, priority: modelPriority, modelHomepageRecommendation: modelVisible, reason: "Raw model recommendation retained for audit." },
    uncertainties: []
  };
  sourceBindings.set(modelOutput, createSourceBinding(id, {
    title: evidence[0],
    originalSummary: evidence.slice(1).join(" "),
    bodyEvidence: []
  }));
  return modelOutput;
}

const cases = [
  {
    name: "Marvell AEC DSP planned sampling remains hidden because it is upstream",
    input: assessment({
      id: "marvell-aec",
      evidence: ["Marvell introduced a 1.6T AEC DSP.", "Customer samples are expected in the second half of 2027."],
      products: [{ id: "aec_dsp", impacts: ["interface", "performance"], evidenceIds: ["e1", "e2"] }],
      claims: [{ type: "customer_sampling", stage: "sampling_validation", timeline: "H2 2027", evidenceIds: ["e2"] }]
    }),
    expect: { status: "rejected", visible: false, relevance: "medium", reason: "upstream_sampling_without_adoption" }
  },
  {
    name: "Marvell CXL specification and future sampling do not imply server adoption",
    input: assessment({
      id: "marvell-cxl",
      evidence: ["The CXL 3.2 memory expander supports six channels.", "Sampling is planned for 2027."],
      products: [{ id: "dram_memory", impacts: ["interface"], evidenceIds: ["e1"] }],
      claims: [{ type: "customer_sampling", stage: "sampling_validation", timeline: "2027", evidenceIds: ["e2"] }]
    }),
    expect: { status: "rejected", visible: false, relevance: "medium", reason: "upstream_sampling_without_adoption" }
  },
  {
    name: "Google Cloud Vera Rubin formal commercialization uses the platform path without productId",
    input: assessment({
      id: "google-rubin-ga",
      evidence: ["Google Cloud and NVIDIA announced general availability of Vera Rubin infrastructure for customer deployment."],
      contexts: [{ type: "major_industry_platform", materiality: "major" }],
      claims: [{ type: "commercial_availability", stage: "occurred" }],
      products: []
    }),
    expect: { status: "accepted", visible: true, relevance: "medium", path: "major_platform_commercialization" }
  },
  {
    name: "Apple material supplier and manufacturing shift uses the supply-chain path",
    input: assessment({
      id: "apple-manufacturing",
      evidence: ["Apple announced supplier investments in critical materials and US manufacturing for future devices."],
      contexts: [{ type: "important_customer_supply_chain", materiality: "major" }],
      claims: [{ type: "capital_investment", stage: "confirmed_future", timeline: "future devices" }],
      products: []
    }),
    expect: { status: "accepted", visible: true, relevance: "medium", path: "important_customer_supply_chain_change" }
  },
  {
    name: "NVIDIA capacity expansion with a specific manufacturing object is material but not automatically high priority",
    input: assessment({
      id: "nvidia-capacity",
      evidence: ["NVIDIA and named supply-chain partners announced capacity buildout for AI infrastructure components."],
      contexts: [{ type: "important_customer_supply_chain", materiality: "material" }],
      claims: [{ type: "capacity_expansion", stage: "confirmed_future", timeline: "announced buildout" }],
      products: []
    }),
    expect: { status: "accepted", visible: true, relevance: "medium", priority: "medium", path: "important_customer_supply_chain_change" }
  },
  {
    name: "Vertiv liquid cooling and power deployment maps to direct products",
    input: assessment({
      id: "vertiv-polar",
      evidence: ["A 41MW site will deploy prefabricated power and thermal management systems."],
      products: [{ id: "coolant_distribution_unit", impacts: ["thermal", "capacity"] }, { id: "server_power_supply", impacts: ["capacity"] }],
      claims: [{ type: "customer_adoption", stage: "confirmed_future", timeline: "deployment program" }]
    }),
    expect: { status: "accepted", visible: true, relevance: "high", path: "direct_product_business" }
  },
  {
    name: "CPO deep technical cost analysis qualifies without a new event",
    input: assessment({
      id: "cpo-cost",
      evidence: ["The analysis quantifies test cost and explains wafer-level manufacturing bottlenecks for co-packaged optics."],
      products: [{ id: "cpo_solution", impacts: ["cost", "manufacturing"] }],
      claims: [{ type: "technical_analysis", stage: "not_applicable", factStatus: "not_applicable" }],
      technical: { isDeep: true, evidenceBasis: "explicit_analysis", dimensions: ["cost", "manufacturing_difficulty"], specificImpacts: ["wafer-level test cost constrains CPO manufacturing"], evidenceIds: ["e1"] }
    }),
    expect: { status: "accepted", visible: true, relevance: "high", priority: "medium", path: "core_direct_technical_analysis" }
  },
  {
    name: "Silicon photonics test requirements without a specific impact require review",
    input: assessment({
      id: "silicon-photonics",
      evidence: ["The article lists general testing requirements for silicon photonics."],
      products: [{ id: "silicon_photonics_chip", impacts: [] }],
      claims: [{ type: "technical_analysis", stage: "not_applicable", factStatus: "not_applicable" }],
      sufficiency: "partial"
    }),
    expect: { status: "needs_review", visible: false, relevance: "medium", reason: "evidence_partial" }
  },
  {
    name: "Panel-level packaging with insufficient evidence is retained for review",
    input: assessment({
      id: "panel-packaging",
      evidence: ["The article says panels are gaining momentum but provides no verified Luxshare capability or manufacturing impact."],
      products: [{ id: "2_5d_3d_semiconductor_packaging", impacts: ["manufacturing"] }],
      claims: [{ type: "technical_analysis", stage: "not_applicable", factStatus: "not_applicable" }],
      sufficiency: "insufficient"
    }),
    expect: { status: "needs_review", visible: false, relevance: "medium", reason: "unconfirmed_business_not_direct" }
  },
  {
    name: "Office promotion is rejected even when the model recommends homepage",
    input: assessment({
      id: "office-promotion",
      evidence: ["Microsoft Office Professional is offered for $27.97 with no subscription."],
      claims: [{ type: "promotion", stage: "occurred" }],
      products: [],
      modelVisible: true,
      modelRelevance: "high",
      modelPriority: "high"
    }),
    expect: { status: "rejected", visible: false, relevance: "low", priority: "low", reason: "low_relevance_not_homepage_eligible" }
  },
  {
    name: "Explicit rumor is retained outside homepage",
    input: assessment({
      id: "cpu-rumor",
      evidence: ["Sources reportedly said a customer may develop an in-house server CPU."],
      products: [{ id: "cpu_chip", impacts: ["demand"] }],
      claims: [{ type: "technology_route_change", stage: "rumor", confidence: "rumor", factStatus: "unconfirmed" }]
    }),
    expect: { status: "rejected", visible: false, relevance: "medium", reason: "rumor_not_homepage_eligible" }
  },
  {
    name: "Official future investment remains future and can qualify",
    input: assessment({
      id: "future-investment",
      evidence: ["The board approved a factory investment that will begin equipment installation in 2028."],
      contexts: [{ type: "important_customer_supply_chain", materiality: "major" }],
      claims: [{ type: "capital_investment", stage: "confirmed_future", timeline: "2028" }]
    }),
    expect: { status: "accepted", visible: true, path: "important_customer_supply_chain_change" }
  },
  {
    name: "A future investment mislabeled occurred is sent to review",
    input: assessment({
      id: "future-mislabeled",
      evidence: ["The company plans to build a factory and will begin production in 2028."],
      contexts: [{ type: "important_customer_supply_chain", materiality: "major" }],
      claims: [{ type: "mass_production", stage: "occurred", factStatus: "fact" }]
    }),
    expect: { status: "needs_review", visible: false, reason: "event_stage_evidence_conflict" }
  },
  {
    name: "Multiple claims preserve different stages",
    input: assessment({
      id: "multi-claim",
      evidence: ["Equipment installation has started.", "Mass production is scheduled for 2028."],
      contexts: [{ type: "important_customer_supply_chain", materiality: "major", evidenceIds: ["e1", "e2"] }],
      claims: [
        { type: "manufacturing_milestone", stage: "occurred", evidenceIds: ["e1"] },
        { type: "mass_production", stage: "confirmed_future", timeline: "2028", evidenceIds: ["e2"] }
      ]
    }),
    expect: { status: "accepted", visible: true, path: "important_customer_supply_chain_change" },
    verify(result, input) {
      assert.deepEqual(input.claims.map((claim) => claim.eventStage), ["occurred", "confirmed_future"]);
      assert.equal(result.auditTrail.find((item) => item.step === "stage_validation").contradictions.length, 0);
    }
  },
  {
    name: "High relevance with low priority stays outside homepage",
    input: assessment({
      id: "direct-low-priority",
      evidence: ["A connector catalog page repeats existing specifications without a new event."],
      products: [{ id: "high_speed_connector", impacts: ["interface"] }],
      claims: [{ type: "other", stage: "not_applicable", factStatus: "not_applicable" }]
    }),
    expect: { status: "rejected", visible: false, relevance: "high", priority: "low", reason: "low_priority_not_homepage_eligible" }
  },
  {
    name: "Major platform path does not require productId",
    input: assessment({
      id: "platform-no-product",
      evidence: ["The industry platform entered general availability with commercial customer deployment."],
      contexts: [{ type: "major_industry_platform", materiality: "major" }],
      claims: [{ type: "commercial_availability", stage: "occurred" }],
      products: []
    }),
    expect: { status: "accepted", visible: true, relevance: "medium", path: "major_platform_commercialization" }
  },
  {
    name: "A future major platform launch is reviewable but is not GA",
    input: assessment({
      id: "future-platform",
      evidence: ["The provider announced that the platform will become generally available next year."],
      contexts: [{ type: "major_industry_platform", materiality: "major" }],
      claims: [{ type: "commercial_availability", stage: "confirmed_future", timeline: "next year" }],
      products: []
    }),
    expect: { status: "needs_review", visible: false, relevance: "medium", priority: "medium", reason: "future_platform_not_yet_commercialized" }
  },
  {
    name: "AEC DSP cannot inherit the direct AEC cable relationship from profile adjacency",
    input: assessment({
      id: "aec-no-direct-inheritance",
      evidence: ["The AEC DSP supports 1.6T links and is expected to sample in 2027."],
      products: [
        { id: "aec_dsp", impacts: ["interface"] },
        { id: "active_electrical_cable", role: "related_luxshare_product", basis: "profile_adjacency_only", impacts: ["interface"] }
      ],
      claims: [{ type: "customer_sampling", stage: "sampling_validation", timeline: "2027" }]
    }),
    expect: { status: "needs_review", visible: false, relevance: "medium", reason: "related_product_impact_not_evidence_backed" }
  },
  {
    name: "An upstream specification without downstream impact has no homepage path",
    input: assessment({
      id: "upstream-spec-only",
      evidence: ["The processor supports a new instruction and lists peak benchmark specifications."],
      products: [{ id: "cpu_chip", impacts: [] }],
      claims: [{ type: "product_release", stage: "occurred" }]
    }),
    expect: { status: "rejected", visible: false, relevance: "medium", priority: "medium", reason: "no_qualifying_admission_path" }
  },
  {
    name: "A real evidence ID that only proves adjacency cannot support a direct business conclusion",
    input: assessment({
      id: "unsupported-business-impact",
      evidence: ["The chip is electrically compatible with active cables."],
      products: [{ id: "active_electrical_cable", role: "related_luxshare_product", basis: "profile_adjacency_only", impacts: ["interface"] }],
      claims: [{ type: "product_release", stage: "occurred" }]
    }),
    expect: { status: "needs_review", visible: false, relevance: "low", reason: "related_product_impact_not_evidence_backed" }
  },
  {
    name: "A reference to a nonexistent evidence ID requires review",
    input: (() => {
      const value = assessment({
        id: "missing-evidence",
        evidence: ["A direct-to-chip cooling product entered commercial service."],
        products: [{ id: "cold_plate", impacts: ["thermal"] }],
        claims: [{ type: "commercial_availability", stage: "occurred" }]
      });
      value.productMatches[0].evidenceIds = ["e99"];
      return value;
    })(),
    expect: { status: "needs_review", visible: false, reason: "missing_evidence_reference" }
  },
  {
    name: "A model article ID that differs from the program-owned source binding requires review",
    input: (() => {
      const value = assessment({
        id: "cross-article-evidence",
        evidence: ["A CDU entered commercial deployment."],
        products: [{ id: "coolant_distribution_unit", impacts: ["thermal"] }],
        claims: [{ type: "commercial_availability", stage: "occurred" }]
      });
      const binding = sourceBindings.get(value);
      sourceBindings.set(value, { ...binding, articleId: "different-article" });
      return value;
    })(),
    expect: { status: "needs_review", visible: false, reason: "article_source_binding_mismatch" }
  },
  {
    name: "A changed program input hash requires review",
    input: (() => {
      const value = assessment({
        id: "changed-source-hash",
        evidence: ["A CDU entered commercial deployment."],
        products: [{ id: "coolant_distribution_unit", impacts: ["thermal"] }],
        claims: [{ type: "commercial_availability", stage: "occurred" }]
      });
      const binding = sourceBindings.get(value);
      sourceBindings.set(value, { ...binding, inputHash: "0".repeat(64) });
      return value;
    })(),
    expect: { status: "needs_review", visible: false, reason: "input_hash_mismatch" }
  },
  {
    name: "A quote not contained in the declared source cannot support admission",
    input: (() => {
      const value = assessment({
        id: "invented-quote",
        evidence: ["A rack power product was introduced."],
        products: [{ id: "server_power_supply", impacts: ["capacity"] }],
        claims: [{ type: "product_release", stage: "occurred" }]
      });
      value.evidenceUnits[0].text = "The product secured a major hyperscale order.";
      return value;
    })(),
    expect: { status: "needs_review", visible: false, reason: "evidence_not_contained_in_source" }
  },
  {
    name: "A completed expansion remains occurred rather than a future plan",
    input: assessment({
      id: "completed-expansion",
      evidence: ["The supplier completed the capacity expansion and the new line entered service."],
      contexts: [{ type: "important_customer_supply_chain", materiality: "material" }],
      claims: [{ type: "capacity_expansion", stage: "occurred" }]
    }),
    expect: { status: "accepted", visible: true, path: "important_customer_supply_chain_change" },
    verify(result, input) {
      assert.equal(input.claims[0].eventStage, "occurred");
      assert.equal(result.auditTrail.find((item) => item.step === "stage_validation").contradictions.length, 0);
    }
  },
  {
    name: "Contradictory claims about the same event require review",
    input: assessment({
      id: "contradictory-claims",
      evidence: ["The factory expansion has been completed.", "The same factory expansion is scheduled for next year."],
      contexts: [{ type: "important_customer_supply_chain", materiality: "major", evidenceIds: ["e1", "e2"] }],
      claims: [
        { type: "capacity_expansion", stage: "occurred", subject: "Supplier", object: "factory expansion", evidenceIds: ["e1"] },
        { type: "capacity_expansion", stage: "confirmed_future", subject: "Supplier", object: "factory expansion", timeline: "next year", evidenceIds: ["e2"] }
      ]
    }),
    expect: { status: "needs_review", visible: false, reason: "event_stage_evidence_conflict" }
  },
  {
    name: "An unknown product ID cannot be treated as a direct business",
    input: assessment({
      id: "unknown-product",
      evidence: ["A new hardware module entered production."],
      products: [{ id: "not_in_business_profile", impacts: ["manufacturing"] }],
      claims: [{ type: "mass_production", stage: "occurred" }]
    }),
    expect: { status: "needs_review", visible: false, reason: "unknown_product_id" }
  },
  {
    name: "Insufficient event evidence can retain High Relevance for a direct product",
    input: assessment({
      id: "direct-product-partial-evidence",
      evidence: ["The article directly discusses a rack-scale integration product but omits deployment evidence."],
      products: [{ id: "ai_rack_scale_integration", impacts: ["design"] }],
      claims: [{ type: "other", stage: "unknown" }],
      sufficiency: "partial"
    }),
    expect: { status: "needs_review", visible: false, relevance: "high", reason: "evidence_partial" }
  }
];

for (const testCase of cases) {
  const result = decide(testCase.input, sourceBindings.get(testCase.input));
  assert.equal(result.decisionStatus, testCase.expect.status, `${testCase.name}: status`);
  assert.equal(result.defaultVisible, testCase.expect.visible, `${testCase.name}: visibility`);
  if (testCase.expect.relevance) assert.equal(result.effectiveRelevance, testCase.expect.relevance, `${testCase.name}: relevance`);
  if (testCase.expect.priority) assert.equal(result.effectivePriority, testCase.expect.priority, `${testCase.name}: priority`);
  if (testCase.expect.path) assert.equal(result.admissionPath, testCase.expect.path, `${testCase.name}: path`);
  if (testCase.expect.reason) assert.ok(result.reasonCodes.includes(testCase.expect.reason), `${testCase.name}: missing reason ${testCase.expect.reason}; got ${result.reasonCodes}`);
  assert.equal(result.modelHomepageRecommendation, testCase.input.modelAssessment.modelHomepageRecommendation);
  assert.ok(result.auditTrail.length >= 4);
  testCase.verify?.(result, testCase.input);
}

console.log(`V2 semantic review prototype tests passed: ${cases.length + 3}/${cases.length + 3}`);
