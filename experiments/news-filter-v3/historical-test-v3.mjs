import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBusinessProfile } from "./business-profile.mjs";
import { loadDeferredQueue, mergeDeferredQueue, recordDeferredOutcomes, saveDeferredQueue } from "./deferred-queue.mjs";
import { evaluateArticleV3 } from "./news-filter-v3.mjs";
import { planFairProcessing, prepareCandidates } from "./funnel-planner.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(directory, "../..");
const profileData = await loadBusinessProfile(path.join(repositoryRoot, "config/luxshare-business-profile.json"));
const cases = JSON.parse(await fs.readFile(path.join(repositoryRoot, "experiments/qwen-news-semantic-eval/cases.json"), "utf8"));

// Keep rule tests independent from the rolling generated-news window.
const generatedFixtures = {
  gaming: {
    id: "fixture-gaming",
    sourceId: "nvidia_newsroom",
    publishedAt: "2026-10-22",
    title: "Cloud Deployment Incoming: ‘Call of Duty: Modern Warfare 4’ Arrives on GeForce NOW",
    originalSummary: "Call of Duty: Modern Warfare 4 arrives on GeForce NOW at launch, bringing a new campaign, multiplayer action and a high-stakes extraction mode to supported devices."
  },
  consumerGpuProduct: {
    id: "fixture-consumer-gpu",
    sourceId: "apple_newsroom",
    publishedAt: "2026-10-27",
    title: "Apple introduces the new 14-inch MacBook Pro with M6",
    originalSummary: "The consumer notebook offers faster graphics and AI performance, a 16-core Neural Engine, up to 32GB of unified memory and memory bandwidth up to 170GB/s."
  },
  oracleRack: {
    id: "fixture-oracle-rack",
    sourceId: "storagereview",
    publishedAt: "2026-10-29",
    title: "72-GPU NVIDIA Vera Rubin NVL72 Racks Anchor OCI’s Planned Multi-Gigawatt Expansion",
    originalSummary: "NVIDIA and Oracle plan to expand Oracle Cloud Infrastructure Superclusters with Vera Rubin NVL72 systems to multi-gigawatt scale, and the NVL72 racks are available on OCI."
  },
  rubinProduction: {
    id: "fixture-rubin-production",
    sourceId: "servethehome",
    publishedAt: "2026-11-01",
    title: "NVIDIA Updates Rubin GPU Specs as First Production Hardware Arrives",
    originalSummary: "As production hardware starts shipping, NVIDIA has updated specifications for its Rubin GPU platforms."
  },
  genericVertiv: {
    id: "fixture-generic-vertiv",
    sourceId: "vertiv_news",
    publishedAt: "2026-10-26",
    title: "Vertiv simplifies high-density AI infrastructure deployment across data center environments",
    originalSummary: "This data-center hardware update may affect server architecture, network or storage design and deployment requirements."
  },
  dc800: {
    id: "fixture-800-vdc",
    sourceId: "eetimes",
    publishedAt: "2026-10-29",
    title: "Infineon’s OktoberTech: Edge AI, SDVs, and the Road to 800 VDC",
    originalSummary: "The report covers GaN power and the shift toward 800 V DC data centers."
  },
  capacityShift: {
    id: "fixture-capacity-shift",
    sourceId: "techpowerup",
    publishedAt: "2026-10-31",
    title: "Intel Diverts 18A Capacity From Panther Lake to Meet Xeon Demand",
    originalSummary: "Intel is moving manufacturing capacity away from consumer chips to meet demand for Xeon server processors amid a documented supply shortage."
  }
};

const getCase = (id) => cases.find((item) => item.id === id);
const evaluate = (article) => evaluateArticleV3(article, profileData);
let assertions = 0;
function check(condition, message) {
  assertions += 1;
  assert.ok(condition, message);
}

const cpo = evaluate(getCase("edge-06-cpo-test-cost"));
check(cpo.retained, "CPO technical analysis must remain in the complete library");
check(cpo.effectiveRelevance === "high", "CPO must map to a direct product");
check(cpo.effectivePriority === "medium", "Deep CPO analysis must be at least medium priority");
check(cpo.defaultVisible && cpo.admissionPath === "core_deep_technical_analysis", "CPO analysis must use the deep technical path");
check(cpo.eventStage === "not_applicable", "Technical analysis must not be presented as a future event");

const aec = evaluate(getCase("edge-02-marvell-retimer"));
check(aec.productMatches.articleSubjects.some((item) => item.productId === "aec_dsp" && item.relationshipLevel === "upstream"), "AEC DSP must remain upstream");
check(aec.productMatches.relatedLuxshareProducts.some((item) => item.productId === "active_electrical_cable"), "AEC cable must be a related direct product");
check(!aec.productMatches.articleSubjects.some((item) => item.productId === "active_electrical_cable"), "AEC DSP must not inherit the cable subject role");
check(!aec.productMatches.articleSubjects.some((item) => item.productId === "ai_rack_scale_integration"), "An AEC used in AI racks must not turn the rack itself into the article subject");
check(aec.productMatches.articleSubjects.some((item) => item.productId === "aec_dsp" && item.impactSupported && /active electrical cable/.test(item.impactEvidence)), "AEC High relevance must bind an upstream DSP impact to the direct AEC product in the same evidence window");

const unboundAec = evaluate({
  id: "rule-unbound-aec",
  sourceId: "industry_trade",
  publishedAt: "2026-11-01",
  title: "Vendor introduces an AEC DSP and retimer",
  originalSummary: `The vendor listed an AEC DSP and retimer without explaining a downstream cable impact. ${"General market commentary without product evidence. ".repeat(8)}A separate software service reduces operating cost.`
});
check(unboundAec.effectiveRelevance !== "high", "AEC keywords and unrelated impact words must not produce High relevance");
check(!unboundAec.defaultVisible, "Unbound upstream AEC evidence must not enter the homepage");

const polar = evaluate(getCase("high-02-vertiv-polar"));
check(polar.effectiveRelevance === "high", "Factory-built 41MW AI infrastructure must map to rack-scale integration");
check(polar.defaultVisible, "Evidence-backed Vertiv deployment must pass the homepage gate");

const cdu = evaluate(getCase("high-03-vertiv-cdu"));
check(cdu.effectiveRelevance === "high" && cdu.effectivePriority === "medium", "Qualified 2.3MW CDU must be high/medium");

const rack = evaluate(getCase("high-05-supermicro-rack"));
check(rack.productMatches.articleSubjects.some((item) => item.productId === "ai_rack_scale_integration"), "Full rack specifications must map to rack-scale integration");
check(rack.effectiveRelevance === "high", "AI rack must be high relevance");

const futureGa = evaluate(getCase("edge-01-google-ga"));
check(futureGa.eventStage === "confirmed_future", "Coming-next-month GA must remain a future plan");
check(!futureGa.defaultVisible && futureGa.decisionStatus === "needs_review", "Future GA must not be treated as occurred commercialization");

const appleSupply = evaluate(getCase("high-04-apple-manufacturing"));
check(appleSupply.defaultVisible && appleSupply.admissionPath === "important_customer_supply_chain", "Specific Apple manufacturing action must use the supply-chain path");
check(!appleSupply.productMatches.brandSupplyInferenceAllowed || /supplier|manufactur/i.test(`${getCase("high-04-apple-manufacturing").originalSummary} ${getCase("high-04-apple-manufacturing").bodyEvidence.join(" ")}`), "Brand alone must not imply supply");

const cxl = evaluate(getCase("edge-03-marvell-cxl"));
check(cxl.retained, "CXL product news must remain in the complete library");
check(!cxl.defaultVisible, "Future sampling of an upstream product without direct impact must stay off the homepage");

const siliconPhotonics = evaluate(getCase("edge-05-silicon-photonics-test"));
check(siliconPhotonics.productMatches.articleSubjects.some((item) => item.productId === "silicon_photonics_chip" && item.relationshipLevel === "unconfirmed"), "Silicon photonics capability must remain unconfirmed");
check(siliconPhotonics.effectiveRelevance !== "high", "Unconfirmed silicon photonics must not inherit direct relevance");
check(siliconPhotonics.effectiveRelevance === "medium" && siliconPhotonics.relevanceStatus === "provisional", "Summary-only silicon photonics evidence must remain a provisional relevance review rather than definitive Low");
check(siliconPhotonics.evidenceSufficiency.status === "requires_full_text" && siliconPhotonics.decisionStatus === "needs_review", "Silicon photonics needs full text before resolving CPO or optical-module impact");

const panelPackaging = evaluate(getCase("edge-04-panel-packaging"));
check(panelPackaging.retained && !panelPackaging.defaultVisible, "Summary-only panel packaging must be retained but not auto-promoted");
check(panelPackaging.effectiveRelevance === "medium" && panelPackaging.relevanceStatus === "provisional", "Panel-level packaging must remain provisional when the summary cannot establish a SiP/module relationship");
check(panelPackaging.productMatches.unresolvedContexts.some((item) => item.contextId === "advanced_semiconductor_packaging"), "Panel-level packaging must record an unresolved context without inheriting a direct packaging capability");

const office = evaluate(getCase("hide-06-office-promotion"));
check(!office.retained && office.exclusionReason === "explicit_software_promotion", "Explicit Office promotion must be excluded as advertising");

const gaming = generatedFixtures.gaming;
check(Boolean(gaming), "Current generated data must contain the unrelated gaming sample");
const gamingResult = evaluate(gaming);
check(!gamingResult.retained && gamingResult.exclusionReason === "explicitly_unrelated_gaming_content", "Explicit game-release content must be excluded as unrelated rather than hidden as Low");

for (const [title, expectedReason] of [
  ["TechPowerUp x Vendor Giveaway: Win Cases, Coolers, and PSUs!", "explicit_advertising_or_garbage"],
  ["Grab a new 3D printer this weekend with prices as low as $199", "explicit_advertising_or_garbage"],
  ["Vendor offers limited-time CPU combo deals", "explicit_advertising_or_garbage"],
  ["Gamer's monitor blocks bullet during a Call of Duty session", "explicitly_unrelated_gaming_content"],
  ["App Store Indie Games Week kicks off today", "explicitly_unrelated_gaming_content"],
  ["NVIDIA GeForce NOW Gets a New Game This Week", "explicitly_unrelated_gaming_content"],
  ["RPCS3 Emulator Now Has Zero PS3 Games Left in the Loadable Category", "explicitly_unrelated_gaming_content"],
  ["New Action Game Launches Today For GeForce RTX", "explicitly_unrelated_gaming_content"],
  ["Storage Brand Joins Action Game on Collaboration SSD Gift Box", "explicitly_unrelated_gaming_content"]
]) {
  const result = evaluate({
    id: `rule-explicit-exclusion-${assertions}`,
    sourceId: "consumer_technology_media",
    publishedAt: "2026-11-02",
    title,
    originalSummary: `${title}. This is a consumer entertainment or promotional item.`
  });
  check(!result.retained && result.exclusionReason === expectedReason, `${title} must be excluded by the existing V3 advertising or unrelated-gaming policy`);
}

for (const title of [
  "Vendor launches a lightweight gaming mouse with a new optical sensor",
  "Vendor confirms a new gaming handheld with an integrated GPU",
  "GPU retail prices increase after a documented supply shortage",
  "Xbox console sales fall as the company points to supply shortages"
]) {
  const result = evaluate({
    id: `rule-normal-consumer-hardware-${assertions}`,
    sourceId: "consumer_technology_media",
    publishedAt: "2026-11-02",
    title,
    originalSummary: `${title}. The report describes hardware specifications or a documented industry supply change.`
  });
  check(result.retained, `${title} is normal hardware or industry news and must not be removed as advertising or game entertainment`);
}

const consoleSupply = evaluate({
  id: "rule-console-supply-shortage",
  sourceId: "industry_technology_media",
  publishedAt: "2026-11-02",
  title: "Xbox console sales fall as the company points to supply shortages",
  originalSummary: "The gaming console business reported lower shipments because supply shortages constrained available hardware while separate game launches continued."
});
check(consoleSupply.retained, "Console supply-chain news must not be removed because its context also mentions game launches");

const normalLow = evaluate({
  id: "rule-normal-low",
  sourceId: "example_tech",
  publishedAt: "2026-11-01",
  title: "Technology company opens a new developer community forum",
  originalSummary: "The company opened a public forum for developers and published its event schedule."
});
check(normalLow.retained && normalLow.effectiveRelevance === "low", "Normal low-relevance technology news must remain in the complete library");

const negatedSupplyDeal = evaluate({
  id: "rule-negated-supply-deal",
  sourceId: "industry_trade",
  publishedAt: "2026-11-01",
  title: "Company hosts AI seminar; no supply deal announced",
  originalSummary: "Nothing came out of the meeting in terms of a new supply contract, and the companies announced no order or supplier change."
});
check(negatedSupplyDeal.retained && !negatedSupplyDeal.defaultVisible, "A negated supply event must remain in the library without becoming a homepage increment");

const sip = evaluate({
  id: "rule-sip",
  sourceId: "packaging_trade",
  publishedAt: "2026-11-01",
  title: "New SiP module packaging line enters volume production",
  originalSummary: "The system-in-package line has entered volume production with a quantified yield improvement."
});
check(sip.effectiveRelevance === "high", "Explicit SiP must map to the direct SiP capability");
check(!sip.productMatches.articleSubjects.some((item) => item.productId === "cowos_packaging"), "SiP must not imply CoWoS");

const cowos = evaluate({
  id: "rule-cowos",
  sourceId: "packaging_trade",
  publishedAt: "2026-11-01",
  title: "CoWoS capacity expansion enters a new phase",
  originalSummary: "The foundry described additional CoWoS capacity for AI accelerators."
});
check(cowos.productMatches.articleSubjects.some((item) => item.productId === "cowos_packaging" && item.relationshipLevel === "unconfirmed"), "CoWoS must remain unconfirmed");
check(cowos.effectiveRelevance !== "high", "CoWoS must not inherit direct SiP relevance");

for (const [productId, title] of [
  ["central_gateway", "Automotive central gateway enters customer qualification"],
  ["telematics_control_unit", "New vehicle telematics control unit begins production"]
]) {
  const result = evaluate({
    id: `rule-${productId}`,
    sourceId: "automotive_trade",
    publishedAt: "2026-11-01",
    title,
    originalSummary: `${title}. The hardware product includes a specific manufacturing and qualification milestone.`
  });
  check(result.productMatches.articleSubjects.some((item) => item.productId === productId), `${productId} must be recognized from the profile`);
  check(result.effectiveRelevance === "high", `${productId} is a user-confirmed direct hardware capability`);
}

const dcOptical = evaluate({
  id: "rule-dc-optical",
  sourceId: "optics_trade",
  publishedAt: "2026-11-01",
  title: "1.6T optical module qualification starts for data center racks",
  originalSummary: "The optical transceiver is entering server rack qualification."
});
check(dcOptical.productMatches.articleSubjects.some((item) => item.productId === "optical_module"), "Data-center optical transceiver must map to optical_module");
check(!dcOptical.productMatches.articleSubjects.some((item) => item.productId === "consumer_optical_modules"), "Data-center optics must not map to consumer camera modules");

const consumerOptical = evaluate({
  id: "rule-consumer-optical",
  sourceId: "consumer_trade",
  publishedAt: "2026-11-01",
  title: "Smartphone camera module adopts a new lens design",
  originalSummary: "The consumer camera and lens module changes the smartphone optical assembly."
});
check(consumerOptical.productMatches.articleSubjects.some((item) => item.productId === "consumer_optical_modules"), "Consumer camera module must use the consumer optics product");
check(!consumerOptical.productMatches.articleSubjects.some((item) => item.productId === "optical_module"), "Consumer optics must not map to a data-center transceiver");

const consumerGpuProduct = evaluate(generatedFixtures.consumerGpuProduct);
check(consumerGpuProduct.effectiveRelevance === "low" && consumerGpuProduct.effectivePriority === "low", "Ordinary consumer hardware must not become Medium merely because its summary contains GPU performance terms");

const oracleRack = evaluate(generatedFixtures.oracleRack);
check(oracleRack.productMatches.articleSubjects.some((item) => item.productId === "ai_rack_scale_integration"), "Plural rack wording must map to the direct AI rack-scale capability");
check(oracleRack.effectiveRelevance === "high", "A concrete NVL72 rack deployment must be High relevance");

const rubinProduction = evaluate(generatedFixtures.rubinProduction);
check(rubinProduction.effectiveRelevance === "medium", "Actual upstream GPU production hardware must remain Medium rather than fall to Low");

const genericVertiv = evaluate(generatedFixtures.genericVertiv);
check(genericVertiv.effectiveRelevance === "medium" && genericVertiv.relevanceStatus === "provisional", "A generic data-center fallback summary must stay provisional rather than prove Low relevance");
check(genericVertiv.evidenceSufficiency.status === "requires_full_text" && !genericVertiv.defaultVisible, "Generic infrastructure evidence must require full text and stay off the homepage");

const dc800 = generatedFixtures.dc800;
check(Boolean(dc800), "Current generated data must contain the 800 VDC sample");
const dc800Result = evaluate(dc800);
check(dc800Result.productMatches.articleSubjects.some((item) => item.productId === "800v_dc_system"), "800 VDC data-center context must map to the direct power architecture");
check(dc800Result.effectiveRelevance === "high", "800 VDC data-center architecture must be high relevance");

const capacityShift = generatedFixtures.capacityShift;
check(Boolean(capacityShift), "Current generated data must contain the Intel capacity-shift sample");
const capacityShiftResult = evaluate(capacityShift);
check(capacityShiftResult.eventStage === "occurred", "An announced current capacity diversion must be recognized as occurred");
check(capacityShiftResult.defaultVisible, "A concrete server CPU capacity reallocation must retain its homepage eligibility");

const mixedStage = evaluate({
  id: "rule-mixed-stage",
  sourceId: "industry_trade",
  publishedAt: "2026-11-01",
  title: "Supplier starts shipping current rack power units and will expand capacity next year",
  originalSummary: "The supplier has begun shipping qualified rack power units and plans to add capacity in 2027."
});
check(mixedStage.eventStage === "mixed", "Occurred and future claims in one article must be separated for review");
check(mixedStage.eventStagesDetected.includes("occurred") && mixedStage.eventStagesDetected.includes("confirmed_future"), "Mixed events must preserve both occurred and future stages in audit output");

const prepared = prepareCandidates([
  { sourceId: "source_a", publishedAt: "2026-11-01", title: "Connector update", originalSummary: "Normal connector industry news." },
  { sourceId: "source_b", publishedAt: "2026-11-01", title: "Normal technology update", originalSummary: "Normal low relevance technology news." },
  { sourceId: "source_a", publishedAt: "2026-11-01", title: "Another server update", originalSummary: "Another normal item." }
], {
  sourceConfigs: new Map([["source_a", { include: /server/i, exclude: /connector/i }]])
});
check(prepared[0].sourceSignal.excludeMatched && prepared[0].sourceSignal.destructive === false, "Source exclude must be diagnostic only");
const plan = planFairProcessing(prepared, { maxFullTextFetches: 2, maxCandidatesPerSource: 2 });
check(plan.selected.length === 2 && plan.deferred.length === 1, "Fair quota must select a bounded batch and retain deferred candidates");
check(plan.baseMetadataRetained.length === 3, "Capacity deferral must not remove base article metadata from the complete library");
check(plan.diagnostics.sourceSignals.destructivelyRemoved === 0, "Soft source signals must not delete candidates");
check(plan.selected[0].candidateId.startsWith("v3_"), "Stable candidateId must exist before transform");

const firstDeferredId = plan.deferred[0].candidateId;
const nextPlan = planFairProcessing(prepared, { maxFullTextFetches: 1, maxCandidatesPerSource: 2, deferredCandidateIds: [firstDeferredId] });
check(nextPlan.selected[0].candidateId === firstDeferredId, "A previously deferred candidate must receive priority in the next run");

const queueDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "hardware-radar-v3-queue-"));
const queuePath = path.join(queueDirectory, "deferred.json");
const emptyQueue = await loadDeferredQueue(queuePath);
const queued = mergeDeferredQueue(emptyQueue, plan.deferred, "2026-11-01T00:00:00.000Z");
await saveDeferredQueue(queuePath, queued);
const reloadedQueue = await loadDeferredQueue(queuePath);
check(reloadedQueue.items.length === 1 && reloadedQueue.items[0].candidateId === firstDeferredId, "Deferred queue must persist base metadata across runs");
const failedQueue = recordDeferredOutcomes(reloadedQueue, [{ candidateId: firstDeferredId, status: "failed", error: "detail timeout" }], "2026-11-02T00:00:00.000Z");
check(failedQueue.items[0].attempts === 1 && failedQueue.items[0].lastError === "detail timeout", "Detail failure must retain metadata and retry state");
const failedTwice = recordDeferredOutcomes(failedQueue, [{ candidateId: firstDeferredId, status: "failed", error: "detail timeout" }], "2026-11-03T00:00:00.000Z");
const manualReviewQueue = recordDeferredOutcomes(failedTwice, [{ candidateId: firstDeferredId, status: "failed", error: "detail timeout" }], "2026-11-04T00:00:00.000Z");
check(manualReviewQueue.items[0].status === "manual_review", "Repeated detail failures must stop automatic retry after a finite limit while retaining metadata");
const completedQueue = recordDeferredOutcomes(failedQueue, [{
  candidateId: firstDeferredId,
  status: "completed",
  articleSnapshot: { id: "cached-article", title: plan.deferred[0].title }
}], "2026-11-03T00:00:00.000Z");
check(completedQueue.items[0].status === "completed" && completedQueue.items[0].articleSnapshot.id === "cached-article", "A completed deferred item must retain a bounded article snapshot");
const completedPlan = planFairProcessing(prepared, { maxFullTextFetches: 2, maxCandidatesPerSource: 2, skipDetailCandidateIds: [firstDeferredId] });
check(!completedPlan.selected.some((item) => item.candidateId === firstDeferredId) && !completedPlan.deferred.some((item) => item.candidateId === firstDeferredId), "A completed candidate must not re-enter the detail backlog");

console.log(`V3 rule tests passed: ${assertions}/${assertions}`);
