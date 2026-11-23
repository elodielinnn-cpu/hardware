import { TAGGING_TAXONOMY } from '../../config/news-screening-rules-v2.mjs';
import { buildGeminiCandidates, decodeReviewText, GEMINI_REVIEW_RULE_VERSION } from './cache.mjs';

const normalize = value => decodeReviewText(value).normalize('NFKC').replace(/\s+/gu, ' ').trim().toLowerCase();
const legacyEventStage = { published: 'occurred', validation: 'sampling_validation',
  initial_use: 'occurred', scale_use: 'occurred', planned: 'confirmed_future',
  not_applicable: 'occurred' };

export function shortenVerifiedEvidence(candidate, output) {
  if (typeof output?.articleEvidence !== 'string' || output.articleEvidence.length <= 240) return output;
  const chosen = candidate.candidateEvents.find(event => event.id === output.mainEventId);
  const source = output.verdict === 'SHOW' ? chosen?.evidence : [candidate.title, candidate.summary].join(' ');
  if (!source || !normalize(source).includes(normalize(output.articleEvidence))) return output;
  return { ...output, articleEvidence: decodeReviewText(output.articleEvidence).slice(0, 200).trim() };
}

export function validateDecision(candidate, output) {
  const errors = [];
  const keys = output && typeof output === 'object' && !Array.isArray(output)
    ? Object.keys(output).sort() : [];
  if (JSON.stringify(keys) !== JSON.stringify(['articleEvidence', 'candidateId', 'mainEventId', 'reason', 'verdict'])) errors.push('unexpected_fields');
  if (output?.candidateId !== candidate.candidateId) errors.push('candidate_id_mismatch');
  if (!['SHOW', 'HIDE', 'UNCERTAIN'].includes(output?.verdict)) errors.push('invalid_verdict');
  if (!candidate.candidateEvents.some(event => event.id === output?.mainEventId) && output?.mainEventId !== 'none') errors.push('unknown_main_event');
  if (output?.verdict === 'SHOW' && output?.mainEventId === 'none'
    && candidate.programDecision === 'HIDE') errors.push('promotion_requires_event');
  if (typeof output?.reason !== 'string' || !output.reason.trim() || output.reason.length > 240) errors.push('invalid_reason');
  const evidence = normalize(output?.articleEvidence);
  const source = normalize([candidate.title, candidate.summary, ...candidate.candidateEvents.map(event => event.evidence)].join(' '));
  if (!evidence || evidence.length > 240 || !source.includes(evidence)) errors.push('evidence_not_in_input');
  const chosen = candidate.candidateEvents.find(event => event.id === output?.mainEventId);
  if (output?.verdict === 'SHOW' && chosen && !normalize(chosen.evidence).includes(evidence)) {
    errors.push('evidence_not_bound_to_main_event');
  }
  if (output?.verdict === 'SHOW' && candidate.programDecision === 'HIDE') {
    const event = candidate.candidateEvents.find(item => item.id === output.mainEventId);
    if (!event?.eventType || !event?.evidence || event.stage === 'rumor'
      || candidate.v3Audit?.evidenceSufficiency !== 'sufficient'
      || !['business_relevance', 'management_priority'].includes(candidate.decisionGate)) errors.push('promotion_gate_failed');
    const directMapping = (candidate.v3Audit?.articleSubjects || []).some(item => item.relationshipLevel === 'direct')
      || (candidate.v3Audit?.relatedLuxshareProducts || []).some(item => item.relationshipLevel === 'direct');
    const physicalSystem = ['server', 'rack', 'infrastructure'].includes(event?.objectLevel);
    if (candidate.decisionGate === 'business_relevance' && !directMapping && !physicalSystem) {
      errors.push('business_link_not_supported');
    }
    if (candidate.decisionGate === 'management_priority' && event?.relevance === 'low') {
      errors.push('business_relevance_still_low');
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validAppliedPromotion(article, now = new Date()) {
  const review = article.homepageQualityReview;
  if (review?.ruleVersion !== GEMINI_REVIEW_RULE_VERSION || review.verdict !== 'SHOW'
    || review.programDecision !== 'HIDE' || review.contentHash === undefined
    || !Number.isFinite(Date.parse(review.reviewedAt))
    || Date.parse(review.reviewedAt) > now.getTime()
    || now.getTime() - Date.parse(review.reviewedAt) > 30 * 86400000) return false;
  const candidate = buildGeminiCandidates([article], now)[0];
  if (!candidate || candidate.contentHash !== review.contentHash || candidate.programDecision !== 'HIDE') return false;
  return validateDecision(candidate, { candidateId: candidate.candidateId, verdict: review.verdict,
    mainEventId: review.mainEventId, reason: review.reason,
    articleEvidence: review.articleEvidence }).valid;
}

export function applyGeminiDecisions(articles, store, now = new Date()) {
  const diagnostics = { matched: 0, shown: 0, hidden: 0, pending: 0,
    uncertain: 0, invalid: 0, mainEventChanged: 0 };
  const pending = article => {
    if (article.showByDefault) diagnostics.pending += 1;
    return { ...article, showByDefault: false,
      defaultFeedAudit: { ...article.defaultFeedAudit,
        defaultHideReason: article.showByDefault ? 'cloud_review_pending'
          : article.defaultFeedAudit?.defaultHideReason || 'cloud_review_pending' } };
  };
  if (store?.ruleVersion !== GEMINI_REVIEW_RULE_VERSION || !Array.isArray(store.reviews)) {
    return { articles: articles.map(pending), diagnostics: { ...diagnostics, invalidStore: true } };
  }
  const byKey = new Map(store.reviews.filter(record => record.status === 'completed'
    && Number.isFinite(Date.parse(record.reviewedAt)) && now.getTime() - Date.parse(record.reviewedAt) <= 30 * 86400000)
    .filter(record => Date.parse(record.reviewedAt) <= now.getTime())
    .map(record => [`${record.candidateId}:${record.contentHash}`, record]));
  return { articles: articles.map(article => {
    const candidate = buildGeminiCandidates([article], now)[0];
    if (!candidate) return pending(article);
    const review = byKey.get(`${candidate.candidateId}:${candidate.contentHash}`);
    if (!review || review.ruleVersion !== GEMINI_REVIEW_RULE_VERSION) return pending(article);
    diagnostics.matched += 1;
    const validation = validateDecision(candidate, review.modelOutput);
    if (!validation.valid) {
      diagnostics.invalid += 1;
      return pending(article);
    }
    if (review.modelOutput.verdict === 'UNCERTAIN') {
      diagnostics.uncertain += 1;
      return pending(article);
    }
    const verdict = review.modelOutput.verdict;
    const selected = candidate.candidateEvents.find(event => event.id === review.modelOutput.mainEventId);
    const show = verdict === 'SHOW';
    if (show && !article.showByDefault) diagnostics.shown += 1;
    if (!show && article.showByDefault) diagnostics.hidden += 1;
    if (selected && selected.id !== article.unifiedTagging?.mainEvent?.id) diagnostics.mainEventChanged += 1;
    const domains = selected?.domains?.length ? selected.domains : article.unifiedTagging?.articleDomains || [];
    const tags = selected ? [...domains.map(domain => TAGGING_TAXONOMY.domains[domain]).filter(Boolean),
      TAGGING_TAXONOMY.events[selected.eventType],
      ...(['unknown', 'not_applicable'].includes(selected.stage) ? [] : [TAGGING_TAXONOMY.stages[selected.stage]])].filter(Boolean) : article.tags;
    const promoted = show && candidate.programDecision === 'HIDE';
    return { ...article, showByDefault: show, tags,
      relevance: promoted && ['低', '未知'].includes(article.relevance) ? '中' : article.relevance,
      importance: promoted && ['低', '未知'].includes(article.importance) ? '中' : article.importance,
      defaultFeedAudit: { ...article.defaultFeedAudit,
        eventType: selected?.eventType || article.defaultFeedAudit?.eventType || '',
        eventEvidenceText: selected?.evidence || article.defaultFeedAudit?.eventEvidenceText || '',
        eventStage: selected ? legacyEventStage[selected.stage] || 'unknown' : article.defaultFeedAudit?.eventStage,
        defaultHideReason: show ? '' : 'cloud_review_hide' },
      unifiedTagging: selected ? { ...article.unifiedTagging, mainEvent: { ...selected },
        homepageEvent: show ? { ...selected } : null, displayEvents: [selected], displayTags: tags } : article.unifiedTagging,
      homepageQualityReview: { ruleVersion: GEMINI_REVIEW_RULE_VERSION, verdict,
        mainEventId: review.modelOutput.mainEventId, articleEvidence: review.modelOutput.articleEvidence,
        reason: review.modelOutput.reason, reviewedAt: review.reviewedAt, contentHash: review.contentHash,
        programDecision: candidate.programDecision, programRelevance: article.relevance,
        programImportance: article.importance,
        programHideReason: article.defaultFeedAudit?.defaultHideReason || '' } };
  }), diagnostics };
}
