import { json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.INNGEST_EVENT_KEY || !process.env.INNGEST_SIGNING_KEY) {
    return json({ status: "awaiting_setup", runner: "in_process" });
  }
  return json({ status: "keys_present", runner: "in_process", note: "Events still run in this server until a worker is connected." });
}
