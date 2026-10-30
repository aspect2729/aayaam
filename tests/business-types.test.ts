import { describe, expect, it } from "vitest";
import { moduleEnabled, navItemVisible, navLabel } from "@/lib/business-types";
import { scoreLead } from "@/lib/lead-score";
import { toE164India } from "@/lib/phone";

describe("business types", () => {
  it("hides commerce for a gym and an interior studio", () => {
    expect(moduleEnabled("gym", "commerce")).toBe(false);
    expect(moduleEnabled("interior", "commerce")).toBe(false);
    expect(navItemVisible("gym", "Commerce")).toBe(false);
    expect(navItemVisible("interior", "Commerce")).toBe(false);
  });

  it("keeps the lead pipeline for interior design and trial enquiries for a gym", () => {
    expect(moduleEnabled("interior", "sales")).toBe(true);
    expect(navItemVisible("interior", "Leads")).toBe(true);
    expect(navLabel("interior", "Customers")).toBe("Clients");
    expect(navItemVisible("gym", "Sales")).toBe(true);
    expect(navItemVisible("gym", "Leads")).toBe(false);
    expect(navLabel("gym", "Customers")).toBe("Members");
    expect(navLabel("gym", "Sales")).toBe("Enquiries");
  });

  it("hides the lead pipeline for a handicraft store and keeps commerce", () => {
    expect(moduleEnabled("handicraft", "sales")).toBe(false);
    expect(moduleEnabled("handicraft", "commerce")).toBe(true);
    expect(navItemVisible("handicraft", "Sales")).toBe(false);
    expect(navItemVisible("handicraft", "Commerce")).toBe(true);
  });
});

describe("lead score and phone", () => {
  it("explains a score from the lead fields", () => {
    const result = scoreLead({
      budgetPaise: 90000000,
      timeline: "immediate",
      projectType: "residential",
      hasPhone: true,
      hasRequirement: true,
      daysSinceContact: 1,
    });
    expect(result.score).toBe(85);
    expect(result.reasons[0]).toContain("budget");
  });

  it("normalizes an Indian mobile number and rejects a short one", () => {
    expect(toE164India("98450 11111")).toBe("+919845011111");
    expect(toE164India("+91 9845011111")).toBe("+919845011111");
    expect(toE164India("12345")).toBeNull();
  });
});
