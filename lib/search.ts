import type { BusinessProfile } from "@/lib/types";

export type SearchHit = { label: string; meta: string; href: string };

export function buildSearchIndex(business: BusinessProfile): SearchHit[] {
  return [
    ...business.leads.map((lead) => ({
      label: lead.name,
      meta: `Lead · ${lead.location}`,
      href: "/sales",
    })),
    ...business.customers.map((customer) => ({
      label: customer.name,
      meta: `Customer · ${customer.city}`,
      href: "/customers",
    })),
    ...business.orders.map((order) => ({
      label: `${order.id} · ${order.customer}`,
      meta: `Order · ${order.total}`,
      href: "/commerce",
    })),
    ...business.products.map((product) => ({
      label: product.name,
      meta: `Product · ${product.price}`,
      href: "/commerce",
    })),
  ];
}
