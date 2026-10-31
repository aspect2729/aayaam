"use client";

import { useMemo } from "react";
import { homeNav, isNavActive, toolNav, topPills, type NavItem } from "@/components/shell/nav";
import { navItemVisible, navLabel } from "@/lib/business-types";
import { useBusiness } from "@/lib/business-context";
import { useActiveConfig } from "@/lib/workspace/active";
import type { WorkspaceConfig } from "@/lib/workspace/catalog";

function configuredLabel(config: WorkspaceConfig | null, type: Parameters<typeof navLabel>[0], label: string) {
  if (!config) return navLabel(type, label);
  if (label === "Leads") return "Leads";
  if (label === "Sales" || label === "Enquiries") return config.modules.find((item) => item.key === "leads")?.navLabel ?? navLabel(type, label);
  if (label === "Customers" || label === "Members" || label === "Clients") return config.modules.find((item) => item.key === "customers")?.navLabel ?? navLabel(type, label);
  return navLabel(type, label);
}

function hiddenByConfig(config: WorkspaceConfig | null, label: string) {
  if (!config) return false;
  if ((label === "Sales" || label === "Leads" || label === "Enquiries") && !config.modules.some((item) => item.key === "leads" && item.enabled)) return true;
  if (label === "Commerce" && !config.modules.some((item) => item.key === "orders" && item.enabled)) return true;
  if ((label === "Customers" || label === "Members" || label === "Clients") && !config.modules.some((item) => item.key === "customers" && item.enabled)) return true;
  return false;
}

export function useWorkspaceNav() {
  const { business } = useBusiness();
  const { config } = useActiveConfig();
  return useMemo(() => {
    const home = homeNav
      .filter((item) => navItemVisible(business.type, item.label) && !hiddenByConfig(config, item.label))
      .map((item) => ({ ...item, label: configuredLabel(config, business.type, item.label) }));
    const pills = topPills
      .filter((item) => navItemVisible(business.type, item.label) && !hiddenByConfig(config, item.label))
      .map((item) => ({ ...item, label: configuredLabel(config, business.type, item.label) }));
    const items = [...home.filter((item) => !item.href.includes("#")), ...toolNav];
    return { home, tools: toolNav, pills, items, type: business.type };
  }, [business.type, config]);
}

export function workspacePageMeta(items: NavItem[], pathname: string) {
  return items.find((item) => isNavActive(pathname, item.href) && !item.href.includes("#")) ?? items[0];
}
