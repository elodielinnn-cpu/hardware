import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { requestProvider } from '../cloud-homepage-review-ab/providers.mjs';
import { loadBusinessProfile, matchBusinessProfile } from '../news-filter-v3/business-profile.mjs';
import { hideDuplicateHomepageBodies } from '../news-filter-v3/body-dedupe.mjs';
import { isConsumerStory } from '../news-screening/scope.mjs';
import { TAGGING_TAXONOMY } from '../../config/news-screening-rules-v2.mjs';
import { decodeReviewText } from '../gemini-homepage-review/cache.mjs';
import { VERSION, schema, assessArticle, eventKey, inWindow } from './rules.mjs';

const [dataPath, queuePath, outputPath, priorPath] = process.argv.slice(2);
if (!outputPath) throw new Error('Usage: node run.mjs SNAPSHOT.js QUEUE.json REPORT.json [PRIOR_REPORT.json]');
const read = file => fs.readFile(file,'utf8');
const [data, queue, profile, prompt, providers, prior] = await Promise.all([
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
const business = profile.products.filter(p => ['direct','adjacent','upstream'].includes(p.relationshipLevel))
  .map(p => ({ id:p.productId, name:p.productName, relation:p.relationshipLevel }));
const queueIndex = new Map(queue.items.map(item => [item.candidateId,item]));
const sources = new Map();
const oldIds = new Set(articles.map(a=>a.id));
for (const a of articles) sources.set(a.v3Audit?.candidateId || a.id,a);
for (const item of queue.items) {
  if (!sources.has(item.candidateId) && item.articleSnapshot) {
    sources.set(item.candidateId,item.articleSnapshot);
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
  const paragraphs = [];
  let characters = 0;
  for (const raw of existing || []) {
    const text = decodeReviewText(raw).trim();
    if (!text || characters >= 12000) continue;
    const bounded = text.slice(0,12000-characters);
    paragraphs.push({ paragraph_id:'p'+(paragraphs.length+1), text:bounded });
    characters += bounded.length;
  }
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
    bodyTruncated:(existing || []).reduce((sum,t)=>sum+decodeReviewText(t).trim().length,0)>characters});
}
candidates.sort((a,b)=>String(b.a.publishedAt).localeCompare(String(a.a.publishedAt)) || a.id.localeCompare(b.id));
const quotas = { admitted:6,recovery:4,industry:2 };
const eligible = candidates.filter(c=>c.group !== 'other' && c.input.paragraphs.length && !c.facts);
const selected = Object.entries(quotas).flatMap(([group,limit])=>eligible.filter(c=>c.group===group).slice(0,limit));
selected.push(...eligible.filter(c=>!selected.includes(c)).slice(0,12-selected.length));
const apiKey = process.env.GEMINI_API_KEY;
if (process.env.GITHUB_ACTIONS && !apiKey) throw new Error('The shadow workflow requires its existing GEMINI_API_KEY secret');
let requests = 0, inputTokens = 0, outputTokens = 0;
const failures = [];
for (const c of selected) {
  if (!apiKey || inputTokens >= 50_000 || outputTokens >= 3_000) break;
  const estimated = JSON.stringify(c.input).length + prompt.length;
  // Characters are a conservative token estimate for the multilingual budget.
  if (inputTokens + estimated > 50_000) continue;
  if (requests) await new Promise(resolve=>setTimeout(resolve,6100));
  requests += 1;
  const response = await requestProvider({provider:'gemini',providerConfig:providers.gemini,schema,
    systemPrompt:prompt,candidate:c.input,apiKey,fetchImpl:fetch,timeoutMs:45000,maxRetries:0,
    maxOutputTokens:Math.min(1800,3000-outputTokens)});
  inputTokens += response.usage?.inputTokens || 0;
  outputTokens += response.usage?.outputTokens || 0;
  if (!response.error && response.finishReason === 'STOP') {
    try { c.facts = JSON.parse(response.rawContent); } catch { failures.push({id:c.id,reason:'invalid_json'}); }
  } else {
    failures.push({id:c.id,reason:response.error?.type || response.finishReason || 'incomplete'});
    if ([401,403,429].includes(response.error?.status)) break;
  }
}

const rows = candidates.map(c => {
  const decision = assessArticle(c.a,c.input,c.facts,profile,asOf);
  if (c.facts && decision.rule !== 'missing_or_invalid_extraction') factsCache.set(c.hash,c.facts);
  const old = oldIds.has(c.a.id) && c.a.showByDefault === true;
  const assessed = Boolean(c.facts) && decision.rule !== 'missing_or_invalid_extraction';
  const row = { id:c.id, title:c.a.title, url:c.a.sourceUrl, publishedAt:c.a.publishedAt,
    sourceId:c.a.sourceId, sourceCategory:c.a.sourceCategory, group:c.group, bodyTruncated:c.bodyTruncated,
    old, baselineKnown:oldIds.has(c.a.id), assessed, ...decision };
  const saved = incumbents.get(c.id);
  if (saved && !assessed && saved.hash === c.hash && inWindow(saved.publishedAt,asOf)) {
    return {...saved,old,retained:true};
  }
  return {...row,hash:c.hash};
});
for (const [id,row] of incumbents) {
  if (!sources.has(id) && inWindow(row.publishedAt,asOf)) rows.push({...row, old:false, baselineKnown:false, retained:true});
}
const ranked = rows.filter(r=>r.tier==='focus' || r.tier==='observation')
  .sort((a,b)=>Number(b.tier==='focus')-Number(a.tier==='focus')
    || Number(b.sourceCategory==='official')-Number(a.sourceCategory==='official')
    || b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id));
const deduped = new Map();
const keys = new Map();
for (const row of ranked) {
  const key = eventKey(row.selected);
  if (!key) continue;
  if (keys.has(key)) deduped.set(row.id,keys.get(key));
  else keys.set(key,row.url);
}
// Retain the existing cross-source full-body check for reports with re-used copy.
const checked = hideDuplicateHomepageBodies(ranked.filter(r=>!deduped.has(r.id)).map(r=>{
  const a = sources.get(r.id);
  return { id:a?.id || r.id,title:r.title,sourceUrl:r.url,sourceId:r.sourceId,
    sourceCategory:r.sourceCategory,publishedAt:r.publishedAt,showByDefault:true,
    unifiedTagging:{mainEvent:{actor:r.selected.subject,eventType:r.selected.signal,stage:r.selected.status}},
    v3Audit:{candidateId:r.id} };
}),queue);
checked.articles.forEach(a=>{
  if (!a.showByDefault) deduped.set(a.v3Audit.candidateId,a.v3Audit.homepageDuplicateOf);
});
const observationLimit = 3;
const observations = new Set(ranked.filter(r=>r.tier==='observation' && !deduped.has(r.id)).slice(0,observationLimit).map(r=>r.id));
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
  row.repaired = !row.duplicateOf && row.tier==='focus' ? 'focus' : 'archive';
  row.withObservation = observations.has(row.id) ? 'observation' : row.repaired;
  const compare = tier => (!row.assessed || ['needs_evidence','needs_extraction'].includes(row.tier)) && !row.retained ? 'incomplete'
    : !row.baselineKnown && tier === 'archive' ? 'outside_old_retained_set'
      : row.old && tier === 'archive' ? 'removed' : !row.old && tier !== 'archive' ? 'added' : 'unchanged';
  row.repairedComparison = compare(row.repaired);
  row.comparison = compare(row.withObservation);
}
await fs.mkdir(path.dirname(outputPath),{recursive:true});
const report = {version:VERSION,profileHash:profile.profileHash,metadata,asOf, observationLimit, selected:selected.map(({id,group})=>({id,group})),
  usage:{requests,inputTokens,outputTokens}, failures, availableApiKey:Boolean(apiKey),
  counts:{input:rows.length,assessed:rows.filter(r=>r.assessed).length,old:rows.filter(r=>r.old).length,
    focus:rows.filter(r=>r.repaired==='focus').length,observation:observations.size,
    incomplete:rows.filter(r=>r.comparison==='incomplete').length},
  rows,factsCache:[...factsCache].slice(-500).map(([hash,facts])=>({hash,facts}))};
await fs.writeFile(outputPath,JSON.stringify(report,null,2)+'\n');
const columns = ['id','title','url','publishedAt','old','baselineKnown','repaired','withObservation',
  'repairedComparison','comparison','tier','rule','duplicateOf','group','assessed','bodyTruncated'];
const csvCell = field => {
  const value = String(field ?? '');
  const escaped = /^[=+@-]/u.test(value) ? "'" + value : value;
  return '"' + escaped.replaceAll('"','""') + '"';
};
const csvRows = rows.map(r => [...columns.map(key=>r[key]),r.selected?.evidence?.change?.quote]);
await fs.writeFile(path.join(path.dirname(outputPath),'comparison.csv'),
  '\ufeff' + [[...columns,'changeEvidence'], ...csvRows].map(r=>r.map(csvCell).join(',')).join('\n')+'\n');
console.log(JSON.stringify({counts:report.counts,usage:report.usage,failures}));
