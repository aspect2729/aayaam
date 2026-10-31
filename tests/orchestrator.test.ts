import { afterEach, describe, expect, it } from "vitest";
import { checkBudget, recordSpend, resetSpendForTests } from "@/lib/ai/cost";
import { estimateUsd } from "@/lib/ai/pricing";
import { redactForLLM } from "@/lib/ai/redact";
import { decidePolicy } from "@/lib/agents/policy";
import { resetRunsForTests, runEvent } from "@/lib/agents/runner";
import { configFromDraft, draftFromText, validateConfig } from "@/lib/workspace/configure";
import type { ArchetypeKey } from "@/lib/workspace/catalog";

const cases: Array<{ text: string; archetype: ArchetypeKey; absent?: string[]; field?: string }> = [
  { text: "Interior design studio in Mysuru for 2-3BHK homes", archetype: "interior_design", absent: ["orders", "billing_ecommerce"], field: "bhk" },
  { text: "We design modular kitchens in Jayanagar", archetype: "interior_design", absent: ["billing_ecommerce"] },
  { text: "Home interiors and office interiors in Bengaluru", archetype: "interior_design", absent: ["orders"] },
  { text: "Clients book a site visit then a quotation", archetype: "interior_design", absent: ["billing_ecommerce"] },
  { text: "Gym in Hubballi with annual memberships", archetype: "gym_fitness", absent: ["orders", "billing_ecommerce"] },
  { text: "Women's fitness studio", archetype: "gym_fitness", absent: ["orders"] },
  { text: "Yoga studio with monthly memberships", archetype: "gym_fitness", absent: ["inventory"] },
  { text: "Handicraft pottery shop", archetype: "ecommerce_handicraft", absent: ["memberships"] },
  { text: "We sell clay pots to homestays", archetype: "ecommerce_handicraft" },
  { text: "Artisan handicraft store on Shopify", archetype: "ecommerce_handicraft" },
  { text: "Dental clinic in Mysuru", archetype: "service_appointments", absent: ["orders", "billing_ecommerce"], field: "next_appointment" },
  { text: "Dental patients book the next visit", archetype: "service_appointments", field: "next_appointment", absent: ["inventory"] },
  { text: "A small clinic with appointments", archetype: "service_appointments", field: "next_appointment", absent: ["orders"] },
  { text: "Hair salon with appointments", archetype: "service_appointments", absent: ["billing_ecommerce"] },
  { text: "Pet grooming and boarding in Belagavi with vaccination dates", archetype: "service_appointments", field: "vaccination_due", absent: ["orders"] },
  { text: "Dog groomer, people book on WhatsApp", archetype: "service_appointments", field: "vaccination_due", absent: ["billing_ecommerce"] },
  { text: "Coaching centre for school tuition", archetype: "service_appointments", absent: ["orders", "inventory", "billing_ecommerce"] },
  { text: "Tuition classes three evenings a week", archetype: "service_appointments", absent: ["orders"] },
  { text: "CA firm filing books for shops", archetype: "service_appointments", absent: ["orders", "billing_ecommerce"] },
  { text: "Chartered accountant with client meetings", archetype: "service_appointments", absent: ["inventory"] },
  { text: "Architecture studio with project fees", archetype: "service_projects", absent: ["orders", "billing_ecommerce"] },
  { text: "Building contractor in Hubballi", archetype: "service_projects", absent: ["billing_ecommerce"] },
  { text: "Solar installer for rooftops", archetype: "service_projects", absent: ["orders"] },
  { text: "Caterer for weddings", archetype: "service_projects", absent: ["billing_ecommerce"] },
  { text: "Design agency with retainers", archetype: "service_projects", absent: ["inventory"] },
  { text: "Bakery with online orders", archetype: "product_retail_online", absent: ["memberships"] },
  { text: "Boutique that sells clothes online", archetype: "product_retail_online" },
  { text: "We sell on Shopify from a home store", archetype: "product_retail_online" },
  { text: "Interior studio, mostly 3bhk apartments", archetype: "interior_design", absent: ["orders"] },
  { text: "Gym memberships and a Saturday trial", archetype: "gym_fitness", absent: ["billing_ecommerce"] },
  { text: "Yoga classes in Vijayanagar", archetype: "gym_fitness", absent: ["orders"] },
  { text: "Pottery and cane handicrafts", archetype: "ecommerce_handicraft" },
  { text: "Salon appointments and a monthly package", archetype: "service_appointments", absent: ["orders"] },
  { text: "Pet boarding with a vaccination reminder", archetype: "service_appointments", field: "vaccination_due", absent: ["billing_ecommerce"] },
  { text: "Coaching centre, no products to ship", archetype: "service_appointments", absent: ["orders", "inventory"] },
  { text: "Architect who visits the site before a quote", archetype: "service_projects", absent: ["billing_ecommerce"] },
  { text: "Solar projects for factories", archetype: "service_projects", absent: ["orders"] },
  { text: "Event catering agency", archetype: "service_projects", absent: ["inventory"] },
  { text: "Online bakery orders for the weekend", archetype: "product_retail_online" },
  { text: "Boutique store with Shopify orders", archetype: "product_retail_online" },
];

describe("workspace configurator", () => {
  it("covers forty descriptions without enabling a point of sale", () => {
    expect(cases).toHaveLength(40);
    for (const item of cases) {
      const config = configFromDraft(draftFromText(item.text));
      expect(config.archetype, item.text).toBe(item.archetype);
      expect(validateConfig(config), item.text).toEqual([]);
      expect(JSON.stringify(config).toLowerCase()).not.toContain("point of sale");
      for (const key of item.absent ?? []) {
        expect(config.modules.some((module) => module.key === key && module.enabled), `${item.text} ${key}`).toBe(false);
      }
      if (item.field) expect(config.customFields.some((field) => field.key === item.field)).toBe(true);
      if (item.archetype === "ecommerce_handicraft" || item.archetype === "product_retail_online") {
        expect(config.modules.some((module) => module.key === "orders" && module.enabled)).toBe(true);
        expect(config.modules.some((module) => module.key === "billing_ecommerce" && module.enabled)).toBe(true);
      }
    }
  });
});

describe("policy, cost, and redaction", () => {
  afterEach(() => {
    resetSpendForTests();
    resetRunsForTests();
    delete process.env.AI_GLOBAL_DAILY_BUDGET_USD;
  });

  it("prices a million flash-lite input tokens at the published rate", () => {
    expect(estimateUsd("gemini-3.5-flash-lite", 1_000_000, 0)).toBeCloseTo(0.3);
    expect(estimateUsd("gpt-6-luna", 1_000_000, 1_000_000)).toBeCloseTo(0.6);
  });

  it("removes phone, email, and GSTIN before a model sees the text", () => {
    const clean = redactForLLM("Call +919845011122 or rohan@example.com GSTIN 29ABCDE1234F1Z5");
    expect(clean).not.toContain("98450");
    expect(clean).not.toContain("example.com");
    expect(clean).not.toContain("29ABCDE");
  });

  it("stops a model call at the daily budget and still allows a rule reminder to be proposed", () => {
    process.env.AI_GLOBAL_DAILY_BUDGET_USD = "1";
    recordSpend("gym", 1);
    expect(() => checkBudget("gym")).toThrow(/budget/i);
    const [run] = runEvent({ eventId: "evt-1", type: "member.payment_due" });
    expect(run.actionStatus).toBe("awaiting_approval");
    expect(run.reason).not.toMatch(/sent/i);
    expect(decidePolicy({ type: "whatsapp.send", actionClass: 3, mode: "auto", payload: {} }).status).toBe("auto");
  });

  it("rejects an opt-out and ignores a duplicate event", () => {
    const [first] = runEvent({ eventId: "evt-2", type: "message.inbound", text: "Please STOP messaging me" });
    expect(first.actionStatus).toBe("rejected");
    const [second] = runEvent({ eventId: "evt-2", type: "message.inbound", text: "Please STOP messaging me" });
    expect(second.reason).toMatch(/Duplicate/);
    expect(decidePolicy({ type: "refund.create", actionClass: 4, payload: {} }).status).toBe("awaiting_approval");
  });
});
