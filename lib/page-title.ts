const titles: Record<string, string> = {
  "/": "Overview",
  "/brain": "Business Brain",
  "/sales": "Sales",
  "/outreach": "Qualification",
  "/marketing": "Marketing",
  "/customers": "Customers",
  "/commerce": "Commerce",
  "/finance": "Finance",
  "/operations": "Operations",
  "/integrations": "Integrations",
  "/agents": "Agent activity",
  "/settings/permissions": "Settings",
  "/settings/system": "System",
  "/plans": "Plans",
  "/assistant": "Assistant",
  "/outreach/unsubscribe": "Unsubscribe",
};

export function titleForPath(pathname: string) {
  return titles[pathname] ?? "Overview";
}
