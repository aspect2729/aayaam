export type SeoConnectionSpec = {
  api: string;
  neededFor: string;
  env: string[];
  flag: string;
  doc: string;
};

export const seoConnections: SeoConnectionSpec[] = [
  {
    api: "Google Business Profile APIs",
    neededFor: "Profile, posts, reviews, media, performance",
    env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_CLOUD_PROJECT_ID"],
    flag: "FEATURE_GBP_API",
    doc: "https://developers.google.com/my-business/content/prereqs",
  },
  {
    api: "Google Search Console API",
    neededFor: "Queries, pages, URL inspection, sitemaps",
    env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    flag: "FEATURE_SEARCH_CONSOLE",
    doc: "https://developers.google.com/webmaster-tools/v1/api_reference_index",
  },
  {
    api: "Places API (New)",
    neededFor: "Place ID and competitor details",
    env: ["GOOGLE_MAPS_API_KEY"],
    flag: "FEATURE_PLACES",
    doc: "https://developers.google.com/maps/documentation/places/web-service/text-search",
  },
  {
    api: "PageSpeed Insights API",
    neededFor: "Lighthouse lab data",
    env: ["GOOGLE_PSI_API_KEY"],
    flag: "FEATURE_PSI",
    doc: "https://developers.google.com/speed/docs/insights/v5/get-started",
  },
  {
    api: "Chrome UX Report API",
    neededFor: "Real-user Core Web Vitals",
    env: ["GOOGLE_CRUX_API_KEY"],
    flag: "FEATURE_CRUX",
    doc: "https://developer.chrome.com/docs/crux/api",
  },
  {
    api: "Keyword data (Google Ads or DataForSEO)",
    neededFor: "Search volumes",
    env: ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"],
    flag: "FEATURE_KEYWORDS",
    doc: "https://developers.google.com/google-ads/api/docs/keyword-planning/overview",
  },
  {
    api: "Maps rank API (DataForSEO, Local Falcon, or SerpApi)",
    neededFor: "Local rank grid",
    env: ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"],
    flag: "FEATURE_RANK",
    doc: "https://docs.dataforseo.com/v3/serp/google/maps/live/advanced/",
  },
  {
    api: "WordPress REST API",
    neededFor: "Page drafts after the owner approves them",
    env: [],
    flag: "FEATURE_WORDPRESS",
    doc: "https://developer.wordpress.org/rest-api/",
  },
  {
    api: "Browser worker",
    neededFor: "Read-only crawl of the business site",
    env: ["BROWSER_WORKER_URL", "BROWSER_WORKER_SECRET"],
    flag: "FEATURE_BROWSER",
    doc: "https://playwright.dev/",
  },
  {
    api: "IndexNow",
    neededFor: "Bing and other participating engines",
    env: ["INDEXNOW_KEY"],
    flag: "FEATURE_INDEXNOW",
    doc: "https://www.indexnow.org/documentation",
  },
];
