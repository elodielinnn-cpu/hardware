import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const resultPath = process.env.RESULT_PATH;
const evaluationPath = process.env.EVALUATION_PATH
  || path.join(directory, "results", "evaluation.json");

if (!resultPath) {
  console.error("RESULT_PATH is required");
  process.exit(1);
}

const [payload, cases, labels, schema] = await Promise.all([
  fs.readFile(resultPath, "utf8").then(JSON.parse),
  fs.readFile(path.join(directory, "cases.json"), "utf8").then(JSON.parse),
  fs.readFile(path.join(directory, "human-labels.json"), "utf8").then(JSON.parse),
  fs.readFile(path.join(directory, "response.schema.json"), "utf8").then(JSON.parse)
]);

function validateSchema(value, definition, location = "result") {
  const errors = [];
  const actualType = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
  if (definition.type && actualType !== definition.type) {
    return [`${location}: expected ${definition.type}, received ${actualType}`];
  }
  if (definition.enum && !definition.enum.includes(value)) {
    errors.push(`${location}: value is not in the allowed enum`);
  }
  if (definition.type === "object") {
    for (const key of definition.required || []) {
      if (!(key in value)) errors.push(`${location}.${key}: required property is missing`);
    }
    if (definition.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in (definition.properties || {}))) {
          errors.push(`${location}.${key}: unexpected property`);
        }
      }
    }
    for (const [key, childDefinition] of Object.entries(definition.properties || {})) {
      if (key in value) errors.push(...validateSchema(value[key], childDefinition, `${location}.${key}`));
    }
  }
  if (definition.type === "array") {
    if (definition.maxItems !== undefined && value.length > definition.maxItems) {
      errors.push(`${location}: exceeds maxItems ${definition.maxItems}`);
    }
    if (definition.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) {
      errors.push(`${location}: duplicate items are not allowed`);
    }
    value.forEach((item, index) => {
      errors.push(...validateSchema(item, definition.items || {}, `${location}[${index}]`));
    });
  }
  return errors;
}

const domainEvidencePatterns = {
  server_rack: [/\b(?:ai\s+)?servers?\b/i, /\brack(?:-scale|s)?\b/i, /服务器|机柜/],
  optical_interconnect_cpo: [
    /\bCPO\b/i,
    /optical (?:module|interconnect)/i,
    /silicon photonics?/i,
    /光模块|光互连|硅光/
  ],
  connector_cable: [
    /\bconnectors?\b/i,
    /\bcables?\b/i,
    /wire harness/i,
    /\binterconnects?\b/i,
    /连接器|线缆|线束|互连/
  ],
  power: [
    /power suppl(?:y|ies)/i,
    /\bPSU\b/i,
    /\b(?:kW|MW|GW)\b/i,
    /\bvoltage\b/i,
    /\bcharging\b/i,
    /electrical architecture/i,
    /电源|供电|功率|电压|充电/
  ],
  liquid_cooling: [
    /liquid cool(?:ing|ed)/i,
    /\bcoolant\b/i,
    /coolant distribution unit/i,
    /\bCDU\b/i,
    /direct-to-chip/i,
    /immersion cooling/i,
    /thermal management/i,
    /液冷|冷却液|热管理|浸没/
  ],
  acoustics_optics: [
    /\bacoustics?\b/i,
    /\bspeakers?\b/i,
    /\bmicrophones?\b/i,
    /\bcameras?\b/i,
    /\blenses?\b/i,
    /\boptics?\b/i,
    /声学|扬声器|麦克风|镜头|光学/
  ],
  automotive_electronics: [
    /\bautomotive\b/i,
    /\bvehicles?\b/i,
    /\bEVs?\b/i,
    /zonal architecture/i,
    /汽车|车辆|电动车|区域架构/
  ],
  ems_odm_manufacturing: [
    /\bEMS\b/i,
    /\bODM\b/i,
    /contract manufactur/i,
    /electronics manufacturing services?/i,
    /assembly line/i,
    /production line/i,
    /制造服务|代工|组装线|生产线/
  ],
  advanced_packaging: [
    /advanced packaging/i,
    /\bchiplets?\b/i,
    /\bCoWoS\b/i,
    /(?:2\.5D|3D) packaging/i,
    /\binterposers?\b/i,
    /fan-out/i,
    /先进封装|芯粒|中介层|扇出/
  ],
  upstream_materials_components: [
    /critical materials?/i,
    /raw materials?/i,
    /\bcomponents?\b/i,
    /\bwafers?\b/i,
    /\bsubstrates?\b/i,
    /copper foil/i,
    /resins?/i,
    /关键材料|原材料|零部件|晶圆|基板|铜箔|树脂/
  ],
  customer_supply_chain: [
    /\bsuppliers?\b/i,
    /supply chain/i,
    /\bcustomers?\b/i,
    /\bsourcing\b/i,
    /multiyear agreement/i,
    /\bpartnerships?\b/i,
    /供应商|供应链|客户|采购|多年协议|合作伙伴/
  ],
  adjacent_semiconductor_storage: [
    /\bsemiconductors?\b/i,
    /\bchips?\b/i,
    /\bDRAM\b/i,
    /\bNAND\b/i,
    /\bSSDs?\b/i,
    /\bGPUs?\b/i,
    /\bCPUs?\b/i,
    /\bSmartNICs?\b/i,
    /\bDPUs?\b/i,
    /半导体|芯片|存储|内存/
  ]
};

function sourceEvidenceText(sourceCase) {
  return [
    sourceCase?.title,
    sourceCase?.originalSummary,
    ...(Array.isArray(sourceCase?.bodyEvidence) ? sourceCase.bodyEvidence : [])
  ]
    .filter((value) => typeof value === "string" && value.trim())
    .join("\n");
}

function qualifiesWithoutMaterialIncrement(result) {
  return (
    (result.relevance === "high" && ["high", "medium"].includes(result.priority)) ||
    (result.relevance === "medium" && result.priority === "high")
  );
}

function applyDeterministicConstraints(result) {
  const appliedConstraints = [];
  if (result.defaultVisible === true && result.relevance === "low") {
    appliedConstraints.push("low_relevance");
  }
  if (result.defaultVisible === true && result.priority === "low") {
    appliedConstraints.push("low_priority");
  }
  if (result.defaultVisible === true && result.abstain === true) {
    appliedConstraints.push("model_abstained");
  }
  if (
    result.defaultVisible === true
    && result.materialIncrement?.exists === false
    && !qualifiesWithoutMaterialIncrement(result)
  ) {
    appliedConstraints.push("missing_required_material_increment");
  }
  return {
    defaultVisible: result.defaultVisible === true && appliedConstraints.length === 0,
    appliedConstraints
  };
}

function validateConsistency(result, sourceCase) {
  const errors = [];

  if (result.defaultVisible === true && result.relevance === "low") {
    errors.push("defaultVisible must be false when relevance is low");
  }
  if (result.defaultVisible === true && result.priority === "low") {
    errors.push("defaultVisible must be false when priority is low");
  }
  if (result.defaultVisible === true && result.abstain === true) {
    errors.push("defaultVisible must be false when abstain is true");
  }
  if (
    result.defaultVisible === true
    && result.materialIncrement?.exists === false
    && !qualifiesWithoutMaterialIncrement(result)
  ) {
    errors.push(
      "defaultVisible lacks material increment and does not meet a relevance/priority path that can qualify without one"
    );
  }

  if (result.materialIncrement?.exists === false) {
    if (!["none", "unknown"].includes(result.materialIncrement.type)) {
      errors.push("materialIncrement.type must be none or unknown when materialIncrement.exists is false");
    }
  } else if (result.materialIncrement?.exists === true) {
    if (["none", "unknown"].includes(result.materialIncrement.type)) {
      errors.push("materialIncrement.type must identify an event when materialIncrement.exists is true");
    }
    if (result.eventStage === "not_applicable") {
      errors.push("eventStage cannot be not_applicable when materialIncrement.exists is true");
    }
  }

  const domains = Array.isArray(result.businessDomain) ? result.businessDomain : [];
  if (domains.includes("unrelated") && domains.length > 1) {
    errors.push("businessDomain cannot combine unrelated with specific business domains");
  }

  const evidenceText = sourceEvidenceText(sourceCase);
  for (const domain of domains) {
    if (domain === "unrelated") continue;
    const patterns = domainEvidencePatterns[domain] || [];
    if (patterns.length > 0 && !patterns.some((pattern) => pattern.test(evidenceText))) {
      errors.push(
        `businessDomain "${domain}" has no explicit support in attributable source text; manual semantic review required (lexical check is advisory)`
      );
    }
  }

  const eventText = [
    result.materialIncrement?.description,
    ...(Array.isArray(result.evidenceQuotes) ? result.evidenceQuotes : [])
  ]
    .filter((value) => typeof value === "string" && value.trim())
    .join(" ");
  const hasFutureMarker = /\b(?:will|plans? to|expects? to|expected to|scheduled to|aims? to|intends? to|set to)\b|计划|预计|将于|拟/i.test(eventText);
  const hasOccurredMarker = /\b(?:has|have|had)\s+(?:begun|started|completed|launched|deployed|adopted|expanded|secured|signed|installed|entered)\b|\b(?:began|started|completed|launched|deployed|adopted|expanded|secured|signed|installed|entered)\b|已完成|已经|已开始|已部署|已采用/i.test(eventText);
  const hasPreparationMarker = /prepar(?:e|es|ing|ation)|pilot production|risk production|qualification|tool move-in|equipment installation|准备|试产|验证|设备进场/i.test(eventText);
  const hasCompletedProductionMarker = /completed (?:the )?(?:mass )?production ramp|entered mass production|began mass production|已完成量产|已进入量产|开始量产/i.test(eventText);

  if (result.eventStage === "occurred" && hasFutureMarker && !hasOccurredMarker) {
    errors.push("eventStage occurred conflicts with evidence that only describes a future event");
  }
  if (result.eventStage === "occurred" && hasPreparationMarker && !hasOccurredMarker) {
    errors.push("eventStage occurred conflicts with evidence limited to preparation or validation");
  }
  if (result.eventStage === "preparation_validation" && hasCompletedProductionMarker) {
    errors.push("eventStage preparation_validation conflicts with evidence of started mass production");
  }

  return errors;
}

const caseById = new Map(cases.map((item) => [item.id, item]));
const labelById = new Map(labels.map((item) => [item.id, item]));
const checks = [];

for (const entry of payload.results || []) {
  const sourceCase = caseById.get(entry.id);
  const reference = labelById.get(entry.id);
  const schemaErrors = entry.result ? validateSchema(entry.result, schema) : [];
  const evidenceErrors = [];
  const consistencyErrors = [];
  const referenceMismatches = [];
  const fieldMatches = {};

  if (!sourceCase) schemaErrors.push(`Unknown case id: ${entry.id}`);
  if (!reference) schemaErrors.push(`Missing reference label: ${entry.id}`);
  if (entry.error) schemaErrors.push(`Inference error: ${entry.error}`);
  if (!entry.result && !entry.error) schemaErrors.push("Model result is missing");

  if (sourceCase && entry.result) {
    const evidenceSources = [sourceCase.originalSummary, ...(sourceCase.bodyEvidence || [])];
    if (!entry.result.abstain && !(entry.result.evidenceQuotes || []).length) {
      evidenceErrors.push("At least one exact evidence quote is required when abstain=false");
    }
    for (const quote of entry.result.evidenceQuotes || []) {
      if (!quote.trim() || !evidenceSources.some((source) => source.includes(quote))) {
        evidenceErrors.push(`Unsupported evidence quote: ${JSON.stringify(quote)}`);
      }
    }
  }

  if (reference && entry.result) {
    for (const key of ["relevance", "priority", "eventStage", "defaultVisible"]) {
      fieldMatches[key] = entry.result[key] === reference[key];
      if (entry.result[key] !== reference[key]) {
        referenceMismatches.push(`${key}: expected ${reference[key]}, received ${entry.result[key]}`);
      }
    }
  }

  if (sourceCase && entry.result && schemaErrors.length === 0) {
    consistencyErrors.push(...validateConsistency(entry.result, sourceCase));
  }

  checks.push({
    id: entry.id,
    elapsedMs: entry.elapsedMs,
    usage: entry.usage || null,
    schemaValid: schemaErrors.length === 0,
    evidenceValid: evidenceErrors.length === 0,
    consistencyValid: consistencyErrors.length === 0,
    referenceMatch: referenceMismatches.length === 0,
    schemaErrors,
    evidenceErrors,
    consistencyErrors,
    referenceMismatches,
    fieldMatches,
    reference: reference
      ? {
          relevance: reference.relevance,
          priority: reference.priority,
          eventStage: reference.eventStage,
          defaultVisible: reference.defaultVisible
        }
      : null,
    effectiveRecommendation: entry.result ? applyDeterministicConstraints(entry.result) : null,
    result: entry.result || null
  });
}

const expectedIds = payload.caseIds || [];
const returnedIds = new Set(checks.map((item) => item.id));
const missingIds = expectedIds.filter((id) => !returnedIds.has(id));
const summary = {
  expected: expectedIds.length,
  returned: checks.length,
  schemaValid: checks.filter((item) => item.schemaValid).length,
  evidenceValid: checks.filter((item) => item.evidenceValid).length,
  consistencyValid: checks.filter((item) => item.consistencyValid).length,
  referenceMatches: checks.filter((item) => item.referenceMatch).length,
  technicalFailures: checks.filter((item) => !item.schemaValid || !item.evidenceValid).length,
  consistencyFailures: checks.filter((item) => !item.consistencyValid).length,
  semanticMismatches: checks.filter((item) => !item.referenceMatch).length,
  missingIds,
  technicalValidationPassed: false,
  consistencyValidationPassed: false,
  semanticEvaluationPassed: false
};

const technicalFailure = missingIds.length
  || checks.length !== expectedIds.length
  || checks.some((item) => !item.schemaValid || !item.evidenceValid);
summary.technicalValidationPassed = !technicalFailure;
summary.consistencyValidationPassed = checks.length === expectedIds.length
  && checks.every((item) => item.consistencyValid);
summary.semanticEvaluationPassed = checks.length === expectedIds.length
  && checks.every((item) => item.referenceMatch);

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function fieldAccuracy(field) {
  const evaluated = checks.filter((item) => item.result && item.reference);
  const correct = evaluated.filter((item) => item.fieldMatches[field]).length;
  return { correct, evaluated: evaluated.length, rate: ratio(correct, evaluated.length) };
}

function defaultVisibilityMetrics(selector) {
  const evaluated = checks.filter((item) => item.result && item.reference);
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let trueNegative = 0;
  for (const item of evaluated) {
    const predicted = selector(item);
    const expected = item.reference.defaultVisible;
    if (predicted && expected) truePositive += 1;
    else if (predicted && !expected) falsePositive += 1;
    else if (!predicted && expected) falseNegative += 1;
    else trueNegative += 1;
  }
  return {
    evaluated: evaluated.length,
    truePositive,
    falsePositive,
    falseNegative,
    trueNegative,
    precision: ratio(truePositive, truePositive + falsePositive),
    recall: ratio(truePositive, truePositive + falseNegative)
  };
}

const evaluatedChecks = checks.filter((item) => item.result && item.reference);
const elapsedValues = checks
  .map((item) => Number(item.elapsedMs))
  .filter((value) => Number.isFinite(value) && value >= 0);
const usageValues = checks.map((item) => ({
  id: item.id,
  promptTokens: Number(item.usage?.prompt_tokens) || 0,
  completionTokens: Number(item.usage?.completion_tokens) || 0,
  totalTokens: Number(item.usage?.total_tokens) || 0
}));
const metrics = {
  schemaValidity: {
    valid: summary.schemaValid,
    evaluated: checks.length,
    rate: ratio(summary.schemaValid, checks.length)
  },
  evidenceValidity: {
    valid: summary.evidenceValid,
    evaluated: checks.length,
    rate: ratio(summary.evidenceValid, checks.length)
  },
  consistencyValidity: {
    valid: summary.consistencyValid,
    evaluated: checks.length,
    rate: ratio(summary.consistencyValid, checks.length)
  },
  relevanceAccuracy: fieldAccuracy("relevance"),
  priorityAccuracy: fieldAccuracy("priority"),
  eventStageAccuracy: fieldAccuracy("eventStage"),
  defaultVisible: {
    rawModel: defaultVisibilityMetrics((item) => item.result.defaultVisible === true),
    constrained: defaultVisibilityMetrics((item) => item.effectiveRecommendation.defaultVisible === true)
  },
  highValueMisses: {
    rawModel: evaluatedChecks
      .filter((item) => item.reference.defaultVisible && !item.result.defaultVisible)
      .map((item) => item.id),
    constrained: evaluatedChecks
      .filter((item) => item.reference.defaultVisible && !item.effectiveRecommendation.defaultVisible)
      .map((item) => ({ id: item.id, constraints: item.effectiveRecommendation.appliedConstraints }))
  },
  hiddenNewsFalsePositives: {
    rawModel: evaluatedChecks
      .filter((item) => !item.reference.defaultVisible && item.result.defaultVisible)
      .map((item) => item.id),
    constrained: evaluatedChecks
      .filter((item) => !item.reference.defaultVisible && item.effectiveRecommendation.defaultVisible)
      .map((item) => item.id)
  },
  inferenceTiming: {
    articles: elapsedValues.length,
    totalMs: elapsedValues.reduce((total, value) => total + value, 0),
    averageMs: elapsedValues.length
      ? elapsedValues.reduce((total, value) => total + value, 0) / elapsedValues.length
      : null,
    minMs: elapsedValues.length ? Math.min(...elapsedValues) : null,
    maxMs: elapsedValues.length ? Math.max(...elapsedValues) : null,
    perArticle: checks.map((item) => ({ id: item.id, elapsedMs: item.elapsedMs ?? null }))
  },
  inferenceTokens: {
    promptTokens: usageValues.reduce((total, item) => total + item.promptTokens, 0),
    completionTokens: usageValues.reduce((total, item) => total + item.completionTokens, 0),
    totalTokens: usageValues.reduce((total, item) => total + item.totalTokens, 0),
    perArticle: usageValues
  }
};

await fs.mkdir(path.dirname(evaluationPath), { recursive: true });
await fs.writeFile(
  evaluationPath,
  `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    model: payload.model,
    experimentGroup: payload.experimentGroup || "historical_baseline",
    runSignature: payload.runSignature || null,
    businessProfile: payload.businessProfile || null,
    summary,
    metrics,
    checks
  }, null, 2)}\n`
);
console.log(JSON.stringify(summary, null, 2));

// Semantic disagreement is an evaluation result, not an experiment infrastructure failure.
if (technicalFailure) process.exitCode = 1;
