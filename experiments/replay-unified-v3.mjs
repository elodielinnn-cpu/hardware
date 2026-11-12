import fs from 'node:fs/promises';
import path from 'node:path';
import { loadBusinessProfile } from './news-filter-v3/business-profile.mjs';
import { evaluateArticleV3 } from './news-filter-v3/news-filter-v3.mjs';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) throw new Error('Usage: node replay-unified-v3.mjs INPUT.json OUTPUT.json');
const source = JSON.parse(await fs.readFile(inputPath, 'utf8'));
if (!Array.isArray(source.articles)) throw new Error('Input must contain articles');
const profile = await loadBusinessProfile(new URL('../config/luxshare-business-profile.json', import.meta.url));
const articles = source.articles.map((article, index) => {
  const result = evaluateArticleV3(article, profile);
  const main = result.unifiedTagging?.mainEvent;
  return {
    sampleNumber: article.sampleNumber || index + 1, title: article.title, url: article.url,
    originalProgramResult: article.decision?.result || '未记录',
    retained: result.retained, rejection: result.exclusionReason || '',
    domain: main?.domains || [], event: main?.eventType || '', stage: main?.stage || 'unknown',
    actor: main?.actor || '', object: main?.object || '', evidence: main?.evidence || '',
    paragraphId: main?.paragraphId || null,
    businessProducts: result.productMatches?.articleSubjects?.map(item => ({ productId: item.productId, relationshipLevel: item.relationshipLevel })) || [],
    relevance: result.effectiveRelevance, priority: result.effectivePriority,
    homepage: result.defaultVisible, decisionStatus: result.decisionStatus,
    admissionPath: result.admissionPath || 'none', reasonCodes: result.reasonCodes || [],
    dataQuality: article.publishedAt ? 'complete' : 'missing_published_at'
  };
});
const report = { version: 'unified-v1', generatedAt: new Date().toISOString(), input: path.basename(inputPath),
  scope: ['datacom', 'automotive', 'consumer'], modelRun: false,
  totals: { articles: articles.length, homepage: articles.filter(item => item.homepage).length,
    missingDates: articles.filter(item => item.dataQuality !== 'complete').length,
    noMainEvent: articles.filter(item => !item.event).length }, articles };
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.totals));
