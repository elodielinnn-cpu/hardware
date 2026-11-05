import { matchBusinessProfile } from '../news-filter-v3/business-profile.mjs';

const promotion = /\b(?:deals?|discount|coupon|black friday|giveaway)\b|促销|优惠券|开箱|使用教程/iu;
const irrelevant = /\b(?:screensaver|docuseries|games week|app store|streams? live|streaming|song|subscription|developers?|siri|social platform|网页应用|社交平台|机器人部门|Uber|ios \d|macos \d)\b/iu;
const events = [
  ['供应链与产能', /\b(?:manufacturing (?:program|partners?)|supplier|factory|capacity|mass production|supply agreement|production transfer)\b|扩产|量产|供应商|制造伙伴/iu],
  ['并购与投资', /\b(?:acquir\w*|acquisition|merger|invests?|invested|investment)\b|收购|并购|投资/iu],
  ['需求与经营', /\b(?:shipments?|earnings|quarter results|sales|earnings guidance|demand (?:growth|decline|increase)|market share)\b|出货|财报|销量|需求|指引/iu],
  ['硬件与工艺变化', /\b(?:adopt\w*|replac\w*|upgrad\w*|redesign\w*|first|introduc\w*|launch\w*|unveil\w*|requires?|increases?|reduces?)\b|采用|替换|升级|首次|发布|提高|降低/iu],
  ['政策与供应风险', /\b(?:tariffs?|export controls?|shortage|recall)\b|关税|出口管制|短缺|召回/iu]
];
const terminal = /\b(?:apple|iphone|ipad|macbook|smartphone|automotive|vehicles?|evs?|servers?|data centers?)\b|手机|汽车|服务器/iu;
const rumor = /\b(?:rumou?r|leaker|reportedly|unconfirmed)\b|传闻|爆料|据称/iu;

export function screen(article, profile) {
  const base = { result: '待定', reason: '', evidence: '', business: '', event: '', rule: 'evidence-review-v1' };
  if (promotion.test(article.title) || irrelevant.test(article.title)) {
    return { ...base, result: '排除', reason: '标题属于促销、软件或娱乐内容', evidence: article.title };
  }
  const paragraphs = [article.title, article.summary, ...(article.bodyEvidence || [])].filter(Boolean);
  const matches = matchBusinessProfile(article, profile);
  base.business = [...new Set(matches.articleSubjects.map(x => profile.profile.domains.find(domain => domain.domainId === x.domainId)?.domainName))].filter(Boolean).join('、');
  for (const paragraph of paragraphs) {
    const event = events.find(([, pattern]) => pattern.test(paragraph));
    if (!event) continue;
    const local = matchBusinessProfile({ ...article, title: paragraph, summary: '', originalSummary: '', bodyEvidence: [] }, profile);
    const direct = local.articleSubjects.some(x => x.relationshipLevel === 'direct');
    const strategic = event[0] !== '硬件与工艺变化' && terminal.test(article.title) && terminal.test(paragraph);
    if (/investor relations|corporate governance|annual meeting of shareholders/iu.test(paragraph)) continue;
    if (!direct && !strategic) continue;
    if (!base.business && strategic) base.business = /evs?|vehicles?|automotive|汽车/iu.test(article.title) ? '汽车需求与经营观察' : /servers?|data centers?/iu.test(article.title) ? '数据中心产业观察' : '消费电子需求与供应链观察';
    base.event = event[0];
    base.evidence = paragraph;
    if (paragraph === article.title || rumor.test(paragraph) || article.bodyStatus !== 'ok') continue;
    return { ...base, result: '入选', reason: `原文同段支持${event[0]}及业务对象关系` };
  }
  if (base.evidence || matches.articleSubjects.length || terminal.test(article.title)) {
    return { ...base, reason: article.bodyStatus !== 'ok' ? '正文不足，业务或事件线索需补证' : '存在业务线索，尚缺明确变化及同段依据' };
  }
  return { ...base, result: article.bodyStatus === 'ok' ? '排除' : '待定', reason: article.bodyStatus === 'ok' ? '正文未发现业务对象与事件组合' : '正文提取不足，无法完成判断' };
}
