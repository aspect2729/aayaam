import { describe, expect, it } from "vitest";
import { toolClass } from "@/lib/agents/tools/seo";
import { runEvent } from "@/lib/agents/runner";
import { crawlBudget, inspectBrowserRequest, robotsAllows } from "@/lib/seo/browser";
import { completeness } from "@/lib/seo/completeness";
import { checkDraft, checkReviewReply } from "@/lib/seo/content";
import { postSlotAllowed, profileChangeAllowed } from "@/lib/seo/cooldown";
import { gridRadiusKm, rankGrid } from "@/lib/seo/grid";
import { keywordUniverse } from "@/lib/seo/keywords";
import { compareNap, toE164In } from "@/lib/seo/nap";
import { weeklySeoPlan } from "@/lib/seo/plan";
import { decideSeoPolicy, gbpFieldClass } from "@/lib/seo/policy";
import { validateJsonLd } from "@/lib/seo/schema";
import { buildUtm } from "@/lib/seo/utm";
import { seoAdapterReport } from "@/lib/seo/adapters";

describe("local SEO rules", () => {
  it("normalises Indian phones and scores NAP mismatches", () => {
    expect(toE164In("98450 12345")).toBe("+919845012345");
    const same = compareNap(
      { name: "Studio Aangan", address: "12, Vijayanagar, Mysuru", phone: "9845012345" },
      { name: "studio  aangan", address: "12 Vijayanagar Mysuru", phone: "+91 98450 12345" }
    );
    expect(same.score).toBe(100);
    const different = compareNap(
      { name: "Studio Aangan", address: "12 Vijayanagar Mysuru", phone: "9845012345" },
      { name: "Other Studio", address: "1 Jayanagar Bengaluru", phone: "9000000000" }
    );
    expect(different.mismatches).toEqual(["name", "address", "phone"]);
  });

  it("builds a capped keyword universe and a gym grid", () => {
    const phrases = keywordUniverse({
      services: ["interior design", "modular kitchen"],
      localities: ["Vijayanagar", "Mysuru"],
      languages: ["en", "kn"],
    });
    expect(phrases.length).toBeLessThanOrEqual(50);
    expect(phrases.some((phrase) => phrase.includes("modular kitchen") && phrase.includes("ಹತ್ತಿರ"))).toBe(true);
    expect(gridRadiusKm("gym_fitness")).toBe(3);
    const points = rankGrid({ lat: 15.3647, lng: 75.124 }, 3, 5);
    expect(points).toHaveLength(25);
    expect(points.some((point) => point.lat === 15.3647)).toBe(true);
  });

  it("scores an empty profile as zero and blocks stuffed or duplicate drafts", () => {
    expect(completeness({}).score).toBe(0);
    const stuffed = checkDraft({
      text: "gym gym gym gym gym gym near the station",
      servedLocalities: ["Hubballi"],
    });
    expect(stuffed.ok).toBe(false);
    const duplicate = checkDraft({
      text: "New morning batch for women at the Hubballi studio",
      previous: ["New morning batch for women at the Hubballi studio this week"],
      servedLocalities: ["Hubballi"],
    });
    expect(duplicate.reasons.some((reason) => reason.includes("repeats"))).toBe(true);
    const outsider = checkDraft({
      text: "We design homes.",
      servedLocalities: ["Mysuru"],
      mentionedLocalities: ["Hubballi"],
    });
    expect(outsider.ok).toBe(false);
    expect(checkReviewReply("Call us at 9845012345 for a guaranteed ranking").ok).toBe(false);
  });

  it("validates schema, UTM links, and cool-downs", () => {
    expect(validateJsonLd(JSON.stringify({ "@type": "HealthClub", name: "Shakti", address: "Hubballi" })).ok).toBe(true);
    expect(validateJsonLd(JSON.stringify({ "@type": "Review", name: "Fake" })).ok).toBe(false);
    expect(validateJsonLd("<script>alert(1)</script>").ok).toBe(false);
    expect(buildUtm("https://example.com/visit", "google", "organic", "gbp")).toContain("utm_source=google");
    expect(buildUtm("javascript:alert(1)")).toBeNull();
    const now = new Date("2026-10-31T12:00:00+05:30");
    expect(profileChangeAllowed("2026-10-30T12:00:00+05:30", now).allowed).toBe(false);
    expect(postSlotAllowed("2026-10-30T12:00:00+05:30", 3, now).allowed).toBe(false);
    expect(postSlotAllowed(null, 3, now).allowed).toBe(true);
  });

  it("keeps browser reads inside the allow list and never fills a password", () => {
    expect(inspectBrowserRequest({ url: "https://maps.google.com/maps?q=gym", allowHosts: ["maps.google.com"], mode: "read" }).allowed).toBe(false);
    expect(inspectBrowserRequest({ url: "http://127.0.0.1/admin", allowHosts: ["127.0.0.1"], mode: "read" }).allowed).toBe(false);
    expect(inspectBrowserRequest({ url: "file:///etc/passwd", allowHosts: [], mode: "read" }).allowed).toBe(false);
    expect(
      inspectBrowserRequest({
        url: "https://studio.example/about",
        allowHosts: ["studio.example"],
        mode: "supervised_write",
        action: "fill",
        fieldType: "password",
        supervisedEnabled: true,
      }).reason
    ).toMatch(/password/i);
    expect(inspectBrowserRequest({ url: "https://studio.example", allowHosts: ["studio.example"], mode: "read", pageText: "I'm not a robot" }).handoff).toBe("owner");
    expect(robotsAllows("User-agent: *\nDisallow: /private", "/private/page")).toBe(false);
    expect(robotsAllows("User-agent: *\nDisallow: /private", "/about")).toBe(true);
    expect(crawlBudget({ maxPages: 900 }).maxPages).toBe(200);
  });

  it("routes SEO writes to approval and does not call providers", () => {
    expect(gbpFieldClass("phone")).toBe(4);
    expect(toolClass("gbp.propose_update", "primary_category")).toBe(4);
    const decision = decideSeoPolicy({ type: "gbp.update", actionClass: 4, field: "phone", payload: {} });
    expect(decision.status).toBe("awaiting_approval");
    const runs = runEvent({ eventId: "review-1", type: "review.received" });
    expect(runs[0]?.actionStatus).toBe("awaiting_approval");
    const report = seoAdapterReport();
    expect(report.every((item) => item.callsNetwork === false)).toBe(true);
    expect(report.every((item) => item.status !== "keys_present_not_called" || item.callsNetwork === false)).toBe(true);
    const plan = weeklySeoPlan({ services: ["gym"], localities: ["Hubballi"], offerEntered: false });
    expect(plan.post.action).toBe("skip");
    expect(plan.grid.measured).toBe(false);
  });
});
