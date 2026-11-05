import assert from 'node:assert/strict';
import { loadBusinessProfile } from '../news-filter-v3/business-profile.mjs';
import { screen } from './screen.mjs';
import { clean, extractBody } from './extract.mjs';

const profile = await loadBusinessProfile(new URL('../../config/luxshare-business-profile.json', import.meta.url));
const article = { sourceId: 'test', title: 'Hardware update', summary: '', bodyStatus: 'ok', bodyEvidence: [] };
const cases = [
  ['different objects in joined clauses', { bodyEvidence: ['The GPU architecture was upgraded and the device contains a speaker.'] }, '待定'],
  ['unrelated reduction in same sentence', { bodyEvidence: ['Apple reduced employee costs, while the speaker retains its existing design.'] }, '排除'],
  ['working scope structural change', { bodyEvidence: ['The manufacturer redesigned the phone hinge to improve durability.'] }, '入选'],
  ['historical coverage is not a new update', { bodyEvidence: ['As we saw in our coverage from OCP 2025, the optical engine replaces long copper traces.'] }, '排除'],
  ['promotion only', { title: 'Black Friday MacBook deals' }, '排除'],
  ['missing body', { title: 'Apple changes suppliers', bodyStatus: 'fetch_failed' }, '待定'],
  ['configuration only', { title: 'Apple introduces MacBook Pro', bodyEvidence: ['It offers a display, six speakers and a wide array of ports.'] }, '排除'],
  ['brand cannot bypass product gate', { bodyEvidence: ['Apple selected manufacturing partners and expanded factory capacity for iPhone production.'] }, '排除'],
  ['supplier changes acoustic module', { bodyEvidence: ['Apple selected a new supplier for the iPhone acoustic module.'] }, '入选'],
  ['hardware change without Luxshare name', { bodyEvidence: ['The manufacturer redesigned the speaker diaphragm to reduce its thickness.'] }, '入选'],
  ['different sentence object', { bodyEvidence: ['Apple reduced employee spending limits. The MacBook has six speakers.'] }, '排除'],
  ['different paragraph object', { bodyEvidence: ['The processor manufacturer expanded production capacity.', 'The device has a speaker and microphone.'] }, '待定'],
  ['background supplier mention', { bodyEvidence: ['The supplier makes speaker modules for smartphones.'] }, '排除'],
  ['negated change', { bodyEvidence: ['Apple has not replaced the supplier of the acoustic module.'] }, '排除'],
  ['body must confirm summary', { summary: 'Apple replaced the supplier of its acoustic module.', bodyEvidence: ['The device has a microphone.'] }, '待定'],
  ['explicit same paragraph reference', { bodyEvidence: ['The speaker uses a thin diaphragm. It adopts a new magnet design.'] }, '入选'],
  ['rumor stays pending', { title: 'Apple reportedly changes speaker suppliers', bodyEvidence: ['Apple replaced the supplier of the speaker.'] }, '待定'],
  ['upstream stays pending', { bodyEvidence: ['The manufacturer upgraded the GPU architecture.'] }, '待定'],
  ['uncertain camera scope', { bodyEvidence: ['The smartphone camera module adopts a new lens design.'] }, '待定'],
  ['other domains use the same gates', { bodyEvidence: ['The server manufacturer redesigned the cold plate to improve thermal performance.'] }, '入选'],
  ['software does not establish hardware update', { bodyEvidence: ['The speaker firmware was upgraded to support new voice commands.'] }, '排除'],
  ['cost cut unrelated to products', { title: 'Apple reduces employee AI token allowances', bodyEvidence: ['Apple reduced employee token allowances from $300 to $200.'] }, '排除']
];
for (const [name, input, expected] of cases) {
  const result = screen({ ...article, ...input }, profile);
  assert.equal(result.result, expected, name);
  if (result.result === '入选') {
    assert.equal(result.eventGate, 'passed', name);
    assert.equal(result.businessGate, 'passed', name);
    assert.ok(result.eventEvidence && result.businessEvidence && result.affectedProducts.length, name);
  }
}
console.log(`${cases.length} two-stage screening cases passed`);

const paragraph = 'The server platform adopts new liquid cooling hardware and changes rack power requirements. '.repeat(4);
const wordpress = `<main><div class="container med post-content"><div><p>${paragraph}</p></div><p>Short but useful technical evidence.</p></div><aside><article><p>Sidebar recommendation.</p></article></aside></main>`;
const wordpressResult = extractBody(wordpress);
assert.equal(wordpressResult.bodyStatus, 'ok');
assert.equal(wordpressResult.bodySelector, '.post-content');
assert.equal(wordpressResult.bodyEvidence.length, 2);
assert.ok(!wordpressResult.bodyEvidence.join(' ').includes('Sidebar'));
const chinese = extractBody(`<div id='paragraph' class='post_content'><div><p>${'服务器采用液冷方案，调整机柜供电要求。'.repeat(20)}</p></div></div>`);
assert.equal(chinese.bodyStatus, 'ok');
assert.equal(chinese.bodySelector, '#paragraph');
assert.equal(extractBody(`<article><p>${paragraph}</p></article>`).bodyStatus, 'ok');
assert.equal(extractBody('<title>Just a moment</title><div class="cf-chl-test">Verify</div>').bodyStatus, 'blocked');
assert.equal(extractBody('<main><p>Short article.</p></main>').bodyStatus, 'insufficient');
assert.equal(clean('&lt;p&gt;正文 &amp; 原句&lt;/p&gt;'), '正文 & 原句');
console.log('10 extraction regression assertions passed');
