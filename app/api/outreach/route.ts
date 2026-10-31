import { getDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { assertSameOrigin, errorResponse, json } from "@/server/http";
import {
  approveMessage,
  arriveLead,
  handBack,
  outreachSnapshot,
  pauseSequences,
  receiveInbound,
  recordCallInterest,
  rejectMessage,
  saveOperatorReply,
  saveQualificationSettings,
  setManualStage,
  simulateSequence,
  takeOver,
  tickSequences,
  unsubscribeLead,
} from "@/server/outreach/engine";
import { liveProviders } from "@/server/outreach/providers";
import { ensureOutreachTables } from "@/server/outreach/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const workspaces: Record<string, string> = {
  aangan: "Studio Aangan",
  shakti: "Shakti Fitness",
  mitti: "Mitti Crafts",
};

function businessIdFor(workspace: string) {
  const name = workspaces[workspace];
  if (!name) throw new AppError(404, "UNKNOWN_WORKSPACE", "Unknown workspace");
  const db = getDb();
  ensureOutreachTables(db);
  const row = db.prepare(`SELECT id, business_type FROM businesses WHERE name = ?`).get(name) as { id: string; business_type: string } | undefined;
  if (!row) throw new AppError(404, "WORKSPACE_MISSING", "That workspace is not in the local database");
  if (row.business_type !== "interior") throw new AppError(403, "MODULE_HIDDEN", "Qualification is available for interior design workspaces");
  return row.id;
}

export async function GET(request: Request) {
  try {
    const workspace = new URL(request.url).searchParams.get("workspace") || "aangan";
    const businessId = businessIdFor(workspace);
    return json(outreachSnapshot(getDb(), businessId, liveProviders()));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = (await request.json()) as { workspace?: string; action?: string; input?: Record<string, unknown> };
    const businessId = businessIdFor(body.workspace || "aangan");
    const db = getDb();
    const now = new Date();
    const providers = liveProviders();
    const input = body.input ?? {};
    const text = (value: unknown) => (typeof value === "string" ? value : "");
    switch (body.action) {
      case "arrive":
        return json(arriveLead(db, businessId, {
          name: text(input.name),
          phone: text(input.phone) || undefined,
          email: text(input.email) || undefined,
          source: text(input.source) || "Website",
          imported: input.imported === true,
          consents: Array.isArray(input.consents) ? (input.consents as { channel: "whatsapp" | "email"; basis: string; source: string }[]) : [],
        }, now, providers));
      case "tick":
        tickSequences(db, businessId, now, providers);
        return json({ ok: true });
      case "inbound":
        return json(receiveInbound(db, businessId, { leadId: text(input.leadId), text: text(input.text), origin: "operator" }, now, providers));
      case "approve":
        return json(approveMessage(db, businessId, text(input.messageId), "owner", now, providers));
      case "reject":
        return json(rejectMessage(db, businessId, text(input.messageId)));
      case "takeover":
        return json(takeOver(db, businessId, text(input.leadId), now));
      case "handback":
        return json(handBack(db, businessId, text(input.leadId), now, providers));
      case "reply":
        return json(saveOperatorReply(db, businessId, text(input.leadId), text(input.body), now));
      case "stage":
        setManualStage(db, businessId, text(input.leadId), text(input.stage), now);
        return json({ ok: true });
      case "pause":
        pauseSequences(db, businessId, input.paused !== false);
        return json({ ok: true });
      case "resume":
        pauseSequences(db, businessId, false);
        return json({ ok: true });
      case "settings":
        saveQualificationSettings(db, businessId, {
          autonomy: text(input.autonomy) as "draft" | "assisted" | "autonomous",
          assistantName: text(input.assistantName) || undefined,
          minBudgetPaise: typeof input.minBudgetPaise === "number" ? input.minBudgetPaise : undefined,
          quietStart: text(input.quietStart) || undefined,
          quietEnd: text(input.quietEnd) || undefined,
          threshold: typeof input.threshold === "number" ? input.threshold : undefined,
          address: text(input.address) || undefined,
          hours: text(input.hours) || undefined,
          portfolio: text(input.portfolio) || undefined,
          dailyCap: typeof input.dailyCap === "number" ? input.dailyCap : undefined,
        });
        return json({ ok: true });
      case "simulate":
        return json({ steps: simulateSequence(db, businessId, text(input.leadId), now), note: "Simulation. Nothing was sent." });
      case "calling-interest":
        recordCallInterest(db, businessId, now);
        return json({ ok: true });
      case "unsubscribe":
        return json(unsubscribeLead(db, businessId, text(input.leadId), text(input.token), now));
      default:
        return json({ error: { code: "UNKNOWN_ACTION", message: "Unknown action" } }, 404);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
