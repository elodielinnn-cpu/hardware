import assert from 'node:assert/strict';
import { loadBusinessProfile } from '../news-filter-v3/business-profile.mjs';
import { screen } from './screen.mjs';

const profile = await loadBusinessProfile(new URL('../../config/luxshare-business-profile.json', import.meta.url));
const article = { sourceId: 'test', title: 'Apple manufacturing partners', summary: '', bodyStatus: 'ok', bodyEvidence: [] };
assert.equal(screen({ ...article, title: 'Black Friday MacBook deals' }, profile).result, '排除');
assert.equal(screen({ ...article, title: 'Apple manufacturing program partners', bodyStatus: 'fetch_failed' }, profile).result, '待定');
assert.equal(screen({ ...article, title: 'Apple introduces MacBook Pro', bodyEvidence: ['It offers a display, six speakers and a wide array of ports.'] }, profile).result, '待定');
assert.equal(screen({ ...article, bodyEvidence: ['Apple selected manufacturing partners and expanded factory capacity for iPhone production.'] }, profile).result, '入选');
assert.equal(screen({ ...article, title: 'Apple reports quarterly results', bodyEvidence: ['Apple provides investor relations information and annual meeting of shareholders materials.'] }, profile).result, '待定');
assert.equal(screen({ ...article, title: 'Formula 1 streams live on Apple TV' }, profile).result, '排除');
console.log('6 focused screening checks passed');
