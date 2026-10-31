import {
  BadgeCheck,
  FileText,
  LayoutGrid,
  MessageCircle,
  Megaphone,
  Settings,
  ShoppingBag,
  Sparkles,
  Square,
  TrendingUp,
  Users,
  Wallet,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const homeNav: NavItem[] = [
  { href: "/", label: "Overview", description: "Business overview", icon: LayoutGrid },
  { href: "/brain", label: "Business Brain", description: "Insights and approvals", icon: Sparkles },
  { href: "/sales", label: "Leads", description: "Pipeline and follow-ups", icon: TrendingUp },
  { href: "/sales", label: "Sales", description: "Pipeline, follow-ups, and recovery", icon: TrendingUp },
  { href: "/outreach", label: "Qualification", description: "WhatsApp and email follow-up", icon: MessageCircle },
  { href: "/marketing", label: "Marketing", description: "Local SEO, reviews, and campaigns", icon: Megaphone },
  { href: "/customers", label: "Customers", description: "WhatsApp-first relationships", icon: Users },
  { href: "/commerce", label: "Commerce", description: "Products, orders, and stock", icon: ShoppingBag },
  { href: "/finance", label: "Finance", description: "Revenue, margin, and cash", icon: Wallet },
  { href: "/operations", label: "Operations", description: "Today’s schedule and workflows", icon: BadgeCheck },
];

export const toolNav: NavItem[] = [
  { href: "/integrations", label: "Integrations", description: "Connected tools", icon: ArrowUpRight },
  { href: "/agents", label: "Agent activity", description: "What ran, and what needs approval", icon: FileText },
  { href: "/settings/permissions", label: "Settings", description: "How much the Business Brain can do", icon: Settings },
];

export const navItems: NavItem[] = [...homeNav.filter((item) => item.label !== "Leads"), ...toolNav];

export const topPills = [
  { href: "/", label: "Dashboard" },
  { href: "/finance", label: "Finance" },
  { href: "/sales", label: "Leads" },
  { href: "/sales", label: "Sales" },
  { href: "/marketing", label: "Marketing" },
  { href: "/agents", label: "Agent activity" },
];

export function isNavActive(pathname: string, href: string) {
  const path = href.split("#")[0] || "/";
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function pageMeta(pathname: string) {
  return navItems.find((item) => isNavActive(pathname, item.href)) ?? homeNav[0];
}
