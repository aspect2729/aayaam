import { createSession, registerAccount } from "@/server/auth";
import { getDb } from "@/server/db";
import { assertSameOrigin, errorResponse, json, sessionCookie } from "@/server/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
      businessName?: string;
      city?: string;
      businessType?: string;
      ecommerceBilling?: boolean;
      gstin?: string;
    };
    if (!body.name || !body.email || !body.password || !body.businessName || !body.city || !body.businessType) {
      return json({ error: { code: "INVALID_INPUT", message: "Name, email, password, business, city, and type are required" } }, 422);
    }
    const db = getDb();
    const created = registerAccount(db, {
      name: body.name,
      email: body.email,
      password: body.password,
      businessName: body.businessName,
      city: body.city,
      businessType: body.businessType,
      ecommerceBilling: Boolean(body.ecommerceBilling),
      gstin: body.gstin,
    });
    const token = createSession(db, created.userId);
    return json({ ok: true, businessId: created.businessId }, 201, { "set-cookie": sessionCookie(token) });
  } catch (error) {
    return errorResponse(error);
  }
}
