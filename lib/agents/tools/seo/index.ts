export const seoTools = [
  { name: "seo.get_state", actionClass: 1 as const, effect: "read" },
  { name: "gbp.get_profile", actionClass: 1 as const, effect: "read" },
  { name: "gsc.query", actionClass: 1 as const, effect: "read" },
  { name: "psi.run", actionClass: 1 as const, effect: "read" },
  { name: "places.search_text", actionClass: 1 as const, effect: "read" },
  { name: "keywords.get_volumes", actionClass: 1 as const, effect: "read" },
  { name: "rank.grid", actionClass: 1 as const, effect: "read" },
  { name: "browser.fetch", actionClass: 1 as const, effect: "read" },
  { name: "seo.plan.update", actionClass: 2 as const, effect: "internal" },
  { name: "content.draft.create", actionClass: 2 as const, effect: "internal" },
  { name: "gbp.propose_post", actionClass: 3 as const, effect: "proposal" },
  { name: "gbp.propose_review_reply", actionClass: 3 as const, effect: "proposal" },
  { name: "gbp.propose_update", actionClass: 3 as const, effect: "proposal" },
  { name: "cms.propose_page_update", actionClass: 3 as const, effect: "proposal" },
  { name: "citation.propose_update", actionClass: 3 as const, effect: "proposal" },
] as const;

export function toolClass(name: string, field?: string): 1 | 2 | 3 | 4 {
  if (name === "gbp.propose_update" && field && ["name", "address", "phone", "primary_category", "service_area"].includes(field)) return 4;
  const tool = seoTools.find((item) => item.name === name);
  return tool?.actionClass ?? 1;
}
