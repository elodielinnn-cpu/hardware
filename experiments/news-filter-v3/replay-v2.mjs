import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import vm from 'node:vm';
import { loadBusinessProfile } from './business-profile.mjs';
import { evaluateArticleV3, hideDuplicateHomepageEvents } from './news-filter-v3.mjs';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error('Usage: node experiments/news-filter-v3/replay-v2.mjs <generated-real-data.js> <report.json>');
}
const input = await fs.readFile(inputPath, 'utf8');
const { metadata, articles } = vm.runInNewContext(`${input}\n({metadata:radarGenerationMetadata,articles:radarGeneratedArticles})`);
const profile = await loadBusinessProfile(new URL('../../config/luxshare-business-profile.json', import.meta.url));
const evaluated = articles.map((article) => {
  // Published data omits the captured full text. This replay tests only the
  // exact text retained in the published artifact and reports that limitation.
  const result = evaluateArticleV3({
    ...article, url: article.sourceUrl, originalSummary: article.summary,
    evidenceAvailability: article.evidenceAvailability || article.v3Audit?.inputStatus || 'summary_only',
    _v3DetailDeferred: article.v3Audit?.detailDeferred || false
  }, profile);
  return { article, result };
});
const displayResults = hideDuplicateHomepageEvents(evaluated.map(({ article, result }) => ({
  id: article.id, title: article.title, sourceId: article.sourceId,
  sourceUrl: article.sourceUrl, publishedAt: article.publishedAt,
  summary: article.summary, showByDefault: result.defaultVisible,
  unifiedTagging: result.unifiedTagging,
  defaultFeedAudit: {}, v3Audit: { admissionPath: result.admissionPath }
})));
const rows = evaluated.map(({ article, result }, index) => {
  const display = displayResults[index];
  return {
    id: article.id, title: article.title, sourceId: article.sourceId, sourceUrl: article.sourceUrl,
    publishedAt: article.publishedAt,
    before: { homepage: article.showByDefault, tags: article.unifiedTagging?.displayTags || [],
      relevance: article.relevance, importance: article.importance },
    after: { homepage: display.showByDefault, tags: result.unifiedTagging?.displayTags || [],
      relevance: result.effectiveRelevance, importance: result.effectivePriority,
      decisionStatus: result.decisionStatus, admissionPath: result.admissionPath,
      displayStatus: display.v3Audit?.displayStatus || 'eligible',
      evidenceSufficiency: result.evidenceSufficiency?.status || 'unknown', reasonCodes: result.reasonCodes || [] }
  };
});
const summary = {
  total: rows.length,
  beforeHomepage: rows.filter(row => row.before.homepage).length,
  afterHomepage: rows.filter(row => row.after.homepage).length,
  homepageAdded: rows.filter(row => !row.before.homepage && row.after.homepage).length,
  homepageRemoved: rows.filter(row => row.before.homepage && !row.after.homepage).length,
  tagChanged: rows.filter(row => JSON.stringify(row.before.tags) !== JSON.stringify(row.after.tags)).length,
  afterNeedsReview: rows.filter(row => row.after.decisionStatus === 'needs_review').length,
  afterUnknownRelevance: rows.filter(row => row.after.relevance === 'unknown').length
};
const report = {
  source: { generatedAt: metadata.generatedAt, codeVersion: metadata.codeVersion,
    inputSha256: crypto.createHash('sha256').update(input).digest('hex'),
    publishedTextOnly: true },
  ruleVersion: '2.0.0', profileHash: profile.profileHash, summary, rows
};
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(summary));
