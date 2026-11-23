import assert from 'node:assert/strict';
import { applyGeminiDecisions, shortenVerifiedEvidence, validAppliedPromotion, validateDecision } from './decision.mjs';
import { buildGeminiCandidates, GEMINI_REVIEW_RULE_VERSION } from './cache.mjs';

const now = new Date('2026-11-23T10:00:00Z');
const event = { id: 'p1s1', eventType: 'product', stage: 'initial_use', object: 'server system',
  objectLevel: 'server', evidence: 'The first server systems are now shipping.', relevance: 'medium', importance: 'medium' };
const make = (id, status, gate, overrides = {}) => ({ id, title: 'Server systems begin shipping',
  summary: 'The first server systems are now shipping.', sourceId: 'fixture', sourceUrl: `https://example.com/${id}`,
  publishedAt: '2026-11-22', showByDefault: status === 'accepted',
  relevance: status === 'accepted' ? '中' : '低', importance: status === 'accepted' ? '中' : '低',
  defaultFeedAudit: { defaultHideReason: status === 'accepted' ? '' : 'low_relevance', eventStage: 'occurred' },
  tags: ['通信与数据中心', '新产品'], unifiedTagging: { articleDomains: ['datacom'], mainEvent: event },
  v3Audit: { candidateId: id, decisionStatus: status, decisionGate: gate,
    evidenceSufficiency: 'sufficient', candidateDecisions: [event] }, ...overrides });
const accepted = make('accepted', 'accepted', 'accepted');
const missed = make('missed', 'rejected', 'business_relevance');
const blocked = make('blocked', 'rejected', 'input_evidence');
assert.deepEqual(buildGeminiCandidates([accepted, missed, blocked], now).map(candidate => candidate.candidateId), ['accepted', 'missed']);
const candidate = buildGeminiCandidates([missed], now)[0];
const show = { candidateId: 'missed', verdict: 'SHOW', mainEventId: 'p1s1',
  reason: 'Confirmed server shipment matters.', articleEvidence: 'now shipping' };
assert.equal(validateDecision(candidate, show).valid, true);
assert.equal(validateDecision(candidate, { ...show, articleEvidence: 'invented order' }).valid, false);
assert.equal(validateDecision(candidate, { ...show, mainEventId: 'not-an-event' }).valid, false);
const encodedEvidence = 'COLUMBUS, Ohio &mdash; Vertiv today added 800 VDC power systems for data halls. ' +
  'The architecture combines conversion, distribution and rack power to support AI deployments. '.repeat(3);
const encodedArticle = make('encoded', 'accepted', 'accepted', { v3Audit: {
  candidateId: 'encoded', decisionStatus: 'accepted', decisionGate: 'accepted',
  evidenceSufficiency: 'sufficient', candidateDecisions: [{ ...event, evidence: encodedEvidence }] } });
const encodedCandidate = buildGeminiCandidates([encodedArticle], now)[0];
const longQuote = encodedCandidate.candidateEvents[0].evidence;
const encodedOutput = { candidateId: 'encoded', verdict: 'SHOW', mainEventId: 'p1s1',
  reason: 'Concrete power architecture expansion.', articleEvidence: longQuote };
assert.ok(longQuote.length > 240);
assert.equal(validateDecision(encodedCandidate, shortenVerifiedEvidence(encodedCandidate, encodedOutput)).valid, true);
assert.equal(validateDecision(encodedCandidate, { ...encodedOutput,
  articleEvidence: 'COLUMBUS, Ohio — Vertiv today added 800 VDC power systems for data halls.' }).valid, true);
assert.equal(validateDecision(encodedCandidate, shortenVerifiedEvidence(encodedCandidate, {
  ...encodedOutput, articleEvidence: longQuote + ' Invented purchase order.' })).valid, false);
const chip = make('chip', 'rejected', 'business_relevance', { v3Audit: {
  candidateId: 'chip', decisionStatus: 'rejected', decisionGate: 'business_relevance',
  evidenceSufficiency: 'sufficient', candidateDecisions: [{ ...event, objectLevel: 'component', relevance: 'low' }],
  articleSubjects: [{ productId: 'cpu_chip', relationshipLevel: 'upstream' }], relatedLuxshareProducts: []
} });
assert.ok(validateDecision(buildGeminiCandidates([chip], now)[0], { ...show, candidateId: 'chip' }).errors.includes('business_link_not_supported'));
const record = (article, output) => { const item = buildGeminiCandidates([article], now)[0]; return {
  candidateId: item.candidateId, contentHash: item.contentHash, ruleVersion: GEMINI_REVIEW_RULE_VERSION,
  status: 'completed', reviewedAt: now.toISOString(), modelOutput: output };
};
const store = { ruleVersion: GEMINI_REVIEW_RULE_VERSION, reviews: [record(missed, show),
  record(accepted, { candidateId: 'accepted', verdict: 'HIDE', mainEventId: 'p1s1',
    reason: 'No management value.', articleEvidence: 'server systems' })] };
const result = applyGeminiDecisions([accepted, missed, blocked], store, now);
assert.equal(result.articles[0].showByDefault, false);
assert.equal(result.articles[1].showByDefault, true);
assert.equal(result.articles[2].showByDefault, false);
assert.equal(result.articles[1].homepageQualityReview.mainEventId, 'p1s1');
assert.equal(result.articles[1].relevance, '中');
assert.equal(result.articles[1].importance, '中');
assert.equal(result.articles[1].defaultFeedAudit.defaultHideReason, '');
assert.equal(result.articles[1].defaultFeedAudit.eventStage, 'occurred');
assert.equal(validAppliedPromotion(result.articles[1], now), true);
assert.equal(validAppliedPromotion({ ...result.articles[1], homepageQualityReview: {
  ...result.articles[1].homepageQualityReview, articleEvidence: 'fabricated evidence' } }, now), false);
assert.equal(result.diagnostics.shown, 1);
assert.equal(result.diagnostics.hidden, 1);
const unreviewed = applyGeminiDecisions([accepted], { ruleVersion: GEMINI_REVIEW_RULE_VERSION, reviews: [] }, now);
assert.equal(unreviewed.articles[0].showByDefault, false);
assert.equal(unreviewed.articles[0].defaultFeedAudit.defaultHideReason, 'cloud_review_pending');
assert.equal(unreviewed.diagnostics.pending, 1);
const uncertain = applyGeminiDecisions([accepted], { ruleVersion: GEMINI_REVIEW_RULE_VERSION,
  reviews: [record(accepted, { candidateId: 'accepted', verdict: 'UNCERTAIN', mainEventId: 'none',
    reason: 'Business effect is unclear.', articleEvidence: 'server systems' })] }, now);
assert.equal(uncertain.articles[0].showByDefault, false);
assert.equal(uncertain.diagnostics.uncertain, 1);
assert.equal(uncertain.diagnostics.invalid, 0);
const changed = applyGeminiDecisions([{ ...missed, summary: 'New text about a different system.' }], store, now);
assert.equal(changed.articles[0].showByDefault, false);
const old = applyGeminiDecisions([missed], store, new Date(now.getTime() + 31 * 86400000));
assert.equal(old.articles[0].showByDefault, false);
console.log('Cloud decision and program-gate regression passed');
