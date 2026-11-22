const radarTaxonomy = {
  asOfDate: "2026-11-22",
  latestArticleDate: "2026-11-22",
  lastUpdatedAt: "2026-11-22T14:54:00+08:00",
  rangeOptions: [
    { id: "day", label: "当日", days: 1 },
    { id: "week", label: "最近一周", days: 7 },
    { id: "month", label: "最近一个月", days: 30 }
  ],
  signalCategories: [
    { id: "supply_chain", label: "供应链", description: "供给、价格、交付、制造、库存、产能和关键物料。" },
    { id: "product", label: "产品", description: "终端新品、平台升级、规格变化和用户需求。" },
    { id: "earnings", label: "财报", description: "财报、资本开支、指引、收入结构和订单能见度。" },
    { id: "company", label: "公司动态", description: "合作、并购、组织调整、客户突破和重大合同。" },
    { id: "macro", label: "宏观经济", description: "利率、汇率、政策、贸易和需求环境。" }
  ],
  industries: [
    { id: "data_center_hardware", label: "数据中心硬件", tone: "green" },
    { id: "automotive", label: "汽车电子", tone: "yellow" },
    { id: "components", label: "核心零部件", tone: "purple" },
    { id: "industry_signal", label: "财报/产业信号", tone: "slate" }
  ],
  importances: [
    { id: "high", label: "高", rank: 3 },
    { id: "medium", label: "中", rank: 2 },
    { id: "low", label: "低", rank: 1 }
  ],
  summaries: {
    day:
      "当日重点关注通信与数据中心、汽车电子的具体产品、技术和供应链变化。优先核对订单、交付、产能、功耗、散热与系统设计证据。",
    week:
      "最近一周重点跟踪 AI 数据中心的机柜、散热、电源与互连，以及汽车电子的感知、控制和电气架构变化。",
    month:
      "最近一个月持续核对数据中心和汽车电子的新产品、客户采用、供应商变化与产能进展。"
  }
};
