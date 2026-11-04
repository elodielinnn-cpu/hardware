import crypto from "node:crypto";

export const GEMINI_REVIEW_RULE_VERSION = "gemini-homepage-shadow-v1";
export const MAX_ATTEMPTS_PER_CONTENT = 3;
export const GEMINI_REVIEW_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const VALID_REVIEW_STATUSES = new Set(["completed", "retryable", "manual_review"]);

function isValidReviewRecord(item, nowMs) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false;
  if (item.ruleVersion !== GEMINI_REVIEW_RULE_VERSION) return false;
  if (!item.candidateId || !item.contentHash || !VALID_REVIEW_STATUSES.has(item.status)) return false;
  const reviewedAt = Date.parse(item.reviewedAt || "");
  if (!Number.isFinite(reviewedAt) || reviewedAt > nowMs || nowMs - reviewedAt > GEMINI_REVIEW_CACHE_MAX_AGE_MS) return false;
  if (item.status !== "completed" && (!Number.isInteger(item.attempts) || item.attempts < 1)) return false;
  return true;
}

export function geminiCandidateContentHash(candidate) {
  return crypto.createHash("sha256").update(JSON.stringify({
    candidateId: candidate.candidateId || "",
    title: candidate.title || "",
    summary: candidate.summary || ""
  })).digest("hex");
}

export function buildGeminiCandidates(articles) {
  return articles.filter((article) => article?.showByDefault === true).map((article) => {
    const candidate = {
      candidateId: article.v3Audit?.candidateId || article.candidateId || article.id || "",
      articleId: article.id || "",
      title: article.title || "",
      summary: article.summary || "",
      source: article.sourceId || "",
      url: article.sourceUrl || "",
      publishedAt: article.publishedAt || "",
      v3Audit: article.v3Audit || null
    };
    return { ...candidate, contentHash: geminiCandidateContentHash(candidate) };
  }).filter((candidate) => candidate.candidateId && candidate.title && candidate.summary);
}

export function selectIncrementalCandidates(candidates, store, limit, now = new Date()) {
  const records = Array.isArray(store?.reviews) ? store.reviews : [];
  const validRecords = records.filter((item) => isValidReviewRecord(item, now.getTime()));
  const exact = new Map(validRecords.map((item) => [`${item.candidateId}:${item.contentHash}:${item.ruleVersion}`, item]));
  const knownIds = new Set(validRecords.map((item) => item.candidateId));
  const selected = [];
  const skipped = [];
  for (const candidate of candidates) {
    const key = `${candidate.candidateId}:${candidate.contentHash}:${GEMINI_REVIEW_RULE_VERSION}`;
    const record = exact.get(key);
    if (record?.status === "completed") {
      skipped.push({ candidateId: candidate.candidateId, reason: "cached_unchanged" });
      continue;
    }
    if (record?.status === "manual_review") {
      skipped.push({ candidateId: candidate.candidateId, reason: "retry_limit_reached" });
      continue;
    }
    const selectionReason = record?.status === "retryable"
      ? "retry"
      : knownIds.has(candidate.candidateId)
        ? "content_changed"
        : "new_homepage_candidate";
    selected.push({ ...candidate, selectionReason, priorAttempts: Number(record?.attempts || 0) });
  }
  const retryFirst = selected.sort((a, b) => Number(b.selectionReason === "retry") - Number(a.selectionReason === "retry") || String(a.candidateId).localeCompare(String(b.candidateId)));
  return {
    selected: retryFirst.slice(0, limit),
    deferred: retryFirst.slice(limit).map((item) => ({ candidateId: item.candidateId, reason: "run_budget" })),
    skipped
  };
}

export function mergeGeminiReviewStore(previousStore, records, currentCandidateIds, now = new Date()) {
  const byKey = new Map();
  for (const item of [...(previousStore?.reviews || []), ...records]) {
    if (!isValidReviewRecord(item, now.getTime())) continue;
    const key = `${item.candidateId}:${item.contentHash}:${item.ruleVersion}`;
    byKey.set(key, item);
  }
  const activeIds = new Set(currentCandidateIds);
  const reviews = [...byKey.values()]
    .filter((item) => activeIds.has(item.candidateId))
    .sort((a, b) => String(a.candidateId).localeCompare(String(b.candidateId)) || String(b.reviewedAt || "").localeCompare(String(a.reviewedAt || "")))
    .slice(0, 500);
  return { schemaVersion: "1.0.0", ruleVersion: GEMINI_REVIEW_RULE_VERSION, mode: "shadow", updatedAt: now.toISOString(), reviews };
}

export function failureRecord(candidate, error, now = new Date()) {
  const attempts = candidate.priorAttempts + 1;
  return {
    candidateId: candidate.candidateId,
    articleId: candidate.articleId,
    contentHash: candidate.contentHash,
    ruleVersion: GEMINI_REVIEW_RULE_VERSION,
    status: attempts >= MAX_ATTEMPTS_PER_CONTENT ? "manual_review" : "retryable",
    attempts,
    reviewedAt: now.toISOString(),
    error: { type: error?.type || "unknown", status: error?.status || null, message: String(error?.message || "unknown error").slice(0, 300) }
  };
}
