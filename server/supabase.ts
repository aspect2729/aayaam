export function supabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseAuth() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

async function supabaseCount(table: string) {
  const auth = supabaseAuth();
  if (!auth) return null;
  const response = await fetch(`${auth.url}/rest/v1/${table}?select=id`, {
    cache: "no-store",
    headers: {
      apikey: auth.key,
      authorization: `Bearer ${auth.key}`,
      prefer: "count=exact",
      range: "0-0",
    },
  });
  if (!response.ok) return null;
  const total = response.headers.get("content-range")?.split("/")[1];
  return total && total !== "*" ? Number(total) : null;
}

export async function supabaseStatus() {
  if (!supabaseAuth()) return "missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY";
  const [businesses, customers, leads, tasks, activity] = await Promise.all([
    supabaseCount("businesses"),
    supabaseCount("customers"),
    supabaseCount("leads"),
    supabaseCount("tasks"),
    supabaseCount("activity_log"),
  ]);
  if (activity === null) return "project reachable, activity_log table is not created yet";
  return `connected — ${businesses ?? 0} businesses, ${customers ?? 0} customers, ${leads ?? 0} leads, ${tasks ?? 0} tasks, ${activity} saved actions`;
}

export async function insertSupabaseActivity(row: { id: string; business_key: string; action: string; detail: string; created_at: string }) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, reason: "Supabase is not configured" };
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/activity_log`, {
    method: "POST",
    cache: "no-store",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!response.ok) {
    return { ok: false, reason: `Supabase returned ${response.status}` };
  }
  return { ok: true, reason: "Stored in Supabase" };
}
