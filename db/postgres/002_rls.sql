-- Production policies for Supabase/Postgres. Not applied in the local SQLite runtime.
-- The application still filters by the signed-in business. These policies are the database backstop.
-- Set `request.jwt` claim business_id from the server session before queries. Do not accept it from the browser.

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Example for a tenant table. Repeat the same predicate for every table that has business_id.
CREATE POLICY tenant_isolation ON customers
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));

CREATE POLICY ledger_no_update ON ledger_entries
  FOR UPDATE
  USING (false);

CREATE POLICY ledger_no_delete ON ledger_entries
  FOR DELETE
  USING (false);
