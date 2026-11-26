import assert from 'node:assert/strict';
import { loadBusinessProfile } from './business-profile.mjs';
import { mergeDeferredQueue, recordDeferredOutcomes, reusableArticleSnapshot } from './deferred-queue.mjs';
import { evaluateArticleV3, hideDuplicateHomepageEvents } from './news-filter-v3.mjs';

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
assert.equal(adjacentThermal.admissionPath, 'product_technology_change');
assert.equal(adjacentThermal.defaultVisible, true);

const confirmedLeadership = evaluate('NVIDIA CEO transition', [
  'NVIDIA announced that its CEO resigned effective immediately.',
  'In an official press release, the board announced an interim CEO to lead the AI infrastructure company.'
]);
assert.equal(confirmedLeadership.admissionPath, 'strategic_business_change');
assert.equal(confirmedLeadership.unifiedTagging.mainEvent?.eventType, 'operations');
const unconfirmedLeadership = evaluate('NVIDIA CEO transition rumor', [
  'Anonymous sources say the CEO may resign from NVIDIA, but the company has not confirmed a change.'
]);
assert.equal(unconfirmedLeadership.defaultVisible, false);

const twoAnnouncements = evaluate('HPE Cray E2000 hybrid storage moves to 32TB SAS-4 HDDs', [
  'HPE has added hybrid flash and hard drive configurations to its Cray Supercomputing Storage Systems E2000, pairing SSDs with new 32TB SAS-4 HDDs in new SAS-4 enclosures that hold 74 or 100 drives. Alongside the storage update, HPE introduced a Rack Management Controller with liquid cooling monitoring and leak detection for dense racks.'
]);
assert.equal(twoAnnouncements.admissionPath, 'product_technology_change');
assert.equal(twoAnnouncements.unifiedTagging.homepageEvent?.id, twoAnnouncements.unifiedTagging.mainEvent?.id);
assert.ok(twoAnnouncements.unifiedTagging.homepageEvent?.evidence.includes('Controller'));
const reversedAnnouncements = evaluate('HPE Cray E2000 hybrid storage and rack management update', [
  'HPE introduced a Rack Management Controller with liquid cooling monitoring and leak detection for dense racks. HPE has added hybrid flash and hard drive configurations to Cray E2000 storage.'
]);
assert.ok(reversedAnnouncements.unifiedTagging.homepageEvent?.evidence.includes('Controller'));

const availability = evaluate('NetApp introduces Novus data center system', [
  'NetApp announced the Novus data center system for AI racks. The first configuration is orderable today.'
]);
assert.equal(availability.unifiedTagging.mainEvent?.availability, 'orderable');
assert.equal(availability.unifiedTagging.mainEvent?.stage, 'published');

const allegedInvestment = evaluate('NVIDIA allegedly funded AI startups', [
  'A report alleges that NVIDIA invested in AI startups to purchase GPUs for data centers.'
]);
assert.equal(allegedInvestment.defaultVisible, false);

const summaryOnly = evaluateArticleV3({
  title: 'Google adds TPU systems', sourceId: 'synthetic', publishedAt: '2026-11-12',
  summary: 'Google added two systems to its eighth-generation TPU lineup: TPU 8tx and TPU 8i Max.',
  evidenceAvailability: 'summary_only'
}, profile);
assert.equal(summaryOnly.unifiedTagging.mainEvent?.eventType, 'product');

const incompleteInput = evaluateArticleV3({
  title: 'Datacenter infrastructure update', sourceId: 'synthetic', publishedAt: '2026-11-12',
  summary: 'A source discusses infrastructure.', evidenceAvailability: 'summary_only'
}, profile);
assert.equal(incompleteInput.decisionStatus, 'needs_review');
assert.equal(incompleteInput.effectiveRelevance, 'unknown');
assert.equal(incompleteInput.effectivePriority, 'unknown');

const summaryAndExcerpt = evaluateArticleV3({
  title: 'Marvell introduces an AEC DSP for AI racks', sourceId: 'synthetic', publishedAt: '2026-11-12',
  summary: 'Marvell introduced a new AEC DSP with improved power efficiency for active electrical cables used across AI racks.',
  bodyEvidence: ['The new AEC DSP is sampling to customers.'], evidenceAvailability: 'full_text'
}, profile);
assert.equal(summaryAndExcerpt.unifiedTagging.mainEvent?.eventType, 'product');
assert.ok(summaryAndExcerpt.productMatches.relatedLuxshareProducts.some(item => item.productId === 'active_electrical_cable'));
assert.ok(!summaryAndExcerpt.productMatches.articleSubjects.some(item => item.productId === 'ai_rack_scale_integration'));

const specifiedRack = evaluate('Supermicro Vera CPU Rack with 256 CPUs', [
  'Supermicro announced the Vera CPU rack, a 48U liquid-cooled rack that holds 256 Vera CPUs for data centers.'
]);
assert.ok(specifiedRack.productMatches.articleSubjects.some(item => item.productId === 'ai_rack_scale_integration'));

const actualSite = evaluate('Polar deploys AI data center infrastructure', [
  'Polar Data Centers is applying the factory-built deployment approach to the first 41 MW phase of its AI data center at a Norway site.'
]);
assert.equal(actualSite.unifiedTagging.mainEvent?.stage, 'initial_use');

const strategicResults = evaluate('NVIDIA reports quarterly revenue', [
  'NVIDIA reported third-quarter revenue of $115.8 billion as demand for AI data centers grew.',
  'NVIDIA began ramping production of its next-generation Vera Rubin NVL72 rack-scale AI computing system.'
]);
assert.equal(strategicResults.unifiedTagging.mainEvent?.eventType, 'operations');
assert.equal(strategicResults.admissionPath, 'strategic_business_change');
assert.equal(strategicResults.unifiedTagging.candidateEvents.length >= 2, true);
assert.equal(strategicResults.unifiedTagging.mainEvent?.objectLevel, 'business');

const cpoDeployment = evaluate('Production co-packaged optics in AI data center', [
  'Lambda disclosed that it deployed co-packaged optics in a production cluster with 10,000 GPUs for AI data center training.'
]);
assert.equal(cpoDeployment.admissionPath, 'product_technology_change');
assert.equal(cpoDeployment.unifiedTagging.mainEvent?.objectLevel, 'component');
assert.equal(cpoDeployment.unifiedTagging.mainEvent?.stage, 'initial_use');

const liquidStorage = evaluate('Dell announces liquid-cooled storage platform for AI racks', [
  'Dell announced a 2-OU direct-liquid-cooled storage platform for AI racks with 32 NVMe drives.',
  'Dell Exascale uses cold plates on every heat-producing part, with no fans, so storage can share the rack coolant supply.'
]);
assert.equal(liquidStorage.admissionPath, 'product_technology_change');
assert.equal(liquidStorage.unifiedTagging.mainEvent?.objectLevel, 'component');
assert.ok(!liquidStorage.productMatches.articleSubjects.some(item => item.productId === 'ai_rack_scale_integration'));

const shippingServer = evaluate('Supermicro ships first all-flash storage servers', [
  'The first server systems, now shipping, include a Petascale server powered by AMD EPYC processors.'
]);
assert.equal(shippingServer.admissionPath, 'product_technology_change');
assert.equal(shippingServer.unifiedTagging.mainEvent?.objectLevel, 'server');
assert.equal(shippingServer.unifiedTagging.mainEvent?.stage, 'initial_use');

const supplyRisk = evaluate('Server power supply shortage constrains data center buildout', [
  'The manufacturer confirmed a shortage of server power supplies and delayed data center rack production because available capacity cannot meet orders.'
]);
assert.equal(supplyRisk.admissionPath, 'industry_demand_cost_risk');

const engineering = evaluate('Liquid-cooled rack engineering analysis', [
  'Measured rack power density reached 100 kW, which requires larger cold plates to limit cooling demand in server systems.'
]);
assert.equal(engineering.admissionPath, 'engineering_analysis');

const missingBody = evaluateArticleV3({ title: 'Vendor ships new server platform', sourceId: 'synthetic',
  publishedAt: '2026-11-12', summary: 'The source did not provide enough attributable summary evidence.',
  evidenceAvailability: 'summary_only' }, profile);
assert.equal(missingBody.decisionStatus, 'needs_review');
assert.equal(missingBody.decisionGate, 'input_evidence');

const ordinaryChip = evaluate('Intel publishes accelerator chip specification', [
  'Intel published the chip clock speed and cache specifications for a new accelerator.'
]);
assert.equal(ordinaryChip.defaultVisible, false);
const advertisement = evaluate('Save 25% on a software license this weekend sale', [
  'Enter the promo code to get a discount on an app.'
]);
assert.equal(advertisement.defaultVisible, false);
const rumorOnly = evaluate('TSMC reportedly changes chip customer terms', [
  'Anonymous sources say TSMC may change customer payment terms for chip production.'
]);
assert.equal(rumorOnly.defaultVisible, false);

const executiveAcronym = evaluate('Altera FPGA quantum controller for data centers', [
  'Simon Phillips, CPO at OQC, said the FPGA gives the company a programmable connection to its quantum processor.'
]);
assert.ok(!executiveAcronym.productMatches.articleSubjects.some(item => item.productId === 'cpo_solution'));

const supplyCommitment = evaluate('NVIDIA expands commitments with supply chain partners', [
  'NVIDIA announced expanded commitments with supply chain partners to support AI infrastructure buildout.',
  'NVIDIA is expanding manufacturing capacity with its partners across advanced packaging and contract manufacturing.'
]);
assert.equal(supplyCommitment.unifiedTagging.mainEvent?.eventType, 'partnership');

const financialCopies = hideDuplicateHomepageEvents([
  { id: 'brief', title: 'NVIDIA reports $115.8B revenue', sourceId: 'eetimes', sourceUrl: 'https://example.com/brief',
    publishedAt: '2026-11-19', summary: 'Brief result.', showByDefault: true,
    unifiedTagging: { mainEvent: { eventType: 'operations', evidence: 'NVIDIA reported revenue of $115.8 billion.' } },
    defaultFeedAudit: {}, v3Audit: {} },
  { id: 'detail', title: 'NVIDIA revenue reaches $115.8 billion', sourceId: 'tomshardware', sourceUrl: 'https://example.com/detail',
    publishedAt: '2026-11-20', summary: 'A detailed explanation of the same quarterly result.', showByDefault: true,
    unifiedTagging: { mainEvent: { eventType: 'operations', evidence: 'NVIDIA reported revenue of $115.8 billion.' } },
    defaultFeedAudit: {}, v3Audit: {} }
]);
assert.equal(financialCopies.filter(item => item.showByDefault).length, 1);
assert.equal(financialCopies.find(item => item.id === 'brief').v3Audit.homepageDuplicateOf, 'https://example.com/detail');

const fiscalReportCopies = hideDuplicateHomepageEvents([
  { id: 'official', title: 'Dell Technologies Delivers Third Quarter Fiscal 2027 Financial Results',
    sourceId: 'dell_press', sourceCategory: 'official', sourceUrl: 'https://example.com/dell-q3',
    publishedAt: '2026-11-24', summary: 'Dell reports total revenue of $54.9 billion.', showByDefault: true,
    unifiedTagging: { mainEvent: { eventType: 'operations', evidence: 'Dell reported total revenue of $54.9 billion.' } },
    defaultFeedAudit: {}, v3Audit: {} },
  { id: 'reprint', title: '(PR) Dell Technologies Delivers Third Quarter Fiscal 2027 Financial Results',
    sourceId: 'techpowerup', sourceCategory: 'discovery', sourceUrl: 'https://example.com/reprint-q3',
    publishedAt: '2026-11-24', summary: 'AI server revenue reached $22 billion.', showByDefault: true,
    unifiedTagging: { mainEvent: { eventType: 'operations', evidence: 'AI server revenue reached $22 billion.' } },
    defaultFeedAudit: {}, v3Audit: {} },
  { id: 'different-quarter', title: 'Dell Technologies Delivers Fourth Quarter Fiscal 2027 Financial Results',
    sourceId: 'eetimes', sourceCategory: 'discovery', sourceUrl: 'https://example.com/dell-q4',
    publishedAt: '2027-02-24', summary: 'Dell reports a different quarter.', showByDefault: true,
    unifiedTagging: { mainEvent: { eventType: 'operations', evidence: 'Dell reported revenue of $57 billion.' } },
    defaultFeedAudit: {}, v3Audit: {} }
]);
assert.equal(fiscalReportCopies.filter(item => item.showByDefault).length, 2);
assert.equal(fiscalReportCopies.find(item => item.id === 'reprint').v3Audit.homepageDuplicateOf, 'https://example.com/dell-q3');
assert.equal(fiscalReportCopies.find(item => item.id === 'official').showByDefault, true);
assert.equal(fiscalReportCopies.find(item => item.id === 'different-quarter').showByDefault, true);

const oldSnapshot = mergeDeferredQueue({ version: 1, items: [] }, [{
  candidateId: 'cache-example', sourceId: 'example', title: 'Cached article',
  url: 'https://example.com/cache', publishedAt: '2026-11-25'
}], '2026-11-25T00:00:00.000Z');
const completedSnapshot = recordDeferredOutcomes(oldSnapshot, [{
  candidateId: 'cache-example', status: 'completed',
  articleSnapshot: { id: 'old', evidenceAvailability: 'summary_only' }
}], '2026-11-25T01:00:00.000Z');
assert.equal(reusableArticleSnapshot(completedSnapshot.items[0], 'v3-article-body-2'), false);
const refreshedSnapshot = recordDeferredOutcomes(completedSnapshot, [{
  candidateId: 'cache-example', status: 'completed', articleSnapshotVersion: 'v3-article-body-2',
  articleSnapshot: { id: 'new', evidenceAvailability: 'full_text' }
}], '2026-11-26T01:00:00.000Z');
assert.equal(reusableArticleSnapshot(refreshedSnapshot.items[0], 'v3-article-body-2'), true);
assert.equal(reusableArticleSnapshot(refreshedSnapshot.items[0], 'v3-article-body-3'), false);
assert.equal(refreshedSnapshot.items[0].articleSnapshot.id, 'new');

console.log('Unified V3 event, review, actor and missing-date checks passed');
