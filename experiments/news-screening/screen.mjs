import { containsAlias, matchBusinessProfile } from '../news-filter-v3/business-profile.mjs';
import { consumerWorkingScope, eventRules, hardwareDetails, productAliases, softwareChange } from './rules.mjs';

const rumor = /\b(?:rumou?rs?|leakers?|reportedly|unconfirmed|according to people|sources? said)\b|传闻|爆料|据称|知情人士/iu;
const negation = /\b(?:no|not|never|without)\b.{0,35}\b(?:new|chang\w*|replac\w*|adopt\w*|supplier|orders?|agreement)\b|没有.{0,15}(?:变化|更换|新增|订单)|并未|尚未确认/iu;
const boilerplate = /investor relations|corporate governance|annual meeting of shareholders|all rights reserved|as we saw|previously covered|in our .{0,60}coverage from/iu;
const reference = /^(?:it|its|these|this|they|their|the (?:new )?(?:module|component|design|system))\b|^(?:该|这些|其|这一)/iu;

function sentences(paragraphs) {
  return paragraphs.flatMap((paragraph, paragraphIndex) => String(paragraph)
    .split(/(?<=[。！？])|(?<=[.!?])\s+(?=[A-Z“"'])|;\s*|,?\s+(?:while|whereas|but)\s+|\s+and\s+(?=(?:the|a|an|it|its|this|these)\b)/u)
    .map(text => ({ text: text.trim(), paragraphIndex })).filter(item => item.text));
}

export function extractChanges(paragraphs) {
  return sentences(paragraphs).flatMap((sentence, index) => {
    if (boilerplate.test(sentence.text) || negation.test(sentence.text)) return [];
    return eventRules.flatMap(rule => {
      const match = sentence.text.match(rule.pattern);
      if (!match) return [];
      if (rule.type === '技术与制造变化' && (!hardwareDetails.test(sentence.text) || softwareChange.test(sentence.text))) return [];
      return [{ type: rule.type, change: match[0], evidence: sentence.text, sentenceIndex: index, paragraphIndex: sentence.paragraphIndex }];
    });
  });
}

function matchProducts(text, profile) {
  const matches = matchBusinessProfile({ title: text }, profile).articleSubjects;
  const aliasMatches = profile.products.filter(product => (productAliases[product.productId] || []).some(alias => containsAlias(text, alias)));
  const scopeMatches = consumerWorkingScope.filter(product => product.aliases.some(alias => containsAlias(text, alias)));
  const ids = new Set([...matches, ...aliasMatches].map(product => product.productId));
  return [...profile.products.filter(product => ids.has(product.productId)), ...scopeMatches];
}

export function screen(article, profile) {
  const base = {
    result: '待定', reason: '', evidence: '', business: '', event: '', rule: 'event-then-business-v2',
    eventGate: 'not_found', businessGate: 'not_checked', eventEvidence: '', businessEvidence: '', affectedObject: '',
    changes: [], affectedProducts: []
  };
  const body = Array.isArray(article.bodyEvidence) ? article.bodyEvidence : [];
  // First identify changes, without using customer brands to qualify them.
  const changes = extractChanges(body);
  const workingScopeUsed = consumerWorkingScope.some(product => body.some(text => product.aliases.some(alias => containsAlias(text, alias))));
  base.scopeBasis = workingScopeUsed ? 'profile_and_conversation_working_scope' : 'profile';
  const hints = extractChanges([article.title, article.summary].filter(Boolean));
  base.changes = changes;
  base.event = changes[0]?.type || '';
  base.eventEvidence = changes.map(change => change.evidence).filter((text, index, all) => all.indexOf(text) === index).join('\n');
  base.eventGate = changes.length ? 'passed' : hints.length ? 'hint_only' : 'not_found';
  if (article.bodyStatus !== 'ok') {
    return { ...base, reason: '正文不足，无法完成具体变化及产品范围核对' };
  }
  if (!changes.length) {
    return { ...base, result: hints.length ? '待定' : '排除', reason: hints.length ? '标题或摘要有变化线索，正文尚未证实' : '正文没有识别出具体变化，配置罗列和一般发布不通过' };
  }

  // Then bind each change to its object. An unrelated product elsewhere is insufficient.
  const bodySentences = sentences(body);
  let unresolved = null;
  for (const change of changes) {
    const previous = bodySentences[change.sentenceIndex - 1];
    const usesReference = reference.test(change.evidence) && previous?.paragraphIndex === change.paragraphIndex;
    const scopeEvidence = usesReference ? `${previous.text} ${change.evidence}` : change.evidence;
    const products = matchProducts(scopeEvidence, profile);
    if (!products.length) continue;
    const direct = products.filter(product => product.relationshipLevel === 'direct' && ['verified_public', 'conversation_working_scope'].includes(product.evidenceStatus));
    const decision = {
      ...base, businessGate: direct.length ? 'passed' : 'needs_review',
      affectedObject: products.map(product => product.productName).join('、'),
      event: change.type, eventEvidence: change.evidence, businessEvidence: scopeEvidence,
      evidence: change.evidence,
      business: [...new Set(products.map(product => product.domainName))].join('、'),
      affectedProducts: products.map(product => ({ productId: product.productId, productName: product.productName, relationshipLevel: product.relationshipLevel, evidenceStatus: product.evidenceStatus }))
    };
    if (rumor.test([article.title, change.evidence].join(' ')) || !direct.length) {
      unresolved ||= { ...decision, reason: '变化已有线索，业务边界或消息确定性仍需核对' };
      continue;
    }
    return { ...decision, result: '入选', reason: `${change.type}涉及${direct.map(product => product.productName).join('、')}，正文支持变化对象与业务范围对应` };
  }
  if (!unresolved && changes.some(change => change.type !== '需求与成本变化') && matchProducts(body.join(' '), profile).length) {
    return { ...base, businessGate: 'needs_review', reason: '正文同时存在变化和产品线索，但尚未建立变化对象与该产品的明确对应' };
  }
  return unresolved || { ...base, result: '排除', businessGate: 'not_matched', reason: '已识别变化，但变化对象未对应知识表中的立讯产品或制造环节' };
}
