-- Prepared for Postgres. Not applied to the local SQLite database or to Supabase.
-- The server still filters every outreach query by business_id.

ALTER TABLE qualification_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualification_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualification_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE offered_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_interest ENABLE ROW LEVEL SECURITY;

CREATE POLICY outreach_leads_tenant ON outreach_leads
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));

CREATE POLICY outreach_messages_tenant ON outreach_messages
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));

CREATE POLICY qualification_answers_tenant ON qualification_answers
  USING (business_id = current_setting('app.business_id', true))
  WITH CHECK (business_id = current_setting('app.business_id', true));
