function getInitialLanguage() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("lang");
  if (requested === "zh" || requested === "en") {
    return requested;
  }
  const saved = window.localStorage?.getItem("hardwareRadarLang");
  return saved === "zh" || saved === "en" ? saved : "en";
}

const state = {
  range: "week",
  signalCategory: "全部",
  company: "全部",
  importance: "全部",
  dataType: "全部",
  relevance: "默认",
  query: "",
  lang: getInitialLanguage()
};

const i18n = {
  en: {
    eyebrow: "Hardware Intelligence Radar",
    title: "Hardware Intelligence Radar",
    languageButton: "Language: English",
    dailyFocus: "Daily Focus",
    industrySignals: "Industry Signals",
    sourceStatus: "Source Status",
    collectionControl: "Collection Control",
    rerunCollection: "Rerun Collection",
    search: "Search",
    searchPlaceholder: "Company, keyword",
    signalCategory: "Signal Category",
    dataType: "Data Type",
    relevance: "Relevance",
    company: "Company",
    importance: "Priority",
    feed: "Information Feed",
    reset: "Clear Filters",
    contentStats: "Content Stats",
    industryMix: "Industry Mix",
    highPriority: "High Priority",
    coveredCompanies: "Companies",
    totalItems: "Total Items",
    realCollection: "Real Collection",
    currentWindow: "Current window",
    defaultVisible: "Default Visible",
    hiddenLow: "low-relevance hidden",
    connectedSources: "Connected Sources",
    tierOnePending: "tier-1 sources to expand",
    activeSources: "Active Sources",
    configList: "configured",
    asOf: "As of",
    connected: "Connected",
    pending: "Pending",
    sampleData: "Sample Data",
    why: "Why it matters",
    involvedCompanies: "Companies",
    source: "Source",
    openOriginal: "Open original",
    noSignals: "No sufficiently important industry signals in this window.",
    noResults: "No matching items. Try clearing filters or changing the keyword.",
    items: "items",
    currentView: "items in current view",
    hidden: "low-relevance hidden",
    relevanceSuffix: "relevance"
  },
  zh: {
    eyebrow: "Hardware Intelligence Radar",
    title: "硬件产业雷达",
    languageButton: "语言：中文",
    dailyFocus: "今日重点",
    industrySignals: "产业信号",
    sourceStatus: "数据源状态",
    collectionControl: "采集控制",
    rerunCollection: "重新采集",
    search: "搜索",
    searchPlaceholder: "公司、关键词",
    signalCategory: "信号分类",
    dataType: "数据类型",
    relevance: "相关度",
    company: "公司",
    importance: "重要性",
    feed: "信息流",
    reset: "清除筛选",
    contentStats: "内容统计",
    industryMix: "行业分布",
    highPriority: "高优先级",
    coveredCompanies: "覆盖公司",
    totalItems: "信息总量",
    realCollection: "真实采集",
    currentWindow: "当前时间范围",
    defaultVisible: "默认可见",
    hiddenLow: "条低相关已隐藏",
    connectedSources: "已接入源",
    tierOnePending: "个一级源待扩展",
    activeSources: "启用源",
    configList: "配置清单",
    asOf: "截至",
    connected: "已接入",
    pending: "待接入",
    sampleData: "样例数据",
    why: "为什么重要",
    involvedCompanies: "涉及公司",
    source: "来源",
    openOriginal: "打开原文",
    noSignals: "当前时间范围内没有足够重要的产业信号。",
    noResults: "没有匹配的信息，试试清除筛选或换一个关键词。",
    items: "条信息",
    currentView: "当前视图共",
    hidden: "已隐藏",
    relevanceSuffix: "相关"
  }
};

const labelMap = {
  en: {
    全部: "All",
    默认: "Default",
    高: "High",
    中: "Medium",
    低: "Low",
    供应链: "Supply Chain",
    产品: "Product",
    财报: "Financials",
    公司动态: "Company Moves",
    宏观经济: "Macro",
    "数据中心硬件": "Data Center Hardware",
    "3C 产品": "3C Products",
    "核心零部件": "Core Components",
    "财报/产业信号": "Financial / Industry Signal",
    真实采集: "Real Collection",
    样例数据: "Sample Data",
    当日: "Today",
    最近一周: "7 Days",
    最近一个月: "30 Days",
    official_news: "Official News",
    editorial_media: "Editorial Media",
    research_news: "Research News",
    investor_relations: "Investor Relations",
    rss: "RSS",
    rss_or_html: "RSS / HTML",
    rss_filtered: "Filtered RSS",
    html: "HTML"
  },
  zh: {
    official_news: "官方新闻",
    editorial_media: "行业媒体",
    research_news: "研究资讯",
    investor_relations: "投资者关系",
    rss: "RSS",
    rss_or_html: "RSS / HTML",
    rss_filtered: "筛选 RSS",
    html: "HTML"
  }
};

function t(key) {
  return i18n[state.lang][key] || i18n.en[key] || key;
}

function displayLabel(value) {
  return labelMap[state.lang]?.[value] || value;
}

function getImportanceRank(label) {
  return radarData.importances.find((importance) => importance.label === label)?.rank || 0;
}

function getSource(article) {
  return radarData.sources.find((source) => source.id === article.sourceId) || {
    name: article.source || "未知来源",
    url: article.sourceUrl || ""
  };
}

function uniqueValues(values) {
  return ["全部", ...Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "zh-CN"))];
}

function getCurrentRange() {
  return radarData.rangeOptions.find((option) => option.id === state.range) || radarData.rangeOptions[0];
}

function daysBetween(asOfDate, articleDate) {
  const dayMs = 24 * 60 * 60 * 1000;
  const asOf = new Date(`${asOfDate}T00:00:00`);
  const date = new Date(`${articleDate}T00:00:00`);
  return Math.floor((asOf - date) / dayMs);
}

function getRangeArticles() {
  const range = getCurrentRange();
  return radarData.articles.filter((article) => {
    const diff = daysBetween(radarData.asOfDate, article.publishedAt);
    return diff >= 0 && diff < range.days;
  });
}

function getVisibleRangeArticles() {
  return getRangeArticles().filter((article) => state.relevance !== "默认" || article.showByDefault !== false);
}

function getFilteredArticles() {
  return getVisibleRangeArticles()
    .filter(matchesArticle)
    .sort((a, b) => getImportanceRank(b.importance) - getImportanceRank(a.importance) || b.publishedAt.localeCompare(a.publishedAt));
}

function getFilters() {
  const articles = getVisibleRangeArticles();
  return {
    signalCategories: [
      "全部",
      ...radarData.signalCategories
        .map((category) => category.label)
        .filter((label) => articles.some((article) => article.signalCategory === label))
    ],
    companies: uniqueValues(articles.flatMap((article) => article.companies)),
    importances: ["全部", ...radarData.importances.map((importance) => importance.label)],
    dataTypes: uniqueValues(getRangeArticles().map((article) => article.dataSourceType || "样例数据")),
    relevances: ["默认", "全部", "高", "中", "低"]
  };
}

function matchesArticle(article) {
  const source = getSource(article);
  const relevance = article.relevance || "中";
  const text = [
    article.title,
    getArticleTitle(article),
    article.signalCategory,
    displayLabel(article.signalCategory),
    article.industry,
    displayLabel(article.industry),
    article.topic,
    source.name,
    article.summary,
    getArticleSummary(article),
    article.whyItMatters,
    getArticleWhy(article),
    ...article.companies,
    ...article.tags
  ]
    .join(" ")
    .toLowerCase();

  return (
    (state.signalCategory === "全部" || article.signalCategory === state.signalCategory) &&
    (state.company === "全部" || article.companies.includes(state.company)) &&
    (state.importance === "全部" || article.importance === state.importance) &&
    (state.dataType === "全部" || (article.dataSourceType || "样例数据") === state.dataType) &&
    (state.relevance === "默认" || state.relevance === "全部" || relevance === state.relevance) &&
    (!state.query || text.includes(state.query.toLowerCase()))
  );
}

function setFilter(key, value) {
  state[key] = value;
  render();
}

function renderFilter(containerId, values, key) {
  const container = document.getElementById(containerId);
  container.innerHTML = values
    .map(
      (value) =>
        `<button class="chip ${state[key] === value ? "active" : ""}" type="button" data-key="${key}" data-value="${value}">${displayLabel(value)}</button>`
    )
    .join("");
}

function renderRangePicker() {
  const range = getCurrentRange();
  const displayDate = radarData.asOfDate.replaceAll("-", ".");
  document.getElementById("date-label").textContent = displayLabel(range.label);
  document.getElementById("date-value").textContent = range.id === "day" ? displayDate : `${t("asOf")} ${displayDate}`;
  renderFilter(
    "range-filters",
    radarData.rangeOptions.map((option) => option.label),
    "rangeLabel"
  );

  document.querySelectorAll('[data-key="rangeLabel"]').forEach((button) => {
    const option = radarData.rangeOptions.find((item) => item.label === button.dataset.value);
    button.classList.toggle("active", option.id === state.range);
  });
}

function getStats(articles) {
  const companies = new Set(articles.flatMap((article) => article.companies));
  return {
    content: [
      { label: t("highPriority"), value: articles.filter((article) => article.importance === "高").length, tone: "red" },
      { label: t("coveredCompanies"), value: companies.size, tone: "blue" },
      { label: t("totalItems"), value: articles.length, tone: "slate" }
    ],
    industry: radarData.industries
      .filter((industry) => ["数据中心硬件", "3C 产品"].includes(industry.label))
      .map((industry) => ({
        label: industry.label,
        value: articles.filter((article) => article.industry === industry.label).length,
        tone: industry.tone
      }))
  };
}

function countBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    if (!key) {
      return acc;
    }
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function topEntries(counts, limit = 3) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
    .slice(0, limit);
}

function joinLabels(entries) {
  return entries.map(([label, count]) => `${displayLabel(label)} ${count}${state.lang === "zh" ? " 条" : ""}`).join(state.lang === "zh" ? "、" : ", ");
}

function buildDynamicSummary(articles) {
  const range = getCurrentRange();
  if (!articles.length) {
    return state.lang === "zh"
      ? `${range.label}暂无可展示信息。当前数据最新日期是 ${getLatestArticleDate() || "未知"}，可以切换到“最近一周”或“最近一个月”查看已有采集结果。`
      : `No visible items for ${displayLabel(range.label)}. Latest collected date is ${getLatestArticleDate() || "unknown"}; switch to 7 Days or 30 Days to review earlier items.`;
  }

  const focus = getLuxshareRelevantArticles(articles).slice(0, 3);
  if (!focus.length) {
    return state.lang === "zh"
      ? "当前可见信息里，暂时没有明显直接影响立讯精密的线索。建议优先看数据中心硬件、苹果链和服务器 ODM 相关信息。"
      : "No clearly direct Luxshare signal is visible in this window. Prioritize data center hardware, Apple supply chain, and server ODM items.";
  }

  return focus
    .map((article) => getExecutiveSummary(article))
    .join(" ");
}

function getExecutiveSummary(article) {
  const summary = getArticleSummary(article).trim();
  if (!summary) {
    return getArticleTitle(article);
  }
  return summary.endsWith("。") || summary.endsWith(".") ? summary : `${summary}${state.lang === "zh" ? "。" : "."}`;
}

function getLatestArticleDate() {
  return radarData.articles.map((article) => article.publishedAt).filter(Boolean).sort().at(-1);
}

function renderSummary() {
  const articles = getVisibleRangeArticles();
  const stats = getStats(articles);
  document.getElementById("daily-summary").textContent = buildDynamicSummary(articles);
  document.getElementById("summary-grid").innerHTML = `
    <div class="metric-row-label">${t("contentStats")}</div>
    <div class="metric-row">${stats.content.map(renderMetric).join("")}</div>
    <div class="metric-row-label">${t("industryMix")}</div>
    <div class="metric-row">${stats.industry.map((item) => renderMetric({ ...item, label: displayLabel(item.label) })).join("")}</div>
  `;
}

function getLuxshareRelevantArticles(articles) {
  return [...articles]
    .map((article) => ({
      article,
      score: getLuxshareScore(article)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || getImportanceRank(b.article.importance) - getImportanceRank(a.article.importance) || b.article.publishedAt.localeCompare(a.article.publishedAt))
    .map((item) => item.article);
}

function getLuxshareScore(article) {
  const text = [
    article.title,
    article.summary,
    article.whyItMatters,
    article.industry,
    article.signalCategory,
    ...article.companies,
    ...article.tags
  ]
    .join(" ")
    .toLowerCase();

  let score = getImportanceRank(article.importance);
  if (/apple|iphone|airpods|wearable|smartphone|assembly|connector|camera|oled/.test(text)) score += 8;
  if (/server|rack|data center|datacenter|ai infrastructure|power|cooling|interconnect|cable|odm|foxconn|supermicro|vertiv|amphenol/.test(text)) score += 7;
  if (/nvidia|blackwell|gpu|hbm|cloud|capex|microsoft|amazon|google|meta/.test(text)) score += 5;
  if (/geforce now|gaming|robotaxi|stockholder meeting/.test(text)) score -= 6;
  if (article.relevance === "低") score -= 5;
  return score;
}

function getArticleTitle(article) {
  if (state.lang === "en") {
    return article.title;
  }
  return getChineseTitle(article);
}

function getArticleSummary(article) {
  if (state.lang === "zh") {
    return article.summary;
  }
  return getEnglishSummary(article);
}

function getArticleWhy(article) {
  if (state.lang === "zh") {
    return article.whyItMatters;
  }
  return getEnglishWhy(article);
}

function hasChinese(value = "") {
  return /[\u4e00-\u9fa5]/.test(value);
}

function getChineseTitle(article) {
  const title = article.title || "";
  const rules = [
    [/NVIDIA and AWS Collaborate/i, "NVIDIA 与 AWS 扩大生产级 AI 部署合作"],
    [/liquid cooling system/i, "NVIDIA 发布高温液冷方案，降低电力和用水压力"],
    [/specialized AI.*trust/i, "企业专用 AI 建设转向可信部署"],
    [/BioNeMo Agent Toolkit/i, "NVIDIA 发布 BioNeMo Agent Toolkit"],
    [/400 of the World.*500 Fastest Supercomputers/i, "NVIDIA 支撑 TOP500 超算中的 400 多套系统"],
    [/Trusted.*AI Agents.*Telecom/i, "NVIDIA 将 AI Agents 引入电信运营"],
    [/NAIRR Science Program/i, "NAIRR 科研项目采用 NVIDIA AI Infrastructure"],
    [/Materials Simulation.*Astronomy/i, "NVIDIA AI 软件覆盖材料仿真和实验天文学"],
    [/Vera CPU/i, "NVIDIA Vera CPU 面向科研 Agentic AI"],
    [/Eco Wave Power/i, "Eco Wave Power 使用 NVIDIA AI Infrastructure 做数字孪生"],
    [/JUPITER Shows What Exascale Science Looks Like/i, "JUPITER 展示 Exascale 科学计算能力"],
    [/Vera Rubin Delivers/i, "NVIDIA Vera Rubin 进入科研超算"],
    [/Europe Unveils.*NVIDIA AI Supercomputers/i, "欧洲新增 35 台 NVIDIA AI 超算"],
    [/Chinese memory brands ditch Samsung and Micron/i, "中国内存品牌转向 CXMT / YMTC，替代 Samsung 和 Micron"],
    [/Coherent Breaks Ground/i, "Coherent 扩建德州产能，押注 AI 光互连"],
    [/HPE AI Factory With NVIDIA/i, "HPE 与 NVIDIA 扩大 AI Factory 方案"],
    [/Blackwell Sweeps MLPerf/i, "NVIDIA Blackwell 在 MLPerf Training 6.0 中领先"],
    [/NVIDIA Confidential Computing.*Apple/i, "NVIDIA 机密计算进入 Apple Private Cloud Compute"],
    [/NVIDIA and LG Group Build/i, "NVIDIA 与 LG Group 建设 AI Factory"],
    [/HPE filed 10-Q/i, "HPE 发布 10-Q"],
    [/NVIDIA filed 10-Q/i, "NVIDIA 发布 10-Q"],
    [/Apple filed 10-Q/i, "Apple 发布 10-Q"],
    [/Qualcomm filed 10-Q/i, "Qualcomm 发布 10-Q"],
    [/Intel.*18A-P process enters risk production/i, "Intel 18A-P 进入风险生产"],
    [/retail SSD market has almost disappeared/i, "Silicon Motion 称零售 SSD 市场被挤压"],
    [/HPE Expands Self-Driving Networks/i, "HPE 扩展自驱网络，覆盖 AI Factory"]
  ];
  return rules.find(([pattern]) => pattern.test(title))?.[1] || getChineseTitleFallback(article);
}

function getChineseTitleFallback(article) {
  const company = article.companies?.[0] || getSource(article).name;
  if (article.sourceId === "sec_edgar") {
    return `${company} 提交 ${article.topic || "filing"}`;
  }
  if (article.signalCategory === "财报") {
    return `${company} 财务与资本开支更新`;
  }
  if (article.industry === "数据中心硬件") {
    return `${company} 数据中心硬件线索`;
  }
  if (article.industry === "3C 产品") {
    return `${company} 3C 产品线索`;
  }
  if (article.industry === "核心零部件") {
    return `${company} 核心零部件线索`;
  }
  return `${company} ${article.signalCategory || "产业"}线索`;
}

function getEnglishSummary(article) {
  const title = article.title.toLowerCase();
  if (/chinese memory brands|cxmt|ymtc/.test(title)) {
    return "Chinese memory brands are shifting toward CXMT and YMTC, moving domestic substitution from policy narrative into brand and PC OEM procurement.";
  }
  if (/coherent/.test(title)) {
    return "Coherent is expanding Texas optical-component capacity, showing that AI data center bottlenecks are spreading from GPU supply into optical interconnect and high-speed links.";
  }
  if (/hpe ai factory with nvidia|ai factory portfolio/.test(title)) {
    return "HPE is packaging NVIDIA platforms as AI Factory solutions, signaling that enterprise buying is moving from standalone servers toward full infrastructure stacks.";
  }
  if (/mlperf|blackwell leads/.test(title)) {
    return "Blackwell is reinforcing the performance-per-watt narrative in training and agentic AI benchmarks; competition is shifting from single-card speed to rack-level throughput.";
  }
  if (/confidential computing|private cloud compute/.test(title)) {
    return "Apple Private Cloud Compute is adopting NVIDIA confidential computing, showing that Apple AI is not only on-device but also creating controlled cloud-infrastructure demand.";
  }
  if (/lg group|physical ai/.test(title)) {
    return "NVIDIA and LG are pushing AI Factory infrastructure for manufacturing, robotics, and mobility, not just a conventional enterprise IT upgrade.";
  }
  if (/hpe filed 10-q/.test(title)) {
    return "HPE's 10-Q is a validation point for whether AI Factory and server-network demand is turning into revenue, margin, and backlog.";
  }
  if (/nvidia filed 10-q/.test(title)) {
    return "NVIDIA's 10-Q is the key filing for checking Blackwell supply, data center revenue, inventory commitments, and customer concentration.";
  }
  if (/apple filed 10-q/.test(title)) {
    return "Apple's 10-Q is a hard signal for new-product stocking, services growth, inventory, and supply-chain risk in the second-half cycle.";
  }
  if (/qualcomm filed 10-q/.test(title)) {
    return "Qualcomm's 10-Q helps verify whether smartphone SoC, AI PC, and automotive-chip demand is actually recovering.";
  }
  if (/18a-p|diamond rapids/.test(title)) {
    return "Intel 18A-P has entered risk production; the key question is whether Diamond Rapids stays on schedule and triggers a new server-platform design cycle.";
  }
  if (/retail ssd market/.test(title)) {
    return "Silicon Motion says retail SSDs are being squeezed and PC OEMs are moving to third-party drives, pointing to NAND supply being reallocated toward data centers and large customers.";
  }
  if (/self-driving networks/.test(title)) {
    return "HPE is bringing campus, edge, and data center networking into the AI Factory stack, making AI facility delivery more dependent on network automation and rack-level coordination.";
  }
  if (!hasChinese(article.summary)) {
    return article.summary || getEnglishFallbackSummary(article);
  }
  return getEnglishFallbackSummary(article);
}

function getEnglishFallbackSummary(article) {
  const text = `${article.title} ${article.summary} ${article.whyItMatters} ${article.tags?.join(" ") || ""}`.toLowerCase();
  if (/liquid|cooling|thermal|cdu|water/.test(text)) {
    return "Thermal constraints are moving from server-level design into rack-level infrastructure; cooling architecture is becoming part of deployment capacity.";
  }
  if (/power|pdu|busbar|electricity/.test(text)) {
    return "Power delivery is becoming a deployment bottleneck for AI racks, making electrical architecture and rack integration more important.";
  }
  if (/network|ethernet|infiniband|telecom/.test(text)) {
    return "AI infrastructure demand is spreading into networking, which changes rack design, cabling, and deployment coordination.";
  }
  if (/storage|ssd|nand|dram|hbm|memory/.test(text)) {
    return "Memory and storage supply is being repriced by AI data center demand, with potential spillover into server BOM and consumer-electronics stocking.";
  }
  if (/aws|amazon|microsoft|azure|google|meta|cloud/.test(text)) {
    return "Cloud customers are still expanding AI infrastructure, so the signal to watch is CAPEX, rack deployment pace, and supplier allocation.";
  }
  if (/nvidia|blackwell|gpu|ai infrastructure|supercomputer|exascale/.test(text)) {
    return "The relevant signal is not the chip headline itself, but whether AI infrastructure demand pulls through rack, power, cooling, cable, and connector demand.";
  }
  if (/apple|iphone|smartphone|wearable|pc|soc/.test(text)) {
    return "The consumer-electronics signal matters if it changes device specifications, stocking plans, or component supplier qualification.";
  }
  if (/10-q|10-k|8-k|filed|filing/.test(text)) {
    return "This filing should be mined for CAPEX, inventory, backlog, customer concentration, margin, and risk-factor changes.";
  }
  if (/semiconductor|chip|foundry|packaging|process|wafer/.test(text)) {
    return "The semiconductor signal matters if it changes AI chip supply, advanced-packaging capacity, or customer qualification timing.";
  }
  return "This item is kept for monitoring, but it needs a clearer link to orders, specifications, capacity, or customer allocation before it becomes a management priority.";
}

function getEnglishWhy(article) {
  const text = `${article.title} ${article.summary} ${article.whyItMatters}`.toLowerCase();
  if (/cxmt|ymtc|china-produced ddr5|chinese memory/.test(text)) {
    return "For Luxshare, domestic memory adoption affects customer qualification, regional supply-chain design, and substitution risk under export controls.";
  }
  if (/coherent|optical|interconnect/.test(text)) {
    return "For Luxshare, the key is whether high-speed interconnect shifts from inside the server into optical links, changing component qualification and customer design choices.";
  }
  if (/apple|private cloud compute/.test(text)) {
    return "For the Apple chain, watch both device-side spec upgrades and whether cloud AI spending creates new server and interconnect demand.";
  }
  if (/hpe|ai factory|blackwell|mlperf|diamond rapids|18a-p/.test(text)) {
    return "This matters because AI servers are moving from card-level procurement to rack-level delivery; power, thermal, cable, connector, and assembly complexity become more valuable.";
  }
  if (/nand|ssd|memory/.test(text)) {
    return "AI data centers absorbing memory supply can affect both server BOM and consumer-electronics stocking costs; watch whether shortages reach customer production schedules.";
  }
  if (/10-q|10-k|filed/.test(text)) {
    return "The filing is useful only if it is mined for CAPEX, inventory, customer concentration, margin, backlog, and risk-factor changes.";
  }
  return "For Luxshare, this should be tracked only if it changes customer orders, hardware specifications, qualification paths, or supply allocation.";
}

function renderMetric(item) {
  return `<div class="metric ${item.tone}"><span>${item.label}</span><strong>${item.value}</strong></div>`;
}

function renderChrome() {
  document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
  document.title = state.lang === "zh" ? "硬件产业雷达" : "Hardware Intelligence Radar";
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.getElementById("search-input").placeholder = t("searchPlaceholder");
  document.getElementById("language-toggle").setAttribute(
    "aria-label",
    state.lang === "zh" ? "Switch to English" : "切换到中文"
  );
}

function renderSignals() {
  const signals = buildDynamicSignals(getVisibleRangeArticles());

  document.getElementById("signals").innerHTML =
    signals
      .map(
        (signal) => `
          <article class="signal">
            <div class="signal-head">
              <strong>${signal.category}</strong>
              <span>${displayLabel(signal.importance)}</span>
            </div>
            <p>${signal.text}</p>
            <small>${signal.meta}</small>
          </article>
        `
      )
      .join("") || `<div class="empty compact">${t("noSignals")}</div>`;
}

function renderSourceStatus() {
  const rangeArticles = getRangeArticles();
  const visibleArticles = getVisibleRangeArticles();
  const realArticles = rangeArticles.filter((article) => article.dataSourceType === "真实采集");
  const hiddenLow = rangeArticles.filter((article) => article.showByDefault === false).length;
  const connectedSourceIds = new Set(realArticles.map((article) => article.sourceId));
  const activeSources = radarData.sources.filter((source) => source.active);
  const prioritySources = activeSources.filter((source) => source.priority === 1);

  const metrics = [
    { label: t("realCollection"), value: realArticles.length, detail: t("currentWindow") },
    { label: t("defaultVisible"), value: visibleArticles.length, detail: state.lang === "zh" ? `${hiddenLow} ${t("hiddenLow")}` : `${hiddenLow} ${t("hiddenLow")}` },
    { label: t("connectedSources"), value: connectedSourceIds.size, detail: state.lang === "zh" ? `${prioritySources.length} ${t("tierOnePending")}` : `${prioritySources.length} ${t("tierOnePending")}` },
    { label: t("activeSources"), value: activeSources.length, detail: t("configList") }
  ];

  document.getElementById("source-metrics").innerHTML = metrics
    .map(
      (metric) => `
        <div class="status-metric">
          <span>${metric.label}</span>
          <strong>${metric.value}</strong>
          <small>${metric.detail}</small>
        </div>
      `
    )
    .join("");

  document.getElementById("last-generated").textContent = `${t("asOf")} ${radarData.asOfDate}`;
  document.getElementById("source-list").innerHTML = activeSources
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
    .slice(0, 8)
    .map((source) => {
      const count = realArticles.filter((article) => article.sourceId === source.id).length;
      const status = count ? t("connected") : t("pending");
      return `
        <article class="source-row">
          <div>
            <strong>${source.name}</strong>
            <span>${displayLabel(source.type)} · ${displayLabel(source.fetchType)}</span>
          </div>
          <div class="source-count ${count ? "connected" : ""}">
            <span>${status}</span>
            <strong>${count}</strong>
          </div>
        </article>
      `;
    })
    .join("");
}

function buildDynamicSignals(articles) {
  const candidates = articles
    .filter((article) => article.importance !== "低")
    .sort((a, b) => getImportanceRank(b.importance) - getImportanceRank(a.importance) || b.publishedAt.localeCompare(a.publishedAt));

  const grouped = candidates.reduce((acc, article) => {
    const key = article.signalCategory;
    acc[key] = acc[key] || [];
    acc[key].push(article);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([category, items]) => {
      const top = items[0];
      const companies = topEntries(countBy(items.flatMap((item) => item.companies), (company) => company), 3)
        .map(([company]) => company)
        .join("、");
      const industries = joinLabels(topEntries(countBy(items, (item) => item.industry), 2));
      const highCount = items.filter((item) => item.importance === "高").length;

      return {
        category: displayLabel(category),
        importance: highCount ? "高" : "中",
        score: highCount * 10 + items.length,
        text: getSignalText(category, top),
        meta:
          state.lang === "zh"
            ? `${items.length} 条 · ${industries}${companies ? ` · ${companies}` : ""}`
            : `${items.length} items · ${industries}${companies ? ` · ${companies}` : ""}`
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

function getSignalText(category, article) {
  const title = getArticleTitle(article);
  if (category === "供应链") {
    return state.lang === "zh"
      ? `供应链关注交付、功耗、散热、连接和关键物料变化。代表线索：${title}`
      : `Supply-chain signals focus on delivery, power, thermal, interconnect, and critical materials. Lead item: ${title}`;
  }
  if (category === "财报") {
    return state.lang === "zh"
      ? `财报和 filings 用来判断云厂商 CAPEX、订单能见度和硬件需求。代表线索：${title}`
      : `Financial filings help verify CAPEX, backlog visibility, and hardware demand. Lead item: ${title}`;
  }
  if (category === "公司动态") {
    return state.lang === "zh"
      ? `公司合作、ODM 订单和客户关系变化可能先于收入体现。代表线索：${title}`
      : `Partnerships, ODM orders, and customer relationship shifts may appear before revenue. Lead item: ${title}`;
  }
  if (category === "产品") {
    return state.lang === "zh"
      ? `产品新闻需要看是否能转成备货、BOM 或零部件规格变化。代表线索：${title}`
      : `Product news matters only if it changes stocking, BOM, or component specifications. Lead item: ${title}`;
  }
  return state.lang === "zh"
    ? `宏观变化影响客户下单、库存和估值环境。代表线索：${title}`
    : `Macro changes affect customer orders, inventory, and valuation context. Lead item: ${title}`;
}

function renderArticles() {
  const filtered = getFilteredArticles();
  const total = getVisibleRangeArticles().length;
  const hidden = getRangeArticles().filter((article) => article.showByDefault === false).length;

  document.getElementById("result-count").textContent =
    state.lang === "zh"
      ? `${filtered.length} 条信息 · 当前视图共 ${total} 条${state.relevance === "默认" && hidden ? ` · 已隐藏 ${hidden} 条低相关` : ""}`
      : `${filtered.length} ${t("items")} · ${total} ${t("currentView")}${state.relevance === "默认" && hidden ? ` · ${hidden} ${t("hidden")}` : ""}`;
  document.getElementById("article-list").innerHTML =
    filtered
      .map((article) => {
        const source = getSource(article);
        const relevance = article.relevance || "中";
        return `
          <article class="article-card">
            <div class="article-main">
              <div class="article-meta">
                <span>${displayLabel(article.dataSourceType || "样例数据")}</span>
                <span>${displayLabel(relevance)}${state.lang === "zh" ? t("relevanceSuffix") : ` ${t("relevanceSuffix")}`}</span>
                <span>${displayLabel(article.signalCategory)}</span>
                <span>${displayLabel(article.industry)}</span>
                <span>${article.publishedAt}</span>
              </div>
              <h3>${getArticleTitle(article)}</h3>
              <p>${getArticleSummary(article)}</p>
              <div class="why">
                <span>${t("why")}</span>
                <p>${getArticleWhy(article)}</p>
              </div>
              <div class="tag-row">
                ${article.tags.map((tag) => `<span>${tag}</span>`).join("")}
              </div>
            </div>
            <aside class="article-side">
              <span class="importance importance-${article.importance}">${displayLabel(article.importance)}</span>
              <div>
                <small>${t("involvedCompanies")}</small>
                <p>${article.companies.join(" / ")}</p>
              </div>
              <div>
                <small>${t("source")}</small>
                <p>${source.name}</p>
                <p><a href="${article.sourceUrl || source.url}" target="_blank" rel="noreferrer">${t("openOriginal")}</a></p>
              </div>
            </aside>
          </article>
        `;
      })
      .join("") || `<div class="empty">${t("noResults")}</div>`;
}

function syncSignalPanelHeight() {
  const signalPanel = document.querySelector(".signal-panel");

  if (!signalPanel) {
    return;
  }

  if (window.matchMedia("(max-width: 980px)").matches) {
    signalPanel.style.height = "";
    return;
  }

  signalPanel.style.height = "520px";
}

function render() {
  const filters = getFilters();
  renderChrome();
  renderRangePicker();
  renderFilter("signal-category-filters", filters.signalCategories, "signalCategory");
  renderFilter("data-type-filters", filters.dataTypes, "dataType");
  renderFilter("relevance-filters", filters.relevances, "relevance");
  renderFilter("company-filters", filters.companies, "company");
  renderFilter("importance-filters", filters.importances, "importance");
  renderSummary();
  renderSignals();
  renderSourceStatus();
  renderArticles();
  syncSignalPanelHeight();
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!target.matches(".chip")) {
    return;
  }

  if (target.dataset.key === "rangeLabel") {
    const option = radarData.rangeOptions.find((item) => item.label === target.dataset.value);
    state.range = option.id;
    state.signalCategory = "全部";
    state.company = "全部";
    state.importance = "全部";
    state.dataType = "全部";
    state.relevance = "默认";
    render();
    return;
  }

  setFilter(target.dataset.key, target.dataset.value);
});

document.getElementById("search-input").addEventListener("input", (event) => {
  state.query = event.target.value.trim();
  renderArticles();
});

document.getElementById("reset-button").addEventListener("click", () => {
  state.signalCategory = "全部";
  state.company = "全部";
  state.importance = "全部";
  state.dataType = "全部";
  state.relevance = "默认";
  state.query = "";
  document.getElementById("search-input").value = "";
  render();
});

document.getElementById("language-toggle").addEventListener("click", () => {
  state.lang = state.lang === "en" ? "zh" : "en";
  window.localStorage?.setItem("hardwareRadarLang", state.lang);
  render();
});

window.addEventListener("resize", syncSignalPanelHeight);

render();
