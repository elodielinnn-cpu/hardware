import { normalizeText } from '../news-filter-v3/business-profile.mjs';

export const VERSION = 'news-event-facts-v1';
const signal = ['product_change','engineering_result','adoption_or_delivery','capacity_change',
  'operating_change','market_shift','policy_or_supply_risk'];
const status = ['planned','announced','validated','in_use','shipped','in_production','not_applicable','unknown'];
const dimensions = ['capacity','procurement','delivery','cost','design','performance','reliability',
  'validation','demand','supply','capex','competition','policy','operations','unknown'];
const kinds = ['capacity_milestone','order_or_adoption','design_change','comparison_result','actual_validation',
  'procurement_or_supply','capex_guidance','named_project_milestone','substitute_validation','policy_change','other'];
const enumOf = values => ({ type: 'string', enum: values });
const string = { type: 'string' };
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const quote = object({ paragraph_id: string, quote: string });
const event = object({
  subject: string, object: string, signal: enumOf(signal), business_id: string,
  relation: enumOf(['direct','adjacent','upstream','unmatched']), status: enumOf(status),
  claim_status: enumOf(['confirmed','attributed_forecast','unconfirmed_report']),
  event_date: string, counterpart: string, kind: enumOf(kinds),
  change: object({ dimension: enumOf(dimensions), direction: enumOf(['increase','decrease','change','unknown']),
    before: string, after: string, unit: string }),
  impact: object({ affected_business_id: string, dimension: enumOf(dimensions),
    direction: enumOf(['increase','decrease','change','unknown']), basis: enumOf(['stated','inferred','unknown']) }),
  evidence: object({ object: quote, change: quote, impact: quote, status: quote, conditions: quote })
});
export const schema = object({
  article_kind: enumOf(['report','sponsored','routine','rumor']),
  events: { type: 'array', maxItems: 5, items: event }
});

function validShape(value, spec) {
  if (spec.type === 'string') return typeof value === 'string' && value.length <= 320
    && (!spec.enum || spec.enum.includes(value));
  if (spec.type === 'array') return Array.isArray(value) && value.length <= spec.maxItems
    && value.every(item => validShape(item, spec.items));
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === spec.required.length
    && spec.required.every(key => validShape(value[key], spec.properties[key]));
}

const normalizeQuote = text => text.normalize('NFKC').replace(/\s+/gu, ' ').trim();
const emptyQuote = value => !value.paragraph_id && !value.quote;
function validQuote(value, paragraphs) {
  const paragraph = paragraphs.get(value.paragraph_id);
  return Boolean(paragraph && value.quote.trim().length >= 6
    && normalizeQuote(paragraph).includes(normalizeQuote(value.quote)));
}
const validDate = value => /^\d{4}-\d{2}-\d{2}$/u.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
export const inWindow = (publishedAt, asOf, days = 30) => {
  const age = (Date.parse(asOf) - Date.parse(publishedAt)) / 86400000;
  return Number.isFinite(age) && age >= 0 && age < days;
};

const directKinds = {
  capacity_milestone: ['capacity_change','in_production','in_use','planned','announced'],
  order_or_adoption: ['adoption_or_delivery','announced','in_use','shipped','in_production'],
  design_change: ['product_change','announced','validated','in_use','shipped','in_production'],
  comparison_result: ['engineering_result','validated','in_use','shipped','in_production'],
  actual_validation: ['engineering_result','validated','in_use','shipped','in_production']
};
const observationKinds = {
  procurement_or_supply: ['market_shift','operating_change','adoption_or_delivery','policy_or_supply_risk'],
  capex_guidance: ['operating_change','market_shift'],
  named_project_milestone: ['adoption_or_delivery','capacity_change'],
  substitute_validation: ['engineering_result'],
  policy_change: ['policy_or_supply_risk']
};
const materialImpact = new Set(['procurement','delivery','cost','design','competition']);
const result = (tier, rule) => ({ tier, rule });

function assessEvent(fact, paragraphs, profile) {
  const { evidence, status: stage, claim_status: claim, relation, impact, kind, change } = fact;
  const required = ['object','change', ...(stage !== 'unknown' && stage !== 'not_applicable' ? ['status'] : []),
    ...(impact.basis === 'stated' ? ['impact'] : [])];
  if (required.some(key => !validQuote(evidence[key], paragraphs))
    || Object.values(evidence).some(quote => !emptyQuote(quote) && !validQuote(quote, paragraphs))) {
    return result('needs_evidence','quote_missing_or_mismatch');
  }
  if (!fact.subject.trim() || !fact.object.trim() || change.dimension === 'unknown') {
    return result('needs_extraction','missing_concrete_change');
  }
  if (fact.event_date && !validDate(fact.event_date)) return result('needs_extraction','invalid_event_date');
  const mapped = profile.productsById.get(fact.business_id);
  const affected = profile.productsById.get(impact.affected_business_id);
  if (relation === 'unmatched' ? fact.business_id !== '' : mapped?.relationshipLevel !== relation || !mapped) {
    return result('needs_extraction','invalid_business_mapping');
  }
  if ((impact.affected_business_id && !affected) || (impact.basis === 'stated' && !affected)) {
    return result('needs_extraction','invalid_impact_mapping');
  }
  if (claim === 'unconfirmed_report') return result('archive','unconfirmed_report');
  const [expected, ...stages] = directKinds[kind] || [];
  const future = stage === 'planned' || (kind === 'capacity_milestone' && stage === 'announced');
  const directConcrete = expected === fact.signal && stages.includes(stage)
    && (kind !== 'order_or_adoption' || fact.counterpart.trim())
    && (!future || validQuote(evidence.conditions, paragraphs));
  if (relation === 'direct' && claim === 'confirmed' && directConcrete) return result('focus','direct_business_change');
  const indirect = relation === 'adjacent' || relation === 'upstream';
  if (indirect && claim === 'confirmed' && impact.basis === 'stated'
    && affected.relationshipLevel === 'direct' && materialImpact.has(impact.dimension)
    && kind !== 'other' && stage !== 'unknown' && (!future || validQuote(evidence.conditions, paragraphs))) {
    return result('focus','stated_indirect_impact');
  }
  if (mapped && observationKinds[kind]?.includes(fact.signal)
    && (kind !== 'named_project_milestone' || fact.counterpart.trim())
    && (kind !== 'substitute_validation' || stage === 'validated')
    && (claim !== 'attributed_forecast' || ['procurement_or_supply','capex_guidance'].includes(kind))) {
    return result('observation','mapped_industry_signal');
  }
  return result(impact.basis === 'inferred' ? 'needs_evidence' : 'archive',
    impact.basis === 'inferred' ? 'inferred_impact_only' : 'no_qualifying_signal');
}

export function assessArticle(article, input, facts, profile, asOf) {
  const finish = (tier, rule, events = []) => ({ tier, rule, events });
  if (!inWindow(article.publishedAt, asOf)) return finish('archive','outside_window');
  if (!input.paragraphs.length) return finish('needs_evidence','no_article_body');
  if (!validShape(facts, schema)) return finish('needs_extraction','missing_or_invalid_extraction');
  if (facts.article_kind !== 'report') return finish('archive',facts.article_kind);
  if (!facts.events.length) return finish('needs_extraction','no_event');
  const paragraphs = new Map(input.paragraphs.map(p => [p.paragraph_id,p.text]));
  const events = facts.events.map(fact => ({ fact, ...assessEvent(fact, paragraphs, profile) }));
  for (const tier of ['focus','observation','needs_evidence','needs_extraction','archive']) {
    const selected = events.find(item => item.tier === tier);
    if (selected) return { ...finish(tier, selected.rule, events), selected: selected.fact };
  }
}

export function eventKey(fact) {
  if (!fact?.event_date) return '';
  return [fact.subject,fact.object,fact.signal,fact.status,fact.event_date,fact.counterpart,
    fact.change.dimension,fact.change.direction,fact.change.after].map(normalizeText).join('|');
}
