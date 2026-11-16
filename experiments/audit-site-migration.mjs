import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../real-data.js', import.meta.url), 'utf8');
const { radarGenerationMetadata, radarGeneratedArticles } = vm.runInNewContext(
  `${source}\n({ radarGenerationMetadata, radarGeneratedArticles })`, {}, { timeout: 2000 });
const rows = radarGeneratedArticles.map(article => ({
  id: article.id, title: article.title,
  oldTags: article.tags || [],
  hasBodyEvidence: Array.isArray(article.bodyEvidence) && article.bodyEvidence.length > 0,
  migrationStatus: Array.isArray(article.bodyEvidence) && article.bodyEvidence.length > 0
    ? 'source_replay_required' : 'unmappable_without_original_body'
}));
const report = {
  sourceVersion: radarGenerationMetadata.codeVersion,
  sourceGeneratedAt: radarGenerationMetadata.generatedAt,
  sourceArticleCount: radarGenerationMetadata.articleCount,
  newVersion: 'unified-v1',
  migrated: 0,
  unmappableWithoutBody: rows.filter(row => !row.hasBodyEvidence).length,
  records: rows
};
await fs.mkdir(new URL('../reports/unified-v1/', import.meta.url), { recursive: true });
await fs.writeFile(new URL('../reports/unified-v1/site-migration.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ articles: rows.length, unmappableWithoutBody: report.unmappableWithoutBody }));
