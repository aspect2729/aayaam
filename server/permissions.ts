import type { Actor, Role } from "@/server/db";
import { AppError } from "@/server/errors";

const actions = ["view", "create", "edit", "approve", "export"] as const;

type Resource =
  | "customer"
  | "lead"
  | "product"
  | "stock"
  | "order"
  | "invoice"
  | "payment"
  | "refund"
  | "expense"
  | "ledger"
  | "task"
  | "campaign"
  | "integration"
  | "member"
  | "backup"
  | "brain"
  | "message";

export type Permission = `${Resource}:${(typeof actions)[number]}`;

const sensitiveFields = [
  "purchase_cost",
  "profit_margin",
  "bank_balance",
  "supplier_dues",
  "financial_reports",
  "customer_financials",
] as const;

export type SensitiveField = (typeof sensitiveFields)[number];

const allResources: Resource[] = [
  "customer",
  "lead",
  "product",
  "stock",
  "order",
  "invoice",
  "payment",
  "refund",
  "expense",
  "ledger",
  "task",
  "campaign",
  "integration",
  "member",
  "backup",
  "brain",
  "message",
];

function allow(resources: Resource[], verbs: Array<(typeof actions)[number]>): Permission[] {
  return resources.flatMap((resource) => verbs.map((verb) => `${resource}:${verb}` as Permission));
}

const roleGrants: Record<Role, { permissions: Permission[]; fields: SensitiveField[] }> = {
  owner: { permissions: allow(allResources, [...actions]), fields: [...sensitiveFields] },
  administrator: { permissions: allow(allResources, [...actions]), fields: [...sensitiveFields] },
  manager: {
    permissions: allow(
      allResources.filter((resource) => resource !== "member"),
      ["view", "create", "edit", "approve", "export"]
    ).concat(["member:view"]),
    fields: [...sensitiveFields],
  },
  salesperson: {
    permissions: allow(["customer", "lead", "task", "message"], ["view", "create", "edit"]).concat([
      "product:view",
      "order:view",
      "payment:view",
      "payment:create",
      "brain:view",
    ]),
    fields: [],
  },
  accountant: {
    permissions: allow(
      ["customer", "invoice", "payment", "refund", "expense", "ledger", "backup"],
      ["view", "create", "edit", "approve", "export"]
    ).concat(["brain:view", "order:view", "product:view"]),
    fields: ["purchase_cost", "profit_margin", "bank_balance", "supplier_dues", "financial_reports", "customer_financials"],
  },
  inventory_manager: {
    permissions: allow(["product", "stock", "order"], ["view", "create", "edit", "export"]).concat([
      "task:view",
      "task:create",
      "brain:view",
    ]),
    fields: ["purchase_cost"],
  },
  marketing_manager: {
    permissions: allow(["campaign", "customer", "lead", "message"], ["view", "create", "edit"]).concat(["brain:view"]),
    fields: [],
  },
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return roleGrants[role].permissions.includes(permission);
}

export function canSeeField(role: Role, field: SensitiveField): boolean {
  return roleGrants[role].fields.includes(field);
}

export function assertPermission(actor: Actor, permission: Permission) {
  if (!hasPermission(actor.role, permission)) {
    throw new AppError(403, "FORBIDDEN", `Role ${actor.role} cannot ${permission}`);
  }
}

export function visibleFields(role: Role): SensitiveField[] {
  return roleGrants[role].fields;
}

export function permissionList(role: Role): Permission[] {
  return roleGrants[role].permissions;
}
