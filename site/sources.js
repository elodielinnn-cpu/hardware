const radarSources = [
  {
    id: "supermicro_newsroom",
    name: "Supermicro Newsroom",
    url: "https://www.supermicro.com/en/newsroom/pressreleases",
    type: "official_news",
    fetchType: "html_listing",
    industries: ["数据中心硬件"],
    signalCategories: ["供应链", "产品", "公司动态"],
    priority: 1,
    active: true
  },
  {
    id: "nvidia_newsroom",
    name: "NVIDIA Newsroom",
    url: "https://nvidianews.nvidia.com/",
    type: "official_news",
    fetchType: "rss_or_html",
    industries: ["数据中心硬件", "核心零部件"],
    signalCategories: ["供应链", "产品", "公司动态"],
    priority: 1,
    active: true
  },
  {
    id: "eetimes",
    name: "EE Times",
    url: "https://www.eetimes.com/",
    type: "editorial_media",
    fetchType: "rss",
    industries: ["核心零部件"],
    signalCategories: ["供应链", "产品", "公司动态"],
    priority: 1,
    active: true
  },
  {
    id: "semiconductor_engineering",
    name: "Semiconductor Engineering",
    url: "https://semiengineering.com/",
    type: "editorial_media",
    fetchType: "rss",
    industries: ["核心零部件"],
    signalCategories: ["供应链", "产品"],
    priority: 1,
    active: true
  },
  {
    id: "trendforce_news",
    name: "TrendForce News",
    url: "https://www.trendforce.com/presscenter/news",
    type: "research_news",
    fetchType: "html_listing",
    industries: ["核心零部件", "数据中心硬件"],
    signalCategories: ["供应链", "产品"],
    priority: 1,
    active: true
  },
  {
    id: "cfol_news",
    name: "光纤在线",
    url: "https://www.c-fol.net/news/",
    type: "editorial_media",
    fetchType: "rss",
    industries: ["数据中心硬件", "核心零部件"],
    signalCategories: ["供应链", "产品", "公司动态"],
    priority: 1,
    active: true
  },
  {
    id: "wiring_harness_news",
    name: "Wiring Harness News",
    url: "https://wiringharnessnews.com/",
    type: "editorial_media",
    fetchType: "rss",
    industries: ["汽车电子"],
    signalCategories: ["供应链", "产品"],
    priority: 2,
    active: true
  },
  {
    id: "three_d_incites",
    name: "3D InCites",
    url: "https://www.3dincites.com/category/3d-in-depth/",
    type: "editorial_media",
    fetchType: "rss",
    industries: ["核心零部件"],
    signalCategories: ["供应链", "产品"],
    priority: 2,
    active: true
  },
  {
    id: "lenovo_press",
    name: "Lenovo Press Releases",
    url: "https://news.lenovo.com/pressroom/press-releases/",
    type: "official_news",
    fetchType: "rss",
    industries: ["数据中心硬件"],
    signalCategories: ["供应链", "产品", "公司动态"],
    priority: 2,
    active: true
  },
  {
    id: "wiwynn_news",
    name: "Wiwynn News",
    url: "https://www.wiwynn.com/news",
    type: "official_news",
    fetchType: "rss",
    industries: ["数据中心硬件"],
    signalCategories: ["供应链", "产品", "公司动态", "财报"],
    priority: 1,
    active: true
  },
  {
    id: "hpe_newsroom",
    name: "HPE Newsroom",
    url: "https://www.hpe.com/us/en/newsroom.html",
    type: "official_news",
    fetchType: "rss",
    industries: ["数据中心硬件"],
    signalCategories: ["供应链", "产品", "公司动态", "财报"],
    priority: 1,
    active: true
  },
  {
    id: "dell_press",
    name: "Dell Technologies Press Releases",
    url: "https://investors.delltechnologies.com/news-events/press-releases",
    type: "investor_relations",
    fetchType: "rss",
    industries: ["数据中心硬件"],
    signalCategories: ["公司动态", "财报", "产品"],
    priority: 1,
    active: true
  },
  {
    id: "tomshardware",
    name: "Tom's Hardware",
    url: "https://www.tomshardware.com/",
    type: "editorial_media",
    fetchType: "rss_filtered",
    industries: ["核心零部件"],
    signalCategories: ["产品", "供应链"],
    priority: 2,
    active: true
  },
  {
    id: "techpowerup",
    name: "TechPowerUp",
    url: "https://www.techpowerup.com/",
    type: "editorial_media",
    fetchType: "rss_filtered",
    industries: ["核心零部件"],
    signalCategories: ["产品", "供应链"],
    priority: 2,
    active: true
  },
  {
    id: "servethehome",
    name: "ServeTheHome",
    url: "https://www.servethehome.com/",
    type: "editorial_media",
    fetchType: "rss",
    industries: ["数据中心硬件"],
    signalCategories: ["供应链", "产品"],
    priority: 1,
    active: true
  },
  {
    id: "storagereview",
    name: "StorageReview",
    url: "https://www.storagereview.com/",
    type: "editorial_media",
    fetchType: "rss_filtered",
    industries: ["数据中心硬件"],
    signalCategories: ["供应链", "产品"],
    priority: 1,
    active: true
  },
  {
    id: "ithome",
    name: "IT之家",
    url: "https://www.ithome.com/",
    type: "editorial_media",
    fetchType: "rss_filtered",
    industries: ["数据中心硬件", "核心零部件"],
    signalCategories: ["供应链", "产品", "公司动态"],
    priority: 1,
    active: true
  },
  {
    id: "intel_newsroom",
    name: "Intel Newsroom",
    url: "https://www.intel.com/content/www/us/en/newsroom/home.html",
    type: "official_news",
    fetchType: "rss_or_html",
    industries: ["核心零部件", "数据中心硬件"],
    signalCategories: ["产品", "公司动态", "供应链"],
    priority: 1,
    active: false
  },
  {
    id: "amd_newsroom",
    name: "AMD Newsroom",
    url: "https://www.amd.com/en/newsroom.html",
    type: "official_news",
    fetchType: "rss_or_html",
    industries: ["核心零部件", "数据中心硬件"],
    signalCategories: ["产品", "公司动态"],
    priority: 1,
    active: false
  },
  {
    id: "qualcomm_news",
    name: "Qualcomm News",
    url: "https://www.qualcomm.com/news",
    type: "official_news",
    fetchType: "rss_or_html",
    industries: ["核心零部件"],
    signalCategories: ["产品", "公司动态"],
    priority: 1,
    active: false
  },
  {
    id: "mediatek_press",
    name: "MediaTek Press Releases",
    url: "https://www.mediatek.com/news-events/press-releases",
    type: "official_news",
    fetchType: "html",
    industries: ["核心零部件"],
    signalCategories: ["产品", "公司动态"],
    priority: 2,
    active: false
  },
  {
    id: "samsung_newsroom",
    name: "Samsung Newsroom",
    url: "https://news.samsung.com/global/",
    type: "official_news",
    fetchType: "rss_or_html",
    industries: ["核心零部件"],
    signalCategories: ["产品", "供应链", "公司动态"],
    priority: 2,
    active: false
  },
  {
    id: "micron_blog",
    name: "Micron Blog",
    url: "https://www.micron.com/about/blog",
    type: "official_news",
    fetchType: "html",
    industries: ["核心零部件", "数据中心硬件"],
    signalCategories: ["供应链", "产品", "财报"],
    priority: 2,
    active: false
  },
  {
    id: "marvell_newsroom",
    name: "Marvell Newsroom",
    url: "https://investor.marvell.com/news-events/press-releases/rss",
    type: "official_news",
    fetchType: "rss_filtered",
    industries: ["数据中心硬件", "核心零部件"],
    signalCategories: ["产品", "公司动态"],
    priority: 2,
    active: true
  },
  {
    id: "vertiv_news",
    name: "Vertiv News & Insights",
    url: "https://www.vertiv.com/rssfeed",
    type: "official_news",
    fetchType: "rss_filtered",
    industries: ["数据中心硬件"],
    signalCategories: ["供应链", "产品", "公司动态"],
    priority: 2,
    active: true
  },
  {
    id: "foxconn_press",
    name: "Foxconn Press Releases",
    url: "https://www.foxconn.com/en-us/press-center/press-releases",
    type: "official_news",
    fetchType: "html",
    industries: ["数据中心硬件"],
    signalCategories: ["供应链", "公司动态", "财报"],
    priority: 2,
    active: false
  },
  {
    id: "microsoft_ir",
    name: "Microsoft Investor Relations",
    url: "https://www.microsoft.com/en-us/investor",
    type: "investor_relations",
    fetchType: "html",
    industries: ["数据中心硬件", "财报/产业信号"],
    signalCategories: ["财报", "宏观经济"],
    priority: 1,
    active: false
  },
  {
    id: "amazon_ir",
    name: "Amazon Investor Relations",
    url: "https://ir.aboutamazon.com/",
    type: "investor_relations",
    fetchType: "html",
    industries: ["数据中心硬件", "财报/产业信号"],
    signalCategories: ["财报"],
    priority: 1,
    active: false
  },
  {
    id: "sec_edgar",
    name: "SEC EDGAR",
    url: "https://www.sec.gov/edgar/search/",
    type: "filings",
    fetchType: "api",
    industries: ["数据中心硬件", "财报/产业信号"],
    signalCategories: ["财报", "公司动态", "宏观经济"],
    priority: 1,
    active: true
  },
  {
    id: "meta_news",
    name: "Meta Newsroom",
    url: "https://about.meta.com/news/",
    type: "official_news",
    fetchType: "html",
    industries: ["数据中心硬件"],
    signalCategories: ["产品", "公司动态", "财报"],
    priority: 3,
    active: false
  },
  {
    id: "federal_reserve",
    name: "Federal Reserve News",
    url: "https://www.federalreserve.gov/newsevents.htm",
    type: "macro",
    fetchType: "html",
    industries: ["财报/产业信号"],
    signalCategories: ["宏观经济"],
    priority: 3,
    active: false
  },
  {
    id: "industry_research_placeholder",
    name: "Industry Research Queue",
    url: "",
    type: "research_queue",
    fetchType: "manual",
    industries: ["核心零部件", "数据中心硬件"],
    signalCategories: ["供应链", "产品", "财报"],
    priority: 3,
    active: false
  },
  {
    id: "blocks_and_files",
    name: "Blocks & Files",
    url: "https://blocksandfiles.com/",
    type: "editorial_media",
    fetchType: "html_listing",
    industries: ["数据中心硬件"],
    signalCategories: ["供应链", "产品"],
    priority: 1,
    active: true
  },
  {
    id: "the_register",
    name: "The Register",
    url: "https://www.theregister.com/",
    type: "editorial_media",
    fetchType: "html_listing",
    industries: ["数据中心硬件", "核心零部件"],
    signalCategories: ["供应链", "产品", "公司动态"],
    priority: 1,
    active: true
  },
  {
    id: "open_compute_project",
    name: "Open Compute Project",
    url: "https://www.opencompute.org/news/",
    type: "official_blog",
    fetchType: "rss",
    industries: ["数据中心硬件"],
    signalCategories: ["供应链", "产品"],
    priority: 1,
    active: true
  },
  {
    id: "data_center_dynamics",
    name: "Data Center Dynamics",
    url: "https://www.datacenterdynamics.com/",
    type: "editorial_media",
    fetchType: "rss",
    industries: ["数据中心硬件"],
    signalCategories: ["供应链", "产品"],
    priority: 2,
    active: true
  },
  {
    id: "light_reading",
    name: "Light Reading",
    url: "https://www.lightreading.com/network-technology/optical-networking",
    type: "editorial_media",
    fetchType: "rss",
    industries: ["数据中心硬件"],
    signalCategories: ["供应链"],
    priority: 2,
    active: true
  },
  {
    id: "electronics_cooling", name: "Electronics Cooling", url: "https://www.electronics-cooling.com/category/technologies/liquid-cooling/",
    type: "editorial_media", fetchType: "rss", industries: ["数据中心硬件"], signalCategories: ["产品", "供应链"], priority: 2, active: true
  },
  {
    id: "te_connectivity", name: "TE Connectivity", url: "https://teconnectivity.mediaroom.com/",
    type: "official_news", fetchType: "rss", industries: ["数据中心硬件", "汽车电子"], signalCategories: ["产品", "供应链"], priority: 1, active: true
  },
  {
    id: "gasgoo", name: "盖世汽车", url: "https://auto.gasgoo.com/",
    type: "editorial_media", fetchType: "html_listing", industries: ["汽车电子"], signalCategories: ["产品", "供应链", "公司动态"], priority: 1, active: true
  },
  {
    id: "data_center_frontier", name: "Data Center Frontier", url: "https://www.datacenterfrontier.com/",
    type: "editorial_media", fetchType: "html_listing", industries: ["数据中心硬件"], signalCategories: ["供应链", "产品"], priority: 2, active: true
  },
  {
    id: "cabling_installation", name: "Cabling Installation & Maintenance", url: "https://www.cablinginstall.com/data-center",
    type: "editorial_media", fetchType: "html_listing", industries: ["数据中心硬件"], signalCategories: ["产品", "供应链"], priority: 1, active: true
  },
  {
    id: "lightwave_data_center", name: "Lightwave", url: "https://www.lightwaveonline.com/data-center",
    type: "editorial_media", fetchType: "html_listing", industries: ["数据中心硬件"], signalCategories: ["产品", "供应链"], priority: 1, active: true
  },
  {
    id: "automotive_manufacturing_solutions", name: "Automotive Manufacturing Solutions", url: "https://www.automotivemanufacturingsolutions.com/tag/wire%20harness",
    type: "editorial_media", fetchType: "html_listing", industries: ["汽车电子"], signalCategories: ["产品", "供应链"], priority: 2, active: true
  },
  {
    id: "molex_news", name: "Molex", url: "https://www.prnewswire.com/news/molex-incorporated/",
    type: "official_news", fetchType: "html_listing", industries: ["数据中心硬件", "汽车电子"], signalCategories: ["产品", "供应链"], priority: 1, active: true
  },
  {
    id: "samtec_news", name: "Samtec", url: "https://www.samtec.com/about/media-room/",
    type: "official_news", fetchType: "html_listing", industries: ["数据中心硬件"], signalCategories: ["产品", "供应链"], priority: 1, active: true
  },
  {
    id: "coherent_news", name: "Coherent", url: "https://www.coherent.com/company/newsroom/press-releases",
    type: "official_news", fetchType: "html_listing", industries: ["数据中心硬件"], signalCategories: ["产品", "供应链"], priority: 1, active: true
  },
  {
    id: "lumentum_news", name: "Lumentum", url: "https://www.lumentum.com/en/newsroom/news-releases",
    type: "official_news", fetchType: "html_listing", industries: ["数据中心硬件"], signalCategories: ["产品", "供应链"], priority: 1, active: true
  },
  {
    id: "delta_news", name: "Delta", url: "https://www.deltaww.com/en-US/press",
    type: "official_news", fetchType: "html_listing", industries: ["数据中心硬件"], signalCategories: ["产品", "供应链"], priority: 1, active: true
  },
  {
    id: "coolit_news", name: "CoolIT", url: "https://www.coolitsystems.com/resources/news/",
    type: "official_news", fetchType: "html_listing", industries: ["数据中心硬件"], signalCategories: ["产品", "供应链"], priority: 1, active: true
  },
  {
    id: "schneider_news", name: "Schneider Electric", url: "https://www.se.com/ww/en/about-us/newsroom/",
    type: "official_news", fetchType: "html_listing", industries: ["数据中心硬件"], signalCategories: ["产品", "供应链"], priority: 2, active: true
  },
  {
    id: "aptiv_news", name: "Aptiv", url: "https://www.aptiv.com/en/newsroom",
    type: "official_news", fetchType: "html_listing", industries: ["汽车电子"], signalCategories: ["产品", "供应链"], priority: 1, active: true
  },
  {
    id: "lear_news", name: "Lear", url: "https://www.lear.com/newsroom",
    type: "official_news", fetchType: "html_listing", industries: ["汽车电子"], signalCategories: ["产品", "供应链"], priority: 2, active: true
  },
  {
    id: "leoni_news", name: "LEONI", url: "https://www.leoni.com/press",
    type: "official_news", fetchType: "html_listing", industries: ["汽车电子"], signalCategories: ["产品", "供应链"], priority: 1, active: true
  }
];
