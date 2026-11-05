import assert from 'node:assert/strict';
import { articleId, encodeCsv, parseCsv, reviewRecords, reviewHeaders, validateLabels, metrics } from './audit.mjs';
import { parseResponse, classifyResponse, diagnosticOf } from './fetch.mjs';

const quotedRows = [['编号', '中文'], ['one', '引号"、逗号,和\n换行'], ['two', '']];
assert.deepEqual(parseCsv(encodeCsv(quotedRows)), quotedRows);
assert.equal(parseCsv('a,b\r\n1,2\r\n').length, 2);
assert.throws(() => parseCsv('a,"unfinished'), /unclosed/);
assert.throws(() => parseCsv('"value"garbage,b'), /unexpected text/);
assert.throws(() => reviewRecords('a,b\n1,2,3'), /number of columns/);

const articles = ['入选', '入选', '排除', '待定'].map((result, index) => ({
  title: `Synthetic fixture ${index}`, url: `https://example.com/fixture/${index}`,
  bodyEvidence: ['The cold plate was redesigned to lower thermal resistance.'], decision: { result }
}));
const rows = articles.map((article, index) => ({
  ...Object.fromEntries(reviewHeaders.map(header => [header, ''])),
  编号: articleId(article), 原文链接: article.url, 人工结果: index === 1 ? '排除' : '入选',
  人工关系: '直接', 变化对象: 'cold plate', 具体变化: 'redesigned', 对应产品: '服务器冷板',
  变化原句: article.bodyEvidence[0], 业务或影响原句: article.bodyEvidence[0], 人工理由: 'Synthetic label for scorer validation'
}));
const labels = validateLabels(articles, rows);
const original = metrics(labels, article => article.decision.result);
assert.equal(original.admissionPrecision, 0.5);
assert.equal(original.selectionRecall, 1 / 3);
assert.equal(original.falseExclusions.length, 1);
assert.equal(original.heldBackRelevant.length, 1);
assert.equal(original.falseAdmissions.length, 1);
const changed = metrics(labels, article => [articles[0].url, articles[2].url].includes(article.url) ? '入选' : article.url === articles[3].url ? '待定' : '排除');
assert.equal(changed.admissionPrecision, 1);
assert.equal(changed.selectionRecall, 2 / 3);
const blankRows = rows.map(row => ({ ...row, 人工结果: '' }));
assert.equal(validateLabels(articles, blankRows).length, 0);
assert.equal(metrics([], article => article.decision.result).admissionPrecision, null);
assert.equal(metrics([], article => article.decision.result).selectionRecall, null);
assert.throws(() => validateLabels(articles, rows.slice(1)), /retain every row/);
assert.throws(() => validateLabels(articles, [rows[0], rows[0], ...rows.slice(2)]), /duplicate/);
assert.throws(() => validateLabels(articles, rows.map((row, index) => index ? row : { ...row, 变化原句: 'invented quote' })), /outside/);
const supplemented = validateLabels(articles, rows.map((row, index) => index ? row : { ...row, 变化原句: 'Supplemental source text.', 补充原文: 'Supplemental source text.' }));
assert.equal(supplemented[0].evidenceBasis, 'reviewer_supplement');

const output = 'HTTP/1.1 200 Connection established\r\n\r\nHTTP/2 302\r\nlocation: https://example.com/feed\r\n\r\nHTTP/2 200\r\nserver: nginx\r\ncontent-type: application/rss+xml\r\nset-cookie: secret-cookie\r\n\r\n<rss><item/></rss>\n__NEWS_HTTP_RESULT__200\tapplication/rss+xml\thttps://example.com/feed\n';
const response = parseResponse(output);
assert.equal(response.body, '<rss><item/></rss>');
assert.equal(response.headers.server, 'nginx');
assert.equal(response.httpStatus, 200);
assert.equal(classifyResponse(response), 'ok');
assert.equal(classifyResponse({ ...response, httpStatus: 403, headers: { 'cf-mitigated': 'challenge' } }), 'verification_page');
assert.equal(classifyResponse({ ...response, httpStatus: 403 }), 'http_forbidden');
assert.equal(classifyResponse({ ...response, httpStatus: 404 }), 'http_not_found');
assert.equal(classifyResponse({ ...response, httpStatus: 429 }), 'rate_limited');
assert.equal(classifyResponse(response, 6), 'dns_failure');
assert.equal(classifyResponse(response, 28), 'timeout');
assert.equal(classifyResponse(response, 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'), 'response_too_large');
assert.equal(classifyResponse({ ...response, body: '<article>Article</article><script src="/challenge-platform/jsd.js"></script>' }), 'ok');
assert.ok(!JSON.stringify(diagnosticOf(response)).includes('secret-cookie'));
console.log('Audit CSV parsing, label validation, metric denominators, version comparison, HTTP diagnostics and cookie redaction checks passed');
