import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { loadBusinessProfile } from "./business-profile.mjs";
import { loadDeferredQueue, mergeDeferredQueue, saveDeferredQueue } from "./deferred-queue.mjs";
import { evaluateArticleV3 } from "./news-filter-v3.mjs";
import { planFairProcessing, prepareCandidates } from "./funnel-planner.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(directory, "../..");

async function loadGeneratedArticles() {
  const source = await fs.readFile(path.join(repositoryRoot, "real-data.js"), "utf8");
  return new vm.Script(`${source}\nradarGeneratedArticles;`, { filename: "real-data.js" })
    .runInNewContext(Object.create(null));
}

function toV3Input(article) {
  return {
    ...article,
    url: article.url || article.sourceUrl,
    originalSummary: article.originalSummary || article.summary,
    bodyEvidence: article.bodyEvidence || []
  };
}

function compareLegacy(article, result) {
  if (!article || article.relevance === undefined) return { available: false, reason: "not_present_in_current_generated_pool" };
  const legacyRelevance = { 高: "high", 中: "medium", 低: "low" }[article.relevance] || "unknown";
  const legacyPriority = { 高: "high", 中: "medium", 低: "low" }[article.importance] || "unknown";
  return {
    available: true,
    legacy: { relevance: legacyRelevance, priority: legacyPriority, defaultVisible: article.showByDefault === true },
    v3: { relevance: result.effectiveRelevance, priority: result.effectivePriority, defaultVisible: result.defaultVisible },
    changed: legacyRelevance !== result.effectiveRelevance || legacyPriority !== result.effectivePriority || Boolean(article.showByDefault) !== result.defaultVisible
  };
}

export async function runShadowEvaluation({ outputPath = "/tmp/hardware-radar-v3-shadow.json", queuePath = null } = {}) {
  const [profileData, currentArticles, cases] = await Promise.all([
    loadBusinessProfile(path.join(repositoryRoot, "config/luxshare-business-profile.json")),
    loadGeneratedArticles(),
    fs.readFile(path.join(repositoryRoot, "experiments/qwen-news-semantic-eval/cases.json"), "utf8").then(JSON.parse)
  ]);
  const currentByTitle = new Map(currentArticles.map((article) => [article.title, article]));
  const currentResults = currentArticles.map((article) => {
    const result = evaluateArticleV3(toV3Input(article), profileData);
    return { article, result, diff: compareLegacy(article, result) };
  });
  const caseResults = cases.map((article) => {
    const result = evaluateArticleV3(toV3Input(article), profileData);
    const legacyArticle = currentByTitle.get(article.title);
    return { article, result, diff: compareLegacy(legacyArticle, result) };
  });
  const prepared = prepareCandidates(currentArticles.map((article) => ({ ...toV3Input(article), v3Result: evaluateArticleV3(toV3Input(article), profileData) })));
  const previousQueue = queuePath ? await loadDeferredQueue(queuePath) : { version: 1, updatedAt: null, items: [] };
  const eligibleDeferredIds = previousQueue.items.filter((item) => item.status === "pending").map((item) => item.candidateId);
  const funnelPlan = planFairProcessing(prepared, { deferredCandidateIds: eligibleDeferredIds });
  const updatedQueue = mergeDeferredQueue(previousQueue, funnelPlan.deferred);
  if (queuePath) await saveDeferredQueue(queuePath, updatedQueue);
  const changedCurrent = currentResults.filter((item) => item.diff.changed);
  const report = {
    generatedAt: new Date().toISOString(),
    mode: "shadow_only",
    productionDataModified: false,
    profileVersion: profileData.profile.profileVersion,
    profileHash: profileData.profileHash,
    currentPool: {
      total: currentResults.length,
      retained: currentResults.filter((item) => item.result.retained).length,
      excludedGarbage: currentResults.filter((item) => !item.result.retained).length,
      legacyHigh: currentResults.filter((item) => item.article.relevance === "高").length,
      v3High: currentResults.filter((item) => item.result.effectiveRelevance === "high").length,
      addedHighCandidates: currentResults.filter((item) => item.article.relevance !== "高" && item.result.effectiveRelevance === "high").length,
      retainedLow: currentResults.filter((item) => item.result.retained && item.result.effectiveRelevance === "low").length,
      legacyDefaultVisible: currentResults.filter((item) => item.article.showByDefault).length,
      v3DefaultVisible: currentResults.filter((item) => item.result.defaultVisible).length,
      changedCount: changedCurrent.length
    },
    funnelPlan: funnelPlan.diagnostics,
    deferredQueue: {
      persistenceEnabled: Boolean(queuePath),
      queuePath: queuePath || null,
      previousPending: previousQueue.items.length,
      pendingAfterPlan: updatedQueue.items.length,
      previouslyDeferredScheduled: funnelPlan.selected.filter((item) => previousQueue.items.some((queued) => queued.candidateId === item.candidateId)).length,
      baseMetadataRetained: funnelPlan.baseMetadataRetained.length
    },
    currentDiffs: changedCurrent.map(({ article, result, diff }) => ({
      id: article.id,
      title: article.title,
      sourceId: article.sourceId,
      legacy: diff.legacy,
      v3: diff.v3,
      retained: result.retained,
      exclusionReason: result.exclusionReason,
      admissionPath: result.admissionPath,
      reasonCodes: result.reasonCodes,
      productSubjects: result.productMatches?.articleSubjects.map((item) => ({ productId: item.productId, relationshipLevel: item.relationshipLevel, productRole: item.productRole })) || []
    })),
    excludedCurrent: currentResults.filter((item) => !item.result.retained).map(({ article, result }) => ({
      id: article.id,
      title: article.title,
      sourceId: article.sourceId,
      exclusionReason: result.exclusionReason
    })),
    fixedCaseResults: caseResults.map(({ article, result, diff }) => ({
      id: article.id,
      cohort: article.cohort,
      title: article.title,
      legacy: diff,
      v3: {
        retained: result.retained,
        relevance: result.effectiveRelevance,
        priority: result.effectivePriority,
        defaultVisible: result.defaultVisible,
        decisionStatus: result.decisionStatus,
        admissionPath: result.admissionPath,
        eventStage: result.eventStage,
        evidenceSufficiency: result.evidenceSufficiency,
        reasonCodes: result.reasonCodes,
        productSubjects: result.productMatches?.articleSubjects.map((item) => ({ productId: item.productId, relationshipLevel: item.relationshipLevel, productRole: item.productRole })) || [],
        relatedLuxshareProducts: result.productMatches?.relatedLuxshareProducts.map((item) => ({ productId: item.productId, relationshipLevel: item.relationshipLevel })) || []
      }
    }))
  };
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return { report, outputPath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputPath = process.argv[2] || "/tmp/hardware-radar-v3-shadow.json";
  const queuePath = process.argv[3] || null;
  const { report } = await runShadowEvaluation({ outputPath, queuePath });
  console.log(`V3 shadow report: ${outputPath}`);
  console.log(JSON.stringify(report.currentPool, null, 2));
  console.log(JSON.stringify(report.funnelPlan, null, 2));
  console.log(JSON.stringify(report.deferredQueue, null, 2));
}
