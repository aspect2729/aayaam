import type Database from "better-sqlite3";
import { defaultQuestions, sequenceBlueprints } from "@/lib/qualification/defaults";
import { defaultBudgetRanges, defaultServiceAreas } from "@/lib/qualification/normalize";

export const outreachSql = `
CREATE TABLE IF NOT EXISTS qualification_configs (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id),
  autonomy TEXT NOT NULL CHECK (autonomy IN ('draft','assisted','autonomous')),
  assistant_name TEXT NOT NULL,
  min_budget_paise INTEGER NOT NULL,
  service_areas_json TEXT NOT NULL,
  budget_ranges_json TEXT NOT NULL,
  quiet_start TEXT NOT NULL,
  quiet_end TEXT NOT NULL,
  holidays_json TEXT NOT NULL,
  daily_cap INTEGER NOT NULL,
  weekly_cap INTEGER NOT NULL,
  confidence_threshold REAL NOT NULL,
  studio_address TEXT NOT NULL,
  working_hours TEXT NOT NULL,
  portfolio_url TEXT NOT NULL,
  services_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS qualification_questions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  field TEXT NOT NULL,
  position INTEGER NOT NULL,
  prompt_en TEXT NOT NULL,
  prompt_hi TEXT NOT NULL,
  prompt_kn TEXT NOT NULL,
  options_json TEXT NOT NULL,
  optional INTEGER NOT NULL DEFAULT 0,
  UNIQUE (business_id, field)
);

CREATE TABLE IF NOT EXISTS message_templates (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  channel TEXT NOT NULL,
  category TEXT NOT NULL,
  language TEXT NOT NULL,
  body TEXT NOT NULL,
  variables_json TEXT NOT NULL,
  provider_status TEXT NOT NULL,
  provider_template_id TEXT,
  UNIQUE (business_id, name, language)
);

CREATE TABLE IF NOT EXISTS sequences (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','paused')),
  UNIQUE (business_id, key)
);

CREATE TABLE IF NOT EXISTS sequence_steps (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  sequence_id TEXT NOT NULL REFERENCES sequences(id),
  position INTEGER NOT NULL,
  offset_days INTEGER NOT NULL,
  template_name TEXT NOT NULL,
  category TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outreach_leads (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  lead_id TEXT REFERENCES leads(id),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  source TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  stage TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  score_reasons_json TEXT NOT NULL DEFAULT '[]',
  outcome_reason TEXT,
  human_active INTEGER NOT NULL DEFAULT 0,
  manual_stage INTEGER NOT NULL DEFAULT 0,
  awaiting_field TEXT,
  clarification_field TEXT,
  demo INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  lead_id TEXT NOT NULL REFERENCES outreach_leads(id),
  channel TEXT NOT NULL,
  basis TEXT NOT NULL,
  source TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  withdrawn_at TEXT
);

CREATE TABLE IF NOT EXISTS suppression_list (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  channel TEXT NOT NULL,
  address TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (business_id, channel, address)
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  lead_id TEXT NOT NULL REFERENCES outreach_leads(id),
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  ai_active INTEGER NOT NULL DEFAULT 1,
  human_owner_id TEXT,
  window_expires_at TEXT,
  UNIQUE (lead_id, channel)
);

CREATE TABLE IF NOT EXISTS outreach_messages (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  lead_id TEXT NOT NULL REFERENCES outreach_leads(id),
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  channel TEXT NOT NULL,
  provider_message_id TEXT,
  template_id TEXT,
  body TEXT NOT NULL,
  media_json TEXT NOT NULL DEFAULT '[]',
  interaction_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL,
  error TEXT,
  origin TEXT NOT NULL,
  policy_id TEXT,
  approved_by TEXT,
  cost_category TEXT,
  enrollment_id TEXT,
  step_index INTEGER,
  idempotency_key TEXT,
  scheduled_for TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (business_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  sequence_id TEXT NOT NULL REFERENCES sequences(id),
  lead_id TEXT NOT NULL REFERENCES outreach_leads(id),
  current_step INTEGER NOT NULL DEFAULT 0,
  next_run_at TEXT,
  status TEXT NOT NULL,
  stop_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS qualification_answers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  lead_id TEXT NOT NULL REFERENCES outreach_leads(id),
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  normalized TEXT NOT NULL,
  confidence REAL NOT NULL,
  source_message_id TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  clarified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (lead_id, field)
);

CREATE TABLE IF NOT EXISTS availability_rules (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  designer_name TEXT NOT NULL,
  weekdays_json TEXT NOT NULL,
  start_hour INTEGER NOT NULL,
  end_hour INTEGER NOT NULL,
  max_per_day INTEGER NOT NULL,
  service_areas_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS site_visits (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  lead_id TEXT NOT NULL REFERENCES outreach_leads(id),
  designer_name TEXT NOT NULL,
  start_at TEXT NOT NULL,
  status TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS offered_slots (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  lead_id TEXT NOT NULL REFERENCES outreach_leads(id),
  start_at TEXT NOT NULL,
  label TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS automation_policies (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  level TEXT NOT NULL,
  detail TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outreach_actions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  lead_id TEXT,
  action TEXT NOT NULL,
  policy_id TEXT,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outreach_webhook_events (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  provider TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  signature_valid INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (business_id, provider, external_event_id)
);

CREATE TABLE IF NOT EXISTS feature_interest (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  feature TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outreach_messages_lead ON outreach_messages(lead_id, created_at);
CREATE INDEX IF NOT EXISTS idx_outreach_enrollments_due ON sequence_enrollments(business_id, status, next_run_at);
`;

const templateBodies: Record<string, { en: string; hi: string; kn: string; category: string }> = {
  intro: {
    category: "utility",
    en: "Hi {{name}}, this is {{assistant}}. {{question}}",
    hi: "नमस्ते {{name}}, मैं {{assistant}} हूँ। {{question}}",
    kn: "ನಮಸ್ಕಾರ {{name}}, ನಾನು {{assistant}}. {{question}}",
  },
  reminder: {
    category: "utility",
    en: "Just checking in, {{name}}. {{question}}",
    hi: "{{name}}, बस याद दिला रहे थे। {{question}}",
    kn: "{{name}}, ಸ್ವಲ್ಪ ನೆನಪಿಸುತ್ತಿದ್ದೇವೆ. {{question}}",
  },
  portfolio: {
    category: "marketing",
    en: "A few recent interiors are here: {{portfolio}}. {{question}}",
    hi: "कुछ हाल के इंटीरियर यहाँ हैं: {{portfolio}}. {{question}}",
    kn: "ಇತ್ತೀಚಿನ ಕೆಲಸ ಇಲ್ಲಿದೆ: {{portfolio}}. {{question}}",
  },
  still_planning: {
    category: "utility",
    en: "Still planning your interiors? {{question}}",
    hi: "क्या इंटीरियर की योजना अभी भी चल रही है? {{question}}",
    kn: "ಇಂಟೀರಿಯರ್ ಯೋಜನೆ ಇನ್ನೂ ಇದೆಯೇ? {{question}}",
  },
  final_check: {
    category: "utility",
    en: "Last note from {{studio}}. Reply if you would like to continue, or say STOP to opt out.",
    hi: "{{studio}} की आखिरी याद। जारी रखना हो तो जवाब दें, वरना STOP लिखें।",
    kn: "{{studio}} ಕೊನೆಯ ಸಂದೇಶ. ಮುಂದುವರಿಸಲು ಉತ್ತರಿಸಿ, ಅಥವಾ STOP ಎಂದು ಹೇಳಿ.",
  },
  slot_offer: {
    category: "utility",
    en: "We can visit the site. Reply with a number:\n{{slots}}",
    hi: "हम साइट विज़िट कर सकते हैं। नंबर चुनें:\n{{slots}}",
    kn: "ನಾವು ಸೈಟ್ ವಿಸಿಟ್ ಮಾಡಬಹುದು. ಸಂಖ್ಯೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ:\n{{slots}}",
  },
  slot_reminder: {
    category: "utility",
    en: "The visit slots are still open.\n{{slots}}",
    hi: "विज़िट के समय अभी खाली हैं।\n{{slots}}",
    kn: "ವಿಸಿಟ್ ಸಮಯ ಇನ್ನೂ ಖಾಲಿ ಇದೆ.\n{{slots}}",
  },
  booking_confirmed: {
    category: "utility",
    en: "Your visit is booked for {{slot}} with {{designer}} at {{address}}. Reply if you need another time.",
    hi: "आपकी विज़िट {{slot}} को {{designer}} के साथ {{address}} पर बुक है। समय बदलना हो तो लिखें।",
    kn: "ನಿಮ್ಮ ವಿಸಿಟ್ {{slot}} ರಂದು {{designer}} ಜೊತೆ {{address}} ನಲ್ಲಿ ಬುಕ್ ಆಗಿದೆ. ಬೇರೆ ಸಮಯ ಬೇಕಾದರೆ ಬರೆಯಿರಿ.",
  },
  not_a_fit: {
    category: "utility",
    en: "Thank you for telling us about the project. This one looks outside what {{studio}} can take up. We wish you the best.",
    hi: "प्रोजेक्ट बताने के लिए धन्यवाद। यह {{studio}} के काम के दायरे से बाहर लग रहा है। शुभकामनाएँ।",
    kn: "ಪ್ರಾಜೆಕ್ಟ್ ಹೇಳಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದ. ಇದು {{studio}} ವ್ಯಾಪ್ತಿಯ ಹೊರಗೆ ಇದೆ. ಶುಭವಾಗಲಿ.",
  },
  opt_out_confirm: {
    category: "utility",
    en: "You are opted out. We will not send more messages.",
    hi: "आपने संदेश बंद कर दिए। अब और संदेश नहीं जाएँगे।",
    kn: "ನೀವು ನಿಲ್ಲಿಸಿದ್ದೀರಿ. ಇನ್ನು ಸಂದೇಶ ಕಳುಹಿಸುವುದಿಲ್ಲ.",
  },
  handoff: {
    category: "utility",
    en: "Let me connect you with our designer. A person from {{studio}} will continue this conversation.",
    hi: "मैं आपको हमारे डिज़ाइनर से जोड़ता हूँ। {{studio}} का एक व्यक्ति आगे बात करेगा।",
    kn: "ನಿಮ್ಮನ್ನು ನಮ್ಮ ಡಿಸೈನರ್ ಜೊತೆ ಜೋಡಿಸುತ್ತೇನೆ. {{studio}} ವ್ಯಕ್ತಿ ಮುಂದೆ ಮಾತನಾಡುತ್ತಾರೆ.",
  },
  clarify: {
    category: "utility",
    en: "I want to note that correctly. {{question}}",
    hi: "मैं इसे सही नोट करना चाहता हूँ। {{question}}",
    kn: "ಇದನ್ನು ಸರಿಯಾಗಿ ಬರೆದಿಡಬೇಕು. {{question}}",
  },
  visit_thanks: {
    category: "utility",
    en: "Thank you for the site visit. The designer will share the next step from {{studio}}.",
    hi: "साइट विज़िट के लिए धन्यवाद। डिज़ाइनर {{studio}} से अगला कदम बताएँगे।",
    kn: "ಸೈಟ್ ವಿಸಿಟ್‌ಗೆ ಧನ್ಯವಾದ. ಡಿಸೈನರ್ {{studio}} ನಿಂದ ಮುಂದಿನ ಹೆಜ್ಜೆ ಹೇಳುತ್ತಾರೆ.",
  },
  quotation_timing: {
    category: "utility",
    en: "The quotation is being prepared by the designer. This note does not include a price.",
    hi: "कोटेशन डिज़ाइनर तैयार कर रहे हैं। इस संदेश में कोई कीमत नहीं है।",
    kn: "ಕೊಟೇಶನ್ ಡಿಸೈನರ್ ಸಿದ್ಧಪಡಿಸುತ್ತಿದ್ದಾರೆ. ಈ ಸಂದೇಶದಲ್ಲಿ ಬೆಲೆ ಇಲ್ಲ.",
  },
  quotation_followup: {
    category: "utility",
    en: "Checking whether you had time to review the quotation. A person can answer questions. This message has no new price.",
    hi: "क्या आप कोटेशन देख पाए? सवालों का जवाब एक व्यक्ति देगा। इसमें कोई नई कीमत नहीं है।",
    kn: "ಕೊಟೇಶನ್ ನೋಡಲು ಸಮಯ ಸಿಕ್ಕಿತೇ? ಪ್ರಶ್ನೆಗಳಿಗೆ ವ್ಯಕ್ತಿ ಉತ್ತರಿಸುತ್ತಾರೆ. ಇಲ್ಲಿ ಹೊಸ ಬೆಲೆ ಇಲ್ಲ.",
  },
  visit_reminder: {
    category: "utility",
    en: "Reminder: site visit {{slot}} with {{designer}} at {{address}}.",
    hi: "याद: साइट विज़िट {{slot}}, {{designer}}, {{address}}।",
    kn: "ಜ್ಞಾಪನೆ: ಸೈಟ್ ವಿಸಿಟ್ {{slot}}, {{designer}}, {{address}}.",
  },
};

export function ensureOutreachTables(db: Database.Database) {
  db.exec(outreachSql);
}

export function seedOutreachDefaults(db: Database.Database, businessId: string, studioName: string) {
  const existing = db.prepare(`SELECT business_id FROM qualification_configs WHERE business_id = ?`).get(businessId);
  const now = new Date().toISOString();
  if (!existing) {
    db.prepare(
      `INSERT INTO qualification_configs
        (business_id, autonomy, assistant_name, min_budget_paise, service_areas_json, budget_ranges_json, quiet_start, quiet_end, holidays_json, daily_cap, weekly_cap, confidence_threshold, studio_address, working_hours, portfolio_url, services_json, updated_at)
       VALUES (?, 'assisted', ?, 30000000, ?, ?, '21:00', '09:00', '[]', 3, 8, 0.7, ?, 'Monday to Saturday, 10:00 to 18:00 IST', '', ?, ?)`
    ).run(
      businessId,
      `Aayaam assistant for ${studioName}`,
      JSON.stringify(defaultServiceAreas),
      JSON.stringify(defaultBudgetRanges),
      "Jayanagar, Bengaluru",
      JSON.stringify(["Full home", "Kitchen", "Wardrobes", "Living room", "Office"]),
      now
    );
  }
  const insertQuestion = db.prepare(
    `INSERT OR IGNORE INTO qualification_questions (id, business_id, field, position, prompt_en, prompt_hi, prompt_kn, options_json, optional)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const question of defaultQuestions) {
    insertQuestion.run(
      `${businessId}:${question.field}`,
      businessId,
      question.field,
      question.position,
      question.prompt.en,
      question.prompt.hi,
      question.prompt.kn,
      JSON.stringify(question.options),
      question.optional ? 1 : 0
    );
  }
  const insertTemplate = db.prepare(
    `INSERT OR IGNORE INTO message_templates (id, business_id, name, channel, category, language, body, variables_json, provider_status, provider_template_id)
     VALUES (?, ?, ?, 'whatsapp', ?, ?, ?, '["name","assistant","question","portfolio","studio","slots","slot","designer","address"]', 'not_submitted', NULL)`
  );
  for (const [name, copy] of Object.entries(templateBodies)) {
    for (const language of ["en", "hi", "kn"] as const) {
      insertTemplate.run(`${businessId}:${name}:${language}`, businessId, name, copy.category, language, copy[language]);
      db.prepare(
        `INSERT OR IGNORE INTO message_templates (id, business_id, name, channel, category, language, body, variables_json, provider_status, provider_template_id)
         VALUES (?, ?, ?, 'email', ?, ?, ?, '[]', 'local_only', NULL)`
      ).run(`${businessId}:${name}:email:${language}`, businessId, name, copy.category, language, copy[language]);
    }
  }
  for (const sequence of sequenceBlueprints) {
    const sequenceId = `${businessId}:${sequence.key}`;
    db.prepare(`INSERT OR IGNORE INTO sequences (id, business_id, key, name, status) VALUES (?, ?, ?, ?, 'active')`).run(sequenceId, businessId, sequence.key, sequence.name);
    sequence.steps.forEach((step, index) => {
      db.prepare(
        `INSERT OR IGNORE INTO sequence_steps (id, business_id, sequence_id, position, offset_days, template_name, category)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(`${sequenceId}:${index}`, businessId, sequenceId, index, step.offsetDays, step.template, step.category);
    });
  }
  db.prepare(
    `INSERT OR IGNORE INTO availability_rules (id, business_id, designer_name, weekdays_json, start_hour, end_hour, max_per_day, service_areas_json)
     VALUES (?, ?, 'Rohan', '[1,2,3,4,5,6]', 10, 18, 4, ?)`
  ).run(`${businessId}:availability`, businessId, JSON.stringify(defaultServiceAreas.map((area) => area.name)));
  for (const level of ["draft", "assisted", "autonomous"]) {
    db.prepare(`INSERT OR IGNORE INTO automation_policies (id, business_id, level, detail) VALUES (?, ?, ?, ?)`).run(
      `${businessId}:${level}`,
      businessId,
      level,
      level === "draft"
        ? "Every outgoing message waits for approval."
        : level === "assisted"
          ? "Fixed templates can be attempted. Free text waits for approval. Nothing is sent without a provider id."
          : "Fixed replies inside an open WhatsApp window can be attempted. Templates are required once the window closes."
    );
  }
}

export function templateBody(name: string, language: "en" | "hi" | "kn") {
  return templateBodies[name]?.[language] ?? templateBodies[name]?.en ?? "";
}
