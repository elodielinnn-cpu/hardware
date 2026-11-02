const STAGE_FACT_STATUS = {
  occurred: "fact",
  confirmed_future: "formal_plan",
  sampling_validation: "validation",
  industry_forecast: "forecast",
  rumor: "unconfirmed",
  unknown: "unknown",
  not_applicable: "not_applicable"
};

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

export function normalizeCompactModelOutput(compact, sourceBinding) {
  const errors = [];
  const limitSaturation = [
    ["evidence", compact.evidence?.length, 4],
    ["products", compact.products?.length, 4],
    ["contexts", compact.contexts?.length, 2],
    ["claims", compact.claims?.length, 3]
  ].filter(([, length, limit]) => length === limit).map(([field, length, limit]) => ({ field, length, limit }));
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
    if (product.role === "related_luxshare_product" && product.support === "explicit_impact" &&
        (!product.impacts?.length || !mappedClaimIds.length || !product.evidenceIds?.length)) {
      errors.push({ path: `/products/${index}`, code: "related_product_impact_binding_incomplete" });
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
  const strategicContexts = (compact.contexts || []).map((context, index) => ({
    contextType: context.type,
    materiality: context.materiality,
    evidenceBasis: context.support,
    claimIds: claimIds(context.claimIndexes, claims.length, errors, `/contexts/${index}/claimIndexes`),
    evidenceIds: checkEvidenceIds(context.evidenceIds, `/contexts/${index}/evidenceIds`)
  }));
  const reviewCodes = [...(compact.sufficiency?.reviewCodes || [])];
  let sufficiencyStatus = compact.sufficiency?.status || "insufficient";
  if (compact.sufficiency?.complete === false) {
    if (sufficiencyStatus === "sufficient") sufficiencyStatus = "partial";
    if (!reviewCodes.length) reviewCodes.push("other");
  }
  if (errors.length && sufficiencyStatus === "sufficient") sufficiencyStatus = "partial";

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
      evidenceSufficiency: { status: sufficiencyStatus, gaps: reviewCodes }
    },
    normalization: {
      valid: errors.length === 0,
      errors,
      extractionComplete: compact.sufficiency?.complete === true,
      reviewCodes,
      limitSaturation
    }
  };
}
