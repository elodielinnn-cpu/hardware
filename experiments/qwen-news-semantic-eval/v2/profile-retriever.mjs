import crypto from "node:crypto";
import fs from "node:fs/promises";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^\p{L}\p{N}+#./-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAlias(text, alias) {
  const normalizedAlias = normalize(alias);
  if (!normalizedAlias) return false;
  if (/^[\p{Script=Han}]+$/u.test(normalizedAlias)) return text.includes(normalizedAlias);
  const escaped = normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "iu").test(text);
}

function aliasWeight(alias) {
  const compact = normalize(alias).replace(/\s/g, "");
  if (compact.length <= 3) return 3;
  if (compact.length <= 7) return 5;
  return 8;
}

function unique(values) {
  return [...new Set(values)];
}

function detectIndependentPathHints(text) {
  const hints = [];
  if (/\b(?:general availability|commercially available|available for deployment|entered? service|commercial deployment|industry platform|cloud infrastructure)\b/iu.test(text)) {
    hints.push("major_industry_platform");
  }
  if (/\b(?:supply chain|supplier|sourcing|manufactur(?:ing|er)|factory|facility|capital investment|capacity (?:expansion|buildout)|production site|strategic partners?)\b/iu.test(text)) {
    hints.push("important_customer_supply_chain");
  }
  return hints;
}

function detectDomainHints(text) {
  const domainIds = [];
  if (/\b(?:power and thermal|power infrastructure|thermal management|liquid cooling|cooling infrastructure|prefabricated power)\b/iu.test(text)) {
    domainIds.push("power_and_thermal");
  }
  if (/\b(?:rack-scale|full-rack|ai rack|rack level integration)\b/iu.test(text)) {
    domainIds.push("ai_server_systems");
  }
  return domainIds;
}

export async function loadBusinessProfile(profilePath, relationsPath) {
  const [profileText, relationsText] = await Promise.all([
    fs.readFile(profilePath, "utf8"),
    fs.readFile(relationsPath, "utf8")
  ]);
  const profile = JSON.parse(profileText);
  const relations = JSON.parse(relationsText);
  const products = profile.domains.flatMap((domain) => domain.products.map((product) => ({
    ...product,
    domainId: domain.domainId,
    domainName: domain.domainName
  })));
  const productsById = new Map(products.map((product) => [product.productId, product]));
  const invalidEdges = relations.edges.filter((edge) => !productsById.has(edge.from) || !productsById.has(edge.to));
  if (invalidEdges.length) throw new Error(`Unknown product IDs in relation graph: ${JSON.stringify(invalidEdges)}`);
  return {
    profile,
    products,
    productsById,
    relations,
    profileHash: sha256(profileText),
    relationGraphHash: sha256(relationsText)
  };
}

export function retrieveProductCandidates(article, profileData, { maxPrimary = 8, maxNeighbors = 10 } = {}) {
  const text = normalize([article.title, article.summary, article.bodyEvidence].filter(Boolean).join("\n"));
  const traces = [];
  const scored = [];
  const independentPathHints = detectIndependentPathHints(text);
  const domainHintIds = detectDomainHints(text);
  const ambiguousRules = profileData.profile.policies?.aliasDisambiguationPolicy?.rules || [];

  for (const product of profileData.products) {
    const aliases = unique([product.productName, ...(product.aliasesZh || []), ...(product.aliasesEn || [])]);
    const matchedAliases = aliases.filter((alias) => containsAlias(text, alias));
    if (!matchedAliases.length) continue;
    const score = matchedAliases.reduce((total, alias) => total + aliasWeight(alias), 0);
    scored.push({ product, score, matchedAliases });
    traces.push({
      step: "alias_match",
      productId: product.productId,
      score,
      matchedAliases
    });
  }

  scored.sort((left, right) => right.score - left.score || left.product.productId.localeCompare(right.product.productId));
  const primary = scored.slice(0, maxPrimary);
  const conflicts = [];
  for (const rule of ambiguousRules) {
    if (!containsAlias(text, rule.alias)) continue;
    const resolved = [];
    for (const productId of rule.productIds || []) {
      const contextTerms = rule.requiredContextByProduct?.[productId] || [];
      if (contextTerms.some((term) => containsAlias(text, term))) resolved.push(productId);
    }
    if (resolved.length !== 1) {
      conflicts.push({ alias: rule.alias, productIds: rule.productIds, resolved });
      traces.push({ step: "ambiguous_alias", alias: rule.alias, resolved });
    } else {
      for (let index = primary.length - 1; index >= 0; index -= 1) {
        if ((rule.productIds || []).includes(primary[index].product.productId) && primary[index].product.productId !== resolved[0]) {
          traces.push({ step: "context_disambiguation_removed", productId: primary[index].product.productId, alias: rule.alias });
          primary.splice(index, 1);
        }
      }
    }
  }

  const primaryIds = new Set(primary.map((item) => item.product.productId));
  const neighborMap = new Map();
  for (const edge of profileData.relations.edges) {
    let neighborId = null;
    let originId = null;
    if (primaryIds.has(edge.from)) {
      originId = edge.from;
      neighborId = edge.to;
    } else if (primaryIds.has(edge.to)) {
      originId = edge.to;
      neighborId = edge.from;
    }
    if (!neighborId || primaryIds.has(neighborId)) continue;
    if (!neighborMap.has(neighborId)) neighborMap.set(neighborId, []);
    neighborMap.get(neighborId).push({ originId, relationType: edge.type });
  }

  const neighbors = [...neighborMap.entries()]
    .slice(0, maxNeighbors)
    .map(([productId, relationTrace]) => ({ product: profileData.productsById.get(productId), relationTrace }));
  for (const neighbor of neighbors) {
    traces.push({ step: "relation_neighbor", productId: neighbor.product.productId, via: neighbor.relationTrace });
  }

  const unresolved = Boolean(article.unresolved) || primary.some((item) => item.product.relationshipLevel === "unconfirmed");
  const conflictDomainIds = unique(conflicts.flatMap((conflict) => conflict.productIds || [])
    .map((productId) => profileData.productsById.get(productId)?.domainId)
    .filter(Boolean));
  const expansionDomainIds = unique([...conflictDomainIds, ...(primary.length === 0 ? domainHintIds : [])]);
  const domainExpansionProductIds = expansionDomainIds.length
    ? profileData.products.filter((product) => expansionDomainIds.includes(product.domainId)).map((product) => product.productId)
    : [];
  const domainExpansion = domainExpansionProductIds.length > 0 && !unresolved;
  const pathContextOnly = primary.length === 0 && independentPathHints.length > 0 && !domainExpansion && !unresolved;
  const fullProfileFallback = unresolved || (primary.length === 0 && !pathContextOnly && !domainExpansion) || (conflicts.length > 0 && !domainExpansion);
  if (pathContextOnly) {
    traces.push({ step: "independent_path_context", paths: independentPathHints, reason: "no_product_match_does_not_block_independent_path" });
  }
  if (domainExpansion) {
    traces.push({ step: "domain_expansion", domainIds: expansionDomainIds, productIds: domainExpansionProductIds, reasons: unique([
      ...(conflicts.length ? ["ambiguous_alias"] : []),
      ...(domainHintIds.length ? ["high_recall_domain_hint"] : [])
    ]) });
  }
  if (fullProfileFallback) {
    traces.push({
      step: "full_profile_fallback",
      reasons: [
        ...(primary.length === 0 ? ["no_product_match"] : []),
        ...(conflicts.length ? ["ambiguous_product_match"] : []),
        ...(unresolved ? ["unresolved_or_unconfirmed_match"] : [])
      ]
    });
  }

  return {
    profileVersion: profileData.profile.profileVersion,
    profileHash: profileData.profileHash,
    relationGraphHash: profileData.relationGraphHash,
    primaryCandidates: primary.map(({ product, score, matchedAliases }) => ({
      productId: product.productId,
      domainId: product.domainId,
      relationshipLevel: product.relationshipLevel,
      score,
      matchedAliases
    })),
    neighborCandidates: neighbors.map(({ product, relationTrace }) => ({
      productId: product.productId,
      domainId: product.domainId,
      relationshipLevel: product.relationshipLevel,
      relationTrace
    })),
    conflicts,
    independentPathHints,
    domainHintIds,
    pathContextOnly,
    domainExpansion,
    domainExpansionProductIds,
    fullProfileFallback,
    fallbackDoesNotRejectArticle: true,
    trace: traces
  };
}

function compactProduct(product, { fallbackIndex = false } = {}) {
  if (fallbackIndex) {
    return {
      productId: product.productId,
      productName: product.productName,
      capabilityType: product.capabilityType,
      relationshipLevel: product.relationshipLevel,
      evidenceStatus: product.evidenceStatus,
      userConfirmedClassification: product.userConfirmedClassification?.classification || "unknown"
    };
  }
  return {
    productId: product.productId,
    productName: product.productName,
    aliasesZh: product.aliasesZh,
    aliasesEn: product.aliasesEn,
    capabilityType: product.capabilityType,
    relationshipLevel: product.relationshipLevel,
    commercialStatus: product.commercialStatus,
    businessScope: product.businessScope,
    evidenceStatus: product.evidenceStatus,
    userConfirmedClassification: product.userConfirmedClassification?.classification || "unknown",
    scopeLimitations: product.scopeLimitations,
    negativeConstraints: product.negativeConstraints
  };
}

export function buildCandidateProfileContext(retrieval, profileData) {
  const selectedProductIds = retrieval.fullProfileFallback
    ? profileData.products.map((product) => product.productId)
    : retrieval.pathContextOnly
      ? []
      : retrieval.domainExpansion
        ? retrieval.domainExpansionProductIds
        : unique([
        ...retrieval.primaryCandidates.map((item) => item.productId),
        ...retrieval.neighborCandidates.map((item) => item.productId)
      ]);
  const products = selectedProductIds.map((productId) => compactProduct(
    profileData.productsById.get(productId),
    { fallbackIndex: retrieval.fullProfileFallback }
  ));
  return {
    profileVersion: retrieval.profileVersion,
    profileHash: retrieval.profileHash,
    selectionMode: retrieval.fullProfileFallback
      ? "full_profile_fallback"
      : retrieval.pathContextOnly ? "independent_path_context" : retrieval.domainExpansion ? "domain_expansion" : "candidate_subset",
    candidateProductIds: retrieval.primaryCandidates.map((item) => item.productId),
    neighborProductIds: retrieval.neighborCandidates.map((item) => item.productId),
    independentAdmissionPaths: retrieval.independentPathHints,
    products,
    constraints: [
      "Relationship level comes from this profile; never infer a customer order or supply relationship from a brand name.",
      "User-confirmed classification and public evidence status are independent.",
      "A direct capability does not prove that every model is commercial or in mass production.",
      "Profile adjacency is retrieval context only and is not article evidence of a business impact.",
      "Upstream or adjacent technology requires article evidence of an interface, performance, design, cost, manufacturing, delivery or demand impact."
    ]
  };
}

export { normalize };
