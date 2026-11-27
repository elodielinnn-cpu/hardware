import assert from 'node:assert/strict';
import { hideDuplicateHomepageBodies } from './body-dedupe.mjs';

const announcement = 'Vertiv introduced a new rack power system with integrated conversion, energy storage, distribution, protection, controls and safety for AI compute pods and data halls. The company described three deployment levels across racks, compute pods and data halls for operators building denser infrastructure.';
const engineering = 'The new system places power conversion outside the compute rack, freeing space for additional servers while allowing operators to retain their existing upstream AC infrastructure. This design reduces the number of conversion stages and enables mixed AC and DC workloads within the same facility.';
const boilerplate = 'Vertiv provides critical digital infrastructure for data centers and communications networks around the world, offering products and services for power and thermal management.';
const article = (id, sourceCategory, stage = 'published') => ({
  id, title: `${id} report on rack power`, sourceId: id, sourceCategory,
  sourceUrl: `https://example.com/${id}`, publishedAt: '2026-11-20',
  companies: ['Vertiv'], showByDefault: true,
  unifiedTagging: { mainEvent: { eventType: 'product', stage, actor: 'Vertiv' } },
  v3Audit: { candidateId: id }, defaultFeedAudit: {}
});
const entry = (id, paragraphs) => ({ candidateId: id, articleSnapshot: {
  id, title: `${id} report on rack power`, sourceUrl: `https://example.com/${id}`,
  bodyEvidence: paragraphs
} });

const official = article('official', 'official');
const report = article('report', 'discovery');
const distinct = article('distinct', 'discovery');
const laterAdoption = article('adoption', 'discovery', 'initial_use');
const queue = { items: [
  entry('official', [announcement, engineering, boilerplate]),
  entry('report', [announcement.replace('introduced', 'announced'),
    engineering.replace('additional servers', 'more servers'), 'A separate editorial introduction to the launch.']),
  entry('distinct', [boilerplate, 'This article describes a separate product with different specifications and a different customer project.']),
  entry('adoption', [announcement, engineering])
] };
const result = hideDuplicateHomepageBodies([report, official, distinct, laterAdoption], queue);
assert.equal(result.diagnostics.duplicatesHidden, 1);
assert.equal(result.articles.find(item => item.id === 'report').showByDefault, false);
assert.equal(result.articles.find(item => item.id === 'report').v3Audit.homepageDuplicateOf, official.sourceUrl);
assert.equal(result.articles.find(item => item.id === 'distinct').showByDefault, true);
assert.equal(result.articles.find(item => item.id === 'adoption').showByDefault, true);
assert.equal(hideDuplicateHomepageBodies([official, report], { items: [] }).diagnostics.duplicatesHidden, 0);
assert.throws(() => hideDuplicateHomepageBodies([official, report], {}), /valid V3 article cache/);
console.log('Homepage body comparison checks passed');
