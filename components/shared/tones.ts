import type { AgentStatus, ChipTone, LeadSource, OrderStatus } from "@/lib/types";

export const sourceTone: Record<LeadSource, ChipTone> = {
  Website: "blue",
  WhatsApp: "mint",
  Google: "sand",
  "Walk-in": "lavender",
  "Meta ad": "blue",
};

export const orderTone: Record<OrderStatus, ChipTone> = {
  Paid: "blue",
  Packed: "sand",
  Shipped: "lavender",
  Delivered: "mint",
  Returned: "rose",
};

export const agentTone: Record<AgentStatus, ChipTone> = {
  done: "mint",
  pending: "sand",
  running: "blue",
  failed: "rose",
};

export const agentLabel: Record<AgentStatus, string> = {
  done: "Done",
  pending: "Pending",
  running: "Running",
  failed: "Failed",
};

export const chartTooltip = {
  background: "#ffffff",
  border: "1px solid #E7EBF5",
  borderRadius: 12,
  fontSize: 13,
  color: "#0B0B10",
  boxShadow: "0 10px 30px rgba(52, 78, 160, 0.08)",
};
