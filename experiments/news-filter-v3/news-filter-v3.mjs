import crypto from "node:crypto";
import { matchBusinessProfile, normalizeText } from "./business-profile.mjs";

const ADVERTISEMENT = /\b(?:coupon|promo code|giveaway|sweepstakes|enter to win|limited[- ]time (?:deal|offer)|combo deals?|lifetime license|sponsored deal|price mistake|while stock lasts)\b|\b(?:black friday|holiday|weekend) sale\b|\b(?:save|saving|sale cuts?)\b.{0,40}\b\d+\b|\b(?:on sale for|prices? as low as|for just|for only)\s+\d+\b|\b(?:grab|snag|buy|get)\b.{0,100}\b(?:\d+(?:\.\d+)? off|for \d+(?:\.\d+)?)\b|优惠券|抽奖|限时促销|终身授权|广告推广/iu;
const CLEAR_GARBAGE = /\b(?:casino bonus|sports betting|celebrity gossip|horoscope|adult content)\b|博彩送彩金|明星绯闻|星座运势/iu;
const CLEAR_IRRELEVANT = /\b(?:gfn thursday|geforce now)\b.{0,180}\b(?:games?|gaming|launches|arrives|campaign|multiplayer)\b|\b(?:games?|gaming|launches|arrives|campaign|multiplayer)\b.{0,180}\b(?:gfn thursday|geforce now)\b|\b(?:gamer|player)\b.{0,120}\b(?:bullet|injury|accident|stunt)\b/iu;
const GAME_ENTERTAINMENT = /\b(?:this week in gaming|games? week|video game emulator|console emulator|playstation \d emulator)\b|\bemulator\b.{0,100}\b(?:games?|compatibility|ingame)\b|\b(?:games?|gaming)\b.{0,100}\b(?:releases?|released|launch(?:es|ed|ing)?|players?|revenue share|campaign|multiplayer|sequel|kicks off|collaboration)\b|\b(?:releases?|released|launch(?:es|ed|ing)?|players?|revenue share|campaign|multiplayer|kicks off|collaboration)\b.{0,100}\b(?:games?|gaming|steam|playstation|xbox|nintendo)\b|\bsteam players?\b|\bplaystation\b.{0,100}\brevenue share\b/iu;
const PLAYABLE_GAME_RELEASE = /\bplayable (?:on|with)\b.{0,80}\b(?:geforce|playstation|xbox|nintendo|steam|pc)\b|\b(?:dlss|ray tracing|path tracing)\b.{0,120}\bplayable\b/iu;
const GAMING_HARDWARE = /\bgaming (?:mouse|mice|keyboard|headset|chair|pc|laptop|monitor|handheld)\b|\b(?:handheld|gamepad|controller|graphics card|gpu|processor|cpu|ssd|storage device|memory card)\b/iu;
const GAMING_PROMOTIONAL_BUNDLE = /\b(?:collaboration|limited[- ]edition)\b.{0,100}\b(?:gift box|bundle)\b|\b(?:gift box|bundle)\b.{0,100}\b(?:collaboration|limited[- ]edition)\b/iu;
const SOFTWARE_PROMOTION = /\b(?:office|ide|software|subscription|app)\b.{0,100}\b(?:deal|discount|sale|lifetime|for life|coupon)\b|软件.{0,40}(?:促销|折扣|优惠|终身订阅)/iu;
const RUMOR = /\b(?:rumou?red|reportedly|unconfirmed|anonymous sources?|sources? (?:say|said)|leak(?:ed)?)\b|传闻|据称|消息称|匿名消息|未经确认|爆料/iu;
const PREDICTION = /\b(?:forecast|outlook|expects? demand|projected|could reach|may reach|prediction)\b|预测|展望|预计需求|有望达到/iu;
const SAMPLING = /\b(?:sampling to customers?|customer samples?|expected to sample|sample in q[1-4]|qualification|under test|pilot production|risk production|prototype)\b|客户送样|预计送样|送样|认证中|测试中|试产|风险生产/iu;
const CONFIRMED_FUTURE = /\b(?:will|plans? to|announced plans?.{0,100}to|scheduled to|set to|coming next|expected to begin|approved investment|committed to invest|by 20\d{2}|in 20\d{2})\b|将于|计划|定于|下月|明年|投资获批|承诺投资|预计开始/iu;
const OCCURRED = /\b(?:now generally available|generally available now|is generally available|entered service|has begun|has started|completed|installed|deployed|is running|are running|is applying|are applying|starts shipping|began shipping|signed|secured|qualified as|approved vendor|diverts?.{0,24}capacity|reallocates?.{0,24}capacity)\b|现已正式商用|已经商用|已投产|已量产|已部署|已安装|正在运行|正在应用|开始出货|已签署|已获认证|列入合格供应商|调配产能|转移产能/iu;
const MATERIAL_EVENT = /\b(?:mass production|volume production|deployment|installed|customer adoption|customer qualification|qualified as|sampling to customers?|expected to sample|order|contract|supply agreement|shortage|supply constraint|capacity expansion|capacity allocation|diverts?.{0,24}capacity|reallocates?.{0,24}capacity|expand global manufacturing capacity|factory expansion|manufacturing transfer|supplier change|generally available|starts shipping|approved vendor)\b|量产|批量生产|部署|安装|客户采用|客户认证|送样|订单|合同|供货协议|短缺|供应受限|扩产|产能分配|调配产能|转移产能|工厂扩建|制造迁移|供应商变更|正式商用|开始出货|合格供应商/iu;
const NEGATED_MATERIAL_EVENT = /\b(?:no|without)\s+(?:new\s+)?(?:supply\s+)?(?:deal|contract|agreement|order)\s+(?:was\s+)?(?:announced|signed|reached|secured)|nothing\s+(?:came|comes)\s+out\s+of\s+it.{0,80}(?:deal|contract|agreement|order)|未(?:宣布|签署|达成|获得)(?:新的?)?(?:供应|供货)?(?:协议|合同|订单)|没有(?:新的?)?(?:供应|供货)?(?:协议|合同|订单)/iu;
const MAJOR_PLATFORM = /\b(?:vera rubin|blackwell|rack[- ]scale platform|cloud infrastructure|ai supercluster|ai factory platform|major industry platform|nvl\d+)\b|重大行业平台|AI超级集群|AI工厂平台|整柜平台/iu;
const CUSTOMER_SUPPLY_CHAIN = /\b(?:supply chain partners?|supplier|sourcing|manufacturing program|manufacturing partner|production site|capacity allocation|manufacturing transfer|supplier change)\b|供应链伙伴|供应商|采购替代|制造计划|制造伙伴|生产基地|产能分配|制造迁移|供应商变化/iu;
const SPECIFIC_SUPPLY_ACTION = /\b(?:selected|signed|invest(?:ed|ment)|committed|expanded|moved|transferred|added capacity|approved|partnered with .{0,80}(?:manufactur|supplier))\b|选定|签署|投资|承诺|扩建|迁移|新增产能|批准|制造合作/iu;
const TECHNICAL_TOPIC = /\b(?:bottleneck|test costs?|testing costs?|yield|signal integrity|thermal density|power density|latency|bandwidth|manufacturing challenge|design challenge|performance per watt|power efficiency|qualification requirement|known-good)\b|技术瓶颈|测试成本|良率|信号完整性|热密度|功率密度|延迟|带宽|制造难点|设计难点|能效|认证要求/iu;
const TECHNICAL_IMPACT = /\b(?:increases?|reduces?|limits?|requires?|drives?|affects?|improves?|degrades?|costs?|trade[- ]off|because|due to)\b|提高|降低|限制|要求|推动|影响|改善|恶化|成本|权衡|由于|原因/iu;
const UPSTREAM_MATERIAL_IMPACT = /\b(?:production hardware|starts? shipping|shipment|capacity|shortage|supply constraint|demand|interface|bandwidth|reach|latency|power efficiency|power consumption|cost|yield|architecture|qualification|compatibility|bom)\b|生产硬件|开始出货|出货|产能|短缺|供应受限|需求|接口|带宽|距离|延迟|功耗|成本|良率|架构|认证|兼容|物料清单/iu;
const CONSUMER_PRODUCT_CONTEXT = /\b(?:macbook|imac|ipad|iphone|consumer pc|consumer laptop|retail product|gaming device)\b|消费级|零售产品|个人电脑|笔记本电脑/iu;
const ENTERPRISE_OR_SUPPLY_CONTEXT = /\b(?:data cent(?:er|re)|server|rack|enterprise|supply chain|supplier|manufactur|capacity|shortages?|commercial deployment|customer qualification)\b|数据中心|服务器|机柜|企业级|供应链|供应商|制造|产能|短缺|商业部署|客户认证/iu;
const GENERIC_SUMMARY = /\bthis (?:data[- ]center hardware|technology|industry) update may affect\b|这项(?:数据中心硬件|技术|行业)更新可能影响/iu;
const QUANTIFIED = /\b\d+(?:\.\d+)?\s*(?:%|x|gbps|tbps|g|kw|mw|w|nm|days?|months?|billion|million)\b|\d+(?:\.\d+)?\s*(?:%|倍|千瓦|兆瓦|天|个月|亿元|亿美元)/iu;
const HIGH_PRIORITY_EVENT = /\b(?:major order|multi[- ]gigawatt|production halt|factory shutdown|export control|supplier replacement|manufacturing transfer|critical shortage)\b|重大订单|吉瓦级|停产|工厂停摆|出口管制|供应商替换|制造迁移|严重短缺/iu;

function unique(values) {
  return [...new Set(values)];
}

function articleText(article) {
  return [
    article.title,
    article.summary,
    article.originalSummary,
    ...(Array.isArray(article.bodyEvidence) ? article.bodyEvidence : [])
  ].filter(Boolean).join("\n");
}

export function createCandidateId(article) {
  const identity = [
    article.sourceId || "unknown",
    String(article.url || article.sourceUrl || "").replace(/[?#].*$/, ""),
    article.publishedAt || "unknown-date",
    normalizeText(article.title)
  ].join("\n");
  return `v3_${crypto.createHash("sha256").update(identity).digest("hex").slice(0, 20)}`;
}

function inferEventStage(text) {
  if (RUMOR.test(text)) return { stage: "rumor", stages: ["rumor"], reason: "rumor_language" };
  if (SAMPLING.test(text)) return { stage: "sampling_validation", stages: ["sampling_validation"], reason: "sampling_or_validation" };
  if (PREDICTION.test(text) && !OCCURRED.test(text)) return { stage: "prediction", stages: ["prediction"], reason: "forecast_language" };
  if (CONFIRMED_FUTURE.test(text) && !OCCURRED.test(text)) return { stage: "confirmed_future", stages: ["confirmed_future"], reason: "formal_future_language" };
  if (CONFIRMED_FUTURE.test(text) && OCCURRED.test(text)) {
    return { stage: "mixed", stages: ["occurred", "confirmed_future"], reason: "occurred_and_future_claims_need_separation" };
  }
  if (OCCURRED.test(text)) return { stage: "occurred", stages: ["occurred"], reason: "occurred_language" };
  return { stage: "unknown", stages: ["unknown"], reason: "no_reliable_stage_signal" };
}

function assessTechnicalDepth(text) {
  const topic = TECHNICAL_TOPIC.test(text);
  const impact = TECHNICAL_IMPACT.test(text);
  return {
    isDeep: topic && impact,
    hasSpecificTopic: topic,
    hasImpactExplanation: impact,
    evidence: topic ? text.match(TECHNICAL_TOPIC)?.[0] || "" : ""
  };
}

function evidenceSufficiency(article, text, profileMatches) {
  const reliableLength = normalizeText(text).length;
  if (reliableLength < 80) return { status: "insufficient", reason: "source_evidence_too_short" };
  const hasUnresolvedBusinessScope = profileMatches.articleSubjects.some((match) => match.relationshipLevel === "unconfirmed") || profileMatches.unresolvedContexts.length > 0;
  if (GENERIC_SUMMARY.test(text) && hasUnresolvedBusinessScope) {
    return { status: "requires_full_text", reason: "generic_summary_cannot_resolve_business_relationship" };
  }
  if (article.evidenceAvailability === "summary_only" && hasUnresolvedBusinessScope) {
    return { status: "requires_full_text", reason: "summary_cannot_resolve_business_relationship" };
  }
  if (profileMatches.allMatches.length && reliableLength < 160) {
    return { status: "requires_full_text", reason: "business_match_needs_more_context" };
  }
  return { status: "sufficient", reason: "title_and_summary_or_body_available" };
}

function determineRelevance(profileMatches, text, strategic, sufficiency) {
  const directSubjects = profileMatches.articleSubjects.filter((match) => match.relationshipLevel === "direct");
  const nonDirectSubjects = profileMatches.articleSubjects.filter((match) => ["upstream", "adjacent"].includes(match.relationshipLevel));
  const unconfirmed = profileMatches.articleSubjects.filter((match) => match.relationshipLevel === "unconfirmed");
  const relatedDirect = profileMatches.relatedLuxshareProducts.filter((match) => match.relationshipLevel === "direct");
  if (directSubjects.length) return { level: "high", reason: "confirmed_direct_business_subject" };
  if (nonDirectSubjects.some((match) => match.impactSupported) && relatedDirect.length) {
    return { level: "high", reason: "upstream_with_explicit_direct_product_impact" };
  }
  if (nonDirectSubjects.length && CONSUMER_PRODUCT_CONTEXT.test(text) && !ENTERPRISE_OR_SUPPLY_CONTEXT.test(text)) {
    return { level: "low", reason: "ordinary_consumer_product_without_supply_chain_impact" };
  }
  if (nonDirectSubjects.length && (nonDirectSubjects.some((match) => match.impactSupported) || UPSTREAM_MATERIAL_IMPACT.test(text))) {
    return { level: "medium", reason: "upstream_or_adjacent_with_specific_impact" };
  }
  if ((unconfirmed.length || profileMatches.unresolvedContexts.length) && sufficiency.status !== "sufficient") {
    return { level: "medium", status: "provisional", reason: "potential_business_relation_requires_full_text" };
  }
  if (nonDirectSubjects.length || unconfirmed.length) {
    return { level: "low", reason: unconfirmed.length ? "unconfirmed_capability_not_direct" : "upstream_without_specific_downstream_impact" };
  }
  if (strategic.majorPlatform || strategic.customerSupplyChain) {
    return { level: "medium", reason: "independent_strategic_path" };
  }
  return { level: "low", reason: "normal_technology_or_industry_news" };
}

function determinePriority({ relevance, text, eventStage, technical, strategic }) {
  if (ADVERTISEMENT.test(text) || SOFTWARE_PROMOTION.test(text)) return { level: "low", reason: "promotion" };
  if (eventStage.stage === "rumor") return { level: "medium", reason: "rumor_priority_capped" };
  if (HIGH_PRIORITY_EVENT.test(text) && (strategic.customerSupplyChain || relevance.level !== "low")) {
    return { level: "high", reason: "material_quantified_or_disruptive_event" };
  }
  if (
    MATERIAL_EVENT.test(text) ||
    relevance.level === "high" && /\b(?:announced|unveiled|launched|introduced|released)\b|发布|推出|亮相/iu.test(text) ||
    technical.isDeep && relevance.level === "high" ||
    strategic.majorPlatform ||
    strategic.customerSupplyChain && SPECIFIC_SUPPLY_ACTION.test(text)
  ) {
    return { level: "medium", reason: technical.isDeep ? "core_business_deep_technical_analysis" : "substantive_industry_event" };
  }
  return { level: "low", reason: "no_management_priority_signal" };
}

function decideHomepage({ relevance, priority, eventStage, sufficiency, technical, strategic, text }) {
  const reasons = [];
  if (sufficiency.status !== "sufficient") reasons.push("evidence_not_sufficient");
  if (eventStage.stage === "rumor") reasons.push("rumor_not_homepage_eligible");
  if (relevance.level === "low") reasons.push("low_relevance");
  if (priority.level === "low") reasons.push("low_priority");
  if (reasons.length) return { visible: false, path: "none", status: sufficiency.status === "sufficient" ? "rejected" : "needs_review", reasons };

  const majorPlatformOccurred = strategic.majorPlatform && eventStage.stage === "occurred";
  const materialCustomerSupply = strategic.customerSupplyChain && SPECIFIC_SUPPLY_ACTION.test(text) && ["occurred", "confirmed_future", "mixed"].includes(eventStage.stage);
  const deepCoreTechnical = technical.isDeep && relevance.level === "high";
  const scoreEligible = (
    relevance.level === "high" && ["high", "medium"].includes(priority.level)
  ) || (
    relevance.level === "medium" && priority.level === "high"
  );
  const materialMediumMedium = relevance.level === "medium" && priority.level === "medium" && MATERIAL_EVENT.test(text) && !NEGATED_MATERIAL_EVENT.test(text) && ["occurred", "confirmed_future", "mixed"].includes(eventStage.stage);

  if (majorPlatformOccurred) return { visible: true, path: "major_platform_commercialization", status: "accepted", reasons: ["platform_is_actually_available"] };
  if (materialCustomerSupply) return { visible: true, path: "important_customer_supply_chain", status: "accepted", reasons: ["specific_supply_chain_action"] };
  if (deepCoreTechnical) return { visible: true, path: "core_deep_technical_analysis", status: "accepted", reasons: ["specific_bottleneck_and_impact"] };
  if (scoreEligible) return { visible: true, path: "relevance_priority", status: "accepted", reasons: ["high_or_medium_score_gate"] };
  if (materialMediumMedium) return { visible: true, path: "material_increment", status: "accepted", reasons: ["medium_medium_with_material_event"] };
  if (strategic.majorPlatform && eventStage.stage === "confirmed_future") {
    return { visible: false, path: "major_platform_future", status: "needs_review", reasons: ["future_platform_not_yet_commercial"] };
  }
  return { visible: false, path: "none", status: "rejected", reasons: ["homepage_evidence_path_not_met"] };
}

export function evaluateArticleV3(article, profileData) {
  const candidateId = article.candidateId || createCandidateId(article);
  const text = articleText(article);
  const normalized = normalizeText(text);
  const normalizedTitle = normalizeText(article.title);
  const structuralErrors = [];
  if (!article.title) structuralErrors.push("missing_title");
  if (!article.sourceId) structuralErrors.push("missing_source_id");
  if (!article.publishedAt) structuralErrors.push("missing_published_at");
  if (structuralErrors.length) {
    return {
      candidateId,
      retained: false,
      exclusionReason: "structural_invalid",
      structuralErrors,
      effectiveRelevance: "low",
      effectivePriority: "low",
      defaultVisible: false,
      decisionStatus: "rejected"
    };
  }

  const unrelatedGaming = CLEAR_IRRELEVANT.test(normalizedTitle) || GAMING_PROMOTIONAL_BUNDLE.test(normalized) || (
    (GAME_ENTERTAINMENT.test(normalized) || PLAYABLE_GAME_RELEASE.test(normalized)) &&
    !GAMING_HARDWARE.test(normalizedTitle) &&
    !ENTERPRISE_OR_SUPPLY_CONTEXT.test(normalized)
  );
  const explicitAdvertisement = ADVERTISEMENT.test(normalizedTitle);
  const explicitSoftwarePromotion = SOFTWARE_PROMOTION.test(normalized);
  if (explicitAdvertisement || explicitSoftwarePromotion || CLEAR_GARBAGE.test(normalized) || unrelatedGaming) {
    return {
      candidateId,
      retained: false,
      exclusionReason: explicitSoftwarePromotion
        ? "explicit_software_promotion"
        : unrelatedGaming
          ? "explicitly_unrelated_gaming_content"
          : "explicit_advertising_or_garbage",
      effectiveRelevance: "low",
      effectivePriority: "low",
      defaultVisible: false,
      decisionStatus: "rejected"
    };
  }

  const profileMatches = matchBusinessProfile(article, profileData);
  const inferredEventStage = inferEventStage(normalized);
  const technicalAnalysis = assessTechnicalDepth(normalized);
  const eventStage = inferredEventStage.stage === "unknown" && technicalAnalysis.isDeep
    ? { stage: "not_applicable", stages: ["not_applicable"], reason: "technical_analysis_without_event_claim" }
    : inferredEventStage;
  const strategic = {
    majorPlatform: MAJOR_PLATFORM.test(normalized),
    customerSupplyChain: CUSTOMER_SUPPLY_CHAIN.test(normalized)
  };
  const sufficiency = evidenceSufficiency(article, normalized, profileMatches);
  const relevance = determineRelevance(profileMatches, normalized, strategic, sufficiency);
  const priority = determinePriority({ relevance, text: normalized, eventStage, technical: technicalAnalysis, strategic });
  const homepage = decideHomepage({ relevance, priority, eventStage, sufficiency, technical: technicalAnalysis, strategic, text: normalized });

  return {
    candidateId,
    articleId: article.id || null,
    title: article.title,
    retained: true,
    exclusionReason: "",
    effectiveRelevance: relevance.level,
    relevanceStatus: relevance.status || "final",
    effectivePriority: priority.level,
    defaultVisible: homepage.visible,
    decisionStatus: homepage.status,
    admissionPath: homepage.path,
    reasonCodes: unique([relevance.reason, priority.reason, eventStage.reason, sufficiency.reason, ...homepage.reasons]),
    eventStage: eventStage.stage,
    eventStagesDetected: eventStage.stages,
    evidenceSufficiency: sufficiency,
    technicalAnalysis,
    strategicContexts: Object.entries(strategic).filter(([, value]) => value).map(([type]) => type),
    productMatches: profileMatches,
    auditTrail: [
      { step: "retention", result: "retained_normal_news" },
      { step: "business_profile", subjects: profileMatches.articleSubjects.map((item) => item.productId), related: profileMatches.relatedLuxshareProducts.map((item) => item.productId) },
      { step: "relevance", ...relevance },
      { step: "priority", ...priority },
      { step: "homepage", ...homepage }
    ]
  };
}

export const V3_RUNTIME_BUDGET = Object.freeze({
  maxParsedCandidates: 600,
  maxCandidatesPerSource: 60,
  maxFullTextFetches: 80,
  fullTextBatchSize: 20,
  maxConcurrentDetailFetches: 6
});
