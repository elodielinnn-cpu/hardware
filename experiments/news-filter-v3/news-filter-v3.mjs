import crypto from "node:crypto";
import { ACTIVE_BUSINESS_SCOPE, HOMEPAGE_PATHS, SCREENING_RULE_VERSION } from '../../config/news-screening-rules-v2.mjs';
import { matchBusinessProfile, normalizeText } from "./business-profile.mjs";
import { eventEvidenceWindow, tagArticle, TAGGING_TAXONOMY } from '../unified-tagging.mjs';
import { isConsumerStory } from '../news-screening/scope.mjs';

const ADVERTISEMENT = /\b(?:coupon|promo code|giveaway|sweepstakes|enter to win|limited[- ]time (?:deal|offer)|combo deals?|lifetime license|sponsored deal|price mistake|while stock lasts)\b|\b(?:black friday|holiday|weekend) sale\b|\b(?:save|saving|sale cuts?)\b.{0,40}\b\d+\b|\b(?:on sale for|prices? as low as|for just|for only)\s+\d+\b|\b(?:grab|snag|buy|get)\b.{0,100}\b(?:\d+(?:\.\d+)? off|for \d+(?:\.\d+)?)\b|优惠券|抽奖|限时促销|终身授权|广告推广/iu;
const CLEAR_GARBAGE = /\b(?:casino bonus|sports betting|celebrity gossip|horoscope|adult content)\b|博彩送彩金|明星绯闻|星座运势/iu;
const CLEAR_IRRELEVANT = /\b(?:gfn thursday|geforce now)\b.{0,180}\b(?:games?|gaming|launches|arrives|campaign|multiplayer)\b|\b(?:games?|gaming|launches|arrives|campaign|multiplayer)\b.{0,180}\b(?:gfn thursday|geforce now)\b|\b(?:gamer|player)\b.{0,120}\b(?:bullet|injury|accident|stunt)\b/iu;
const GAME_ENTERTAINMENT = /\b(?:this week in gaming|games? week|video game emulator|console emulator|playstation \d emulator)\b|\bemulator\b.{0,100}\b(?:games?|compatibility|ingame)\b|\b(?:games?|gaming)\b.{0,100}\b(?:releases?|released|launch(?:es|ed|ing)?|players?|revenue share|campaign|multiplayer|sequel|kicks off|collaboration)\b|\b(?:releases?|released|launch(?:es|ed|ing)?|players?|revenue share|campaign|multiplayer|kicks off|collaboration)\b.{0,100}\b(?:games?|gaming|steam|playstation|xbox|nintendo)\b|\bsteam players?\b|\bplaystation\b.{0,100}\brevenue share\b/iu;
const PLAYABLE_GAME_RELEASE = /\bplayable (?:on|with)\b.{0,80}\b(?:geforce|playstation|xbox|nintendo|steam|pc)\b|\b(?:dlss|ray tracing|path tracing)\b.{0,120}\bplayable\b/iu;
const GAMING_HARDWARE = /\bgaming (?:mouse|mice|keyboard|headset|chair|pc|laptop|monitor|handheld)\b|\b(?:handheld|gamepad|controller|graphics card|gpu|processor|cpu|ssd|storage device|memory card)\b/iu;
const GAMING_PROMOTIONAL_BUNDLE = /\b(?:collaboration|limited[- ]edition)\b.{0,100}\b(?:gift box|bundle)\b|\b(?:gift box|bundle)\b.{0,100}\b(?:collaboration|limited[- ]edition)\b/iu;
const SOFTWARE_PROMOTION = /\b(?:office|ide|software|subscription|app)\b.{0,100}\b(?:deal|discount|sale|lifetime|for life|coupon)\b|软件.{0,40}(?:促销|折扣|优惠|终身订阅)/iu;
const RUMOR = /\b(?:rumou?red|reportedly|alleged(?:ly)?|unconfirmed|anonymous sources?|sources? (?:say|said)|leaked|leaks)\b|传闻|据称|消息称|匿名消息|未经确认|爆料/iu;
const MATERIAL_EVENT = /\b(?:mass production|volume production|deployment|installed|customer adoption|customer qualification|qualified as|sampling to customers?|expected to sample|order|contract|supply agreement|shortage|supply constraint|capacity expansion|capacity allocation|diverts?.{0,24}capacity|reallocates?.{0,24}capacity|expand global manufacturing capacity|factory expansion|manufacturing transfer|supplier change|generally available|starts shipping|approved vendor)\b|量产|批量生产|部署|安装|客户采用|客户认证|送样|订单|合同|供货协议|短缺|供应受限|扩产|产能分配|调配产能|转移产能|工厂扩建|制造迁移|供应商变更|正式商用|开始出货|合格供应商/iu;
const MAJOR_PLATFORM = /\b(?:vera rubin|blackwell|rack[- ]scale platform|cloud infrastructure|ai supercluster|ai factory platform|major industry platform|nvl\d+)\b|重大行业平台|AI超级集群|AI工厂平台|整柜平台/iu;
const CUSTOMER_SUPPLY_CHAIN = /\b(?:supply chain partners?|supplier|sourcing|manufacturing program|manufacturing partner|manufacturing capacity|production site|capacity allocation|manufacturing transfer|supplier change)\b|供应链伙伴|供应商|采购替代|制造计划|制造伙伴|生产基地|产能分配|制造迁移|供应商变化/iu;
const SPECIFIC_SUPPLY_ACTION = /\b(?:selected|signed|invest(?:ed|ment)|committed|expanded|mov(?:ed|ing)|divert(?:ed|s|ing)|reallocat(?:ed|es|ing)|transferred|added capacity|approved|partnered with .{0,80}(?:manufactur|supplier))\b|选定|签署|投资|承诺|扩建|迁移|新增产能|批准|制造合作/iu;
const TECHNICAL_TOPIC = /\b(?:airflow|cooling headroom|chassis layout|bottleneck|test costs?|testing costs?|yield|signal integrity|thermal density|power density|latency|bandwidth|manufacturing challenge|design challenge|performance per watt|power efficiency|qualification requirement|known-good)\b|技术瓶颈|测试成本|良率|信号完整性|热密度|功率密度|延迟|带宽|制造难点|设计难点|能效|认证要求/iu;
const TECHNICAL_IMPACT = /\b(?:buys?|enables?|so that|increases?|reduces?|limits?|requires?|drives?|affects?|improves?|degrades?|costs?|trade[- ]off|because|due to|path to|compared with|versus)\b|提高|降低|限制|要求|推动|影响|改善|恶化|成本|权衡|由于|原因/iu;
const BOUND_SYSTEM_IMPACT = /\b(?:racks?|servers?|chassis|system design|system architecture)\b.{0,130}\b(?:design|architecture|layout|density|interconnect|cabling|power budget|cooling requirement|integration|manufactur|compatib)\b|\b(?:design|architecture|layout|density|interconnect|cabling|power budget|cooling requirement|integration|manufactur|compatib)\b.{0,130}\b(?:racks?|servers?|chassis)\b|(?:机柜|服务器|整机).{0,70}(?:架构|密度|接口|线缆|供电预算|散热要求|集成|制造|兼容)/iu;
const CONSUMER_PRODUCT_CONTEXT = /\b(?:macbook|imac|ipad|iphone|consumer pc|consumer laptop|retail product|gaming device)\b|消费级|零售产品|个人电脑|笔记本电脑/iu;
const ENTERPRISE_OR_SUPPLY_CONTEXT = /\b(?:data cent(?:er|re)|server|rack|enterprise|supply chain|supplier|manufactur|capacity|shortages?|commercial deployment|customer qualification)\b|数据中心|服务器|机柜|企业级|供应链|供应商|制造|产能|短缺|商业部署|客户认证/iu;
const GENERIC_SUMMARY = /\bthis (?:data[- ]center hardware|technology|industry) update may affect\b|这项(?:数据中心硬件|技术|行业)更新可能影响/iu;
const QUANTIFIED = /\b\d+(?:\.\d+)?\s*(?:%|x|gbps|tbps|gb\/s|tb\/s|g|kw|mw|w|nm|days?|months?|billion|million)\b|\d+(?:\.\d+)?\s*(?:%|倍|千瓦|兆瓦|天|个月|亿元|亿美元)/iu;
const HIGH_PRIORITY_EVENT = /\b(?:major order|multi[- ]gigawatt|production halt|factory shutdown|export control|supplier replacement|manufacturing transfer|critical shortage)\b|重大订单|吉瓦级|停产|工厂停摆|出口管制|供应商替换|制造迁移|严重短缺/iu;
const STRATEGIC_COMPANY = /\b(?:nvidia|amd|hpe|hewlett packard enterprise|dell|broadcom|microsoft|google|amazon|meta|oracle|intel)\b/iu;
const MATERIAL_FINANCIAL_RESULT = /\b(?:revenue|profit|earnings|sales|backlog)\b.{0,120}(?:\$\s*\d+(?:\.\d+)?\s*(?:b|bn|billion|m|million)\b|\b\d+(?:\.\d+)?\s*(?:billion|million|%))|(?:\$\s*\d+(?:\.\d+)?\s*(?:b|bn|billion|m|million)\b|\b\d+(?:\.\d+)?\s*(?:billion|million|%)).{0,120}\b(?:revenue|profit|earnings|sales|backlog)\b/iu;
const LEADERSHIP_CHANGE = /\b(?:ceo|chief executive officer|board of directors)\b.{0,90}\b(?:resign(?:ed|s|ation)?|step(?:ped|s)? down|depart(?:ed|s|ure)?|appoint(?:ed|s|ment)?|replac(?:ed|es|ement)?|transition)\b|\b(?:resign(?:ed|s|ation)?|appoint(?:ed|s|ment)?)\b.{0,90}\b(?:ceo|chief executive officer)\b|首席执行官.{0,30}(?:辞任|离职|任命|接任)/iu;
const LEADERSHIP_CONFIRMED = /\b(?:press release|company announced|board (?:of directors )?(?:announced|confirmed|appointed)|official(?:ly)? confirmed)\b|官方公告|董事会宣布|公司宣布/iu;
const ADJACENT_THERMAL = /\b(?:rear[- ]door|fan wall|heat exchanger|rack cooling)\b/iu;
const THERMAL_VALIDATION = /\b(?:validat(?:ed|ion)|test(?:ed|ing)|durability|corrosion|reliability)\b/iu;
const THERMAL_IMPACT = /\b(?:cooling capacity|power density|electrical consumption|fan power|reduc(?:e|tion)|heat transfer|replacement|alternative)\b/iu;
const RACK_COOLING_CONTROL = /\b(?:rack[- ](?:management|level) controller|liquid[- ]cooling controller)\b/iu;
const COOLING_CONTROL_FUNCTION = /\b(?:liquid cooling|leak detection|valve control|rack[- ]level monitoring|automated control)\b/iu;

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

function evidenceSufficiency(article, text, profileMatches, event, technical) {
  // Judge the evidence needed for this conclusion, not a universal character count.
  if (article.evidenceAvailability === "unavailable") {
    return { status: "insufficient", reason: "source_detail_unavailable" };
  }
  if (!String(article.summary || article.originalSummary || '').trim()
    && !(article.bodyEvidence || []).length) return { status: "insufficient", reason: "no_usable_source_content" };
  if (!event && !technical.isDeep && article.evidenceAvailability === "summary_only") {
    return { status: "requires_full_text", reason: "summary_does_not_resolve_candidate_event" };
  }
  const hasUnresolvedBusinessScope = profileMatches.articleSubjects.some((match) => match.relationshipLevel === "unconfirmed") || profileMatches.unresolvedContexts.length > 0;
  if (article.evidenceAvailability !== "full_text" && GENERIC_SUMMARY.test(text) && hasUnresolvedBusinessScope) {
    return { status: "requires_full_text", reason: "generic_summary_cannot_resolve_business_relationship" };
  }
  if (article.evidenceAvailability === "summary_only" && hasUnresolvedBusinessScope) {
    return { status: "requires_full_text", reason: "summary_cannot_resolve_business_relationship" };
  }
  return { status: "sufficient", reason: "title_and_summary_or_body_available" };
}

function determineRelevance(profileMatches, text, strategic, sufficiency, adjacentThermal, adjacentRackControl) {
  if (sufficiency.status !== "sufficient") return { level: "unknown", status: "provisional", reason: sufficiency.reason };
  const directSubjects = profileMatches.articleSubjects.filter((match) => match.relationshipLevel === "direct");
  const nonDirectSubjects = profileMatches.articleSubjects.filter((match) => ["upstream", "adjacent"].includes(match.relationshipLevel));
  const unconfirmed = profileMatches.articleSubjects.filter((match) => match.relationshipLevel === "unconfirmed");
  const relatedDirect = profileMatches.relatedLuxshareProducts.filter((match) => match.relationshipLevel === "direct");
  if (directSubjects.length) return { level: "high", reason: "confirmed_direct_business_subject" };
  if (adjacentThermal) return { level: "medium", reason: "validated_adjacent_thermal_competition" };
  if (adjacentRackControl) return { level: 'medium', reason: 'adjacent_rack_cooling_control' };
  if (nonDirectSubjects.some((match) => match.impactSupported) && relatedDirect.length) {
    return { level: "high", reason: "upstream_with_explicit_direct_product_impact" };
  }
  if (nonDirectSubjects.length && CONSUMER_PRODUCT_CONTEXT.test(text) && !ENTERPRISE_OR_SUPPLY_CONTEXT.test(text)) {
    return { level: "low", reason: "ordinary_consumer_product_without_supply_chain_impact" };
  }
  if (nonDirectSubjects.length && (nonDirectSubjects.some((match) => match.impactSupported) || BOUND_SYSTEM_IMPACT.test(text))) {
    return { level: "medium", reason: "upstream_or_adjacent_with_specific_impact" };
  }
  if (strategic.majorLeadership || strategic.majorOperating || (strategic.customerSupplyChain && SPECIFIC_SUPPLY_ACTION.test(text))) {
    return { level: "medium", reason: "independent_strategic_path" };
  }
  if (nonDirectSubjects.length || unconfirmed.length) {
    return { level: "low", reason: unconfirmed.length ? "unconfirmed_capability_not_direct" : "upstream_without_specific_downstream_impact" };
  }
  return { level: "low", reason: "normal_technology_or_industry_news" };
}

function determinePriority({ relevance, text, eventStage, technical, strategic, tagging, adjacentThermal, adjacentRackControl }) {
  if (ADVERTISEMENT.test(text) || SOFTWARE_PROMOTION.test(text)) return { level: "low", reason: "promotion" };
  if (eventStage.stage === "rumor") return { level: "medium", reason: "rumor_priority_capped" };
  if (adjacentThermal) return { level: "medium", reason: "validated_thermal_substitution_impact" };
  if (adjacentRackControl) return { level: 'medium', reason: 'concrete_rack_cooling_control_change' };
  if (strategic.majorLeadership) return { level: 'high', reason: 'confirmed_strategic_company_leadership_change' };
  if (strategic.majorOperating) return { level: 'high', reason: 'material_strategic_company_operating_result' };
  if (HIGH_PRIORITY_EVENT.test(text) && (strategic.customerSupplyChain || relevance.level !== "low")) {
    return { level: "high", reason: "material_quantified_or_disruptive_event" };
  }
  if (
    MATERIAL_EVENT.test(text) ||
    relevance.level === "high" && tagging.mainEvent?.eventType === 'partnership' ||
    relevance.level === "high" && /\b(?:announced|unveiled|launched|introduced|released)\b|发布|推出|亮相/iu.test(text) ||
    technical.isDeep && relevance.level === "high" ||
    technical.isDeep && relevance.level === "medium" && QUANTIFIED.test(text) ||
    strategic.majorPlatform ||
    strategic.customerSupplyChain && SPECIFIC_SUPPLY_ACTION.test(text)
  ) {
    return { level: "medium", reason: technical.isDeep
      ? relevance.level === 'high' ? 'core_business_deep_technical_analysis' : 'specific_quantified_engineering_impact'
      : "substantive_industry_event" };
  }
  return { level: "low", reason: "no_management_priority_signal" };
}

function decideHomepage({ relevance, priority, eventStage, sufficiency, technical, strategic, text, tagging, missingPublishedAt }) {
  const reasons = [];
  if (missingPublishedAt) reasons.push('published_at_missing');
  if (tagging.mainEvent ? !tagging.mainEvent.domains.length
    : !tagging.articleDomains.length && !technical.isDeep && relevance.level !== 'high') reasons.push('outside_active_industry_scope');
  if (!tagging.mainEvent && !technical.isDeep) reasons.push('no_supported_event_or_engineering_conclusion');
  if (sufficiency.status !== "sufficient") reasons.push("evidence_not_sufficient");
  if (eventStage.stage === "rumor") reasons.push("rumor_not_homepage_eligible");
  if (relevance.level === "low") reasons.push("low_relevance");
  if (priority.level === "low") reasons.push("low_priority");
  if (reasons.length) return { visible: false, path: "none", status: sufficiency.status === "sufficient" ? "rejected" : "needs_review", reasons };

  const eventType = tagging.mainEvent?.eventType;
  if (strategic.majorLeadership || strategic.majorOperating || (strategic.customerSupplyChain && SPECIFIC_SUPPLY_ACTION.test(text))) {
    return { visible: true, path: HOMEPAGE_PATHS.strategicBusiness, status: "accepted", reasons: ["confirmed_strategic_action"] };
  }
  if (technical.isDeep && (eventType === 'technology' || !tagging.mainEvent)) {
    return { visible: true, path: HOMEPAGE_PATHS.engineeringAnalysis, status: "accepted", reasons: ["specific_engineering_conclusion"] };
  }
  if (["product", "technology", "partnership"].includes(eventType)) {
    return { visible: true, path: HOMEPAGE_PATHS.productTechnology, status: "accepted", reasons: ["specific_relevant_change"] };
  }
  if (["operations", "risk", "order", "investment"].includes(eventType)) {
    return { visible: true, path: HOMEPAGE_PATHS.industryDemandRisk, status: "accepted", reasons: ["material_business_or_supply_change"] };
  }
  return { visible: false, path: "none", status: "rejected", reasons: ["no_supported_management_value_path"] };
}

export function evaluateArticleV3(article, profileData) {
  const candidateId = article.candidateId || createCandidateId(article);
  const text = articleText(article);
  const normalized = normalizeText(text);
  const normalizedTitle = normalizeText(article.title);
  const structuralErrors = [];
  if (!article.title) structuralErrors.push("missing_title");
  if (!article.sourceId) structuralErrors.push("missing_source_id");
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

  if (isConsumerStory(article)) {
    return {
      candidateId, articleId: article.id || null, title: article.title,
      retained: false, exclusionReason: 'consumer_story_out_of_scope',
      effectiveRelevance: 'low', effectivePriority: 'low', defaultVisible: false,
      decisionStatus: 'rejected', reasonCodes: ['consumer_story_out_of_scope']
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

  const tagging = tagArticle(article, { scope: ACTIVE_BUSINESS_SCOPE });
  const leadershipEvidence = (article.bodyEvidence || []).slice(0, 3).join(' ');
  const strategicCompany = article.title.match(STRATEGIC_COMPANY)?.[0] || '';
  // Assess distinct developments independently; a storage headline can contain a
  // separate cooling launch that deserves the homepage on its own evidence.
  const eventResults = (tagging.candidateEvents?.length ? tagging.candidateEvents : [null]).map(event => {
    const candidateTagging = { ...tagging, mainEvent: event };
    const engineeringEvidence = !event ? [
      ...(article.bodyEvidence || []), article.summary || ''
    ].find(paragraph => assessTechnicalDepth(paragraph).isDeep && !GENERIC_SUMMARY.test(paragraph)) || '' : '';
    const eventParagraph = event && event === tagging.mainEvent ? eventEvidenceWindow(article, event)
      : event?.evidence || engineeringEvidence || article.summary || article.originalSummary || '';
    const eventContext = normalizeText([event === tagging.mainEvent ? article.title : '', eventParagraph || event?.evidence || ''].filter(Boolean).join('\n'));
    const profileMatches = matchBusinessProfile({ title: event?.object || article.title, summary: '',
      bodyEvidence: eventParagraph ? [eventParagraph] : [] }, profileData);
    const taggedStage = event?.stage || 'unknown';
    const inferredEventStage = RUMOR.test(`${article.title || ''} ${event?.evidence || ''}`)
      ? { stage: 'rumor', stages: ['rumor'], reason: 'rumor_language' }
      : { stage: ({ published: 'occurred', validation: 'sampling_validation', initial_use: 'occurred',
        scale_use: 'occurred', planned: 'confirmed_future', not_applicable: 'occurred' })[taggedStage] || 'unknown',
        stages: [taggedStage], reason: `event_bound_stage_${taggedStage}` };
    const technicalAnalysis = assessTechnicalDepth(eventContext);
    const eventStage = inferredEventStage.stage === 'unknown' && technicalAnalysis.isDeep
      ? { stage: 'not_applicable', stages: ['not_applicable'], reason: 'technical_analysis_without_event_claim' }
      : inferredEventStage;
    const strategic = {
      majorPlatform: MAJOR_PLATFORM.test(eventContext),
      customerSupplyChain: CUSTOMER_SUPPLY_CHAIN.test(eventContext),
      majorOperating: event?.eventType === 'operations' && Boolean(strategicCompany)
        && MATERIAL_FINANCIAL_RESULT.test(event.evidence),
      majorLeadership: event?.eventType === 'operations' && Boolean(strategicCompany)
        && event.evidence.toLowerCase().includes(strategicCompany.toLowerCase())
        && LEADERSHIP_CHANGE.test(event.evidence) && (LEADERSHIP_CONFIRMED.test(leadershipEvidence)
          || /(?:^|_)(?:newsroom|press)(?:_|$)/u.test(article.sourceId || ''))
    };
    const adjacentThermal = event?.domains.includes('datacom') && ADJACENT_THERMAL.test(eventParagraph)
      && THERMAL_VALIDATION.test(eventParagraph) && THERMAL_IMPACT.test(eventParagraph)
      && event.eventType === 'technology' && event.stage === 'validation';
    const adjacentRackControl = event?.domains.includes('datacom') && event.eventType === 'product'
      && RACK_COOLING_CONTROL.test(event.evidence) && COOLING_CONTROL_FUNCTION.test(event.evidence)
      && /\b(?:announc(?:ed|es)|introduc(?:ed|es)|unveil(?:ed|s)|launch(?:ed|es))\b/iu.test(event.evidence);
    const sufficiency = evidenceSufficiency(article, normalized, profileMatches, event, technicalAnalysis);
    const relevance = determineRelevance(profileMatches, eventContext, strategic, sufficiency, adjacentThermal, adjacentRackControl);
    const priority = sufficiency.status === "sufficient"
      ? determinePriority({ relevance, text: eventContext, eventStage, technical: technicalAnalysis,
        strategic, tagging: candidateTagging, adjacentThermal, adjacentRackControl })
      : { level: "unknown", reason: sufficiency.reason };
    const homepage = decideHomepage({ relevance, priority, eventStage, sufficiency, technical: technicalAnalysis,
      strategic, text: eventContext, tagging: candidateTagging, missingPublishedAt: !article.publishedAt });
    return { event, engineeringEvidence, profileMatches, technicalAnalysis, eventStage, strategic, sufficiency, relevance, priority, homepage };
  });
  const levelScore = { high: 3, medium: 2, low: 1, unknown: 0 };
  const selected = [...eventResults].sort((left, right) =>
    Number(right.homepage.visible) - Number(left.homepage.visible)
    || levelScore[right.priority.level] - levelScore[left.priority.level]
    || levelScore[right.relevance.level] - levelScore[left.relevance.level]
    || (right.event?.titleFit || 0) - (left.event?.titleFit || 0))[0];
  const { event, engineeringEvidence, profileMatches, technicalAnalysis, eventStage, strategic, sufficiency, relevance, priority, homepage } = selected;
  const unifiedTagging = { ...tagging, mainEvent: event, homepageEvent: homepage.visible ? event : null,
    engineeringConclusion: !event && engineeringEvidence ? engineeringEvidence.slice(0, 600) : '',
    displayEvents: event ? [event, ...tagging.candidateEvents.filter(item => item.id !== event.id)].slice(0, 2) : [],
    displayTags: event ? [...event.domains.map(id => TAGGING_TAXONOMY.domains[id]),
      TAGGING_TAXONOMY.events[event.eventType], ...(['unknown', 'not_applicable'].includes(event.stage)
        ? [] : [TAGGING_TAXONOMY.stages[event.stage]])] : [] };

  return {
    ruleVersion: SCREENING_RULE_VERSION,
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
    unifiedTagging,
    auditTrail: [
      { step: "retention", result: "retained_normal_news" },
      { step: 'event_candidates', candidates: eventResults.map(result => ({ id: result.event?.id || null,
        eventType: result.event?.eventType || null, stage: result.event?.stage || 'unknown',
        object: result.event?.object || '',
        evidence: result.event?.evidence || '', homepage: result.homepage.visible,
        relevance: result.relevance.level, importance: result.priority.level,
        reasons: result.homepage.reasons })) },
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
  maxFullTextFetches: 200,
  fullTextBatchSize: 20,
  maxConcurrentDetailFetches: 6
});

function financialEventIdentity(article) {
  if (article.unifiedTagging?.mainEvent?.eventType !== 'operations') return '';
  const text = `${article.title || ''} ${article.unifiedTagging.mainEvent.evidence || ''}`;
  const company = text.match(STRATEGIC_COMPANY)?.[0]?.toLowerCase();
  const amount = text.match(/\$\s*(\d+(?:\.\d+)?)\s*(billion|bn|b|million|m)\b/iu);
  if (!company || !amount || !/\b(?:revenue|earnings|sales|profit)\b/iu.test(text)) return '';
  const millions = Math.round(Number(amount[1]) * (/^(?:b|bn|billion)$/iu.test(amount[2]) ? 1000 : 1));
  const metric = /\brevenue\b/iu.test(text) ? 'revenue' : /\bprofit\b/iu.test(text) ? 'profit' : 'earnings';
  return `${company}:${metric}:${millions}`;
}

export function hideDuplicateHomepageEvents(articles) {
  const grouped = new Map();
  for (const article of articles.filter(item => item.showByDefault)) {
    const key = financialEventIdentity(article);
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(article);
  }
  const duplicateOf = new Map();
  for (const group of grouped.values()) {
    group.sort((a, b) => Number(b.sourceId === 'nvidia_newsroom') - Number(a.sourceId === 'nvidia_newsroom')
      || (b.summary?.length || 0) - (a.summary?.length || 0));
    const winner = group[0];
    for (const item of group.slice(1)) {
      const daysApart = Math.abs(Date.parse(item.publishedAt) - Date.parse(winner.publishedAt)) / 86400000;
      if (daysApart <= 7) duplicateOf.set(item.id, winner.sourceUrl);
    }
  }
  return articles.map(article => duplicateOf.has(article.id) ? {
    ...article, showByDefault: false,
    defaultFeedAudit: { ...article.defaultFeedAudit, defaultHideReason: 'duplicate_event' },
    v3Audit: { ...article.v3Audit, displayStatus: 'duplicate_hidden', homepageDuplicateOf: duplicateOf.get(article.id) }
  } : article);
}
