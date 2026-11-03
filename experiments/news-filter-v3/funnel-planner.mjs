import { createCandidateId, V3_RUNTIME_BUDGET } from "./news-filter-v3.mjs";

function unique(values) {
  return [...new Set(values)];
}

function sourceSignal(candidate, sourceConfig = {}) {
  const text = `${candidate.title || ""} ${candidate.summary || candidate.originalSummary || ""} ${candidate.url || candidate.sourceUrl || ""}`;
  return {
    includeMatched: sourceConfig.include instanceof RegExp ? sourceConfig.include.test(text) : null,
    excludeMatched: sourceConfig.exclude instanceof RegExp ? sourceConfig.exclude.test(text) : false,
    destructive: false
  };
}
function priorityScore(candidate, deferredCandidateIds) {
  const result = candidate.v3Result || {};
  let score = 0;
  if (deferredCandidateIds.has(candidate.candidateId)) score += 1000;
  if (result.retained === false) score -= 100;
  if (result.effectiveRelevance === "high") score += 40;
  if (result.effectiveRelevance === "medium") score += 20;
  if (result.productMatches?.articleSubjects?.some((item) => item.relationshipLevel === "direct")) score += 30;
  if (result.decisionStatus === "needs_review") score += 10;
  if (candidate.sourceSignal?.excludeMatched) score -= 3;
  return score;
}

export function prepareCandidates(items, { sourceConfigs = new Map() } = {}) {
  return items.map((item) => {
    const candidateId = item.candidateId || createCandidateId(item);
    return {
      ...item,
      candidateId,
      sourceSignal: sourceSignal(item, sourceConfigs.get(item.sourceId)),
      funnelTrace: [
        { stage: "parsed", status: "retained", reason: "candidate_id_assigned_before_transform" },
        { stage: "source_keyword_signal", status: "retained", reason: "include_exclude_are_non_destructive_in_v3" }
      ]
    };
  });
}

export function planFairProcessing(candidates, options = {}) {
  const deferredCandidateIds = new Set(options.deferredCandidateIds || []);
  const skipDetailCandidateIds = new Set(options.skipDetailCandidateIds || []);
  const { deferredCandidateIds: _ignored, skipDetailCandidateIds: _ignoredSkip, ...budgetOverrides } = options;
  const budget = { ...V3_RUNTIME_BUDGET, ...budgetOverrides };
  const structurallyValid = candidates.filter((item) => item.title && item.sourceId && item.publishedAt);
  const structurallyInvalid = candidates.filter((item) => !item.title || !item.sourceId || !item.publishedAt)
    .map((item) => ({ ...item, deferredReason: "structural_invalid" }));
  const bounded = structurallyValid.slice(0, budget.maxParsedCandidates);
  const beyondGlobalParseBudget = structurallyValid.slice(budget.maxParsedCandidates)
    .map((item) => ({ ...item, deferredReason: "global_parse_budget" }));
  const bySource = new Map();
  for (const candidate of bounded.filter((item) => !skipDetailCandidateIds.has(item.candidateId))) {
    if (!bySource.has(candidate.sourceId)) bySource.set(candidate.sourceId, []);
    bySource.get(candidate.sourceId).push(candidate);
  }
  for (const values of bySource.values()) {
    values.sort((left, right) => priorityScore(right, deferredCandidateIds) - priorityScore(left, deferredCandidateIds) || String(right.publishedAt).localeCompare(String(left.publishedAt)));
  }

  const selected = [];
  const deferred = [...structurallyInvalid, ...beyondGlobalParseBudget];
  const sourceCounts = new Map();
  const drainQueues = (previouslyDeferredOnly) => {
    let madeProgress = true;
    while (selected.length < budget.maxFullTextFetches && madeProgress) {
      madeProgress = false;
      for (const [sourceId, queue] of bySource) {
        if (!queue.length || selected.length >= budget.maxFullTextFetches) continue;
        const candidateIndex = previouslyDeferredOnly
          ? queue.findIndex((item) => deferredCandidateIds.has(item.candidateId))
          : queue.findIndex((item) => !deferredCandidateIds.has(item.candidateId));
        if (candidateIndex < 0) continue;
        const count = sourceCounts.get(sourceId) || 0;
        if (count >= budget.maxCandidatesPerSource) continue;
        const [candidate] = queue.splice(candidateIndex, 1);
        selected.push({
          ...candidate,
          funnelTrace: [...candidate.funnelTrace, {
            stage: "fair_capacity",
            status: "selected",
            reason: previouslyDeferredOnly ? "prior_run_deferred_first" : "round_robin_source_quota"
          }]
        });
        sourceCounts.set(sourceId, count + 1);
        madeProgress = true;
      }
    }
  };
  drainQueues(true);
  drainQueues(false);
  for (const queue of bySource.values()) {
    deferred.push(...queue.map((item) => ({
      ...item,
      deferredReason: (sourceCounts.get(item.sourceId) || 0) >= budget.maxCandidatesPerSource ? "per_source_capacity" : "full_text_capacity",
      funnelTrace: [...item.funnelTrace, { stage: "fair_capacity", status: "deferred", reason: "retained_for_later_batch" }]
    })));
  }

  return {
    budget,
    baseMetadataRetained: structurallyValid,
    selected,
    deferred,
    diagnostics: {
      input: candidates.length,
      structurallyInvalid: structurallyInvalid.length,
      selected: selected.length,
      deferred: deferred.length,
      detailCacheHits: bounded.filter((item) => skipDetailCandidateIds.has(item.candidateId)).length,
      sourceCount: bySource.size,
      sourceSignals: {
        includeMiss: candidates.filter((item) => item.sourceSignal?.includeMatched === false).length,
        excludeMatch: candidates.filter((item) => item.sourceSignal?.excludeMatched === true).length,
        destructivelyRemoved: 0
      },
      deferredReasons: Object.fromEntries(unique(deferred.map((item) => item.deferredReason)).map((reason) => [
        reason,
        deferred.filter((item) => item.deferredReason === reason).length
      ]))
    }
  };
}
