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

for (const title of ['Apple announces iPhone manufacturing partners', 'New microphone for creators launched']) {
  const consumer = evaluate(title, [`${title}. The product is now commercially available.`]);
  assert.equal(consumer.retained, false);
  assert.equal(consumer.exclusionReason, 'consumer_story_out_of_scope');
}

const adjacentThermal = evaluate('New rear-door cooling technology for data centers', [
  'A supplier validated a rear-door aluminum heat exchanger for data-center racks. Testing showed a 38% cooling capacity increase and a 25% reduction in fan power versus copper alternatives.'
]);
assert.equal(adjacentThermal.effectiveRelevance, 'medium');
assert.equal(adjacentThermal.effectivePriority, 'medium');
assert.equal(adjacentThermal.admissionPath, 'validated_adjacent_thermal_impact');
assert.equal(adjacentThermal.defaultVisible, true);

const confirmedLeadership = evaluate('NVIDIA CEO transition', [
  'NVIDIA announced that its CEO resigned effective immediately.',
  'In an official press release, the board announced an interim CEO to lead the AI infrastructure company.'
]);
assert.equal(confirmedLeadership.admissionPath, 'strategic_leadership_change');
assert.equal(confirmedLeadership.unifiedTagging.mainEvent?.eventType, 'operations');
const unconfirmedLeadership = evaluate('NVIDIA CEO transition rumor', [
  'Anonymous sources say the CEO may resign from NVIDIA, but the company has not confirmed a change.'
]);
assert.equal(unconfirmedLeadership.defaultVisible, false);

const twoAnnouncements = evaluate('HPE Cray E2000 hybrid storage moves to 32TB SAS-4 HDDs', [
  'HPE has added hybrid flash and hard drive configurations to its Cray Supercomputing Storage Systems E2000, pairing SSDs with new 32TB SAS-4 HDDs in new SAS-4 enclosures that hold 74 or 100 drives. Alongside the storage update, HPE introduced a Rack Management Controller with liquid cooling monitoring and leak detection for dense racks.'
]);
assert.equal(twoAnnouncements.admissionPath, 'rack_cooling_control_launch');
assert.notEqual(twoAnnouncements.unifiedTagging.homepageEvent?.id, twoAnnouncements.unifiedTagging.mainEvent?.id);
assert.ok(twoAnnouncements.unifiedTagging.homepageEvent?.evidence.includes('Controller'));

console.log('Unified V3 event, review, actor and missing-date checks passed');
