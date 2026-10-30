PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  business_key TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  business_type TEXT NOT NULL,
  ecommerce_billing INTEGER NOT NULL DEFAULT 0 CHECK (ecommerce_billing IN (0, 1)),
  currency TEXT NOT NULL DEFAULT 'INR',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  gstin TEXT,
  financial_year_start_month INTEGER NOT NULL DEFAULT 4 CHECK (financial_year_start_month BETWEEN 1 AND 12),
  default_tax_bps INTEGER NOT NULL DEFAULT 0 CHECK (default_tax_bps >= 0 AND default_tax_bps <= 10000),
  address TEXT NOT NULL DEFAULT '',
  invoice_on_paid_order INTEGER NOT NULL DEFAULT 1 CHECK (invoice_on_paid_order IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1))
);

CREATE TABLE IF NOT EXISTS business_members (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('owner','administrator','manager','salesperson','accountant','inventory_manager','marketing_manager')),
  created_at TEXT NOT NULL,
  UNIQUE (business_id, user_id)
);

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','revoked')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  active_business_id TEXT REFERENCES businesses(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  gstin TEXT,
  notes TEXT NOT NULL DEFAULT '',
  archived_at TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique
  ON customers(business_id, phone)
  WHERE phone IS NOT NULL AND archived_at IS NULL;

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  customer_id TEXT REFERENCES customers(id),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  source TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('new','contacted','qualified','proposal','negotiation','won','lost')),
  score INTEGER NOT NULL DEFAULT 0,
  requirement TEXT NOT NULL DEFAULT '',
  budget_paise INTEGER,
  assignee_member_id TEXT REFERENCES business_members(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS leads_open_phone
  ON leads(business_id, phone)
  WHERE phone IS NOT NULL AND stage NOT IN ('won','lost');

CREATE TABLE IF NOT EXISTS lead_activities (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  lead_id TEXT NOT NULL REFERENCES leads(id),
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  purchase_cost_paise INTEGER,
  currency TEXT NOT NULL DEFAULT 'INR',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE (business_id, sku)
);

CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  selling_price_paise INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'piece',
  created_at TEXT NOT NULL,
  UNIQUE (business_id, sku)
);

CREATE TABLE IF NOT EXISTS inventory_locations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_balances (
  business_id TEXT NOT NULL REFERENCES businesses(id),
  variant_id TEXT NOT NULL REFERENCES product_variants(id),
  location_id TEXT NOT NULL REFERENCES inventory_locations(id),
  quantity_milli INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (variant_id, location_id)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  variant_id TEXT NOT NULL REFERENCES product_variants(id),
  location_id TEXT NOT NULL REFERENCES inventory_locations(id),
  quantity_milli INTEGER NOT NULL,
  reason TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_movement_source
  ON stock_movements(business_id, source_type, source_id, variant_id, reason);

CREATE TABLE IF NOT EXISTS ecommerce_stores (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  provider TEXT NOT NULL CHECK (provider IN ('shopify','woocommerce')),
  status TEXT NOT NULL CHECK (status IN ('pending_configuration','connected','error','disconnected')),
  shop_domain TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ecommerce_orders (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  store_id TEXT REFERENCES ecommerce_stores(id),
  external_id TEXT,
  customer_id TEXT REFERENCES customers(id),
  currency TEXT NOT NULL,
  fulfillment_status TEXT NOT NULL CHECK (fulfillment_status IN ('unfulfilled','fulfilled','cancelled','returned')),
  financial_status TEXT NOT NULL,
  discount_paise INTEGER NOT NULL DEFAULT 0,
  shipping_paise INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS orders_external
  ON ecommerce_orders(store_id, external_id)
  WHERE store_id IS NOT NULL AND external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ecommerce_order_items (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  order_id TEXT NOT NULL REFERENCES ecommerce_orders(id),
  variant_id TEXT REFERENCES product_variants(id),
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity_milli INTEGER NOT NULL,
  unit_paise INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS invoice_sequences (
  business_id TEXT NOT NULL REFERENCES businesses(id),
  financial_year TEXT NOT NULL,
  last_number INTEGER NOT NULL,
  PRIMARY KEY (business_id, financial_year)
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  order_id TEXT UNIQUE REFERENCES ecommerce_orders(id),
  customer_id TEXT REFERENCES customers(id),
  number TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('issued','cancelled')),
  currency TEXT NOT NULL,
  subtotal_paise INTEGER NOT NULL,
  discount_paise INTEGER NOT NULL,
  shipping_paise INTEGER NOT NULL,
  tax_paise INTEGER NOT NULL,
  total_paise INTEGER NOT NULL,
  issued_at TEXT NOT NULL,
  UNIQUE (business_id, number)
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  business_id TEXT NOT NULL REFERENCES businesses(id),
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity_milli INTEGER NOT NULL,
  unit_paise INTEGER NOT NULL,
  tax_bps INTEGER NOT NULL,
  line_paise INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  customer_id TEXT REFERENCES customers(id),
  method TEXT NOT NULL CHECK (method IN ('cash','upi','card','bank','credit')),
  status TEXT NOT NULL CHECK (status IN ('initiated','app_confirmed','bank_settled','pending','failed','reversed','under_investigation','recorded')),
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  currency TEXT NOT NULL,
  reference TEXT,
  provider TEXT,
  settlement_evidence TEXT,
  idempotency_key TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_idempotency
  ON payment_transactions(business_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payment_provider_reference
  ON payment_transactions(business_id, provider, reference)
  WHERE provider IS NOT NULL AND reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_allocations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  payment_id TEXT NOT NULL REFERENCES payment_transactions(id),
  invoice_id TEXT REFERENCES invoices(id),
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  payment_id TEXT NOT NULL REFERENCES payment_transactions(id),
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  status TEXT NOT NULL CHECK (status IN ('refund_initiated','refund_completed')),
  reference TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS credit_notes (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  number TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (business_id, number)
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  account TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('debit','credit')),
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  currency TEXT NOT NULL,
  customer_id TEXT,
  supplier_id TEXT,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  reversal_of TEXT REFERENCES ledger_entries(id),
  memo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  UNIQUE (business_id, name)
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  category_id TEXT NOT NULL REFERENCES expense_categories(id),
  supplier_id TEXT REFERENCES suppliers(id),
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  currency TEXT NOT NULL,
  memo TEXT NOT NULL DEFAULT '',
  incurred_on TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('open','done','cancelled')),
  due_at TEXT,
  assignee_member_id TEXT,
  source_type TEXT,
  source_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  action TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','executed','failed')),
  requested_by TEXT NOT NULL,
  decided_by TEXT,
  result_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  actor_user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  detail_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  provider TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_configuration','connected','error','disconnected')),
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE (business_id, provider)
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  integration_id TEXT NOT NULL REFERENCES integrations(id),
  external_event_id TEXT NOT NULL,
  signature_valid INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('stored','processed','failed','duplicate')),
  error TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (integration_id, external_event_id)
);

CREATE TABLE IF NOT EXISTS sync_jobs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  channel TEXT NOT NULL,
  body TEXT NOT NULL,
  outstanding_paise INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','blocked','approved')),
  blocked_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  objective TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','planned')),
  budget_paise INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  source TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_runs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  kind TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('deterministic','model')),
  input_json TEXT NOT NULL,
  output_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS backup_snapshots (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  sha256 TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open','resolved')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_rules (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  trigger TEXT NOT NULL,
  action TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  rule_id TEXT NOT NULL REFERENCES workflow_rules(id),
  status TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  business_id TEXT NOT NULL,
  key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (business_id, key)
);

CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_members_user ON business_members(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_business ON ledger_entries(business_id, account);
CREATE INDEX IF NOT EXISTS idx_audit_business ON audit_events(business_id, created_at);
