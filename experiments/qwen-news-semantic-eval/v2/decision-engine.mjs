import crypto from "node:crypto";

const PRIORITY_ORDER = { low: 0, medium: 1, high: 2 };
const RELEVANCE_ORDER = { low: 0, medium: 1, high: 2 };
const ADMISSIBLE_STAGES = new Set(["occurred", "confirmed_future"]);
const FUTURE_MARKERS = /\b(?:will|plans? to|expected to|scheduled to|aims? to|targets? to)\b|将于|计划|预计|拟于|目标于/iu;
const RUMOR_MARKERS = /\b(?:reportedly|rumou?r|sources? (?:say|said)|may|could)\b|据称|传闻|消息称|可能/iu;

function maxLevel(values, order, fallback = "low") {
  return values.reduce((best, value) => (order[value] > order[best] ? value : best), fallback);
}

function unique(values) {
  return [...new Set(values)];
}

function evidenceMap(assessment) {
  return new Map((assessment.evidenceUnits || []).map((item) => [item.evidenceId, item]));
}

function normalizeEvidenceText(value) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

function bindingHash(articleId, originalSourceDocument) {
  return crypto.createHash("sha256").update(JSON.stringify({ articleId, originalSourceDocument })).digest("hex");
}

function validateEvidenceUnits(assessment, sourceBinding) {
  const originFields = {
    title: "title",
    feed_summary: "feedSummary",
    official_body: "bodyEvidence",
    attributed_body: "bodyEvidence"
  };
  const seen = new Set();
  const duplicateEvidenceIds = [];
  const evidenceNotInSourceIds = [];
  const validEvidenceIds = new Set();
  for (const unit of assessment.evidenceUnits || []) {
    if (seen.has(unit.evidenceId)) duplicateEvidenceIds.push(unit.evidenceId);
    seen.add(unit.evidenceId);
    const sourceField = originFields[unit.origin];
    const original = sourceBinding?.originalSourceDocument || {};
    const sourceValue = sourceField === "feedSummary"
      ? original.originalSummary
      : sourceField === "bodyEvidence"
        ? (original.bodyEvidence || []).join("\n")
        : original[sourceField];
    const sourceText = normalizeEvidenceText(sourceValue);
    const quotedText = normalizeEvidenceText(unit.text);
    if (!sourceField || !quotedText || !sourceText.includes(quotedText)) {
      evidenceNotInSourceIds.push(unit.evidenceId);
      continue;
    }
    validEvidenceIds.add(unit.evidenceId);
  }
  for (const id of duplicateEvidenceIds) validEvidenceIds.delete(id);
  return { duplicateEvidenceIds, evidenceNotInSourceIds, validEvidenceIds };
}

export function createSourceBinding(articleId, originalSourceDocument) {
  return {
    articleId,
    inputHash: bindingHash(articleId, originalSourceDocument),
    originalSourceDocument
  };
}

export function validateSourceBinding(assessment, sourceBinding) {
  const computedInputHash = sourceBinding?.articleId && sourceBinding?.originalSourceDocument
    ? bindingHash(sourceBinding.articleId, sourceBinding.originalSourceDocument)
    : null;
  const evidenceValidation = validateEvidenceUnits(assessment, sourceBinding);
  return {
    articleIdMatches: Boolean(sourceBinding?.articleId) && assessment.articleId === sourceBinding.articleId,
    inputHashMatches: Boolean(sourceBinding?.inputHash) && sourceBinding.inputHash === computedInputHash,
    computedInputHash,
    ...evidenceValidation,
    validEvidenceIds: [...evidenceValidation.validEvidenceIds]
  };
}

function collectEvidenceIds(assessment) {
  return unique([
    ...(assessment.productMatches || []).flatMap((item) => item.evidenceIds || []),
    ...(assessment.strategicContexts || []).flatMap((item) => item.evidenceIds || []),
    ...(assessment.claims || []).flatMap((item) => item.evidenceIds || []),
    ...(assessment.technicalAnalysis?.evidenceIds || [])
  ]);
}

function validateClaimReferences(assessment) {
  const claimIds = (assessment.claims || []).map((claim) => claim.claimId);
  const knownClaimIds = new Set(claimIds);
  const duplicateClaimIds = unique(claimIds.filter((id, index) => claimIds.indexOf(id) !== index));
  const referencedClaimIds = unique([
    ...(assessment.productMatches || []).flatMap((item) => item.claimIds || []),
    ...(assessment.strategicContexts || []).flatMap((item) => item.claimIds || [])
  ]);
  const unknownClaimIds = referencedClaimIds.filter((id) => !knownClaimIds.has(id));
  return { duplicateClaimIds, unknownClaimIds };
}

function stageContradictions(assessment, evidenceById) {
  const contradictions = [];
  for (const claim of assessment.claims || []) {
    const text = (claim.evidenceIds || []).map((id) => evidenceById.get(id)?.text || "").join(" ");
    if (claim.eventStage === "occurred" && FUTURE_MARKERS.test(text)) {
      contradictions.push({ claimId: claim.claimId, reason: "future_language_marked_occurred" });
    }
    if (claim.eventStage !== "rumor" && (claim.evidenceConfidence === "rumor" || RUMOR_MARKERS.test(text))) {
      contradictions.push({ claimId: claim.claimId, reason: "rumor_language_without_rumor_stage" });
    }
    if (claim.eventStage === "sampling_validation" && claim.factStatus !== "validation") {
      contradictions.push({ claimId: claim.claimId, reason: "sampling_stage_fact_status_mismatch" });
    }
    if (claim.eventStage === "confirmed_future" && claim.factStatus !== "formal_plan") {
      contradictions.push({ claimId: claim.claimId, reason: "future_stage_fact_status_mismatch" });
    }
  }
  const claims = assessment.claims || [];
  for (let leftIndex = 0; leftIndex < claims.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < claims.length; rightIndex += 1) {
      const left = claims[leftIndex];
      const right = claims[rightIndex];
      const sameEvent = left.eventType === right.eventType &&
        normalizeEvidenceText(left.subject) === normalizeEvidenceText(right.subject) &&
        normalizeEvidenceText(left.object) === normalizeEvidenceText(right.object);
      const incompatibleStages = new Set([left.eventStage, right.eventStage]);
      if (sameEvent && incompatibleStages.has("occurred") && (incompatibleStages.has("rumor") || incompatibleStages.has("confirmed_future"))) {
        contradictions.push({ claimIds: [left.claimId, right.claimId], reason: "conflicting_claim_stages" });
      }
    }
  }
  return contradictions;
}

function hasReliableClaim(assessment, predicate, validEvidenceIds, { stages = ADMISSIBLE_STAGES, claimIds = null } = {}) {
  return (assessment.claims || []).some((claim) =>
    (!claimIds || claimIds.has(claim.claimId)) &&
    predicate(claim) &&
    stages.has(claim.eventStage) &&
    ["official", "attributed_report"].includes(claim.evidenceConfidence) &&
    (claim.evidenceIds || []).length > 0 &&
    (claim.evidenceIds || []).every((id) => validEvidenceIds.has(id))
  );
}

function makeResult({ assessment, status, relevance, priority, visible, path, reasons, evidenceIds, auditTrail }) {
  return {
    articleId: assessment.articleId,
    effectiveRelevance: relevance,
    effectivePriority: priority,
    defaultVisible: visible,
    decisionStatus: status,
    admissionPath: path,
    reasonCodes: unique(reasons),
    evidenceIds: unique(evidenceIds),
    modelHomepageRecommendation: assessment.modelAssessment?.modelHomepageRecommendation ?? false,
    auditTrail
  };
}

export function createDecisionEngine(profileData) {
  return function decide(assessment, sourceBinding) {
    const evidenceById = evidenceMap(assessment);
    const sourceBindingValidation = validateSourceBinding(assessment, sourceBinding);
    const evidenceValidation = {
      ...sourceBindingValidation,
      validEvidenceIds: new Set(sourceBindingValidation.validEvidenceIds)
    };
    const claimValidation = validateClaimReferences(assessment);
    const referencedEvidenceIds = collectEvidenceIds(assessment);
    const missingEvidenceIds = referencedEvidenceIds.filter((id) => !evidenceById.has(id));
    const unknownProductIds = [];
    const matchedProducts = [];
    for (const match of assessment.productMatches || []) {
      const product = profileData.productsById.get(match.productId);
      if (!product) unknownProductIds.push(match.productId);
      else matchedProducts.push({ match, product });
    }

    const contradictions = stageContradictions(assessment, evidenceById);
    const matchHasValidEvidence = ({ match }) =>
      (match.evidenceIds || []).length > 0 &&
      (match.evidenceIds || []).every((id) => evidenceValidation.validEvidenceIds.has(id));
    const directMatches = matchedProducts.filter(({ product }) => product.relationshipLevel === "direct");
    const qualifiedDirectMatches = directMatches.filter(({ match, product }) =>
      matchHasValidEvidence({ match, product }) &&
      match.relationshipBasis === "explicit_article_evidence" &&
      (match.productRole === "article_subject" ||
        (match.productRole === "related_luxshare_product" && (match.impactDimensions || []).length > 0))
    );
    const upstreamMatches = matchedProducts.filter(({ product }) => product.relationshipLevel === "upstream");
    const adjacentMatches = matchedProducts.filter(({ product }) => product.relationshipLevel === "adjacent");
    const unconfirmedMatches = matchedProducts.filter(({ product }) => product.relationshipLevel === "unconfirmed");
    const contextHasValidEvidence = (item) =>
      item.evidenceBasis === "explicit_event" &&
      (item.evidenceIds || []).length > 0 &&
      item.evidenceIds.every((id) => evidenceValidation.validEvidenceIds.has(id));
    const supplyContexts = (assessment.strategicContexts || []).filter((item) =>
      item.contextType === "important_customer_supply_chain" &&
      ["major", "material"].includes(item.materiality) &&
      contextHasValidEvidence(item)
    );
    const platformContexts = (assessment.strategicContexts || []).filter((item) =>
      item.contextType === "major_industry_platform" &&
      item.materiality === "major" &&
      contextHasValidEvidence(item)
    );
    const evidenceStatus = assessment.evidenceSufficiency?.status || "insufficient";
    const unsupportedRelatedProductMatches = directMatches
      .filter(({ match }) =>
        match.productRole === "related_luxshare_product" &&
        (match.relationshipBasis !== "explicit_article_evidence" || !(match.impactDimensions || []).length)
      )
      .map(({ product }) => product.productId);
    const auditTrail = [
      { step: "profile_lookup", direct: directMatches.map(({ product }) => product.productId), qualifiedDirect: qualifiedDirectMatches.map(({ product }) => product.productId), upstream: upstreamMatches.map(({ product }) => product.productId), adjacent: adjacentMatches.map(({ product }) => product.productId), unconfirmed: unconfirmedMatches.map(({ product }) => product.productId) },
      { step: "source_binding_validation", articleIdMatches: sourceBindingValidation.articleIdMatches, inputHashMatches: sourceBindingValidation.inputHashMatches, inputHash: sourceBinding?.inputHash || null },
      { step: "evidence_validation", status: evidenceStatus, missingEvidenceIds, duplicateEvidenceIds: evidenceValidation.duplicateEvidenceIds, evidenceNotInSourceIds: evidenceValidation.evidenceNotInSourceIds, validEvidenceIds: [...evidenceValidation.validEvidenceIds] },
      { step: "claim_reference_validation", ...claimValidation },
      {
        step: "semantic_support_validation",
        unsupportedRelatedProductMatches,
        deterministicScope: "Checks structured evidence and claim bindings; semantic entailment still requires model or human review."
      },
      { step: "stage_validation", contradictions },
      { step: "model_recommendation", value: assessment.modelAssessment?.modelHomepageRecommendation ?? false }
    ];

    let relevance = "low";
    if (qualifiedDirectMatches.length) relevance = "high";
    else if (upstreamMatches.length || adjacentMatches.length || supplyContexts.length || platformContexts.length) relevance = "medium";
    else if (unconfirmedMatches.length) relevance = "medium";

    const deepTechnical = Boolean(
      assessment.technicalAnalysis?.isDeep &&
      assessment.technicalAnalysis?.evidenceBasis === "explicit_analysis" &&
      assessment.technicalAnalysis.dimensions?.length &&
      assessment.technicalAnalysis.specificImpacts?.length &&
      assessment.technicalAnalysis.evidenceIds?.length &&
      assessment.technicalAnalysis.evidenceIds.every((id) => evidenceValidation.validEvidenceIds.has(id))
    );
    const hasMaterialClaim = hasReliableClaim(assessment, (claim) => !["promotion", "technical_analysis", "other"].includes(claim.eventType), evidenceValidation.validEvidenceIds);
    const hasHighImpactClaim = hasReliableClaim(assessment, (claim) =>
      ["order_contract", "mass_production", "customer_adoption", "risk_policy_change"].includes(claim.eventType)
    , evidenceValidation.validEvidenceIds);
    const hasDirectProductEvent = qualifiedDirectMatches.some(({ match }) => hasReliableClaim(assessment, (claim) =>
      ["product_release", "commercial_availability", "customer_adoption", "order_contract", "mass_production", "manufacturing_milestone", "system_architecture_change"].includes(claim.eventType)
    , evidenceValidation.validEvidenceIds, { claimIds: new Set(match.claimIds || []) }));
    const hasDirectSampling = qualifiedDirectMatches.some(({ match }) => (assessment.claims || []).some((claim) =>
      (match.claimIds || []).includes(claim.claimId) &&
      claim.eventType === "customer_sampling" &&
      claim.eventStage === "sampling_validation" &&
      ["official", "attributed_report"].includes(claim.evidenceConfidence) &&
      Boolean(claim.timeline || claim.qualifiers?.length) &&
      (claim.evidenceIds || []).every((id) => evidenceValidation.validEvidenceIds.has(id))
    ));
    const hasUpstreamSamplingOnly = upstreamMatches.length > 0 &&
      (assessment.claims || []).some((claim) => claim.eventType === "customer_sampling") &&
      !(assessment.claims || []).some((claim) => claim.eventType !== "customer_sampling" && ADMISSIBLE_STAGES.has(claim.eventStage));
    const hasSupplyChainEvent = supplyContexts.some((context) => hasReliableClaim(
      assessment,
      (claim) => !["promotion", "technical_analysis", "other"].includes(claim.eventType),
      evidenceValidation.validEvidenceIds,
      { claimIds: new Set(context.claimIds || []) }
    ));
    const hasPlatformCommercialization = platformContexts.some((context) => hasReliableClaim(
      assessment,
      (claim) => claim.eventType === "commercial_availability" && claim.factStatus === "fact",
      evidenceValidation.validEvidenceIds,
      { stages: new Set(["occurred"]), claimIds: new Set(context.claimIds || []) }
    ));
    const hasFuturePlatformPlan = platformContexts.some((context) => hasReliableClaim(
      assessment,
      (claim) => claim.eventType === "commercial_availability" && claim.factStatus === "formal_plan",
      evidenceValidation.validEvidenceIds,
      { stages: new Set(["confirmed_future"]), claimIds: new Set(context.claimIds || []) }
    ));
    const hasCoreTechnicalAnalysis = qualifiedDirectMatches.length > 0 && deepTechnical;
    const rumorOnly = (assessment.claims || []).length > 0 && (assessment.claims || []).every((claim) =>
      claim.eventStage === "rumor" || claim.evidenceConfidence === "rumor"
    );

    let priority = "low";
    if (relevance !== "low" && (hasMaterialClaim || hasDirectSampling || hasCoreTechnicalAnalysis)) priority = "medium";
    if (hasHighImpactClaim && (qualifiedDirectMatches.length || supplyContexts.some((item) => item.materiality === "major"))) priority = "high";
    if (rumorOnly && PRIORITY_ORDER[priority] > PRIORITY_ORDER.medium) priority = "medium";
    if (hasCoreTechnicalAnalysis) priority = maxLevel([priority, "medium"], PRIORITY_ORDER);

    const reviewReasons = [];
    if (!sourceBindingValidation.articleIdMatches) reviewReasons.push("article_source_binding_mismatch");
    if (!sourceBindingValidation.inputHashMatches) reviewReasons.push("input_hash_mismatch");
    if (evidenceStatus !== "sufficient") reviewReasons.push(`evidence_${evidenceStatus}`);
    if (missingEvidenceIds.length) reviewReasons.push("missing_evidence_reference");
    if (evidenceValidation.duplicateEvidenceIds.length) reviewReasons.push("duplicate_evidence_id");
    if (evidenceValidation.evidenceNotInSourceIds.length) reviewReasons.push("evidence_not_contained_in_source");
    if (claimValidation.duplicateClaimIds.length) reviewReasons.push("duplicate_claim_id");
    if (claimValidation.unknownClaimIds.length) reviewReasons.push("unknown_claim_reference");
    if (unknownProductIds.length) reviewReasons.push("unknown_product_id");
    if (contradictions.length) reviewReasons.push("event_stage_evidence_conflict");
    if (unsupportedRelatedProductMatches.length) reviewReasons.push("related_product_impact_not_evidence_backed");
    if (unconfirmedMatches.length && !qualifiedDirectMatches.length && !supplyContexts.length && !platformContexts.length) reviewReasons.push("unconfirmed_business_not_direct");
    if (hasFuturePlatformPlan) reviewReasons.push("future_platform_not_yet_commercialized");

    if (reviewReasons.length) {
      return makeResult({
        assessment,
        status: "needs_review",
        relevance,
        priority,
        visible: false,
        path: null,
        reasons: reviewReasons,
        evidenceIds: referencedEvidenceIds,
        auditTrail
      });
    }

    const rejectionReasons = [];
    if (rumorOnly) rejectionReasons.push("rumor_not_homepage_eligible");
    if (hasUpstreamSamplingOnly) rejectionReasons.push("upstream_sampling_without_adoption");
    if (priority === "low") rejectionReasons.push("low_priority_not_homepage_eligible");
    if (relevance === "low") rejectionReasons.push("low_relevance_not_homepage_eligible");

    let admissionPath = null;
    if (!rejectionReasons.length) {
      if (hasCoreTechnicalAnalysis) admissionPath = "core_direct_technical_analysis";
      else if (hasDirectProductEvent || hasDirectSampling) admissionPath = "direct_product_business";
      else if (hasSupplyChainEvent) admissionPath = "important_customer_supply_chain_change";
      else if (hasPlatformCommercialization) admissionPath = "major_platform_commercialization";
    }

    if (!admissionPath) rejectionReasons.push("no_qualifying_admission_path");
    if (priority === "low" || relevance === "low") admissionPath = null;
    const accepted = Boolean(admissionPath) && !rejectionReasons.length;
    auditTrail.push({
      step: "admission_evaluation",
      paths: {
        directProduct: hasDirectProductEvent || hasDirectSampling,
        customerSupplyChain: hasSupplyChainEvent,
        majorPlatform: hasPlatformCommercialization,
        coreTechnicalAnalysis: hasCoreTechnicalAnalysis
      },
      selected: admissionPath
    });

    return makeResult({
      assessment,
      status: accepted ? "accepted" : "rejected",
      relevance,
      priority,
      visible: accepted,
      path: admissionPath,
      reasons: accepted ? [`admitted_${admissionPath}`] : rejectionReasons,
      evidenceIds: referencedEvidenceIds,
      auditTrail
    });
  };
}

export { RELEVANCE_ORDER, PRIORITY_ORDER };
