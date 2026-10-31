import { sessionProfile } from "@/server/auth";
import { getDb } from "@/server/db";
import { errorResponse, json, readSessionToken } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const profile = sessionProfile(getDb(), readSessionToken(request));
    if (!profile) return json({ signedIn: false, mode: "demo", name: "Rohan", role: "Founder" });
    const role = profile.role.split("_").join(" ");
    return json({ signedIn: true, mode: "account", name: profile.name, role });
  } catch (error) {
    return errorResponse(error);
  }
}
