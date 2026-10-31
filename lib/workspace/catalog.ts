export const archetypeKeys = [
  "gym_fitness",
  "interior_design",
  "ecommerce_handicraft",
  "service_appointments",
  "service_projects",
  "product_retail_online",
] as const;

export type ArchetypeKey = (typeof archetypeKeys)[number];

export const moduleKeys = [
  "brain",
  "leads",
  "customers",
  "memberships",
  "appointments",
  "projects",
  "catalog",
  "inventory",
  "orders",
  "billing_ecommerce",
  "receipts",
  "marketing_seo",
  "messaging",
  "finance",
  "operations",
  "reports",
  "integrations",
  "settings",
] as const;

export type CatalogModule = (typeof moduleKeys)[number];

export type StageColor = "blue" | "sand" | "lavender" | "mint" | "rose";

export type FieldType = "text" | "long_text" | "number" | "currency_inr" | "date" | "phone" | "email" | "select";

export type WorkspaceConfig = {
  schemaVersion: 1;
  archetype: ArchetypeKey;
  business: {
    displayName: string;
    city?: string;
    localities: string[];
    services: string[];
    languages: Array<"en" | "hi" | "kn">;
    customerTerm: string;
  };
  modules: Array<{ key: CatalogModule; enabled: boolean; navLabel: string; navOrder: number }>;
  customFields: Array<{ entity: "lead" | "customer" | "project"; key: string; label: string; type: FieldType; required: boolean }>;
  pipeline: Array<{ key: string; label: string; color: StageColor; terminal: "none" | "won" | "lost" | "done" }>;
  dashboard: string[];
  automations: string[];
  changes: string[];
};

const moduleLabel: Record<CatalogModule, string> = {
  brain: "Business Brain",
  leads: "Enquiries",
  customers: "Customers",
  memberships: "Memberships",
  appointments: "Appointments",
  projects: "Projects",
  catalog: "Catalogue",
  inventory: "Inventory",
  orders: "Orders",
  billing_ecommerce: "Billing",
  receipts: "Receipts",
  marketing_seo: "Marketing",
  messaging: "Messages",
  finance: "Finance",
  operations: "Operations",
  reports: "Agent activity",
  integrations: "Integrations",
  settings: "Settings",
};

export function moduleRow(key: CatalogModule, enabled: boolean, order: number, label?: string) {
  return { key, enabled, navLabel: label ?? moduleLabel[key], navOrder: order };
}

export function archetypeModules(archetype: ArchetypeKey): CatalogModule[] {
  const shared: CatalogModule[] = ["brain", "marketing_seo", "finance", "operations", "reports", "integrations", "settings"];
  if (archetype === "gym_fitness") return ["leads", "customers", "memberships", "receipts", "messaging", ...shared];
  if (archetype === "interior_design" || archetype === "service_projects") return ["leads", "customers", "projects", "receipts", "messaging", ...shared];
  if (archetype === "service_appointments") return ["leads", "customers", "appointments", "receipts", "messaging", ...shared];
  return ["customers", "catalog", "inventory", "orders", "billing_ecommerce", "messaging", ...shared];
}

export function defaultPipeline(archetype: ArchetypeKey): WorkspaceConfig["pipeline"] {
  if (archetype === "interior_design" || archetype === "service_projects") {
    return [
      { key: "new", label: "New", color: "blue", terminal: "none" },
      { key: "contacted", label: "Contacted", color: "sand", terminal: "none" },
      { key: "site_visit", label: "Site visit", color: "lavender", terminal: "none" },
      { key: "quotation", label: "Quotation", color: "mint", terminal: "none" },
      { key: "won", label: "Won", color: "mint", terminal: "won" },
      { key: "lost", label: "Lost", color: "rose", terminal: "lost" },
    ];
  }
  if (archetype === "gym_fitness") {
    return [
      { key: "new", label: "New", color: "blue", terminal: "none" },
      { key: "trial", label: "Trial", color: "sand", terminal: "none" },
      { key: "won", label: "Joined", color: "mint", terminal: "won" },
      { key: "lost", label: "Lost", color: "rose", terminal: "lost" },
    ];
  }
  if (archetype === "service_appointments") {
    return [
      { key: "new", label: "New", color: "blue", terminal: "none" },
      { key: "booked", label: "Visit booked", color: "lavender", terminal: "none" },
      { key: "done", label: "Done", color: "mint", terminal: "done" },
    ];
  }
  return [
    { key: "new", label: "New", color: "blue", terminal: "none" },
    { key: "paid", label: "Paid", color: "mint", terminal: "none" },
    { key: "fulfilled", label: "Fulfilled", color: "sand", terminal: "done" },
  ];
}

export function defaultDashboard(archetype: ArchetypeKey) {
  if (archetype === "gym_fitness") return ["renewals_due", "members_at_risk", "schedule_today", "followups_due"];
  if (archetype === "service_appointments") return ["schedule_today", "followups_due", "reviews_summary"];
  if (archetype === "interior_design" || archetype === "service_projects") return ["followups_due", "pipeline_summary", "schedule_today", "lead_sources"];
  return ["revenue_trend", "top_products", "low_stock", "orders"];
}

export function defaultAutomations(archetype: ArchetypeKey) {
  if (archetype === "gym_fitness") return ["payment_reminder", "welcome", "inactivity_nudge", "birthday"];
  if (archetype === "service_appointments") return ["appointment_reminder", "welcome"];
  if (archetype === "interior_design" || archetype === "service_projects") return ["qualification_sequence", "quotation_followup", "gbp_post_cadence"];
  return ["low_stock_alert", "gbp_post_cadence"];
}
