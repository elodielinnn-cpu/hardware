const collectedArticles = typeof radarGeneratedArticles === "undefined" ? [] : radarGeneratedArticles;
const generationMetadata = typeof radarGenerationMetadata === "undefined"
  ? {
      filterMode: "legacy",
      generatedAt: radarTaxonomy.lastUpdatedAt || "",
      codeVersion: "unknown",
      articleCount: collectedArticles.length
    }
  : radarGenerationMetadata;

if (typeof window !== "undefined") {
  window.hardwareRadarGenerationMetadata = Object.freeze({ ...generationMetadata });
  const documentRoot = window.document?.documentElement;
  if (documentRoot) {
    documentRoot.dataset.newsFilterMode = generationMetadata.filterMode;
    documentRoot.dataset.newsGeneratedAt = generationMetadata.generatedAt;
    documentRoot.dataset.newsCodeVersion = generationMetadata.codeVersion;
    documentRoot.dataset.newsArticleCount = String(generationMetadata.articleCount);
  }
}

const radarData = {
  generationMetadata,
  asOfDate: radarTaxonomy.asOfDate,
  lastUpdatedAt: radarTaxonomy.lastUpdatedAt,
  latestArticleDate: radarTaxonomy.latestArticleDate,
  rangeOptions: radarTaxonomy.rangeOptions,
  signalCategories: radarTaxonomy.signalCategories,
  industries: radarTaxonomy.industries,
  importances: radarTaxonomy.importances,
  summaries: radarTaxonomy.summaries,
  sources: radarSources,
  articles: collectedArticles.length ? collectedArticles : radarArticles
};
