import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const profilePath = path.resolve(
  repositoryRoot,
  process.argv[2] || "config/luxshare-business-profile.json"
);

const errors = [];
const warnings = [];

function error(message) {
  errors.push(message);
}

function warning(message) {
  warnings.push(message);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function requireKeys(object, keys, context) {
  for (const key of keys) {
    if (!(key in object)) {
      error(`${context}: missing required field ${key}`);
    }
  }
}

function requireNonEmptyString(object, key, context) {
  if (!isNonEmptyString(object[key])) {
    error(`${context}: ${key} must be a non-empty string`);
  }
}

function requireStringArray(object, key, context, { allowEmpty = false } = {}) {
  const value = object[key];
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.some((item) => !isNonEmptyString(item))) {
    error(`${context}: ${key} must be ${allowEmpty ? "an" : "a non-empty"} array of non-empty strings`);
  }
}

function validateEnum(value, allowedValues, context) {
  if (!allowedValues.has(value)) {
    error(`${context}: invalid value ${JSON.stringify(value)}`);
  }
}

let profile;
try {
  profile = JSON.parse(await fs.readFile(profilePath, "utf8"));
} catch (readError) {
  console.error(`Business profile could not be read: ${readError.message}`);
  process.exit(1);
}

requireKeys(profile, [
  "profileVersion",
  "profileStatus",
  "createdAt",
  "lastVerified",
  "classificationPrinciples",
  "enums",
  "policies",
  "evidenceCatalog",
  "supplyRelationshipClaims",
  "domains"
], "profile");
requireNonEmptyString(profile, "profileVersion", "profile");
requireNonEmptyString(profile, "profileStatus", "profile");
if (!/^\d+\.\d+\.\d+$/.test(profile.profileVersion || "")) {
  error("profile: profileVersion must use semantic version format x.y.z");
}
if (!isIsoDate(profile.createdAt)) error("profile: createdAt must be an ISO date");
if (!isIsoDate(profile.lastVerified)) error("profile: lastVerified must be an ISO date");

const requiredPrinciples = [
  "userClassificationAndPublicEvidenceAreIndependent",
  "keywordMatchIsNotCapabilityEvidence",
  "customerBrandNamesAreNotSupplyProof",
  "officialSolutionPagesDoNotProveEveryProductIsInMassProduction",
  "unknownAndInsufficientEvidenceAreAllowed"
];
for (const principle of requiredPrinciples) {
  if (profile.classificationPrinciples?.[principle] !== true) {
    error(`profile.classificationPrinciples: ${principle} must be true`);
  }
}

const enumNames = [
  "capabilityType",
  "relationshipLevel",
  "commercialStatus",
  "massProductionStatus",
  "capabilityAssertion",
  "evidenceStatus",
  "userClassification"
];
const enumSets = {};
for (const enumName of enumNames) {
  const values = profile.enums?.[enumName];
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => !isNonEmptyString(value))) {
    error(`profile.enums.${enumName}: must be a non-empty string array`);
    enumSets[enumName] = new Set();
  } else {
    enumSets[enumName] = new Set(values);
    if (enumSets[enumName].size !== values.length) {
      error(`profile.enums.${enumName}: contains duplicate values`);
    }
  }
}

const brandPolicy = profile.policies?.brandInferencePolicy;
if (brandPolicy?.allowBrandOnlySupplyInference !== false || brandPolicy?.requireProductManufacturingOrSupplyChainEvidence !== true) {
  error("profile.policies.brandInferencePolicy: brand-only supply inference must be disabled and evidence must be required");
}
const semiconductorPolicy = profile.policies?.upstreamSemiconductorPolicy;
if (semiconductorPolicy?.treatAsLuxshareManufacturedByDefault !== false || semiconductorPolicy?.requiresExplicitEvidenceForDirectClassification !== true) {
  error("profile.policies.upstreamSemiconductorPolicy: upstream chips must not default to Luxshare-manufactured products");
}
const commercializationPolicy = profile.policies?.capabilityCommercializationPolicy;
if (
  commercializationPolicy?.directRelationshipDoesNotImplyMassProduction !== true ||
  commercializationPolicy?.productCapabilityDoesNotImplyMassProduction !== true ||
  commercializationPolicy?.requireExplicitEvidenceForMassProduction !== true
) {
  error("profile.policies.capabilityCommercializationPolicy: product capability and direct relationships must not imply mass production");
}
const automotivePolicy = profile.policies?.automotiveControllerPolicy;
if (
  automotivePolicy?.directHardwareDoesNotImplyFullStackSoftware !== true ||
  automotivePolicy?.requirePerProductCapabilityBreakdown !== true
) {
  error("profile.policies.automotiveControllerPolicy: direct automotive hardware must not imply full-stack software capability");
}
const aliasPolicy = profile.policies?.aliasDisambiguationPolicy;
if (aliasPolicy?.requireContextForAmbiguousAliases !== true || !Array.isArray(aliasPolicy?.rules)) {
  error("profile.policies.aliasDisambiguationPolicy: ambiguous aliases must require explicit context rules");
}

const evidenceCatalog = profile.evidenceCatalog || {};
for (const [evidenceId, evidence] of Object.entries(evidenceCatalog)) {
  const context = `evidenceCatalog.${evidenceId}`;
  requireKeys(evidence, ["source", "title", "url", "date", "dateType", "excerpt"], context);
  for (const key of ["source", "title", "url", "dateType", "excerpt"]) {
    requireNonEmptyString(evidence, key, context);
  }
  if (!isIsoDate(evidence.date)) error(`${context}: date must be an ISO date`);
  if (!/^https:\/\//.test(evidence.url || "")) error(`${context}: url must use https`);
}

if (!Array.isArray(profile.domains) || profile.domains.length === 0) {
  error("profile.domains: must be a non-empty array");
}

const requiredProductFields = [
  "productId",
  "productName",
  "aliasesZh",
  "aliasesEn",
  "capabilityType",
  "relationshipLevel",
  "commercialStatus",
  "massProductionStatus",
  "businessScope",
  "evidence",
  "evidenceStatus",
  "userConfirmedClassification",
  "scopeLimitations",
  "negativeConstraints",
  "lastVerified",
  "profileVersion"
];
const domainIds = new Set();
const productIds = new Set();
const productsById = new Map();
let productCount = 0;

for (const domain of profile.domains || []) {
  const context = `domain ${domain?.domainId || "<missing>"}`;
  requireKeys(domain, ["domainId", "domainName", "businessScope", "profileVersion", "products"], context);
  for (const key of ["domainId", "domainName", "businessScope"]) requireNonEmptyString(domain, key, context);
  if (domainIds.has(domain.domainId)) error(`${context}: duplicate domainId`);
  domainIds.add(domain.domainId);
  if (domain.profileVersion !== profile.profileVersion) error(`${context}: profileVersion differs from root profileVersion`);
  if (!Array.isArray(domain.products) || domain.products.length === 0) error(`${context}: products must be a non-empty array`);

  for (const product of domain.products || []) {
    productCount += 1;
    const productContext = `${context}, product ${product?.productId || "<missing>"}`;
    requireKeys(product, requiredProductFields, productContext);
    for (const key of ["productId", "productName", "businessScope"]) requireNonEmptyString(product, key, productContext);
    requireStringArray(product, "aliasesZh", productContext);
    requireStringArray(product, "aliasesEn", productContext);
    requireStringArray(product, "evidence", productContext, { allowEmpty: true });
    requireStringArray(product, "scopeLimitations", productContext);
    requireStringArray(product, "negativeConstraints", productContext);

    if (productIds.has(product.productId)) error(`${productContext}: duplicate productId`);
    productIds.add(product.productId);
    productsById.set(product.productId, product);
    validateEnum(product.capabilityType, enumSets.capabilityType, `${productContext}.capabilityType`);
    validateEnum(product.relationshipLevel, enumSets.relationshipLevel, `${productContext}.relationshipLevel`);
    validateEnum(product.commercialStatus, enumSets.commercialStatus, `${productContext}.commercialStatus`);
    validateEnum(product.massProductionStatus, enumSets.massProductionStatus, `${productContext}.massProductionStatus`);
    validateEnum(product.evidenceStatus, enumSets.evidenceStatus, `${productContext}.evidenceStatus`);
    if (!isIsoDate(product.lastVerified)) error(`${productContext}: lastVerified must be an ISO date`);
    if (product.profileVersion !== profile.profileVersion) error(`${productContext}: profileVersion differs from root profileVersion`);

    const userClassification = product.userConfirmedClassification;
    requireKeys(userClassification || {}, ["classification", "confirmed", "confirmedAt"], `${productContext}.userConfirmedClassification`);
    validateEnum(userClassification?.classification, enumSets.userClassification, `${productContext}.userConfirmedClassification.classification`);
    if (userClassification?.confirmed !== true) error(`${productContext}: V1 entries must explicitly preserve a confirmed user classification`);
    if (!isIsoDate(userClassification?.confirmedAt)) error(`${productContext}: user confirmation date must be an ISO date`);
    if (userClassification?.classification !== product.relationshipLevel) {
      error(`${productContext}: user classification ${userClassification?.classification} conflicts with relationshipLevel ${product.relationshipLevel}`);
    }

    for (const evidenceId of product.evidence || []) {
      if (!(evidenceId in evidenceCatalog)) error(`${productContext}: unknown evidence reference ${evidenceId}`);
    }
    if (product.evidenceStatus === "verified_public" && product.evidence.length === 0) {
      error(`${productContext}: verified_public requires at least one public evidence reference`);
    }
    if (["pending_verification", "user_confirmed_only"].includes(product.evidenceStatus) && product.evidence.length > 0) {
      warning(`${productContext}: has evidence references but remains ${product.evidenceStatus}; review whether partially_verified is more precise`);
    }
    if (product.relationshipLevel === "unconfirmed" && product.commercialStatus !== "unknown") {
      error(`${productContext}: unconfirmed relationships must use commercialStatus=unknown`);
    }
    if (["upstream_component", "adjacent_technology"].includes(product.capabilityType) && product.relationshipLevel === "direct") {
      error(`${productContext}: upstream or adjacent capability cannot be marked direct`);
    }
    if (product.capabilityType === "unconfirmed_capability" && product.relationshipLevel !== "unconfirmed") {
      error(`${productContext}: unconfirmed_capability must use relationshipLevel=unconfirmed`);
    }
    if (product.evidenceStatus === "user_confirmed_only" && product.relationshipLevel === "direct" && product.scopeLimitations.length === 0) {
      error(`${productContext}: user-confirmed direct entries without public evidence require an explicit scope limitation`);
    }
    if (
      product.massProductionStatus === "verified_mass_production" &&
      (product.evidence.length === 0 || !["verified_public", "partially_verified"].includes(product.evidenceStatus))
    ) {
      error(`${productContext}: verified mass production requires public evidence`);
    }
  }
}

for (const productId of semiconductorPolicy?.productIds || []) {
  const product = productsById.get(productId);
  if (!product) {
    error(`profile.policies.upstreamSemiconductorPolicy: unknown productId ${productId}`);
    continue;
  }
  if (product.relationshipLevel === "direct" || product.capabilityType === "product") {
    error(`product ${productId}: upstream semiconductor policy forbids direct or product classification`);
  }
}

if (productsById.has("apple_named_product_programs")) {
  error("product apple_named_product_programs: customer supply claims must not be stored as product capabilities");
}

const supplyClaims = profile.supplyRelationshipClaims;
if (!Array.isArray(supplyClaims) || supplyClaims.length === 0) {
  error("profile.supplyRelationshipClaims: must be a non-empty array");
}
const claimIds = new Set();
for (const claim of supplyClaims || []) {
  const context = `supply claim ${claim?.claimId || "<missing>"}`;
  requireKeys(claim, [
    "claimId",
    "brand",
    "claimName",
    "productScope",
    "relationshipStatus",
    "evidence",
    "evidenceStatus",
    "userConfirmedClassification",
    "scopeLimitations",
    "negativeConstraints",
    "lastVerified",
    "profileVersion"
  ], context);
  for (const key of ["claimId", "brand", "claimName", "productScope"]) requireNonEmptyString(claim, key, context);
  requireStringArray(claim, "evidence", context, { allowEmpty: true });
  requireStringArray(claim, "scopeLimitations", context);
  requireStringArray(claim, "negativeConstraints", context);
  if (claimIds.has(claim.claimId)) error(`${context}: duplicate claimId`);
  claimIds.add(claim.claimId);
  if (productIds.has(claim.claimId)) error(`${context}: claimId must not duplicate a productId`);
  validateEnum(claim.relationshipStatus, enumSets.relationshipLevel, `${context}.relationshipStatus`);
  validateEnum(claim.evidenceStatus, enumSets.evidenceStatus, `${context}.evidenceStatus`);
  if (claim.relationshipStatus !== "unconfirmed") error(`${context}: unverified customer supply claims must remain unconfirmed`);
  requireKeys(claim.userConfirmedClassification || {}, ["classification", "confirmed", "confirmedAt"], `${context}.userConfirmedClassification`);
  validateEnum(
    claim.userConfirmedClassification?.classification,
    enumSets.userClassification,
    `${context}.userConfirmedClassification.classification`
  );
  if (claim.userConfirmedClassification?.classification !== claim.relationshipStatus) {
    error(`${context}: user classification must remain separate and match relationshipStatus`);
  }
  if (claim.userConfirmedClassification?.confirmed !== true || !isIsoDate(claim.userConfirmedClassification?.confirmedAt)) {
    error(`${context}: user classification confirmation must be explicit and dated`);
  }
  if (!claim.negativeConstraints.some((item) => /brand|品牌|Apple/.test(item))) {
    error(`${context}: must explicitly forbid brand-only supply inference`);
  }
  for (const evidenceId of claim.evidence || []) {
    if (!(evidenceId in evidenceCatalog)) error(`${context}: unknown evidence reference ${evidenceId}`);
  }
  if (!isIsoDate(claim.lastVerified)) error(`${context}: lastVerified must be an ISO date`);
  if (claim.profileVersion !== profile.profileVersion) error(`${context}: profileVersion differs from root profileVersion`);
}

const aliasOwners = new Map();
for (const product of productsById.values()) {
  for (const alias of [...product.aliasesZh, ...product.aliasesEn]) {
    const normalizedAlias = alias.trim().toLowerCase();
    if (!aliasOwners.has(normalizedAlias)) aliasOwners.set(normalizedAlias, new Set());
    aliasOwners.get(normalizedAlias).add(product.productId);
  }
}
const aliasRules = new Map();
for (const rule of aliasPolicy?.rules || []) {
  const context = `alias rule ${rule?.alias || "<missing>"}`;
  requireNonEmptyString(rule, "alias", context);
  requireStringArray(rule, "productIds", context);
  requireNonEmptyString(rule, "unresolvedAction", context);
  if (rule.unresolvedAction !== "keep_ambiguous") error(`${context}: unresolvedAction must preserve ambiguity`);
  const normalizedAlias = rule.alias.trim().toLowerCase();
  aliasRules.set(normalizedAlias, rule);
  for (const productId of rule.productIds) {
    if (!productsById.has(productId)) error(`${context}: unknown productId ${productId}`);
    requireStringArray(rule.requiredContextByProduct || {}, productId, context);
  }
}
for (const [alias, owners] of aliasOwners) {
  if (owners.size < 2) continue;
  const rule = aliasRules.get(alias);
  if (!rule) {
    error(`ambiguous alias ${JSON.stringify(alias)}: missing context disambiguation rule for ${[...owners].join(", ")}`);
    continue;
  }
  const configuredOwners = new Set(rule.productIds);
  for (const owner of owners) {
    if (!configuredOwners.has(owner)) error(`alias rule ${alias}: missing productId ${owner}`);
  }
}

const capabilityKeys = ["hardwareManufacturing", "productDesign", "systemIntegration", "softwareCapability"];
for (const productId of automotivePolicy?.directProductIds || []) {
  const product = productsById.get(productId);
  const context = `automotive direct product ${productId}`;
  if (!product) {
    error(`${context}: product not found`);
    continue;
  }
  if (product.relationshipLevel !== "direct") error(`${context}: user-confirmed automotive product must remain direct`);
  requireKeys(product.capabilityBreakdown || {}, capabilityKeys, `${context}.capabilityBreakdown`);
  for (const key of capabilityKeys) {
    validateEnum(product.capabilityBreakdown?.[key], enumSets.capabilityAssertion, `${context}.capabilityBreakdown.${key}`);
  }
}
for (const productId of automotivePolicy?.controllerProductIds || []) {
  const product = productsById.get(productId);
  if (!product) continue;
  if (!["not_confirmed", "unknown"].includes(product.capabilityBreakdown?.softwareCapability)) {
    error(`automotive controller ${productId}: direct hardware must not inherit full-stack software capability`);
  }
}

const nand = productsById.get("nand_flash");
const completeSsd = productsById.get("complete_ssd_device");
if (!nand || nand.relationshipLevel !== "upstream" || /\bSSD\b/i.test(nand.productName)) {
  error("product nand_flash: NAND media must remain upstream and separate from complete SSD products");
}
if (!completeSsd || completeSsd.relationshipLevel === "direct") {
  error("product complete_ssd_device: complete SSD must be represented separately and must not default to direct");
}

const statusCounts = {};
const relationshipCounts = {};
const capabilityCounts = {};
const massProductionCounts = {};
for (const product of productsById.values()) {
  statusCounts[product.evidenceStatus] = (statusCounts[product.evidenceStatus] || 0) + 1;
  relationshipCounts[product.relationshipLevel] = (relationshipCounts[product.relationshipLevel] || 0) + 1;
  capabilityCounts[product.capabilityType] = (capabilityCounts[product.capabilityType] || 0) + 1;
  massProductionCounts[product.massProductionStatus] = (massProductionCounts[product.massProductionStatus] || 0) + 1;
}

for (const message of warnings) console.warn(`WARNING: ${message}`);
if (errors.length > 0) {
  for (const message of errors) console.error(`ERROR: ${message}`);
  console.error(`Luxshare business profile validation failed: ${errors.length} error(s), ${warnings.length} warning(s).`);
  process.exit(1);
}

console.log(`Luxshare business profile validation passed: ${domainIds.size} domains, ${productCount} products, ${supplyClaims.length} supply claim(s), ${Object.keys(evidenceCatalog).length} evidence records.`);
console.log(`Capability types: ${JSON.stringify(capabilityCounts)}`);
console.log(`Relationship levels: ${JSON.stringify(relationshipCounts)}`);
console.log(`Evidence status: ${JSON.stringify(statusCounts)}`);
console.log(`Mass-production status: ${JSON.stringify(massProductionCounts)}`);
console.log(`Warnings: ${warnings.length}`);
