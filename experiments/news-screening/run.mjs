import fs from 'node:fs/promises';
import { loadBusinessProfile } from '../news-filter-v3/business-profile.mjs';
import { screen } from './screen.mjs';
import { clean, extractBody } from './extract.mjs';
import { isConsumerStory, scopeVersion } from './scope.mjs';
import { fetchDocument, diagnosticOf } from './fetch.mjs';

const root = new URL('../../', import.meta.url);
const profile = await loadBusinessProfile(new URL('config/luxshare-business-profile.json', root));
const sources = [
  ['ServeTheHome', 'https://www.servethehome.com/feed/', 'datacom'],
  ['StorageReview', 'https://www.storagereview.com/feed', 'datacom'],
  ['Electrek', 'https://electrek.co/feed/', 'automotive'],
  ['DCD', 'https://www.datacenterdynamics.com/en/rss/', 'datacom'],
  ['ADAS & Autonomous Vehicle International', 'https://www.autonomousvehicleinternational.com/feed', 'automotive']
];
function field(block, name) {
  return block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] || '';
}
const replay = process.argv.includes('--replay');
const refetch = process.argv.includes('--refetch');
const previous = replay || refetch ? JSON.parse(await fs.readFile(new URL('outputs/news-screening/latest.json', root), 'utf8')) : null;
const warnings = previous?.warnings || [];
const sourceDiagnostics = previous?.sourceDiagnostics || [];
const candidates = previous?.articles || [];
const seen = new Set();
for (const [sourceId, url, sourceDomain] of replay || refetch ? [] : sources) {
  try {
    const response = await fetchDocument(url);
    sourceDiagnostics.push({ sourceId, ...diagnosticOf(response) });
    const xml = response.body;
    const blocks = xml.match(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi) || [];
    sourceDiagnostics.at(-1).feedEntries = blocks.length;
    if (!blocks.length) {
      sourceDiagnostics.at(-1).reason = 'feed_parse_failure';
      throw new Error('HTTP response contained no RSS/Atom entries');
    }
    for (const block of blocks.slice(0, 20)) {
      const link = clean(field(block, 'link')) || block.match(/<link\b[^>]*href="([^"]+)"/)?.[1];
      const title = clean(field(block, 'title'));
      if (!link || !title || seen.has(link)) continue;
      seen.add(link);
      const rssHtml = field(block, 'content:encoded') || field(block, 'description') || field(block, 'content');
      const rssBodyEvidence = extractBody(`<article>${rssHtml}</article>`).bodyEvidence.filter(text => !/^Continue reading|^The post .+ appeared first on/iu.test(text));
      candidates.push({ sourceId, sourceDomain, rssBodyEvidence, title, url: link, publishedAt: clean(field(block, 'pubDate') || field(block, 'published') || field(block, 'updated')), summary: clean(field(block, 'description') || field(block, 'summary') || field(block, 'content')), bodyEvidence: [] });
    }
    console.log(`${sourceId}: ${blocks.length} feed entries`);
  } catch (error) {
    if (error.fetchDiagnostics) sourceDiagnostics.push({ sourceId, ...error.fetchDiagnostics });
    warnings.push(`${sourceId}: ${error.message.split('\n')[0]}`);
  }
}
// Drop clearly consumer-led items before detail fetching. Replayed records also pass this filter.
const articles = candidates.filter(article => !isConsumerStory(article));
// Batch detail requests to keep source load and cloud runtime bounded.
for (let offset = 0; offset < articles.length; offset += 5) {
  await Promise.all(articles.slice(offset, offset + 5).map(async article => {
    if (replay) {
      article.decision = screen(article, profile);
      return;
    }
    try {
      const response = await fetchDocument(article.url);
      article.webFetchDiagnostics = diagnosticOf(response);
      const html = response.body;
      delete article.webBodyStatus;
      Object.assign(article, extractBody(html));
      article.bodyFetchedAt = new Date().toISOString();
      article.bodyError = '';
      article.evidenceSource = 'web_page';
    } catch (error) {
      article.bodyEvidence = [];
      article.bodyStatus = 'fetch_failed';
      article.bodySelector = '';
      article.bodyCharacters = 0;
      article.bodyFetchedAt = new Date().toISOString();
      article.bodyError = error.fetchDiagnostics?.reason || 'request_failed';
      article.webFetchDiagnostics = error.fetchDiagnostics || null;
      article.evidenceSource = 'unavailable';
    }
    if (article.bodyStatus !== 'ok' && article.rssBodyEvidence?.join(' ').length >= 250) {
      article.webBodyStatus = article.bodyStatus;
      article.bodyEvidence = article.rssBodyEvidence;
      article.bodyStatus = 'rss_evidence';
      article.bodySelector = 'RSS paragraphs';
      article.bodyCharacters = article.bodyEvidence.join(' ').length;
      article.evidenceSource = 'rss_excerpt';
    }
    article.decision = screen(article, profile);
  }));
  console.log(`Processed ${Math.min(offset + 5, articles.length)}/${articles.length}`);
}
if (!candidates.length) throw new Error(`All sources failed: ${warnings.join(' | ')}`);
const inScopeArticles = articles.filter(article => article.decision.inScope);
const sourceFailures = warnings.length;
const candidateCount = previous?.scopeVersion === scopeVersion ? previous.candidateCount ?? candidates.length : candidates.length;
const outOfScopeRemoved = candidateCount - inScopeArticles.length;
const report = { fetchedAt: previous?.fetchedAt || new Date().toISOString(), evaluatedAt: new Date().toISOString(), scopeVersion, profileStatus: profile.profile.profileStatus, candidateCount, outOfScopeRemoved, sourceFailures, warnings, sourceDiagnostics, articles: inScopeArticles };
const output = new URL('outputs/news-screening/', root);
await fs.mkdir(output, { recursive: true });
await fs.writeFile(new URL('latest.json', output), JSON.stringify(report, null, 2) + '\n');
const columns = ['结果', '业务', '标题', '来源', '发布时间', '原因', '原句', '链接', '正文状态', '事件类型', '规则版本', '正文容器', '正文字数', '抓取错误', '变化识别', '业务核对', '变化原句', '业务依据原句', '对应产品', '关系类型', '影响原句', '业务范围依据', '证据来源'];
const labels = {
  passed: '通过', not_found: '未识别到变化', hint_only: '仅标题或摘要线索', not_checked: '未核对',
  needs_review: '待核对', not_matched: '未对应', direct: '直接产品变化',
  explicit_indirect: '明确上下游影响', unresolved_indirect: '上下游影响待核对',
  web_page: '网页正文', rss_excerpt: 'RSS原文节选'
};
const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
const rows = inScopeArticles.map(a => [a.decision.result, a.decision.business, a.title, a.sourceId, a.publishedAt, a.decision.reason, a.decision.evidence, a.url, a.bodyStatus, a.decision.event, a.decision.rule, a.bodySelector, a.bodyCharacters, a.bodyError, labels[a.decision.eventGate], labels[a.decision.businessGate], a.decision.eventEvidence, a.decision.businessEvidence, a.decision.affectedProducts.map(product => product.productName).join('、'), labels[a.decision.relationship] || '', a.decision.impactEvidence, a.decision.affectedProducts.map(product => product.scopeEvidence).join(' | '), labels[a.evidenceSource] || a.evidenceSource]);
await fs.writeFile(new URL('latest.csv', output), '\ufeff' + [columns, ...rows].map(row => row.map(quote).join(',')).join('\n'));
console.log(JSON.stringify({ total: inScopeArticles.length, candidateCount, outOfScopeRemoved, counts: Object.fromEntries(['入选', '待定', '排除'].map(result => [result, inScopeArticles.filter(a => a.decision.result === result).length])), warnings }));
