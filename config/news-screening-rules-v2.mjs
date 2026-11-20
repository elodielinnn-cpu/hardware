// Shared public labels and active production scope. Screening decisions live in
// experiments/news-filter-v3/news-filter-v3.mjs; both replay and cloud import it.
export const SCREENING_RULE_VERSION = '2.0.0';
export const ACTIVE_BUSINESS_SCOPE = Object.freeze(['datacom', 'automotive']);
export const HOMEPAGE_PATHS = Object.freeze({
  productTechnology: 'product_technology_change',
  strategicBusiness: 'strategic_business_change',
  industryDemandRisk: 'industry_demand_cost_risk',
  engineeringAnalysis: 'engineering_analysis'
});
export const TAGGING_TAXONOMY = Object.freeze({
  domains: { datacom: '通信与数据中心', automotive: '汽车电子' },
  events: { technology: '新技术', product: '新产品', partnership: '商业合作', order: '订单与定点', investment: '投资与产能', operations: '经营变化', risk: '政策与风险' },
  stages: { published: '已发布', validation: '试验验证', initial_use: '初步应用', scale_use: '规模应用', planned: '计划中', unknown: '未明确', not_applicable: '不适用' },
  availability: { unknown: '未说明', preorder: '预订', orderable: '可购买/可订阅' }
});
