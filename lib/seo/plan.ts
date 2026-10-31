import { gridRadiusKm, rankGrid } from "@/lib/seo/grid";
import { keywordUniverse } from "@/lib/seo/keywords";
import { postSlotAllowed } from "@/lib/seo/cooldown";

export function weeklySeoPlan(input: {
  services: string[];
  localities: string[];
  languages?: Array<"en" | "hi" | "kn">;
  archetype?: string;
  offerEntered?: boolean;
  center?: { lat: number; lng: number };
  lastPostAt?: string | null;
  cadenceDays?: number;
}) {
  const keywords = keywordUniverse({
    services: input.services,
    localities: input.localities,
    languages: input.languages,
  });
  const radiusKm = gridRadiusKm(input.archetype ?? "service_appointments");
  const grid = input.center ? rankGrid(input.center, radiusKm) : [];
  const slot = postSlotAllowed(input.lastPostAt ?? null, input.cadenceDays ?? 3);
  const post = !slot.allowed
    ? { action: "skip" as const, reason: slot.reason }
    : input.offerEntered
      ? { action: "propose_draft" as const, reason: "An owner-entered offer can be drafted. It is not published." }
      : { action: "skip" as const, reason: "Nothing genuine is on record, so the slot asks the owner for a photo instead of inventing a post." };
  return {
    goals: ["Confirm the Google profile against the details the owner entered.", "Draft one useful page or post from a real service and locality."],
    tasks: [
      { agent: "seo_lead", title: "Write this week’s plan from the workspace", needsModel: false },
      { agent: "gbp_manager", title: "Score profile completeness once Business Profile is connected", needsModel: false },
      { agent: "reputation", title: "Hold review replies for approval", needsModel: false },
      { agent: "rank_tracker", title: "Keep the grid ready. Do not invent positions.", needsModel: false },
    ],
    keywords,
    grid: { points: grid.length || 25, radiusKm, measured: false as const },
    post,
  };
}
