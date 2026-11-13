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
assert.equal(review.unifiedTagging.mainEvent?.stage, 'unknown');
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

const cpuRack = evaluate('Vendor CPU Rack launched', ['A manufacturer introduced a new CPU Rack for AI data centers with integrated cabling, power and cooling.']);
assert.equal(cpuRack.effectiveRelevance, 'high');
assert.ok(cpuRack.productMatches.articleSubjects.some(item => item.productId === 'ai_rack_scale_integration'));

const adjacentSsd = evaluate('Enterprise SSD announced', [
  'A vendor announced an enterprise SSD for cloud servers with lower power draw. The vendor says it is in volume production and running in customer environments.'
]);
assert.equal(adjacentSsd.unifiedTagging.mainEvent?.stage, 'scale_use');
assert.equal(adjacentSsd.defaultVisible, false);

const adjacentThermal = evaluate('New rear-door cooling technology for data centers', [
  'A supplier validated a rear-door aluminum heat exchanger for data-center racks. Testing showed a 38% cooling capacity increase and a 25% reduction in fan power versus copper alternatives.'
]);
assert.equal(adjacentThermal.effectiveRelevance, 'medium');
assert.equal(adjacentThermal.effectivePriority, 'medium');
assert.equal(adjacentThermal.admissionPath, 'validated_adjacent_thermal_impact');
assert.equal(adjacentThermal.defaultVisible, true);

console.log('Unified V3 event, review, actor and missing-date checks passed');
