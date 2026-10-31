import { flagStatus } from "@/server/flags";
import { json } from "@/server/http";
import { supabaseConfigured } from "@/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return json({
    supabase: supabaseConfigured() ? "url and service role are set" : "missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    backup: "No scheduled backup is running.",
    jobs: "Sequences tick in this server process. Inngest and Trigger.dev are not connected.",
    flags: flagStatus(),
  });
}
