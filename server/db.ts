import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { ensureOutreachTables } from "@/server/outreach/schema";

const schemaPath = path.join(process.cwd(), "server/db/schema.sql");

let singleton: Database.Database | null = null;

export function schemaSql(): string {
  return fs.readFileSync(schemaPath, "utf8");
}

export function openDatabase(filename: string): Database.Database {
  const db = new Database(filename);
  db.pragma("foreign_keys = ON");
  db.exec(schemaSql());
  ensureOutreachTables(db);
  return db;
}

export function getDb(): Database.Database {
  if (singleton) return singleton;
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  singleton = openDatabase(path.join(dir, "aayaam.sqlite"));
  singleton.pragma("journal_mode = WAL");
  const { seedIfEmpty } = require("./seed") as { seedIfEmpty: (database: Database.Database) => void };
  seedIfEmpty(singleton);
  return singleton;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export type Actor = {
  userId: string;
  businessId: string;
  organizationId: string;
  role: Role;
};

export type Role =
  | "owner"
  | "administrator"
  | "manager"
  | "salesperson"
  | "accountant"
  | "inventory_manager"
  | "marketing_manager";
