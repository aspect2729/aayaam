import { describe, expect, it } from "vitest";
import { integrationForBusiness } from "@/lib/business-types";
import { businesses } from "@/lib/mock-data";

describe("workspace isolation", () => {
  it("keeps the gym schedule, agents, and approvals inside a gym", () => {
    const gym = businesses.find((business) => business.id === "shakti");
    expect(gym?.type).toBe("gym");
    const text = [
      ...(gym?.events ?? []).map((event) => `${event.title} ${event.detail ?? ""}`),
      ...(gym?.agents ?? []).map((agent) => `${agent.agent} ${agent.task}`),
      ...(gym?.approvals ?? []).map((item) => item.title),
    ]
      .join(" ")
      .toLowerCase();
    expect(text).not.toContain("jayanagar");
    expect(text).not.toContain("clay");
    expect(text).not.toContain("counter");
    expect(text).not.toContain("quotation");
    expect(text).not.toContain("commerce");
  });

  it("shows store integrations only for a handicraft business unless every integration is requested", () => {
    expect(integrationForBusiness("gym", true, false)).toBe(false);
    expect(integrationForBusiness("interior", true, false)).toBe(false);
    expect(integrationForBusiness("handicraft", true, false)).toBe(true);
    expect(integrationForBusiness("gym", true, true)).toBe(true);
    expect(integrationForBusiness("gym", false, false)).toBe(true);
  });
});
