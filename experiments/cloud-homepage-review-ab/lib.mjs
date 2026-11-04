import crypto from "node:crypto";

export const MAX_OUTPUT_TOKENS = 220;
export const REQUEST_TIMEOUT_MS = 45_000;
export const MAX_RETRIES = 0;

export function selectBalancedSamples(samples, labels, limit) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 30) throw new Error("sampleLimit must be an integer from 1 to 30");
  if (limit > samples.length) throw new Error(`sampleLimit ${limit} exceeds the ${samples.length} fixed samples`);
  const labelMap = new Map(labels.map(([id, expected]) => [id, expected]));
  const queues = {
    KEEP: samples.filter((sample) => labelMap.get(sample.candidateId) === "KEEP"),
    HIDE: samples.filter((sample) => labelMap.get(sample.candidateId) === "HIDE")
  };
  const selected = [];
  while (selected.length < limit) {
    for (const label of ["KEEP", "HIDE"]) {
      const sample = queues[label].shift();
      if (sample) selected.push(sample);
      if (selected.length === limit) break;
    }
  }
  if (selected.length !== limit) throw new Error("Unable to create the requested fixed-sample selection");
  return selected;
}

export function buildCandidateInput(sample) {
  return {
    candidateId: sample.candidateId,
    title: sample.title,
    summary: sample.summary,
    source: sample.source,
    url: sample.url
  };
}

export function validateModelOutput(value, sample) {
  const errors = [];
  const expectedKeys = ["articleEvidence", "candidateId", "reason", "verdict"];
  if (!value || typeof value !== "object" || Array.isArray(value)) return { valid: false, evidenceValid: false, errors: ["output_not_object"] };
  const keys = Object.keys(value).sort();
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) errors.push("unexpected_fields");
  if (value.candidateId !== sample.candidateId) errors.push("candidate_id_mismatch");
  if (!["KEEP", "HIDE", "UNCERTAIN"].includes(value.verdict)) errors.push("invalid_verdict");
  for (const key of ["reason", "articleEvidence"]) {
    if (typeof value[key] !== "string" || !value[key].trim() || value[key].length > 300) errors.push(`invalid_${key}`);
  }
  const sourceText = `${sample.title}\n${sample.summary}`.toLocaleLowerCase();
  const evidenceValid = typeof value.articleEvidence === "string" && sourceText.includes(value.articleEvidence.trim().toLocaleLowerCase());
  if (!evidenceValid) errors.push("evidence_not_in_article");
  return { valid: errors.length === 0, evidenceValid, errors };
}

export function applyEvidenceGate(sample, modelOutput, validation) {
  if (!validation.valid || modelOutput.verdict !== "HIDE") return { effectiveVerdict: "KEEP", acceptedHide: false, reason: validation.valid ? "model_did_not_recommend_hide" : "technical_validation_failed" };
  const allowedKinds = new Set(["promotion", "software_promotion", "retail_promotion", "game", "software_only", "lifestyle_marketing", "routine_financial", "culture", "unsupported_upstream_inheritance"]);
  if (!allowedKinds.has(sample.gateContext?.kind)) return { effectiveVerdict: "KEEP", acceptedHide: false, reason: "hide_not_supported_by_deterministic_gate" };
  return { effectiveVerdict: "HIDE", acceptedHide: true, reason: `supported_${sample.gateContext.kind}` };
}

export function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

export function calculateMetrics(results, labels) {
  const labelMap = new Map(labels.map(([id, expected]) => [id, expected]));
  const completed = results.filter((item) => item.modelOutput && item.validation);
  const valid = completed.filter((item) => item.validation.valid);
  const latencies = results.filter((item) => Number.isFinite(item.requestLatencyMs)).map((item) => item.requestLatencyMs);
  const expectedHide = results.filter((item) => labelMap.get(item.candidateId) === "HIDE").length;
  const expectedKeep = results.filter((item) => labelMap.get(item.candidateId) === "KEEP").length;
  const rawHide = valid.filter((item) => item.modelOutput.verdict === "HIDE");
  const effectiveHide = valid.filter((item) => item.gate?.effectiveVerdict === "HIDE");
  const score = (items, useGate = false) => {
    const predicted = (item) => useGate ? item.gate.effectiveVerdict : item.modelOutput.verdict;
    const correct = items.filter((item) => predicted(item) === labelMap.get(item.candidateId)).length;
    const hideTp = items.filter((item) => predicted(item) === "HIDE" && labelMap.get(item.candidateId) === "HIDE").length;
    const hideFp = items.filter((item) => predicted(item) === "HIDE" && labelMap.get(item.candidateId) === "KEEP").length;
    return {
      accuracy: items.length ? correct / items.length : null,
      hidePrecision: hideTp + hideFp ? hideTp / (hideTp + hideFp) : null,
      hideRecall: expectedHide ? hideTp / expectedHide : null,
      keepFalseHideCount: hideFp,
      keepFalseHideRate: expectedKeep ? hideFp / expectedKeep : null
    };
  };
  return {
    attempted: results.length,
    technicallyValid: valid.length,
    invalidJsonOrSchema: results.filter((item) => item.error?.type === "invalid_json" || item.validation?.errors.some((error) => error !== "evidence_not_in_article")).length,
    evidenceFailures: results.filter((item) => item.validation && !item.validation.evidenceValid).length,
    uncertain: valid.filter((item) => item.modelOutput.verdict === "UNCERTAIN").length,
    httpErrors: results.filter((item) => item.error?.type === "http").length,
    rateLimited: results.filter((item) => item.error?.status === 429).length,
    timeouts: results.filter((item) => item.error?.type === "timeout").length,
    truncated: results.filter((item) => item.error?.type === "truncated").length,
    retries: results.reduce((sum, item) => sum + (item.retryCount || 0), 0),
    rawHideCount: rawHide.length,
    effectiveHideCount: effectiveHide.length,
    raw: score(valid),
    evidenceGated: score(valid, true),
    latencyMs: {
      mean: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null,
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      total: results.reduce((sum, item) => sum + (item.requestLatencyMs || 0), 0),
      clientWait: results.reduce((sum, item) => sum + (item.clientWaitMs || 0), 0),
      retryWait: results.reduce((sum, item) => sum + (item.retryWaitMs || 0), 0)
    },
    tokens: {
      input: results.reduce((sum, item) => sum + (item.usage?.inputTokens || 0), 0),
      output: results.reduce((sum, item) => sum + (item.usage?.outputTokens || 0), 0)
    }
  };
}

export function experimentHash(parts) {
  return crypto.createHash("sha256").update(parts.join("\n---\n")).digest("hex");
}

export function redactError(message) {
  return String(message || "unknown error")
    .replace(/(api[_-]?key|authorization|bearer)\s*[:=]?\s*[^\s,;]+/gi, "$1=[redacted]")
    .slice(0, 500);
}
