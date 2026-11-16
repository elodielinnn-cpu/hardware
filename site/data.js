const collectedArticles = typeof radarGeneratedArticles === "undefined" ? [] : radarGeneratedArticles;
// Hide stale published batches until the next cloud fetch replaces them. Collection
// and V3 classification apply the full two-business gate before writing new data.
const visibleArticles = (collectedArticles.length ? collectedArticles : radarArticles).filter((article) =>
  article.industry !== "3C 产品" && !/\b(?:iphone|ipad|macbook|imac|airpods|siri|smartphone|smartwatch|earbuds?|headsets?|microphones?|laptops?|notebooks?|workstations?|convertible|2-in-1|gaming|playstation|ps[45]|xbox|nintendo|steam(?:os)?|sega|gta|zelda|dlss|pssr|qssr|loot boxes|geforce|rtx 5090|radeon (?:rx|hd)|rdna 5|thinkpad|thinkbook|pcs?|desktop cpu|dell pro precision|qualcomm filed|siren halo|kora|motherboards?|keyboards?|gaming mice|vbios|am5|coreliquid|hx1000i|ai top aero|cfexpress|thunderbay|thunderbolt (?:4|5)|inand|air purifiers?|home nas|portable ssd|external ssd|powerwall|home batteries?|e-?bikes?|e-motorcycles?|electric motorcycles?|electric mopeds?|electric dirt bikes?|cyclists?|engwe|juiced|super73|vespa|super cub|wheel-e)\b|消费电子|手机|耳机|麦克风|笔记本|工作站|家用储能|电动自行车|游戏机|任天堂|世嘉|当贝|电视盒子|净化器/iu.test(article.title || "")
);
const generationMetadata = typeof radarGenerationMetadata === "undefined"
  ? {
      filterMode: "legacy",
      generatedAt: radarTaxonomy.lastUpdatedAt || "",
      codeVersion: "unknown",
      articleCount: visibleArticles.length
    }
  : { ...radarGenerationMetadata, articleCount: visibleArticles.length };

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
  articles: visibleArticles
};
