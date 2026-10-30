import { getDb } from "@/server/db";
import { errorResponse, json, requireActor } from "@/server/http";
import { buildWorkspace } from "@/server/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return json(buildWorkspace(getDb(), requireActor(request)));
  } catch (error) {
    return errorResponse(error);
  }
}
