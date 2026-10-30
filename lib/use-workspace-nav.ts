"use client";

import { useMemo } from "react";
import { homeNav, isNavActive, toolNav, topPills, type NavItem } from "@/components/shell/nav";
import { navItemVisible, navLabel } from "@/lib/business-types";
import { useBusiness } from "@/lib/business-context";

function labelItem(type: Parameters<typeof navLabel>[0], item: NavItem): NavItem {
  return { ...item, label: navLabel(type, item.label) };
}

export function useWorkspaceNav() {
  const { business } = useBusiness();
  return useMemo(() => {
    const home = homeNav.filter((item) => navItemVisible(business.type, item.label)).map((item) => labelItem(business.type, item));
    const pills = topPills
      .filter((item) => navItemVisible(business.type, item.label))
      .map((item) => ({ ...item, label: navLabel(business.type, item.label) }));
    const items = [...home.filter((item) => !item.href.includes("#")), ...toolNav];
    return { home, tools: toolNav, pills, items, type: business.type };
  }, [business.type]);
}

export function workspacePageMeta(items: NavItem[], pathname: string) {
  return items.find((item) => isNavActive(pathname, item.href) && !item.href.includes("#")) ?? items[0];
}
