const collectedArticles = typeof radarGeneratedArticles === "undefined" ? [] : radarGeneratedArticles;

const radarData = {
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
