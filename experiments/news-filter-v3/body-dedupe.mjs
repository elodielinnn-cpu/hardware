import { canonicalNewsTitle } from './news-filter-v3.mjs';

function normalizedWords(text) {
  return String(text || '').normalize('NFKC').toLowerCase()
    .replace(/&(?:nbsp|mdash|ndash|trade|amp|quot|ldquo|rdquo|lsquo|rsquo);/gu, ' ')
    .replace(/(\d+)\s+(vdc|vac|kw|mw|gw|gb|tb)\b/gu, '$1$2')
    .match(/[a-z0-9]+|[\u4e00-\u9fff]/gu) || [];
}

function paragraphShingles(text) {
  const words = normalizedWords(text);
  if (words.length < 28) return null;
  const shingles = new Set();
  for (let index = 0; index <= words.length - 4; index += 1) {
    shingles.add(words.slice(index, index + 4).join(' '));
  }
  return shingles.size >= 20 ? shingles : null;
}

function bodyParagraphs(article, queueByCandidateId) {
  const entry = queueByCandidateId.get(article.v3Audit?.candidateId);
  const snapshot = entry?.articleSnapshot;
  // A cache entry is only evidence for the same article, not merely the same candidate ID.
  if (!snapshot || snapshot.id !== article.id || snapshot.sourceUrl !== article.sourceUrl
    || canonicalNewsTitle(snapshot.title) !== canonicalNewsTitle(article.title)) return [];
  return (Array.isArray(snapshot.bodyEvidence) ? snapshot.bodyEvidence : [])
    .map(paragraphShingles).filter(Boolean);
}

function sharedParagraphs(left, right) {
  const used = new Set();
  let matches = 0;
  for (const a of left) {
    for (let index = 0; index < right.length; index += 1) {
      if (used.has(index)) continue;
      const b = right[index];
      const smaller = a.size <= b.size ? a : b;
      const larger = a.size <= b.size ? b : a;
      let overlap = 0;
      for (const shingle of smaller) if (larger.has(shingle)) overlap += 1;
      if (overlap >= 20 && overlap / smaller.size >= 0.8) {
        used.add(index);
        matches += 1;
        break;
      }
    }
    if (matches >= 2) return matches;
  }
  return matches;
}

function eventActor(article) {
  return String(article.companies?.[0] || article.unifiedTagging?.mainEvent?.actor || '')
    .normalize('NFKC').toLowerCase().replace(/\b(?:holdings|corporation|company|co|inc|ltd)\b\.?/gu, '').trim();
}

function sameEventContext(left, right) {
  const a = left.unifiedTagging?.mainEvent;
  const b = right.unifiedTagging?.mainEvent;
  if (!a?.eventType || a.eventType !== b?.eventType || !eventActor(left)
    || eventActor(left) !== eventActor(right) || left.sourceId === right.sourceId) return false;
  if (a.stage && b.stage && a.stage !== 'unknown' && b.stage !== 'unknown' && a.stage !== b.stage) return false;
  const daysApart = Math.abs(Date.parse(left.publishedAt) - Date.parse(right.publishedAt)) / 86400000;
  return Number.isFinite(daysApart) && daysApart <= 30;
}

function preference(left, right) {
  return Number(right.sourceCategory === 'official') - Number(left.sourceCategory === 'official')
    || Number(right.sourceWeight || 0) - Number(left.sourceWeight || 0)
    || String(left.publishedAt).localeCompare(String(right.publishedAt))
    || String(left.sourceUrl).localeCompare(String(right.sourceUrl));
}

// Compare independent reports after cloud review, before anything reaches the homepage.
// Two long, highly overlapping body paragraphs plus the same event context are required;
// a common topic or a single reused quote is insufficient.
export function hideDuplicateHomepageBodies(articles, queue) {
  if (!Array.isArray(queue?.items)) throw new Error('Body comparison requires a valid V3 article cache');
  const queueByCandidateId = new Map(queue.items.map(item => [item.candidateId, item]));
  const visible = articles.filter(article => article.showByDefault).sort(preference);
  const bodies = new Map(visible.map(article => [article.id, bodyParagraphs(article, queueByCandidateId)]));
  const duplicateOf = new Map();
  let pairsCompared = 0;
  for (let index = 0; index < visible.length; index += 1) {
    const winner = visible[index];
    if (duplicateOf.has(winner.id) || bodies.get(winner.id).length < 2) continue;
    for (const candidate of visible.slice(index + 1)) {
      if (duplicateOf.has(candidate.id) || bodies.get(candidate.id).length < 2
        || !sameEventContext(winner, candidate)) continue;
      pairsCompared += 1;
      if (sharedParagraphs(bodies.get(winner.id), bodies.get(candidate.id)) >= 2) {
        duplicateOf.set(candidate.id, winner.sourceUrl);
      }
    }
  }
  return {
    articles: articles.map(article => duplicateOf.has(article.id) ? {
      ...article, showByDefault: false,
      defaultFeedAudit: { ...article.defaultFeedAudit, defaultHideReason: 'duplicate_event' },
      v3Audit: { ...article.v3Audit, displayStatus: 'duplicate_hidden',
        homepageDuplicateOf: duplicateOf.get(article.id), duplicateMethod: 'body_paragraph_overlap' }
    } : article),
    diagnostics: { homepageCandidates: visible.length,
      withComparableBody: [...bodies.values()].filter(body => body.length >= 2).length,
      pairsCompared, duplicatesHidden: duplicateOf.size }
  };
}
