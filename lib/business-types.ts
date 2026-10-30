import type { BusinessType } from "@/lib/types";

export type ModuleKey =
  | "overview"
  | "brain"
  | "sales"
  | "customers"
  | "marketing"
  | "commerce"
  | "finance"
  | "operations";

export type BusinessTypeConfig = {
  title: string;
  modules: ModuleKey[];
  labels: Partial<Record<string, string>>;
};

export const businessTypeConfig: Record<BusinessType, BusinessTypeConfig> = {
  interior: {
    title: "Interior design studio",
    modules: ["overview", "brain", "sales", "customers", "marketing", "finance", "operations"],
    labels: { Customers: "Clients" },
  },
  handicraft: {
    title: "Handicraft store",
    modules: ["overview", "brain", "customers", "marketing", "commerce", "finance", "operations"],
    labels: {},
  },
  gym: {
    title: "Gym / fitness studio",
    modules: ["overview", "brain", "sales", "customers", "marketing", "finance", "operations"],
    labels: { Sales: "Enquiries", Customers: "Members" },
  },
};

const navModule: Record<string, ModuleKey | "tools"> = {
  Overview: "overview",
  "Business Brain": "brain",
  Leads: "sales",
  Sales: "sales",
  Marketing: "marketing",
  Customers: "customers",
  Commerce: "commerce",
  Finance: "finance",
  Operations: "operations",
  Analytics: "finance",
  Dashboard: "overview",
  Reports: "tools",
  Integrations: "tools",
  Settings: "tools",
};

export function moduleEnabled(type: BusinessType, key: ModuleKey) {
  return businessTypeConfig[type].modules.includes(key);
}

export function navItemVisible(type: BusinessType, label: string) {
  if (type === "gym" && label === "Leads") return false;
  if (type !== "interior" && label === "Leads") return false;
  const section = navModule[label];
  if (!section || section === "tools") return true;
  return moduleEnabled(type, section);
}

export function navLabel(type: BusinessType, label: string) {
  return businessTypeConfig[type].labels[label] ?? label;
}
