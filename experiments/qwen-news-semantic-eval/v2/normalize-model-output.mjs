const STAGE_FACT_STATUS = {
  occurred: "fact",
  confirmed_future: "formal_plan",
  sampling_validation: "validation",
  industry_forecast: "forecast",
  rumor: "unconfirmed",
  unknown: "unknown",
  not_applicable: "not_applicable"
};
const FIELD_LIMITS = Object.freeze({ evidence: 4, products: 4, contexts: 2, claims: 3 });
function normalizeText(value) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

function findOrigin(quote, original) {
  const target = normalizeText(quote);
  if (normalizeText(original.title).includes(target)) return "title";
  if (normalizeText(original.originalSummary).includes(target)) return "feed_summary";
  if (normalizeText((original.bodyEvidence || []).join("\n")).includes(target)) {
    return original.evidenceAvailability === "reliable" ? "official_body" : "attributed_body";
  }
  return null;
}

function claimIds(indexes, claimCount, errors, path) {
  const ids = [];
  for (const index of indexes || []) {
    if (!Number.isInteger(index) || index < 0 || index >= claimCount) {
      errors.push({ path, code: "invalid_claim_index", value: index });
    } else {
      ids.push(`c${index + 1}`);
    }
  }
  return [...new Set(ids)];
}

export function normalizeCompactModelOutput(compact, sourceBinding, profileData = null, runtimeStatus = {}) {
  const errors = [];
  const limitSaturation = Object.entries(FIELD_LIMITS)
    .filter(([field, limit]) => compact[field]?.length === limit)
    .map(([field, limit]) => ({ field, length: compact[field].length, limit }));
  const original = sourceBinding?.originalSourceDocument || {};
  const evidenceUnits = (compact.evidence || []).map((item, index) => {
    const origin = findOrigin(item.quote, original);
    if (!origin) errors.push({ path: `/evidence/${index}`, code: "evidence_not_contained_in_source", evidenceId: item.id });
    return { evidenceId: item.id, origin: origin || "feed_summary", text: item.quote };
  });
  const knownEvidenceIds = new Set(evidenceUnits.map((item) => item.evidenceId));
  const checkEvidenceIds = (ids, path) => {
    for (const id of ids || []) {
      if (!knownEvidenceIds.has(id)) errors.push({ path, code: "unknown_evidence_id", evidenceId: id });
    }
    return ids || [];
  };
  const claims = (compact.claims || []).map((claim, index) => ({
    claimId: `c${index + 1}`,
    eventType: claim.type,
    subject: claim.subject,
    object: claim.object,
    eventStage: claim.stage,
    evidenceConfidence: claim.confidence,
    qualifiers: claim.qualifiers,
    timeline: claim.timeline,
    factStatus: STAGE_FACT_STATUS[claim.stage] || "unknown",
    evidenceIds: checkEvidenceIds(claim.evidenceIds, `/claims/${index}/evidenceIds`)
  }));
  const productMatches = (compact.products || []).map((product, index) => {
    const mappedClaimIds = claimIds(product.claimIndexes, claims.length, errors, `/products/${index}/claimIndexes`);
    const profileProduct = profileData?.productsById?.get(product.productId);
    if (product.role === "related_luxshare_product" && product.support === "explicit_impact" &&
        (!product.impacts?.length || !mappedClaimIds.length || !product.evidenceIds?.length)) {
      errors.push({ path: `/products/${index}`, code: "related_product_impact_binding_incomplete" });
    }
    if (product.role === "related_luxshare_product" && product.match === "direct_subject") {
      errors.push({ path: `/products/${index}`, code: "related_product_cannot_be_direct_subject" });
    }
    if (product.role === "related_luxshare_product" && profileProduct?.relationshipLevel === "unconfirmed") {
      errors.push({ path: `/products/${index}`, code: "unconfirmed_product_cannot_be_related_luxshare_product" });
    }
    return {
      productId: product.productId,
      productRole: product.role,
      matchType: product.match,
      relationshipBasis: product.support === "explicit_impact"
        ? "explicit_article_evidence"
        : product.support === "profile_only" ? "profile_adjacency_only" : "unresolved",
      impactDimensions: product.impacts,
      claimIds: mappedClaimIds,
      evidenceIds: checkEvidenceIds(product.evidenceIds, `/products/${index}/evidenceIds`)
    };
  });
  const strategicContexts = (compact.contexts || []).map((context, index) => {
    const mappedClaimIds = claimIds(context.claimIndexes, claims.length, errors, `/contexts/${index}/claimIndexes`);
    const materialClaims = mappedClaimIds
      .map((claimId) => claims.find((claim) => claim.claimId === claimId))
      .filter((claim) => claim && !["technical_analysis", "promotion", "other"].includes(claim.eventType));
    if (!['major', 'material'].includes(context.materiality)) {
      errors.push({ path: `/contexts/${index}`, code: "non_material_context_should_be_omitted" });
    }
    if (context.support !== "explicit_event" || materialClaims.length === 0) {
      errors.push({ path: `/contexts/${index}`, code: "strategic_context_without_material_event" });
    }
    return {
      contextType: context.type,
      materiality: context.materiality,
      evidenceBasis: context.support,
      claimIds: mappedClaimIds,
      evidenceIds: checkEvidenceIds(context.evidenceIds, `/contexts/${index}/evidenceIds`)
    };
  });
  const semanticReasonCodes = [...(compact.sufficiency?.reasonCodes || [])];
  const legacyReviewCodes = [...(compact.sufficiency?.reviewCodes || [])];
  const usesLegacySufficiencyContract = Object.hasOwn(compact.sufficiency || {}, "complete") ||
    Object.hasOwn(compact.sufficiency || {}, "reviewCodes") || compact.sufficiency?.status === "partial";
  if (Object.hasOwn(compact.sufficiency || {}, "complete")) {
    errors.push({ path: "/sufficiency/complete", code: "model_reported_engineering_completion" });
  }
  if (legacyReviewCodes.some((code) => /_limit_reached$/.test(code))) {
    errors.push({ path: "/sufficiency/reviewCodes", code: "model_reported_engineering_capacity" });
  }
  let sufficiencyStatus = compact.sufficiency?.status || "unable_to_assess";
  if (sufficiencyStatus === "partial") sufficiencyStatus = "unable_to_assess";
  if (!usesLegacySufficiencyContract) {
    if (sufficiencyStatus === "sufficient" && semanticReasonCodes.length) {
      errors.push({ path: "/sufficiency/reasonCodes", code: "sufficient_evidence_has_reason_codes" });
    }
    if (sufficiencyStatus === "requires_full_text" && !semanticReasonCodes.includes("requires_full_text")) {
      errors.push({ path: "/sufficiency/reasonCodes", code: "semantic_status_reason_mismatch", expected: "requires_full_text" });
    }
    if (sufficiencyStatus === "unable_to_assess" && !semanticReasonCodes.includes("unable_to_assess")) {
      errors.push({ path: "/sufficiency/reasonCodes", code: "semantic_status_reason_mismatch", expected: "unable_to_assess" });
    }
    if (sufficiencyStatus === "insufficient" && semanticReasonCodes.length === 0) {
      errors.push({ path: "/sufficiency/reasonCodes", code: "insufficient_evidence_requires_reason" });
    }
  }

  const finishReason = runtimeStatus.finishReason ?? null;
  const technicalError = runtimeStatus.technicalError ?? null;
  const schemaValid = runtimeStatus.schemaValid ?? true;
  const outputTruncated = Boolean(runtimeStatus.outputTruncated) || (finishReason !== null && finishReason !== "stop");
  const structuredOutputComplete = schemaValid && !outputTruncated && !technicalError;

  return {
    assessment: {
      articleId: compact.articleId,
      evidenceUnits,
      productMatches,
      strategicContexts,
      claims,
      technicalAnalysis: {
        isDeep: compact.technical.deep,
        evidenceBasis: compact.technical.support,
        dimensions: compact.technical.dimensions,
        specificImpacts: compact.technical.impacts,
        evidenceIds: checkEvidenceIds(compact.technical.evidenceIds, "/technical/evidenceIds")
      },
      evidenceSufficiency: {
        status: sufficiencyStatus,
        gaps: semanticReasonCodes
      }
    },
    normalization: {
      valid: errors.length === 0,
      errors,
      semanticEvidenceStatus: sufficiencyStatus,
      semanticStatusSource: usesLegacySufficiencyContract ? "legacy_ambiguous" : "model_semantic_assessment",
      semanticReasonCodes,
      legacyReviewCodes
    },
    outputIntegrity: {
      structuredOutputComplete,
      schemaValid,
      finishReason,
      outputTruncated,
      technicalError,
      fieldLimits: FIELD_LIMITS,
      limitSaturation
    }
  };
}
