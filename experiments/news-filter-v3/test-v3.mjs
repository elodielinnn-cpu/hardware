import assert from 'node:assert/strict';
import { loadBusinessProfile } from './business-profile.mjs';
import { evaluateArticleV3 } from './news-filter-v3.mjs';

const profile = await loadBusinessProfile(new URL('../../config/luxshare-business-profile.json', import.meta.url));
const evaluate = (title, bodyEvidence, publishedAt = '2026-11-12') => evaluateArticleV3({
  title, sourceId: 'synthetic', publishedAt, bodyEvidence, summary: bodyEvidence.join(' ')
}, profile);

const launch = evaluate('New server rack announced', ['Lenovo announced a new liquid-cooled server rack system for data centers with 100 kW density.']);
assert.equal(launch.unifiedTagging.mainEvent?.eventType, 'product');
assert.equal(launch.unifiedTagging.mainEvent?.stage, 'published');
assert.equal(launch.effectiveRelevance, 'high');

const review = evaluate('Server rack review', ['Our testing measured a 25% improvement in server rack power efficiency and found lower cooling demand at 100 kW.']);
assert.equal(review.unifiedTagging.mainEvent?.eventType, 'technology');
assert.equal(review.unifiedTagging.mainEvent?.stage, 'validation');
assert.equal(review.retained, true);

const unrelated = evaluate('Meta data center deployment', [
  'Meta deployed a new server rack system at its data center in Texas.',
  'CoreWeave deployed a separate server rack system at another site.'
]);
assert.equal(unrelated.unifiedTagging.mainEvent?.actor, 'Meta');
assert.equal(unrelated.unifiedTagging.mainEvent?.paragraphId, 1);

const undated = evaluate('Server rack launched', ['Lenovo introduced a new liquid-cooled server rack system for data centers.'], null);
assert.equal(undated.retained, true);
assert.equal(undated.defaultVisible, false);
assert.ok(undated.reasonCodes.includes('published_at_missing'));

console.log('Unified V3 event, review, actor and missing-date checks passed');
