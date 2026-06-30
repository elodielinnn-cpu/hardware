const radarTaxonomy = {
  asOfDate: "2026-06-30",
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
    { id: "consumer_3c", label: "3C 产品", tone: "yellow" },
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
      "当日重点集中在 AI 服务器供给、苹果供应链备货和高功耗机柜配套。对 3C 电子和机柜组件制造商来说，更值得优先跟踪的是订单能见度、备货节奏、散热与电源规格变化。",
    week:
      "最近一周的硬件信息显示，AI 数据中心资本开支继续向液冷、电源、光模块、ODM 和 HBM 链条扩散；消费电子端则围绕 AI 手机、AI PC 和苹果新机备货形成结构性线索。",
    month:
      "最近一个月的主线仍是 AI 基础设施投入外溢到上游零部件和整柜交付，同时 3C 产品端需要用销量、备货和 BOM 变化验证端侧 AI 的真实拉动。"
  }
};
