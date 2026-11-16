import fs from 'node:fs/promises';
import path from 'node:path';
import { loadBusinessProfile } from './business-profile.mjs';
import { evaluateArticleV3 } from './news-filter-v3.mjs';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) throw new Error('Usage: node compare-fresh.mjs FETCHED.json REPORT.json');
const input = JSON.parse(await fs.readFile(inputPath, 'utf8'));
if (!Array.isArray(input.articles)) throw new Error('Expected fetched articles');
const profile = await loadBusinessProfile(new URL('../../config/luxshare-business-profile.json', import.meta.url));
const articles = input.articles.map((article, index) => {
  const v3 = evaluateArticleV3({ ...article, sourceUrl: article.url, summary: article.summary || '',
    originalSummary: article.summary || '' }, profile);
  const main = v3.unifiedTagging?.mainEvent;
  return {
    sampleNumber: index + 1, title: article.title, url: article.url, sourceId: article.sourceId,
    publishedAt: article.publishedAt, bodyStatus: article.bodyStatus,
    bodyParagraphs: article.bodyEvidence?.length || 0,
    programResult: article.decision?.result || '', programReason: article.decision?.reason || '',
    v3Homepage: v3.defaultVisible, relevance: v3.effectiveRelevance, priority: v3.effectivePriority,
    domain: main?.domains || v3.unifiedTagging?.articleDomains || [],
    event: main?.eventType || '', stage: main?.stage || 'unknown',
    actor: main?.actor || '', object: main?.object || '', evidence: main?.evidence || '',
    stageEvidence: main?.stageEvidence || '', reasonCodes: v3.reasonCodes || [],
    admissionPath: v3.admissionPath || 'none',
    businessProducts: v3.productMatches?.articleSubjects?.map(item => ({ productId: item.productId, relation: item.relationshipLevel })) || []
  };
});
const report = {
  generatedAt: new Date().toISOString(), sourceFetchedAt: input.fetchedAt, modelRun: false,
  scope: ['datacom', 'automotive'],
  sourceDiagnostics: input.sourceDiagnostics,
  totals: {
    articles: articles.length,
    fullBody: articles.filter(article => article.bodyStatus === 'ok').length,
    rssEvidence: articles.filter(article => article.bodyStatus === 'rss_evidence').length,
    programSelected: articles.filter(article => article.programResult === '入选').length,
    programPending: articles.filter(article => article.programResult === '待定').length,
    v3Homepage: articles.filter(article => article.v3Homepage).length,
    v3SelectedFromProgramPending: articles.filter(article => article.v3Homepage && article.programResult === '待定').length,
    noMainEvent: articles.filter(article => !article.event).length
  },
  articles
};
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.totals));
