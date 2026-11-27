import { decodeReviewText } from '../gemini-homepage-review/cache.mjs';
import { normalizeText } from '../news-filter-v3/business-profile.mjs';
import { eventKey } from './rules.mjs';

export function prepareBody(raw, limit = 12000) {
  const paragraphs = [];
  const removed = [];
  let available = 0;
  let sent = 0;
  for (const [index, value] of (raw || []).entries()) {
    const text = decodeReviewText(value).replace(/\s+/gu,' ').trim();
    if (!text) continue;
    if (/^\d{1,2}:\d{2}\s+by\s+\S+.*\(\s*\d+\s*\)$/iu.test(text)
      || /^《.{1,180}》$/u.test(text)
      || /^(?:related articles|recommended for you|most read|also read|相关阅读|相关阅读推荐)\s*[:：]?$/iu.test(text)) {
      removed.push(index + 1);
      continue;
    }
    available += text.length;
    if (sent >= limit) continue;
    const end = Math.min(text.length,limit-sent);
    paragraphs.push({paragraph_id:'p'+(index+1),text:text.slice(0,end)});
    sent += end;
  }
  return {paragraphs, range:{available,sent,truncated:sent<available,removed,
    segments:paragraphs.map(p=>({paragraph_id:p.paragraph_id,start:0,end:p.text.length}))}};
}

export function canonicalUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:','https:'].includes(url.protocol)) return '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_.*|fbclid|gclid|mc_cid|mc_eid)$/iu.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return url.hostname.replace(/^www\./u,'') + url.pathname.replace(/\/+$/u,'') + url.search;
  } catch { return ''; }
}

const oldStages = {published:'announced',validation:'validated',initial_use:'in_use',planned:'planned'};
export function incumbentFact(article) {
  const old = article.unifiedTagging?.homepageEvent || article.unifiedTagging?.mainEvent;
  if (!old?.evidence?.trim() || article.homepageQualityReview?.verdict !== 'SHOW'
    || !article.homepageQualityReview.articleEvidence?.trim()) return null;
  const reviewed = normalizeText(article.homepageQualityReview.articleEvidence);
  if (!reviewed || !normalizeText(old.evidence).includes(reviewed)) return null;
  return {subject:old.actor,object:old.object,action:old.action || old.eventType,
    status:oldStages[old.stage] || old.stage, evidence:{change:{quote:old.evidence}},
    origin:'verified_old_homepage'};
}

export function compareEvent(row, keeper) {
  const a = row.selected, b = keeper.selected;
  const url = canonicalUrl(row.url);
  if (a?.status && b?.status && a.status !== b.status
    && ![a.status,b.status].some(stage=>['unknown','not_applicable'].includes(stage))) return '';
  if (url && url === canonicalUrl(keeper.url)) return 'same_url';
  if (row.oldDuplicateOf && canonicalUrl(row.oldDuplicateOf) === canonicalUrl(keeper.url)) return 'prior_duplicate_record';
  const key = eventKey(a);
  if (key && key === eventKey(b)) return 'same_dated_event';
  if (a?.event_date && b?.event_date && a.event_date !== b.event_date) return '';
  const actor = normalizeText(a?.subject || '');
  const otherActor = normalizeText(b?.subject || '');
  const object = normalizeText(a?.object || '');
  const otherObject = normalizeText(b?.object || '');
  const sameActor = actor && actor === otherActor;
  const sameObject = object && object === otherObject;
  if ((sameActor && sameObject) || (sameObject && (!actor || !otherActor))
    || (sameActor && (!object || !otherObject))) return 'possible_duplicate';
  return '';
}
