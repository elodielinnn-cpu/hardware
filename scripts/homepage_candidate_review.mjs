import crypto from "node:crypto";
import fs from "node:fs/promises";

export const HOMEPAGE_REVIEW_RULE_VERSION = "homepage-quality-v1";
export const HOMEPAGE_REVIEW_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const PROMOTION = /\b(?:giveaway|coupon|discount|limited[- ]time deal|promo(?:tion)?|sponsored|save \$?\d+|for only \$?\d+|lifetime (?:license|deal)|buy now|shop now)\b|促销|优惠券|限时优惠|抽奖|赞助内容/iu;
const PURE_GAME = /\b(?:gameplay|game launch|gaming event|call of duty|geforce now|xbox game pass|playstation plus|steam sale|esports tournament)\b|游戏上线|电竞赛事|游戏促销/iu;
const MATERIAL_HARDWARE_CONTEXT = /\b(?:server|rack|connector|cable|storage|ssd|gpu|cpu|semiconductor|manufactur|supply chain|capacity|data cent(?:er|re)|power|cooling)\b|服务器|机柜|连接器|线缆|存储|芯片|半导体|制造|供应链|产能|数据中心|电源|液冷/iu;
const CLEARLY_OFF_TOPIC = /\b(?:celebrity gossip|horoscope|recipe|fashion week|travel deal)\b|明星八卦|星座运势|菜谱|旅游优惠/iu;

function normalizeText(value = "") {
  return String(value).normalize("NFKC").replace(/[\s\u00a0]+/gu, " ").trim().toLowerCase();
}

function stableArticlePayload(article) {
  return {
    candidateId: article.v3Audit?.candidateId || article.candidateId || article.id || "",
    articleId: article.id || "",
    title: article.title || "",
    summary: article.summary || "",
    sourceUrl: article.sourceUrl || "",
    publishedAt: article.publishedAt || ""
  };
}

export function homepageCandidateContentHash(article) {
  return crypto.createHash("sha256").update(JSON.stringify(stableArticlePayload(article))).digest("hex");
}

export function buildHomepageReviewCandidates(articles) {
  const candidates = articles.filter((article) => article?.showByDefault === true).map((article) => {
    const payload = stableArticlePayload(article);
    return {
      ...payload,
      contentHash: homepageCandidateContentHash(article),
      sourceId: article.sourceId || "",
      relevance: article.relevance || "",
      priority: article.importance || "",
      v3Audit: article.v3Audit || null
    };
  });
  return [...new Map(candidates.map((candidate) => [`${candidate.candidateId}:${candidate.contentHash}`, candidate])).values()];
}

export function validateMinimalModelOutput(output, candidate) {
  const errors = [];
  const keys = output && typeof output === "object" && !Array.isArray(output) ? Object.keys(output).sort() : [];
  const expectedKeys = ["articleEvidence", "candidateId", "reason", "verdict"];
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) errors.push("unexpected_output_fields");
  if (output?.candidateId !== candidate.candidateId) errors.push("candidate_id_mismatch");
  if (!new Set(["KEEP", "HIDE", "UNCERTAIN"]).has(output?.verdict)) errors.push("invalid_verdict");
  if (typeof output?.reason !== "string" || !output.reason.trim() || output.reason.length > 300) errors.push("invalid_reason");
  if (typeof output?.articleEvidence !== "string" || !output.articleEvidence.trim() || output.articleEvidence.length > 300) errors.push("invalid_article_evidence");
  const sourceText = normalizeText(`${candidate.title || ""} ${candidate.summary || ""}`);
  const evidence = normalizeText(output?.articleEvidence || "");
  if (evidence && !sourceText.includes(evidence)) errors.push("evidence_not_in_article");
  return { valid: errors.length === 0, errors };
}

function hasUnsupportedUpstreamDirectInheritance(candidate) {
  const audit = candidate.v3Audit;
  if (!audit || !Array.isArray(audit.articleSubjects) || !Array.isArray(audit.relatedLuxshareProducts)) return false;
  if (!audit.articleSubjects.length || !audit.relatedLuxshareProducts.length) return false;
  const subjectIsNotDirect = audit.articleSubjects.every((item) => item.relationshipLevel !== "direct");
  const noSupportedImpact = audit.articleSubjects.every((item) => item.impactSupported !== true);
  const relatedDirectExists = audit.relatedLuxshareProducts.some((item) => item.relationshipLevel === "direct");
  return subjectIsNotDirect && noSupportedImpact && relatedDirectExists;
}

export function validateHideRecommendation(candidate, output) {
  const technical = validateMinimalModelOutput(output, candidate);
  if (!technical.valid) return { accepted: false, effectiveVerdict: "KEEP", reasonCodes: technical.errors };
  if (output.verdict !== "HIDE") {
    return { accepted: true, effectiveVerdict: "KEEP", reasonCodes: [`model_${output.verdict.toLowerCase()}_preserves_v3`] };
  }

  const sourceText = normalizeText(`${candidate.title || ""} ${candidate.summary || ""}`);
  const hardNegative = PROMOTION.test(sourceText)
    ? "verified_promotion"
    : PURE_GAME.test(sourceText) && !MATERIAL_HARDWARE_CONTEXT.test(sourceText)
      ? "verified_pure_game"
      : CLEARLY_OFF_TOPIC.test(sourceText)
        ? "verified_off_topic"
        : "";
  if (hardNegative) return { accepted: true, effectiveVerdict: "HIDE", reasonCodes: [hardNegative] };
  if (hasUnsupportedUpstreamDirectInheritance(candidate)) {
    return { accepted: true, effectiveVerdict: "HIDE", reasonCodes: ["verified_unsupported_upstream_direct_inheritance"] };
  }
  return { accepted: false, effectiveVerdict: "KEEP", reasonCodes: ["hide_not_deterministically_supported"] };
}

export function mergeReviewStore(previousStore, runResult, now = new Date()) {
  const nowMs = now.getTime();
  const prior = Array.isArray(previousStore?.reviews) ? previousStore.reviews : [];
  const incoming = Array.isArray(runResult?.reviews) ? runResult.reviews : [];
  const byKey = new Map();
  for (const review of [...prior, ...incoming]) {
    if (review.ruleVersion !== HOMEPAGE_REVIEW_RULE_VERSION) continue;
    const expiresAt = Date.parse(review.expiresAt || "");
    if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) continue;
    const key = `${review.candidateId || ""}:${review.contentHash || ""}`;
    if (key !== ":") byKey.set(key, review);
  }
  return {
    schemaVersion: "1.0.0",
    ruleVersion: HOMEPAGE_REVIEW_RULE_VERSION,
    updatedAt: now.toISOString(),
    reviews: [...byKey.values()].sort((a, b) => String(a.candidateId).localeCompare(String(b.candidateId)))
  };
}

export function applyHomepageReviewStore(articles, store, now = new Date()) {
  const diagnostics = { loaded: 0, applied: 0, expired: 0, hashMismatch: 0, invalid: 0, preserved: 0 };
  if (store?.ruleVersion !== HOMEPAGE_REVIEW_RULE_VERSION || !Array.isArray(store?.reviews)) {
    return { articles, diagnostics: { ...diagnostics, invalidStore: true } };
  }
  const reviewByCandidate = new Map();
  for (const review of store.reviews) {
    diagnostics.loaded += 1;
    if (review.ruleVersion !== HOMEPAGE_REVIEW_RULE_VERSION) {
      diagnostics.invalid += 1;
      continue;
    }
    const expiresAt = Date.parse(review.expiresAt || "");
    if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
      diagnostics.expired += 1;
      continue;
    }
    reviewByCandidate.set(review.candidateId, review);
  }
  const reviewedArticles = articles.map((article) => {
    if (article.showByDefault !== true) return article;
    const candidate = buildHomepageReviewCandidates([article])[0];
    const review = reviewByCandidate.get(candidate.candidateId);
    if (!review) return article;
    if (review.contentHash !== candidate.contentHash) {
      diagnostics.hashMismatch += 1;
      return article;
    }
    const validation = validateHideRecommendation(candidate, review.modelOutput);
    if (!validation.accepted) {
      diagnostics.invalid += 1;
      return article;
    }
    if (validation.effectiveVerdict !== "HIDE") {
      diagnostics.preserved += 1;
      return article;
    }
    diagnostics.applied += 1;
    return {
      ...article,
      showByDefault: false,
      defaultFeedAudit: {
        ...(article.defaultFeedAudit || {}),
        defaultHideReason: "validated_qwen_homepage_quality_hide"
      },
      homepageQualityReview: {
        ruleVersion: HOMEPAGE_REVIEW_RULE_VERSION,
        reviewedAt: review.reviewedAt,
        contentHash: review.contentHash,
        verdict: "HIDE",
        reason: review.modelOutput.reason,
        articleEvidence: review.modelOutput.articleEvidence,
        validationReasonCodes: validation.reasonCodes
      }
    };
  });
  return { articles: reviewedArticles, diagnostics };
}

export async function loadAndApplyHomepageReviews(articles, reviewPath, now = new Date()) {
  try {
    const store = JSON.parse(await fs.readFile(reviewPath, "utf8"));
    return applyHomepageReviewStore(articles, store, now);
  } catch (error) {
    return {
      articles,
      diagnostics: { loaded: 0, applied: 0, preserved: articles.filter((item) => item.showByDefault).length, failOpen: true, error: String(error.message || error).slice(0, 200) }
    };
  }
}
