import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { requestProvider } from '../cloud-homepage-review-ab/providers.mjs';
import { loadBusinessProfile, matchBusinessProfile } from '../news-filter-v3/business-profile.mjs';
import { evaluateArticleV3 } from '../news-filter-v3/news-filter-v3.mjs';
import { hideDuplicateHomepageBodies } from '../news-filter-v3/body-dedupe.mjs';
import { isConsumerStory } from '../news-screening/scope.mjs';
import { TAGGING_TAXONOMY } from '../../config/news-screening-rules-v2.mjs';
import { prepareBody, canonicalUrl, incumbentFact, compareEvent } from './replay.mjs';
import { VERSION, factOutputGuide, assessArticle, extractValidatedFacts, inWindow } from './rules.mjs';

const [dataPath, queuePath, outputPath, priorPath] = process.argv.slice(2);
if (!outputPath) throw new Error('Usage: node run.mjs SNAPSHOT.js QUEUE.json REPORT.json [PRIOR_REPORT.json]');
const read = file => fs.readFile(file,'utf8');
const [data, queue, profile, promptText, providers, prior] = await Promise.all([
  read(dataPath), read(queuePath).then(JSON.parse),
  loadBusinessProfile(new URL('../../config/luxshare-business-profile.json',import.meta.url)),
  read(new URL('./prompt.txt',import.meta.url)),
  read(new URL('../cloud-homepage-review-ab/providers.json',import.meta.url)).then(JSON.parse),
  priorPath ? read(priorPath).then(JSON.parse) : null
]);
const { articles, metadata } = new vm.Script(data + '\n({articles:radarGeneratedArticles,metadata:radarGenerationMetadata})')
  .runInNewContext(Object.create(null));
if (metadata.filterMode !== 'v3' || metadata.homepageReviewMode !== 'required'
  || articles.length !== metadata.articleCount || !Array.isArray(queue.items)) {
  throw new Error('Expected a published V3 snapshot with reviewed decisions and its collection queue');
}
if (process.env.NEWS_SHADOW_REVIEW_REPORT) {
  const review = JSON.parse(await read(process.env.NEWS_SHADOW_REVIEW_REPORT));
  if (review.sourceGeneration?.generatedAt !== metadata.generatedAt
    || review.sourceGeneration?.codeVersion !== metadata.codeVersion) {
    throw new Error('The selected published snapshot and Actions artifact came from different runs');
  }
}
const asOf = metadata.generatedAt.slice(0,10);
const mode = process.env.NEWS_SHADOW_MODE || 'queue';
if (!['fixed','queue'].includes(mode)) throw new Error('Expected fixed or queue replay mode');
const fixtureCases = JSON.parse(await read(new URL('./fixed-cases.json',import.meta.url)));
const fixedCases = new Map(fixtureCases.map(entry=>[entry.id,entry]));
const frozenTime = '2026-11-27T10:27:00+08:00';
if (mode === 'fixed' && metadata.generatedAt !== frozenTime) throw new Error('Fixed mode requires the archived November 27 input');
if (mode === 'queue' && process.env.GITHUB_ACTIONS && asOf <= frozenTime.slice(0,10)) {
  throw new Error('Queue mode requires a later snapshot for the holdout');
}
const prompt = `${promptText}
Required JSON fields and allowed values (use one value where alternatives are separated by |):
${factOutputGuide}`;
const business = profile.products.filter(p => ['direct','adjacent','upstream'].includes(p.relationshipLevel))
  .map(p => ({ id:p.productId, name:p.productName, relation:p.relationshipLevel }));
const queueIndex = new Map(queue.items.map(item => [item.candidateId,item]));
const sources = new Map();
const oldIds = new Set(articles.map(a=>a.id));
for (const a of articles) sources.set(a.v3Audit?.candidateId || a.id,a);
for (const item of queue.items) {
  if (!sources.has(item.candidateId) && (item.articleSnapshot || (mode === 'fixed' && fixedCases.has(item.candidateId)))) {
    sources.set(item.candidateId,item.articleSnapshot || {...item, sourceUrl:item.url});
  }
}
const sameRules = prior?.version === VERSION && prior?.profileHash === profile.profileHash;
const incumbents = new Map((sameRules ? prior.rows : [])
  .filter(r => ['focus','observation'].includes(r.withObservation)).map(r => [r.id,r]));
const candidates = [];
const cache = new Map((prior?.factsCache || []).map(entry => [entry.hash,entry.facts]));
const factsCache = new Map(cache);
for (const [id,a] of sources) {
  if (!inWindow(a.publishedAt,asOf) || (!oldIds.has(a.id) && isConsumerStory(a))) continue;
  const snapshot = queueIndex.get(id)?.articleSnapshot;
  const existing = a.bodyEvidence || (snapshot?.id === a.id && snapshot.sourceUrl === a.sourceUrl ? snapshot.bodyEvidence : []);
  const {paragraphs,range} = prepareBody(existing);
  const input = { title:a.title, paragraphs, business };
  const matched = matchBusinessProfile({title:a.title,bodyEvidence:paragraphs.map(p=>p.text)},profile);
  const mapped = [...matched.articleSubjects, ...matched.relatedLuxshareProducts]
    .filter(p=>['direct','adjacent','upstream'].includes(p.relationshipLevel));
  const signal = a.v3Audit?.candidateDecisions || [];
  const marketCandidate = signal.some(e=>['market','operations','policy'].includes(e.eventType))
    || mapped.some(p=>p.relationshipLevel !== 'direct');
  const group = a.v3Audit?.decisionStatus === 'accepted' || a.showByDefault ? 'admitted'
    : mapped.length && marketCandidate
      ? 'industry' : mapped.length ? 'recovery' : 'other';
  const hash = createHash('sha256').update(JSON.stringify({id,version:VERSION,prompt,model:providers.gemini.modelId,
    profile:profile.profileHash,input:{title:input.title,paragraphs}})).digest('hex');
  candidates.push({id,a,input,group,hash,facts:paragraphs.length ? cache.get(hash) : undefined,
    range, bodyTruncated:range.truncated, attempts:0});
}
candidates.sort((a,b)=>String(b.a.publishedAt).localeCompare(String(a.a.publishedAt)) || a.id.localeCompare(b.id));
const quotas = { admitted:6,recovery:4,industry:2 };
const normalEligible = candidates.filter(c=>c.a.publishedAt?.slice(0,10) > frozenTime.slice(0,10)
  && !fixedCases.has(c.id) && c.group !== 'other' && c.input.paragraphs.length && !c.facts);
const selected = mode === 'fixed'
  ? fixtureCases.map(fixture=>candidates.find(c=>c.id===fixture.id)).filter(c=>c?.input.paragraphs.length && !c.facts)
  : Object.entries(quotas).flatMap(([group,limit])=>normalEligible.filter(c=>c.group===group).slice(0,limit));
if (mode === 'queue') selected.push(...normalEligible.filter(c=>!selected.includes(c)).slice(0,12-selected.length));
const selectedIds = new Set(selected.map(c=>c.id));
const apiKey = process.env.GEMINI_API_KEY;
if (process.env.GITHUB_ACTIONS && !apiKey) throw new Error('The shadow workflow requires its existing GEMINI_API_KEY secret');
const budget = {requests:12,inputTokens:mode==='fixed' ? 70000 : 50000,outputTokens:mode==='fixed' ? 12000 : 3000};
let requests = 0, inputTokens = 0, outputTokens = 0, completedRequests = 0;
const repairPrompt = prompt + '\nYour previous response failed JSON, required-field or source-quote validation. Re-read the numbered paragraphs and correct the JSON once. Use only quotes present in the stated paragraph.';
const failures = [];
const sentInputs = [];
let stopReason = null;
async function attempt(c, repair) {
  const systemPrompt = repair ? repairPrompt : prompt;
  const estimated = JSON.stringify(c.input).length + systemPrompt.length;
  if (!apiKey || stopReason || requests >= budget.requests || inputTokens + estimated > budget.inputTokens
    || budget.outputTokens - outputTokens < 300) return false;
  if (requests) await new Promise(resolve=>setTimeout(resolve,6100));
  requests += 1;
  c.attempts += 1;
  c.formatRetryDeferred = false;
  sentInputs.push({id:c.id, attempt:c.attempts, repair, systemPrompt:repair ? 'repair' : 'initial',
    range:c.range,input:c.input});
  const response = await requestProvider({provider:'gemini',providerConfig:providers.gemini,
    systemPrompt,candidate:c.input,apiKey,fetchImpl:fetch,timeoutMs:45000,maxRetries:0,
    maxOutputTokens:Math.min(2400,budget.outputTokens-outputTokens)});
  inputTokens += response.usage?.inputTokens || 0;
  outputTokens += response.usage?.outputTokens || 0;
  if (response.error) {
    failures.push({id:c.id,attempt:c.attempts,reason:response.error.type,httpStatus:response.error.status ?? null,
      message:response.error.message?.replaceAll(apiKey,'[redacted]').slice(0,300)});
    if ([400,401,403,404,429].includes(response.error.status)) stopReason = 'provider_rejected_request';
    return false;
  }
  let facts;
  if (response.finishReason === 'STOP') {
    try { facts = JSON.parse(response.rawContent); } catch {}
  }
  const extraction = extractValidatedFacts(c.input,facts,{truncated:c.bodyTruncated});
  c.extraction = extraction;
  if (extraction.state !== 'invalid_response') {
    c.facts = facts;
    completedRequests += 1;
    return false;
  }
  failures.push({id:c.id,attempt:c.attempts,reason:response.finishReason !== 'STOP' ? response.finishReason
    : facts ? 'invalid_fields_or_quotes' : 'invalid_json',rejected:extraction.rejected.map(item=>item.reason)});
  c.formatRetryDeferred = !repair;
  return !repair;
}
const retry = [];
for (const c of selected) if (await attempt(c,false)) retry.push(c);
for (const c of retry) await attempt(c,true);
const rows = candidates.map(c => {
  const extraction = c.extraction || extractValidatedFacts(c.input,c.facts,
    {truncated:c.bodyTruncated,attempted:Boolean(c.facts)});
  const decision = assessArticle(c.a,c.input,c.facts,profile,asOf,extraction);
  if (c.facts && ['ok','no_event','insufficient_input'].includes(extraction.state)) factsCache.set(c.hash,c.facts);
  const old = oldIds.has(c.a.id) && c.a.showByDefault === true;
  const oldFact = old ? incumbentFact(c.a) : null;
  const assessed = Boolean(c.facts) && extraction.state !== 'invalid_response';
  // Re-evaluate the old program on these exact paragraphs. Keep the archived
  // homepage verdict separate because it includes the previous model review.
  const legacy = selectedIds.has(c.id) || (mode==='fixed' && fixedCases.has(c.id))
    ? evaluateArticleV3({ id:c.a.id,title:c.input.title,sourceId:c.a.sourceId,url:c.a.sourceUrl,
      publishedAt:c.a.publishedAt,bodyEvidence:c.input.paragraphs.map(p=>p.text) },profile) : null;
  const row = { id:c.id, title:c.a.title, url:c.a.sourceUrl, publishedAt:c.a.publishedAt,
    sourceId:c.a.sourceId, sourceCategory:c.a.sourceCategory, group:c.group, bodyTruncated:c.bodyTruncated,
    old, oldFact, oldReplayVisible:legacy?.defaultVisible ?? null,
    oldReplayGate:legacy?.decisionGate || legacy?.exclusionReason || '',
    oldReplayEvidence:legacy?.unifiedTagging?.mainEvent?.evidence || '',
    oldDuplicateOf:c.a.v3Audit?.homepageDuplicateOf || '', baselineKnown:oldIds.has(c.a.id),
    assessed, extractionState:extraction.state, rejectedFacts:extraction.rejected,
    formatRetryDeferred:Boolean(c.formatRetryDeferred),
    selectedForReview:selectedIds.has(c.id), sent:c.attempts>0, attempts:c.attempts, inputRange:c.range,
    sendReason:c.attempts ? (mode==='fixed' ? 'fixed_case' : 'queue_'+c.group)
      : c.facts ? 'cached_facts' : !c.input.paragraphs.length ? 'no_body'
        : selectedIds.has(c.id) ? (!apiKey ? 'missing_local_key' : stopReason || 'budget')
          : mode==='fixed' ? 'outside_fixed_group' : c.a.publishedAt?.slice(0,10) <= frozenTime.slice(0,10) ? 'outside_holdout' : c.group==='other' ? 'no_candidate_signal' : 'quota',
    fixture:mode==='fixed' ? fixedCases.get(c.id) : undefined, ...decision };
  if (oldFact && !['sponsored','rumor'].includes(decision.rule) && ('no_event' === extraction.state || !extraction.state
    || ['insufficient_input','invalid_response'].includes(extraction.state))) {
    row.retained = true;
    row.baselineRetention = extraction.state === 'no_event' ? 'model_missed_old_event_pending_review' : 'old_event_pending_extraction';
    row.selected = oldFact;
    row.tier = 'focus';
  }
  const saved = incumbents.get(c.id);
  if (saved && !assessed && saved.hash === c.hash && inWindow(saved.publishedAt,asOf)) {
    return {...saved,old,retained:true};
  }
  return {...row,hash:c.hash};
});
for (const [id,row] of incumbents) {
  if (!sources.has(id) && inWindow(row.publishedAt,asOf)) rows.push({...row, old:false, baselineKnown:false, retained:true});
}
const evidenceCount = fact => new Set(Object.values(fact?.evidence || {}).filter(q=>q.quote)
  .map(q=>q.paragraph_id || 'prior_verified')).size;
const ranked = rows.filter(r=>r.tier==='focus' || r.tier==='observation' || r.old)
  .map(r=>({ ...r, selected: r.selected || r.oldFact || {} }))
  .sort((a,b)=>Number(b.tier==='focus')-Number(a.tier==='focus')
    || Number(Boolean(a.oldDuplicateOf))-Number(Boolean(b.oldDuplicateOf))
    || evidenceCount(b.selected)-evidenceCount(a.selected)
    || Number(b.sourceCategory==='official')-Number(a.sourceCategory==='official')
    || b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id));
const deduped = new Map();
const keepers = [];
for (const row of ranked) {
  for (const keeper of keepers) {
    const match = compareEvent(row,keeper);
    if (match === 'possible_duplicate') {
      (row.suspectedDuplicates ||= []).push(keeper.url);
    } else if (match) {
      deduped.set(row.id,keeper.url);
      row.dedupeMethod = match;
      break;
    }
  }
  if (!deduped.has(row.id)) keepers.push(row);
}
const checked = hideDuplicateHomepageBodies(keepers.map(r=>{
  const a = sources.get(r.id);
  const f = r.selected;
  const eventType = f.signal || {product:'product_change',technology:'engineering_result',
    order:'adoption_or_delivery',investment:'capacity_change'}[f.action] || f.action;
  return { id:a?.id || r.id,title:r.title,sourceUrl:r.url,sourceId:r.sourceId,
    sourceCategory:r.sourceCategory,publishedAt:r.publishedAt,showByDefault:true,
    unifiedTagging:{mainEvent:{actor:f.subject,eventType,stage:f.status}},
    v3Audit:{candidateId:r.id} };
}),queue);
for (const a of checked.articles) {
  if (a.showByDefault) continue;
  const row = keepers.find(r=>r.id===a.v3Audit.candidateId);
  (row.suspectedDuplicates ||= []).push(a.v3Audit.homepageDuplicateOf);
}
const observationLimit = 3;
const observations = new Set(ranked.filter(r=>r.tier==='observation' && !deduped.has(r.id) && (r.old || !r.suspectedDuplicates?.length)).slice(0,observationLimit).map(r=>r.id));
const publicEvents = {product_change:'product',engineering_result:'technology',adoption_or_delivery:'order',
  capacity_change:'investment',operating_change:'operations',market_shift:'operations',policy_or_supply_risk:'risk'};
const publicStages = {planned:'planned',announced:'published',validated:'validation',in_use:'initial_use',
  shipped:'initial_use'};
for (const row of rows) {
  const event = row.selected;
  row.publicTags = event ? [
    TAGGING_TAXONOMY.domains[profile.productsById.get(event.business_id)?.domainId],
    TAGGING_TAXONOMY.events[publicEvents[event.signal]],
    // Start of production is not evidence of production at scale.
    event.status === 'in_production' ? TAGGING_TAXONOMY.stages.initial_use
      : TAGGING_TAXONOMY.stages[publicStages[event.status]]
  ].filter(Boolean) : [];
  row.duplicateOf = deduped.get(row.id) || '';
  const checkedRow = keepers.find(item=>item.id===row.id);
  row.suspectedDuplicates = [...new Set(checkedRow?.suspectedDuplicates || [])];
  row.dedupeMethod = ranked.find(item=>item.id===row.id)?.dedupeMethod || '';
  const pendingDuplicate = !row.old && !row.duplicateOf && row.suspectedDuplicates.length;
  row.repaired = !pendingDuplicate && !row.duplicateOf && row.tier==='focus' ? 'focus' : 'archive';
  row.withObservation = observations.has(row.id) ? 'observation' : row.repaired;
  const compare = tier => (!row.assessed || ['needs_evidence','needs_extraction'].includes(row.tier)) && !row.retained ? 'incomplete'
    : !row.baselineKnown && tier === 'archive' ? 'outside_old_retained_set'
      : row.old && tier === 'archive' ? 'removed' : !row.old && tier !== 'archive' ? 'added' : 'unchanged';
  const replacedOld = rows.some(old=>old.old && deduped.get(old.id)
    && canonicalUrl(deduped.get(old.id)) === canonicalUrl(row.url));
  row.coverageChange = pendingDuplicate ? 'suspected_duplicate'
    : row.duplicateOf ? 'duplicate'
      : replacedOld && row.withObservation !== 'archive' ? 'source_replacement'
        : !row.old && ['focus','observation'].includes(row.withObservation) ? 'candidate_recovery_pending_human'
          : row.old && row.withObservation === 'archive' && row.assessed ? 'removed_pending_human' : 'none';
  row.repairedComparison = compare(row.repaired);
  row.comparison = compare(row.withObservation);
  if (row.comparison === 'incomplete') {
    row.repaired = row.tier;
    row.withObservation = row.tier;
  }
}
await fs.mkdir(path.dirname(outputPath),{recursive:true});
const observationRows = rows.filter(r=>r.sent && (r.group==='industry'
  || r.fixture?.expected.startsWith('observation')));
const stateCounts = Object.fromEntries(['ok','no_event','insufficient_input','invalid_response'].map(state=>
  [state,rows.filter(r=>(mode==='queue' || r.fixture) && r.extractionState===state).length]));
const report = {mode,budget,stateCounts, missingFixedCases: mode==='fixed' ? fixtureCases.filter(f=>!rows.some(r=>r.id===f.id)) : [],
  observationFunnel: {sent:observationRows.length,
    facts:observationRows.filter(r=>r.extractionState==='ok').length,
    rejected:observationRows.filter(r=>r.extractionState==='ok' && r.tier==='archive').length,
    rejectedReasons:observationRows.filter(r=>r.extractionState==='ok' && r.tier==='archive').map(r=>({id:r.id,rule:r.rule}))},
  version:VERSION,profileHash:profile.profileHash,metadata,asOf, observationLimit, selected:selected.map(({id,group})=>({id,group})),
  usage:{requests,completedRequests,inputTokens,outputTokens}, stopReason, failures, availableApiKey:Boolean(apiKey),
  counts:{input:rows.length,assessed:rows.filter(r=>r.assessed).length,old:rows.filter(r=>r.old).length,
    focus:rows.filter(r=>r.repaired==='focus').length,observation:observations.size,
    incomplete:rows.filter(r=>r.comparison==='incomplete').length},
  rows,factsCache:[...factsCache].slice(-500).map(([hash,facts])=>({hash,facts}))};
await fs.writeFile(outputPath,JSON.stringify(report,null,2)+'\n');
const audit = {mode,metadata, snapshotHash:createHash('sha256').update(data).digest('hex'),
  queueHash:createHash('sha256').update(JSON.stringify(queue)).digest('hex'),
  initialPrompt:prompt, repairPrompt, inputs:sentInputs};
await fs.writeFile(path.join(path.dirname(outputPath),'model-inputs.json'),JSON.stringify(audit,null,2)+'\n');
const columns = ['id','title','url','publishedAt','old','baselineKnown','oldReplayVisible','oldReplayGate','oldReplayEvidence','repaired','withObservation',
  'repairedComparison','comparison','tier','rule','duplicateOf','dedupeMethod','coverageChange','group','sent','sendReason','attempts','formatRetryDeferred','extractionState','baselineRetention','assessed','bodyTruncated'];
const csvCell = field => {
  const value = String(field ?? '');
  const escaped = /^[=+@-]/u.test(value) ? "'" + value : value;
  return '"' + escaped.replaceAll('"','""') + '"';
};
const csvRows = rows.map(r => [...columns.map(key=>r[key]),r.selected?.evidence?.change?.quote,'','']);
await fs.writeFile(path.join(path.dirname(outputPath),'comparison.csv'),
  '\ufeff' + [[...columns,'changeEvidence','humanCoverageVerdict','humanReviewNotes'], ...csvRows].map(r=>r.map(csvCell).join(',')).join('\n')+'\n');
console.log(JSON.stringify({counts:report.counts,usage:report.usage,failures}));

if (process.env.GITHUB_ACTIONS && selected.length && !completedRequests) {
  console.error('No selected article produced valid structured facts. See comparison.json for request diagnostics.');
  process.exitCode = 1;
}
