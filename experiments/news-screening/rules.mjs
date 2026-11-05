// Event recognition and business scope are separate, editable inputs.
export const eventRules = [
  { type: '供应商变化', pattern: /\b(?:select(?:s|ed|ing)?|replac(?:es|ed|ing)|switch(?:es|ed|ing)?|add(?:s|ed|ing)?|expand(?:s|ed|ing)?)\b.{0,90}\b(?:suppliers?|manufacturing partners?|partnerships?|sourcing)\b|\b(?:suppliers?|manufacturing partners?)\b.{0,70}\b(?:selected|replaced|added|changed)\b|(?:新增|更换|替换|选定|扩大).{0,30}(?:供应商|制造伙伴|供应合作)/iu },
  { type: '订单与产能', pattern: /\b(?:expand(?:s|ed|ing)?|increas(?:es|ed|ing)|relocat(?:es|ed|ing)|transfer(?:s|red|ring)?|start(?:s|ed|ing)?|begin(?:s|ning)?|began|secur(?:es|ed|ing)|sign(?:s|ed|ing)?)\b.{0,90}\b(?:production|capacity|factory|manufacturing|orders?|supply agreement)\b|\b(?:entered|enters) (?:mass|volume) production\b|扩产|开始量产|进入量产|产能迁移|新增产能|(?:获得|签署|新增).{0,20}(?:订单|供货协议)/iu },
  { type: '并购与投资', pattern: /\b(?:acquir(?:e[sd]?|ing)|acquisition of|merge[sd]? with|invest(?:s|ed|ing)? in|investment in)\b|(?:收购|并购|投资建设)/iu },
  { type: '需求与成本变化', pattern: /\b(?:shipments?|sales|demand|costs?|prices?|revenue)\b.{0,70}\b(?:rose|fell|up|down|grow\w*|declin\w*|increas\w*|decreas\w*|ris\w*|drop\w*)\b|(?:出货|销量|需求|成本|价格|营收).{0,30}(?:增长|下降|提高|降低|上涨|下跌)/iu },
  { type: '技术与制造变化', pattern: /\b(?:adopt(?:s|ed|ing)?|replac(?:es|ed|ing)|redesign(?:s|ed|ing)?|upgrad(?:es|ed|ing)|improv(?:es|ed|ing)|reduc(?:es|ed|ing)|increas(?:es|ed|ing)|revis(?:es|ed|ing)|switch(?:es|ed|ing)? to|introduc(?:es|ed|ing)|now features)\b|采用|替换|重新设计|升级|改进|降低|提高|修订|改用/iu },
  { type: '政策与供应风险', pattern: /\b(?:impos(?:es|ed|ing)|rais(?:es|ed|ing)|lift(?:s|ed|ing)?|restrict(?:s|ed|ing)?|halt(?:s|ed|ing)?|recall(?:s|ed|ing)?)\b.{0,80}\b(?:tariffs?|exports?|production|components?|products?)\b|(?:加征|取消).{0,20}关税|出口管制|供应中断|停产|召回/iu }
];

// Aliases map to existing entries without adding supply relationship claims.
export const productAliases = {
  acoustic_components: ['speakers', 'microphones', 'receiver module', '声学组件'],
  consumer_connectors_and_charging: ['wireless charging receiver', 'wireless charging transmitter'],
  tws_and_smart_audio_assembly: ['TWS earbuds', 'smart speaker assembly'],
  server_power_supply: ['PSUs'],
  coolant_distribution_unit: ['CDUs']
};
export const hardwareDetails = /\b(?:hardware|hinge|enclosure|display|OLED|FATP|SMT|design|architecture|material|diaphragm|driver|membrane|magnet|coil|connector|microphones?|speakers?|acoustic|antenna|module|packaging|manufacturing|process|assembly|yield|cooling|busbar|rack|interconnect|optical|power supply|bandwidth|voltage|watts?|thermal)\b|硬件|结构|材料|振膜|磁体|线圈|声学|连接器|麦克风|扬声器|天线|模组|封装|制造|工艺|组装|良率|散热|机柜|互连|带宽|供电/iu;
export const softwareChange = /\b(?:software|firmware|app|subscription|tokens?|spending limits?|allowances?)\b|软件|固件|应用程序|订阅|额度/iu;

// Working scope comes from the supplied conversation, pending business-owner review.
// Camera modules stay governed by the profile's unresolved entity/evidence boundary.
export const consumerWorkingScope = [
  { productId: 'consumer_structure', productName: '消费电子结构件与转轴', aliases: ['titanium enclosure', 'metal enclosure', 'phone enclosure', 'stainless steel hinge', 'phone hinge', '手机结构件', '手机转轴', '钛金属机壳'] },
  { productId: 'consumer_display', productName: '消费电子显示模组', aliases: ['OLED display', 'Mini LED display', 'display module', '显示模组', '屏幕模组', 'OLED 显示屏'] },
  { productId: 'consumer_wireless', productName: '天线与无线模组', aliases: ['antenna module', 'Wi-Fi module', 'Bluetooth module', '天线模组', '无线模组'] },
  { productId: 'consumer_manufacturing', productName: 'SMT与消费终端组装测试', aliases: ['surface mount technology', 'SMT process', 'FATP', 'final assembly', 'smartphone assembly', 'phone assembly', 'SMT工艺', '贴片工艺', '整机组装', '最终组装'] }
].map(product => ({ ...product, domainId: 'consumer_electronics', domainName: '消费电子', relationshipLevel: 'direct', evidenceStatus: 'conversation_working_scope' }));
