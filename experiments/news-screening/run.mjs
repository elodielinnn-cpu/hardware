import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadBusinessProfile } from '../news-filter-v3/business-profile.mjs';
import { screen } from './screen.mjs';
import { clean, extractBody } from './extract.mjs';

const execute = promisify(execFile);
const root = new URL('../../', import.meta.url);
const profile = await loadBusinessProfile(new URL('config/luxshare-business-profile.json', root));
const sources = [
  ['Apple', 'https://www.apple.com/newsroom/rss-feed.rss'],
  ['ServeTheHome', 'https://www.servethehome.com/feed/'],
  ['Electrek', 'https://electrek.co/feed/'],
  ['9to5Mac', 'https://9to5mac.com/feed/'],
  ['IT之家', 'https://www.ithome.com/rss/']
];
async function fetchText(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('HTTPS required');
  const { stdout } = await execute('curl', ['-f', '-sS', '-L', '--max-time', '18', '--max-filesize', '4000000', '--proto', '=https', '--proto-redir', '=https', url], { maxBuffer: 5000000 });
  return stdout;
}
function field(block, name) {
  return block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] || '';
}
const replay = process.argv.includes('--replay');
const refetch = process.argv.includes('--refetch');
const previous = replay || refetch ? JSON.parse(await fs.readFile(new URL('outputs/news-screening/latest.json', root), 'utf8')) : null;
const warnings = previous?.warnings || [];
const articles = previous?.articles || [];
const seen = new Set();
for (const [sourceId, url] of replay || refetch ? [] : sources) {
  try {
    const xml = await fetchText(url);
    const blocks = xml.match(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi) || [];
    if (!blocks.length) throw new Error('No RSS/Atom entries');
    for (const block of blocks.slice(0, 20)) {
      const link = clean(field(block, 'link')) || block.match(/<link\b[^>]*href="([^"]+)"/)?.[1];
      const title = clean(field(block, 'title'));
      if (!link || !title || seen.has(link)) continue;
      seen.add(link);
      articles.push({ sourceId, title, url: link, publishedAt: clean(field(block, 'pubDate') || field(block, 'published') || field(block, 'updated')), summary: clean(field(block, 'description') || field(block, 'summary') || field(block, 'content')), bodyEvidence: [] });
    }
    console.log(`${sourceId}: ${blocks.length} feed entries`);
  } catch (error) {
    warnings.push(`${sourceId}: ${error.message.split('\n')[0]}`);
  }
}
// Batch detail requests to keep source load and cloud runtime bounded.
for (let offset = 0; offset < articles.length; offset += 5) {
  await Promise.all(articles.slice(offset, offset + 5).map(async article => {
    if (replay) {
      article.decision = screen(article, profile);
      return;
    }
    try {
      const html = await fetchText(article.url);
      Object.assign(article, extractBody(html));
      article.bodyFetchedAt = new Date().toISOString();
      article.bodyError = '';
    } catch (error) {
      article.bodyEvidence = [];
      article.bodyStatus = 'fetch_failed';
      article.bodySelector = '';
      article.bodyCharacters = 0;
      article.bodyFetchedAt = new Date().toISOString();
      article.bodyError = error.code === 22 ? 'http_error' : error.code === 28 || error.killed ? 'timeout' : 'request_failed';
    }
    article.decision = screen(article, profile);
  }));
  console.log(`Processed ${Math.min(offset + 5, articles.length)}/${articles.length}`);
}
if (!articles.length) throw new Error(`All sources failed: ${warnings.join(' | ')}`);
const report = { fetchedAt: previous?.fetchedAt || new Date().toISOString(), evaluatedAt: new Date().toISOString(), profileStatus: profile.profile.profileStatus, warnings, articles };
const output = new URL('outputs/news-screening/', root);
await fs.mkdir(output, { recursive: true });
await fs.writeFile(new URL('latest.json', output), JSON.stringify(report, null, 2) + '\n');
const columns = ['结果', '业务', '标题', '来源', '发布时间', '原因', '原句', '链接', '正文状态', '事件类型', '规则版本', '正文容器', '正文字数', '抓取错误', '变化识别', '业务核对', '变化原句', '业务依据原句', '对应产品'];
const quote = value => `"${String(value || '').replace(/"/g, '""')}"`;
const rows = articles.map(a => [a.decision.result, a.decision.business, a.title, a.sourceId, a.publishedAt, a.decision.reason, a.decision.evidence, a.url, a.bodyStatus, a.decision.event, a.decision.rule, a.bodySelector, a.bodyCharacters, a.bodyError, a.decision.eventGate, a.decision.businessGate, a.decision.eventEvidence, a.decision.businessEvidence, a.decision.affectedProducts.map(product => product.productName).join('、')]);
await fs.writeFile(new URL('latest.csv', output), '\ufeff' + [columns, ...rows].map(row => row.map(quote).join(',')).join('\n'));
console.log(JSON.stringify({ total: articles.length, counts: Object.fromEntries(['入选', '待定', '排除'].map(result => [result, articles.filter(a => a.decision.result === result).length])), warnings }));
