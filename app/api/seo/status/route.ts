import { seoAdapterReport } from "@/lib/seo/adapters";
import { json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return json({
    items: seoAdapterReport(),
    note: "No SEO provider is called from this server. Demo charts on Marketing stay labelled as demo.",
  });
}
