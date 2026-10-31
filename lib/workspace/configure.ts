import {
  archetypeModules,
  defaultAutomations,
  defaultDashboard,
  defaultPipeline,
  moduleRow,
  type ArchetypeKey,
  type WorkspaceConfig,
} from "@/lib/workspace/catalog";

export type ProfileDraft = {
  text: string;
  archetype: ArchetypeKey;
  confidence: "high" | "low";
  displayName: string;
  city?: string;
  customerTerm: string;
  services: string[];
  languages: Array<"en" | "hi" | "kn">;
};

const cities = ["mysuru", "mysore", "bengaluru", "bangalore", "hubballi", "hubli", "belagavi", "belgaum", "mangaluru", "vijayanagar", "jayanagar"];

export function classifyBusiness(text: string): Pick<ProfileDraft, "archetype" | "confidence" | "customerTerm" | "services"> {
  const value = text.toLowerCase();
  const has = (...words: string[]) => words.some((word) => value.includes(word));
  if (has("interior", "3bhk", "2bhk", "2–3bhk", "modular kitchen", "site visit")) {
    return { archetype: "interior_design", confidence: "high", customerTerm: "Client", services: servicesFrom(value, ["home interiors", "modular kitchen", "office interiors"]) };
  }
  if (has("handicraft", "pottery", "clay pot", "artisan")) {
    return { archetype: "ecommerce_handicraft", confidence: "high", customerTerm: "Customer", services: ["handicrafts"] };
  }
  if (has("bakery", "boutique") || (has("online order", "shopify") && has("sell", "store", "orders"))) {
    return { archetype: "product_retail_online", confidence: "high", customerTerm: "Customer", services: servicesFrom(value, ["online orders"]) };
  }
  if (has("gym", "fitness", "yoga")) {
    return { archetype: "gym_fitness", confidence: "high", customerTerm: "Member", services: servicesFrom(value, ["memberships"]) };
  }
  if (has("dental", "clinic", "salon", "groom", "pet", "coach", "tuition", "chartered", "ca firm")) {
    return { archetype: "service_appointments", confidence: "high", customerTerm: has("dental", "clinic") ? "Patient" : has("pet", "groom") ? "Pet parent" : "Client", services: servicesFrom(value, ["appointments"]) };
  }
  if (has("architect", "contractor", "solar", "caterer", "catering", "agency")) {
    return { archetype: "service_projects", confidence: "high", customerTerm: "Client", services: servicesFrom(value, ["projects"]) };
  }
  return { archetype: "service_appointments", confidence: "low", customerTerm: "Customer", services: ["appointments"] };
}

function servicesFrom(text: string, fallback: string[]) {
  const found = ["modular kitchen", "home interiors", "office interiors", "vaccination", "boarding", "grooming"].filter((item) => text.includes(item));
  return found.length ? found : fallback;
}

export function draftFromText(text: string, displayName = "Your business"): ProfileDraft {
  const classified = classifyBusiness(text);
  const city = cities.find((item) => text.toLowerCase().includes(item));
  const languages: ProfileDraft["languages"] = text.toLowerCase().includes("kannada") ? ["kn", "en"] : text.toLowerCase().includes("hindi") || text.toLowerCase().includes("hinglish") ? ["hi", "en"] : ["en"];
  return { text, displayName, city: city ? titleCity(city) : undefined, languages, ...classified };
}

function titleCity(value: string) {
  const names: Record<string, string> = { mysore: "Mysuru", mysuru: "Mysuru", bangalore: "Bengaluru", bengaluru: "Bengaluru", hubli: "Hubballi", hubballi: "Hubballi", belgaum: "Belagavi", belagavi: "Belagavi" };
  return names[value] ?? value.slice(0, 1).toUpperCase() + value.slice(1);
}

export function configFromDraft(draft: ProfileDraft): WorkspaceConfig {
  const enabled = new Set(archetypeModules(draft.archetype));
  const rows = [...enabled].map((key, index) => {
    if (key === "customers") return moduleRow(key, true, index, draft.customerTerm === "Member" ? "Members" : draft.customerTerm === "Patient" ? "Patients" : draft.customerTerm === "Pet parent" ? "Pet parents" : draft.customerTerm === "Client" ? "Clients" : "Customers");
    if (key === "leads" && draft.archetype === "gym_fitness") return moduleRow(key, true, index, "Enquiries");
    if (key === "leads" && draft.archetype === "service_appointments") return moduleRow(key, true, index, "Bookings");
    return moduleRow(key, true, index);
  });
  const customFields: WorkspaceConfig["customFields"] = [];
  const lower = draft.text.toLowerCase();
  if (draft.archetype === "interior_design") {
    customFields.push({ entity: "lead", key: "bhk", label: "BHK", type: "text", required: false });
    customFields.push({ entity: "lead", key: "possession_status", label: "Possession", type: "select", required: false });
  }
  if (lower.includes("dental") || lower.includes("clinic") || lower.includes("appointment")) {
    customFields.push({ entity: "customer", key: "next_appointment", label: "Next appointment", type: "date", required: false });
  }
  if (lower.includes("vaccin") || lower.includes("pet") || lower.includes("groom")) {
    customFields.push({ entity: "customer", key: "vaccination_due", label: "Vaccination due", type: "date", required: false });
  }
  const changes = [
    `Archetype ${draft.archetype.split("_").join(" ")}`,
    `Customers are labelled ${rows.find((row) => row.key === "customers")?.navLabel ?? draft.customerTerm}`,
    enabled.has("orders") ? "Orders stay visible" : "Orders and inventory stay hidden",
    enabled.has("billing_ecommerce") ? "E-commerce billing stays available for connected orders" : "E-commerce billing stays hidden",
  ];
  return {
    schemaVersion: 1,
    archetype: draft.archetype,
    business: {
      displayName: draft.displayName,
      city: draft.city,
      localities: draft.city ? [draft.city] : [],
      services: draft.services,
      languages: draft.languages,
      customerTerm: draft.customerTerm,
    },
    modules: rows,
    customFields,
    pipeline: defaultPipeline(draft.archetype),
    dashboard: defaultDashboard(draft.archetype),
    automations: defaultAutomations(draft.archetype),
    changes,
  };
}

export function validateConfig(config: WorkspaceConfig) {
  const errors: string[] = [];
  const keys = config.modules.map((item) => item.key);
  if (keys.includes("billing_ecommerce" as never) && !config.modules.some((item) => item.key === "orders" && item.enabled)) {
    errors.push("E-commerce billing needs orders.");
  }
  if (JSON.stringify(config).toLowerCase().includes("point of sale") || keys.some((key) => String(key) === "pos")) errors.push("POS is not a module.");
  if (!config.modules.some((item) => item.enabled)) errors.push("At least one module must stay on.");
  const fieldKeys = config.customFields.map((field) => field.key);
  if (new Set(fieldKeys).size !== fieldKeys.length) errors.push("Field keys must be unique.");
  return errors;
}

export function diffConfigs(current: WorkspaceConfig | null, next: WorkspaceConfig) {
  if (!current) return next.changes;
  const lines = [...next.changes];
  const before = current.modules.find((item) => item.key === "customers")?.navLabel;
  const after = next.modules.find((item) => item.key === "customers")?.navLabel;
  if (before && after && before !== after) lines.push(`Customers: ${before} → ${after}`);
  return lines;
}

export type BusinessTypeName = "gym" | "handicraft" | "interior";

export function archetypeToBusinessType(archetype: ArchetypeKey): BusinessTypeName {
  if (archetype === "ecommerce_handicraft" || archetype === "product_retail_online") return "handicraft";
  if (archetype === "interior_design" || archetype === "service_projects") return "interior";
  return "gym";
}
