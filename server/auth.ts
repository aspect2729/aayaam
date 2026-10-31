import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type Database from "better-sqlite3";
import type { Actor, Role } from "@/server/db";
import { nowIso } from "@/server/db";
import { AppError } from "@/server/errors";

const attempts = new Map<string, { count: number; resetAt: number }>();

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function assertLoginRate(email: string) {
  const key = email.toLowerCase();
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return;
  }
  current.count += 1;
  if (current.count > 8) throw new AppError(429, "RATE_LIMITED", "Too many sign-in attempts. Try again later.");
}

export function registerAccount(
  db: Database.Database,
  input: {
    name: string;
    email: string;
    password: string;
    businessName: string;
    city: string;
    businessType: string;
    ecommerceBilling: boolean;
    gstin?: string | null;
  }
) {
  if (input.password.length < 10) throw new AppError(422, "WEAK_PASSWORD", "Use at least 10 characters");
  const email = input.email.trim().toLowerCase();
  if (db.prepare(`SELECT id FROM users WHERE email = ?`).get(email)) {
    throw new AppError(409, "EMAIL_IN_USE", "An account with this email already exists");
  }
  const userId = crypto.randomUUID();
  const orgId = crypto.randomUUID();
  const businessId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const at = nowIso();
  const run = db.transaction(() => {
    db.prepare(`INSERT INTO users (id, email, name, password_hash, email_verified_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)`).run(
      userId,
      email,
      input.name.trim(),
      hashPassword(input.password),
      at
    );
    db.prepare(`INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)`).run(orgId, input.businessName.trim(), at);
    db.prepare(
      `INSERT INTO businesses
        (id, organization_id, name, city, business_type, ecommerce_billing, currency, timezone, gstin, financial_year_start_month, default_tax_bps, address, invoice_on_paid_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'INR', 'Asia/Kolkata', ?, 4, ?, '', 1, ?)`
    ).run(businessId, orgId, input.businessName.trim(), input.city, input.businessType, input.ecommerceBilling ? 1 : 0, input.gstin ?? null, input.ecommerceBilling ? 1800 : 0, at);
    db.prepare(`INSERT INTO branches (id, business_id, name, city, is_primary) VALUES (?, ?, 'Primary', ?, 1)`).run(branchId, businessId, input.city);
    db.prepare(`INSERT INTO business_members (id, business_id, user_id, role, created_at) VALUES (?, ?, ?, 'owner', ?)`).run(memberId, businessId, userId, at);
    db.prepare(
      `INSERT INTO workflow_rules (id, business_id, name, trigger, action, enabled) VALUES (?, ?, 'Lead follow-up', 'lead.created', 'create_followup_task', 1)`
    ).run(crypto.randomUUID(), businessId);
  });
  run();
  return { userId, businessId };
}

export function createSession(db: Database.Database, userId: string): string {
  const token = randomBytes(32).toString("base64url");
  const membership = db.prepare(`SELECT business_id FROM business_members WHERE user_id = ? ORDER BY created_at LIMIT 1`).get(userId) as
    | { business_id: string }
    | undefined;
  db.prepare(`INSERT INTO sessions (id, user_id, token_hash, active_business_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
    crypto.randomUUID(),
    userId,
    hashToken(token),
    membership?.business_id ?? null,
    new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
    nowIso()
  );
  return token;
}

export function login(db: Database.Database, email: string, password: string): string {
  assertLoginRate(email);
  const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email.trim().toLowerCase()) as
    | { id: string; password_hash: string }
    | undefined;
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new AppError(401, "INVALID_LOGIN", "Email or password is incorrect");
  }
  return createSession(db, user.id);
}

export function actorFromToken(db: Database.Database, token: string | undefined): Actor | null {
  if (!token) return null;
  const session = db.prepare(`SELECT * FROM sessions WHERE token_hash = ?`).get(hashToken(token)) as
    | { user_id: string; active_business_id: string | null; expires_at: string }
    | undefined;
  if (!session || session.expires_at < nowIso() || !session.active_business_id) return null;
  const member = db
    .prepare(`SELECT role FROM business_members WHERE user_id = ? AND business_id = ?`)
    .get(session.user_id, session.active_business_id) as { role: Role } | undefined;
  if (!member) return null;
  const business = db.prepare(`SELECT organization_id FROM businesses WHERE id = ?`).get(session.active_business_id) as
    | { organization_id: string }
    | undefined;
  if (!business) return null;
  return {
    userId: session.user_id,
    businessId: session.active_business_id,
    organizationId: business.organization_id,
    role: member.role,
  };
}

export function switchBusiness(db: Database.Database, token: string, businessId: string) {
  const session = db.prepare(`SELECT * FROM sessions WHERE token_hash = ?`).get(hashToken(token)) as { id: string; user_id: string } | undefined;
  if (!session) throw new AppError(401, "UNAUTHENTICATED", "Sign in required");
  const member = db.prepare(`SELECT role FROM business_members WHERE user_id = ? AND business_id = ?`).get(session.user_id, businessId);
  if (!member) throw new AppError(403, "FORBIDDEN", "You do not belong to that business");
  db.prepare(`UPDATE sessions SET active_business_id = ? WHERE id = ?`).run(businessId, session.id);
}

export function sessionProfile(db: Database.Database, token: string | undefined) {
  const actor = actorFromToken(db, token);
  if (!actor) return null;
  const user = db.prepare(`SELECT name FROM users WHERE id = ?`).get(actor.userId) as { name: string } | undefined;
  return { name: user?.name ?? "Owner", role: actor.role };
}

export function destroySession(db: Database.Database, token: string) {
  db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(hashToken(token));
}

export function requestPasswordReset(db: Database.Database, email: string): { token: string | null; delivered: false } {
  const user = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email.trim().toLowerCase()) as { id: string } | undefined;
  if (!user) return { token: null, delivered: false };
  const token = randomBytes(24).toString("base64url");
  db.prepare(`INSERT INTO password_resets (id, user_id, token_hash, expires_at, used_at) VALUES (?, ?, ?, ?, NULL)`).run(
    crypto.randomUUID(),
    user.id,
    hashToken(token),
    new Date(Date.now() + 1000 * 60 * 30).toISOString()
  );
  return { token, delivered: false };
}

export function resetPassword(db: Database.Database, token: string, password: string) {
  if (password.length < 10) throw new AppError(422, "WEAK_PASSWORD", "Use at least 10 characters");
  const row = db.prepare(`SELECT * FROM password_resets WHERE token_hash = ?`).get(hashToken(token)) as
    | { id: string; user_id: string; expires_at: string; used_at: string | null }
    | undefined;
  if (!row || row.used_at || row.expires_at < nowIso()) throw new AppError(400, "INVALID_TOKEN", "This reset link is not valid");
  db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hashPassword(password), row.user_id);
  db.prepare(`UPDATE password_resets SET used_at = ? WHERE id = ?`).run(nowIso(), row.id);
}
