import type Database from "better-sqlite3";
import { createHash } from "crypto";
import { fillTemplate, sequenceBlueprints } from "@/lib/qualification/defaults";
import { extractAnswer, languageOf, type QuestionField } from "@/lib/qualification/extract";
import { asksForPrice, isOptOut, isPromptInjection, mentionsSensitiveData, needsHumanTone, type LeadLanguage } from "@/lib/qualification/language";
import { interactionFor, numberedOptions } from "@/lib/qualification/limits";
import { inServiceArea, type AnswerOption, type BudgetRange, type ServiceArea } from "@/lib/qualification/normalize";
import { decideOutcome, scoreFromAnswers, stopReason } from "@/lib/qualification/rules";
import { formatSlotLabel, fromIst, istParts, nextAllowedSend, withJitter } from "@/lib/qualification/schedule";
import { nextDeliveryStatus, windowExpiry, windowOpen } from "@/lib/qualification/window";
import { toE164India } from "@/lib/phone";
import type { MessagingProvider, ProviderSet } from "@/server/outreach/providers";
import { seedOutreachDefaults } from "@/server/outreach/schema";

type Lead = {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string;
  language: LeadLanguage;
  stage: string;
  human_active: number;
  manual_stage: number;
  awaiting_field: string | null;
  clarification_field: string | null;
  archived_at: string | null;
  created_at: string;
};

type Config = {
  business_id: string;
  autonomy: "draft" | "assisted" | "autonomous";
  assistant_name: string;
  min_budget_paise: number;
  service_areas_json: string;
  budget_ranges_json: string;
  quiet_start: string;
  quiet_end: string;
  holidays_json: string;
  daily_cap: number;
  weekly_cap: number;
  confidence_threshold: number;
  studio_address: string;
  working_hours: string;
  portfolio_url: string;
  services_json: string;
};

type Question = {
  field: string;
  position: number;
  prompt_en: string;
  prompt_hi: string;
  prompt_kn: string;
  options_json: string;
  optional: number;
};

type SendInput = {
  templateName: string;
  questionText: string;
  kind: "template" | "freeform";
  idempotencyKey: string;
  enrollmentId?: string | null;
  stepIndex?: number | null;
  options?: AnswerOption[];
  now: Date;
  providers: ProviderSet;
  automated: boolean;
};

export function unsubscribeToken(businessId: string, leadId: string) {
  return createHash("sha256").update(`${businessId}:${leadId}:aayaam-local-unsubscribe`).digest("hex");
}

function ready(db: Database.Database, businessId: string) {
  const business = db.prepare(`SELECT id, name, business_type FROM businesses WHERE id = ?`).get(businessId) as
    | { id: string; name: string; business_type: string }
    | undefined;
  if (!business) throw new Error("Business not found");
  if (business.business_type === "interior") seedOutreachDefaults(db, businessId, business.name);
  return business;
}

function configOf(db: Database.Database, businessId: string) {
  ready(db, businessId);
  return db.prepare(`SELECT * FROM qualification_configs WHERE business_id = ?`).get(businessId) as Config;
}

function questionsOf(db: Database.Database, businessId: string) {
  return db.prepare(`SELECT * FROM qualification_questions WHERE business_id = ? ORDER BY position`).all(businessId) as Question[];
}

function leadOf(db: Database.Database, businessId: string, leadId: string) {
  const lead = db.prepare(`SELECT * FROM outreach_leads WHERE id = ? AND business_id = ?`).get(leadId, businessId) as Lead | undefined;
  if (!lead) throw new Error("Lead not found");
  return lead;
}

function logAction(db: Database.Database, businessId: string, leadId: string | null, action: string, policyId: string | null, detail: string) {
  db.prepare(`INSERT INTO outreach_actions (id, business_id, lead_id, action, policy_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    crypto.randomUUID(),
    businessId,
    leadId,
    action,
    policyId,
    detail.slice(0, 240),
    new Date().toISOString()
  );
}

function areas(config: Config) {
  return JSON.parse(config.service_areas_json) as ServiceArea[];
}
function ranges(config: Config) {
  return JSON.parse(config.budget_ranges_json) as BudgetRange[];
}
function holidays(config: Config) {
  return JSON.parse(config.holidays_json) as string[];
}

function answerRows(db: Database.Database, leadId: string) {
  return db.prepare(`SELECT field, value, normalized, confidence, source_message_id, verified, clarified FROM qualification_answers WHERE lead_id = ?`).all(leadId) as {
    field: string;
    value: string;
    normalized: string;
    confidence: number;
    source_message_id: string | null;
    verified: number;
    clarified: number;
  }[];
}

function consentRow(db: Database.Database, leadId: string, channel: "whatsapp" | "email") {
  return db.prepare(`SELECT withdrawn_at FROM consents WHERE lead_id = ? AND channel = ? ORDER BY recorded_at DESC LIMIT 1`).get(leadId, channel) as { withdrawn_at: string | null } | undefined;
}

function consentOk(db: Database.Database, leadId: string, channel: "whatsapp" | "email") {
  const row = consentRow(db, leadId, channel);
  return !!row && !row.withdrawn_at;
}

function suppressed(db: Database.Database, businessId: string, channel: string, address: string | null) {
  if (!address) return false;
  return !!db.prepare(`SELECT id FROM suppression_list WHERE business_id = ? AND channel = ? AND address = ?`).get(businessId, channel, address);
}

function chooseChannel(db: Database.Database, lead: Lead): "whatsapp" | "email" | null {
  const phone = lead.phone ? toE164India(lead.phone) : null;
  if (phone && consentOk(db, lead.id, "whatsapp") && !suppressed(db, lead.business_id, "whatsapp", phone)) return "whatsapp";
  if (lead.email && consentOk(db, lead.id, "email") && !suppressed(db, lead.business_id, "email", lead.email.toLowerCase())) return "email";
  return null;
}

function ensureConversation(db: Database.Database, businessId: string, leadId: string, channel: string) {
  const existing = db.prepare(`SELECT id, window_expires_at, ai_active FROM conversations WHERE lead_id = ? AND channel = ?`).get(leadId, channel) as
    | { id: string; window_expires_at: string | null; ai_active: number }
    | undefined;
  if (existing) return existing;
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO conversations (id, business_id, lead_id, channel, status, ai_active, human_owner_id, window_expires_at) VALUES (?, ?, ?, ?, 'open', 1, NULL, NULL)`).run(
    id,
    businessId,
    leadId,
    channel
  );
  return { id, window_expires_at: null as string | null, ai_active: 1 };
}

function promptFor(question: Question, language: LeadLanguage) {
  if (language === "hi") return question.prompt_hi;
  if (language === "kn") return question.prompt_kn;
  return question.prompt_en;
}

function nextQuestion(db: Database.Database, businessId: string, leadId: string) {
  const answered = new Set(answerRows(db, leadId).filter((row) => row.verified || row.normalized || row.clarified).map((row) => row.field));
  return questionsOf(db, businessId).find((question) => !question.optional && !answered.has(question.field)) ?? null;
}

function templateVars(db: Database.Database, config: Config, lead: Lead, questionText: string) {
  const slots = db.prepare(`SELECT label FROM offered_slots WHERE lead_id = ? ORDER BY position`).all(lead.id) as { label: string }[];
  const visit = db.prepare(`SELECT start_at, designer_name FROM site_visits WHERE lead_id = ? AND status = 'scheduled' ORDER BY created_at DESC LIMIT 1`).get(lead.id) as
    | { start_at: string; designer_name: string }
    | undefined;
  return {
    name: lead.name,
    assistant: config.assistant_name,
    studio: config.assistant_name.replace("Aayaam assistant for ", ""),
    question: questionText,
    portfolio: config.portfolio_url || "Ask us and we will share the portfolio in person.",
    slots: slots.map((slot, index) => `${index + 1}. ${slot.label}`).join("\n"),
    slot: visit ? formatSlotLabel(new Date(visit.start_at)) : "",
    designer: visit?.designer_name || "Rohan",
    address: config.studio_address,
  };
}

function render(db: Database.Database, config: Config, lead: Lead, templateName: string, questionText: string) {
  const row = db.prepare(`SELECT id, body, category FROM message_templates WHERE business_id = ? AND name = ? AND language = ? AND channel = 'whatsapp'`).get(
    config.business_id,
    templateName,
    lead.language
  ) as { id: string; body: string; category: string } | undefined;
  return {
    templateId: row?.id ?? null,
    body: fillTemplate(row?.body || templateName, templateVars(db, config, lead, questionText)),
    category: (row?.category || "utility") as "utility" | "marketing" | "service",
  };
}

function stopEnrollments(db: Database.Database, leadId: string, reason: string) {
  db.prepare(`UPDATE sequence_enrollments SET status = 'stopped', stop_reason = ?, next_run_at = NULL WHERE lead_id = ? AND status IN ('active','waiting_approval')`).run(reason, leadId);
}

function currentStop(db: Database.Database, lead: Lead, repliedSinceSchedule: boolean) {
  const booked = !!db.prepare(`SELECT id FROM site_visits WHERE lead_id = ? AND status = 'scheduled'`).get(lead.id);
  const channel = chooseChannel(db, lead);
  const withdrawn = !!consentRow(db, lead.id, "whatsapp")?.withdrawn_at || !!consentRow(db, lead.id, "email")?.withdrawn_at;
  return stopReason({
    optedOut: lead.stage === "opted_out",
    booked,
    manualStage: lead.manual_stage === 1,
    stage: lead.stage,
    humanActive: lead.human_active === 1,
    consentWithdrawn: withdrawn && channel === null,
    channelDead: false,
    archived: !!lead.archived_at,
    repliedSinceSchedule,
  });
}

function capReached(db: Database.Database, config: Config, leadId: string, now: Date) {
  const parts = istParts(now);
  const dayStart = fromIst(parts.year, parts.month, parts.day, 0, 0).toISOString();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const countSince = (since: string) =>
    (db.prepare(`SELECT COUNT(*) AS total FROM outreach_messages WHERE lead_id = ? AND direction = 'outbound' AND origin = 'system' AND created_at >= ? AND status != 'rejected'`).get(leadId, since) as { total: number }).total;
  return countSince(dayStart) >= config.daily_cap || countSince(weekStart) >= config.weekly_cap;
}

function messageBase(lead: Lead, conversationId: string, channel: string, body: string, status: string, error: string | null, origin: string, policyId: string | null, input: SendInput) {
  return {
    id: crypto.randomUUID(),
    business_id: lead.business_id,
    conversation_id: conversationId,
    lead_id: lead.id,
    direction: "outbound",
    channel,
    provider_message_id: null as string | null,
    template_id: null as string | null,
    body,
    media_json: "[]",
    interaction_json: "{}",
    status,
    error,
    origin,
    policy_id: policyId,
    approved_by: null as string | null,
    cost_category: null as string | null,
    enrollment_id: input.enrollmentId ?? null,
    step_index: input.stepIndex ?? null,
    idempotency_key: input.idempotencyKey,
    scheduled_for: null as string | null,
    sent_at: null as string | null,
    created_at: input.now.toISOString(),
  };
}

function insertMessage(db: Database.Database, row: ReturnType<typeof messageBase>) {
  const existing = db.prepare(`SELECT id, status FROM outreach_messages WHERE business_id = ? AND idempotency_key = ?`).get(row.business_id, row.idempotency_key) as { id: string; status: string } | undefined;
  if (existing) return existing;
  db.prepare(
    `INSERT INTO outreach_messages
      (id, business_id, conversation_id, lead_id, direction, channel, provider_message_id, template_id, body, media_json, interaction_json, status, error, origin, policy_id, approved_by, cost_category, enrollment_id, step_index, idempotency_key, scheduled_for, sent_at, created_at)
     VALUES (@id, @business_id, @conversation_id, @lead_id, @direction, @channel, @provider_message_id, @template_id, @body, @media_json, @interaction_json, @status, @error, @origin, @policy_id, @approved_by, @cost_category, @enrollment_id, @step_index, @idempotency_key, @scheduled_for, @sent_at, @created_at)`
  ).run(row);
  return { id: row.id, status: row.status };
}

function policyFor(config: Config, kind: "template" | "freeform") {
  if (config.autonomy === "draft" || (kind === "freeform" && config.autonomy !== "autonomous")) {
    return { id: `${config.business_id}:${config.autonomy}`, send: false };
  }
  return { id: `${config.business_id}:${config.autonomy}`, send: true };
}

function attemptSend(db: Database.Database, config: Config, lead: Lead, input: SendInput): { id?: string; status: string } {
  const channel = chooseChannel(db, lead);
  if (!channel) {
    logAction(db, lead.business_id, lead.id, "message.blocked", null, "No consented channel");
    return { status: "blocked" };
  }
  const conversation = ensureConversation(db, lead.business_id, lead.id, channel);
  const open = channel === "email" || windowOpen(conversation.window_expires_at, input.now);
  const rendered = render(db, config, lead, input.templateName, input.questionText);
  const options = input.options ?? [];
  const mode = channel === "whatsapp" ? interactionFor(options, open) : "text";
  let body = rendered.body;
  if (mode === "text" && options.length) body = `${body}\n${numberedOptions(options)}`;
  if (channel === "email") body += `\n\nReply STOP to opt out.`;
  if (channel === "whatsapp" && !open && input.kind === "freeform" && !rendered.templateId) {
    return insertMessage(db, messageBase(lead, conversation.id, channel, body, "queued", "Outside the customer-service window. A template is required.", "system", null, input));
  }
  if (input.automated && input.enrollmentId && capReached(db, config, lead.id, input.now)) {
    const later = nextAllowedSend(new Date(input.now.getTime() + 24 * 60 * 60 * 1000), config.quiet_start, config.quiet_end, holidays(config));
    if (input.enrollmentId) db.prepare(`UPDATE sequence_enrollments SET next_run_at = ? WHERE id = ?`).run(later.toISOString(), input.enrollmentId);
    logAction(db, lead.business_id, lead.id, "message.deferred", null, "Frequency cap");
    return { status: "deferred" };
  }
  const allowedAt = nextAllowedSend(input.now, config.quiet_start, config.quiet_end, holidays(config));
  const base = messageBase(lead, conversation.id, channel, body, "scheduled", null, "system", `${config.business_id}:${config.autonomy}`, input);
  base.template_id = rendered.templateId;
  base.interaction_json = JSON.stringify({ mode, options: mode === "text" ? [] : options });
  base.cost_category = rendered.category;
  if (allowedAt.getTime() - input.now.getTime() > 1000) {
    base.scheduled_for = allowedAt.toISOString();
    return insertMessage(db, base);
  }
  const policy = policyFor(config, input.kind);
  if (!policy.send) {
    base.status = "queued";
    base.policy_id = policy.id;
    logAction(db, lead.business_id, lead.id, "message.queued", policy.id, input.templateName);
    return insertMessage(db, base);
  }
  const provider: MessagingProvider = channel === "whatsapp" ? input.providers.whatsapp : input.providers.email;
  const result = provider.send({
    to: channel === "whatsapp" ? lead.phone || "" : lead.email || "",
    body,
    templateName: input.templateName,
    language: lead.language,
    category: rendered.category,
    buttons: mode === "buttons" ? options : undefined,
    list: mode === "list" ? options : undefined,
  });
  if (result.status === "failed" && /not on whatsapp|131026/i.test(result.reason) && lead.email && consentOk(db, lead.id, "email")) {
    db.prepare(`UPDATE consents SET withdrawn_at = ? WHERE lead_id = ? AND channel = 'whatsapp' AND withdrawn_at IS NULL`).run(input.now.toISOString(), lead.id);
    if (lead.phone) {
      db.prepare(`INSERT OR IGNORE INTO suppression_list (id, business_id, channel, address, reason, created_at) VALUES (?, ?, 'whatsapp', ?, 'not_on_whatsapp', ?)`).run(
        crypto.randomUUID(),
        lead.business_id,
        lead.phone,
        input.now.toISOString()
      );
    }
    logAction(db, lead.business_id, lead.id, "channel.switched", policy.id, "WhatsApp failed permanently. Switched to email.");
    return attemptSend(db, config, leadOf(db, lead.business_id, lead.id), { ...input, idempotencyKey: `${input.idempotencyKey}:email` });
  }
  base.status = result.status;
  base.provider_message_id = result.providerMessageId ?? null;
  base.sent_at = result.status === "sent" ? input.now.toISOString() : null;
  base.error = result.status === "failed" ? result.reason : null;
  base.policy_id = policy.id;
  base.cost_category = result.costCategory;
  logAction(db, lead.business_id, lead.id, result.status === "sent" ? "message.sent" : "message.awaiting_provider", policy.id, input.templateName);
  return insertMessage(db, base);
}

function scheduleAt(config: Config, anchor: Date, offsetDays: number, leadId: string) {
  const base = new Date(anchor.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const allowed = nextAllowedSend(base, config.quiet_start, config.quiet_end, holidays(config));
  return withJitter(allowed, `${leadId}:${offsetDays}`, offsetDays === 0 ? 4 : 14, config.quiet_start, config.quiet_end, holidays(config));
}

function enroll(db: Database.Database, businessId: string, leadId: string, key: string, now: Date) {
  const sequence = db.prepare(`SELECT id, status FROM sequences WHERE business_id = ? AND key = ?`).get(businessId, key) as { id: string; status: string } | undefined;
  if (!sequence || sequence.status !== "active") return;
  const existing = db.prepare(`SELECT id FROM sequence_enrollments WHERE lead_id = ? AND sequence_id = ? AND status IN ('active','waiting_approval')`).get(leadId, sequence.id);
  if (existing) return;
  const step = db.prepare(`SELECT offset_days FROM sequence_steps WHERE sequence_id = ? AND position = 0`).get(sequence.id) as { offset_days: number } | undefined;
  if (!step) return;
  const config = configOf(db, businessId);
  db.prepare(`INSERT INTO sequence_enrollments (id, business_id, sequence_id, lead_id, current_step, next_run_at, status, stop_reason, created_at) VALUES (?, ?, ?, ?, 0, ?, 'active', NULL, ?)`).run(
    crypto.randomUUID(),
    businessId,
    sequence.id,
    leadId,
    scheduleAt(config, now, step.offset_days, leadId).toISOString(),
    now.toISOString()
  );
}

function rememberQuestion(db: Database.Database, config: Config, lead: Lead) {
  const question = nextQuestion(db, config.business_id, lead.id);
  if (!question) return { text: "", options: [] as AnswerOption[], field: null as string | null };
  db.prepare(`UPDATE outreach_leads SET awaiting_field = ? WHERE id = ?`).run(question.field, lead.id);
  return { text: promptFor(question, lead.language), options: JSON.parse(question.options_json) as AnswerOption[], field: question.field };
}

function sendCurrentQuestion(db: Database.Database, config: Config, lead: Lead, templateName: string, now: Date, providers: ProviderSet, key: string, enrollmentId?: string, stepIndex?: number) {
  const bundle = rememberQuestion(db, config, lead);
  return attemptSend(db, config, leadOf(db, lead.business_id, lead.id), {
    templateName: bundle.field ? templateName : "final_check",
    questionText: bundle.text,
    kind: "template",
    idempotencyKey: key,
    enrollmentId,
    stepIndex,
    options: bundle.options,
    now,
    providers,
    automated: true,
  });
}

function refreshScore(db: Database.Database, config: Config, lead: Lead) {
  const flat = Object.fromEntries(answerRows(db, lead.id).filter((row) => row.verified).map((row) => [row.field, row.normalized]));
  const scored = scoreFromAnswers(flat, !!lead.phone, ranges(config));
  db.prepare(`UPDATE outreach_leads SET score = ?, score_reasons_json = ? WHERE id = ?`).run(scored.score, JSON.stringify(scored.reasons), lead.id);
}

function offerSlots(db: Database.Database, config: Config, lead: Lead, now: Date, providers: ProviderSet) {
  db.prepare(`DELETE FROM offered_slots WHERE lead_id = ?`).run(lead.id);
  const rule = db.prepare(`SELECT weekdays_json, start_hour, end_hour, max_per_day FROM availability_rules WHERE business_id = ?`).get(lead.business_id) as {
    weekdays_json: string;
    start_hour: number;
    end_hour: number;
    max_per_day: number;
  };
  const weekdays = JSON.parse(rule.weekdays_json) as number[];
  const slots: { start: string; label: string }[] = [];
  for (let day = 1; day < 21 && slots.length < 3; day += 1) {
    const parts = istParts(new Date(now.getTime() + day * 24 * 60 * 60 * 1000));
    if (!weekdays.includes(parts.weekday)) continue;
    const dayCount = (db.prepare(`SELECT COUNT(*) AS total FROM site_visits WHERE business_id = ? AND status = 'scheduled' AND substr(start_at, 1, 10) = ?`).get(lead.business_id, `${parts.year}-${String(parts.month + 1).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`) as { total: number }).total;
    if (dayCount >= rule.max_per_day) continue;
    const start = fromIst(parts.year, parts.month, parts.day, rule.start_hour, 0);
    slots.push({ start: start.toISOString(), label: formatSlotLabel(start) });
  }
  slots.forEach((slot, index) => {
    db.prepare(`INSERT INTO offered_slots (id, business_id, lead_id, start_at, label, position) VALUES (?, ?, ?, ?, ?, ?)`).run(crypto.randomUUID(), lead.business_id, lead.id, slot.start, slot.label, index + 1);
  });
  attemptSend(db, config, lead, {
    templateName: "slot_offer",
    questionText: "",
    kind: "template",
    idempotencyKey: `${lead.id}:slots`,
    options: slots.map((slot, index) => ({ id: `slot_${index + 1}`, title: slot.label.slice(0, 24) })),
    now,
    providers,
    automated: true,
  });
}

function handoff(db: Database.Database, config: Config, lead: Lead, reason: string, now: Date, providers: ProviderSet) {
  db.prepare(`UPDATE outreach_leads SET human_active = 1, stage = 'needs_review', outcome_reason = ?, updated_at = ? WHERE id = ?`).run(reason, now.toISOString(), lead.id);
  db.prepare(`UPDATE conversations SET ai_active = 0 WHERE lead_id = ?`).run(lead.id);
  stopEnrollments(db, lead.id, "human_takeover");
  const fields = answerRows(db, lead.id).map((row) => `${row.field}=${row.normalized || "unverified"}`).join(", ") || "No fields yet";
  db.prepare(`INSERT INTO notifications (id, business_id, title, body, created_at) VALUES (?, ?, 'Lead needs a person', ?, ?)`).run(
    crypto.randomUUID(),
    lead.business_id,
    `${lead.name} needs a person.\n${fields.slice(0, 180)}\nReason: ${reason}`,
    now.toISOString()
  );
  attemptSend(db, config, leadOf(db, lead.business_id, lead.id), {
    templateName: "handoff",
    questionText: "",
    kind: "template",
    idempotencyKey: `${lead.id}:handoff:${reason}`,
    now,
    providers,
    automated: true,
  });
  logAction(db, lead.business_id, lead.id, "lead.handoff", null, reason);
}

function applyOutcome(db: Database.Database, config: Config, lead: Lead, now: Date, providers: ProviderSet) {
  const map = Object.fromEntries(answerRows(db, lead.id).map((row) => [row.field, { normalized: row.normalized, verified: row.verified === 1 }]));
  const required = questionsOf(db, config.business_id).filter((question) => !question.optional).map((question) => question.field);
  const location = map.location?.normalized || "";
  const outcome = decideOutcome({
    answers: map,
    required,
    minBudgetPaise: config.min_budget_paise,
    ranges: ranges(config),
    locationServed: !!location && (inServiceArea(location, areas(config)) || areas(config).some((area) => area.name === location)),
    locationKnown: !!location,
  });
  if (outcome === "not_a_fit") {
    db.prepare(`UPDATE outreach_leads SET stage = 'not_a_fit', outcome_reason = 'Outside the service rules', updated_at = ? WHERE id = ?`).run(now.toISOString(), lead.id);
    stopEnrollments(db, lead.id, "not_a_fit");
    attemptSend(db, config, leadOf(db, lead.business_id, lead.id), { templateName: "not_a_fit", questionText: "", kind: "template", idempotencyKey: `${lead.id}:not-a-fit`, now, providers, automated: true });
    logAction(db, lead.business_id, lead.id, "sync.skipped", null, "No Sheets, Zoho, Notion, or Odoo connector is configured.");
  } else if (outcome === "needs_review") {
    handoff(db, config, leadOf(db, lead.business_id, lead.id), "Qualification needs a person", now, providers);
  } else if (outcome === "qualified") {
    db.prepare(`UPDATE outreach_leads SET stage = 'qualified', updated_at = ? WHERE id = ?`).run(now.toISOString(), lead.id);
    stopEnrollments(db, lead.id, "qualified");
    offerSlots(db, config, leadOf(db, lead.business_id, lead.id), now, providers);
    enroll(db, lead.business_id, lead.id, "qualified_unbooked", now);
    logAction(db, lead.business_id, lead.id, "sync.skipped", null, "No Sheets, Zoho, Notion, or Odoo connector is configured.");
  }
  return outcome;
}

function recordConsent(db: Database.Database, businessId: string, leadId: string, channel: "whatsapp" | "email", basis: string, source: string, now: Date) {
  db.prepare(`INSERT INTO consents (id, business_id, lead_id, channel, basis, source, recorded_at, withdrawn_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`).run(
    crypto.randomUUID(),
    businessId,
    leadId,
    channel,
    basis,
    source,
    now.toISOString()
  );
}

function advanceEnrollment(
  db: Database.Database,
  config: Config,
  lead: Lead,
  enrollment: { id: string; current_step: number; created_at: string; sequence_id: string; sequence_key: string },
  now: Date
) {
  const steps = db.prepare(`SELECT position, offset_days FROM sequence_steps WHERE sequence_id = ? ORDER BY position`).all(enrollment.sequence_id) as { position: number; offset_days: number }[];
  const next = steps.find((step) => step.position === enrollment.current_step + 1);
  if (!next) {
    db.prepare(`UPDATE sequence_enrollments SET status = 'completed', next_run_at = NULL, current_step = current_step + 1 WHERE id = ?`).run(enrollment.id);
    if (enrollment.sequence_key === "arrival" && ["qualifying", "new"].includes(lead.stage)) {
      db.prepare(`UPDATE outreach_leads SET stage = 'cold', updated_at = ? WHERE id = ?`).run(now.toISOString(), lead.id);
      logAction(db, lead.business_id, lead.id, "lead.cold", null, "Final follow-up completed");
    }
    return;
  }
  db.prepare(`UPDATE sequence_enrollments SET current_step = ?, next_run_at = ?, status = 'active' WHERE id = ?`).run(
    next.position,
    scheduleAt(config, new Date(enrollment.created_at), next.offset_days, lead.id).toISOString(),
    enrollment.id
  );
}

export function arriveLead(
  db: Database.Database,
  businessId: string,
  input: { name: string; phone?: string; email?: string; source: string; imported?: boolean; consents?: { channel: "whatsapp" | "email"; basis: string; source: string }[]; known?: Record<string, string> },
  now: Date,
  providers: ProviderSet
) {
  ready(db, businessId);
  const phone = input.phone ? toE164India(input.phone) : null;
  if (input.phone && !phone) return { ok: false as const, reason: "Phone is not a valid Indian mobile" };
  if (phone) {
    const duplicate = db.prepare(`SELECT id FROM outreach_leads WHERE business_id = ? AND phone = ? AND archived_at IS NULL AND stage NOT IN ('won','lost','cold','opted_out')`).get(businessId, phone) as { id: string } | undefined;
    if (duplicate) return { ok: true as const, duplicate: true, leadId: duplicate.id };
  }
  const id = crypto.randomUUID();
  const linked = phone ? (db.prepare(`SELECT id FROM leads WHERE business_id = ? AND phone LIKE ?`).get(businessId, `%${phone.slice(-10)}`) as { id: string } | undefined) : undefined;
  db.prepare(
    `INSERT INTO outreach_leads (id, business_id, lead_id, name, phone, email, source, language, stage, score, score_reasons_json, outcome_reason, human_active, manual_stage, awaiting_field, clarification_field, demo, archived_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'en', 'qualifying', 0, '[]', NULL, 0, 0, NULL, NULL, 0, NULL, ?, ?)`
  ).run(id, businessId, linked?.id ?? null, input.name, phone, input.email?.toLowerCase() ?? null, input.source, now.toISOString(), now.toISOString());
  for (const consent of input.consents ?? []) recordConsent(db, businessId, id, consent.channel, consent.basis, consent.source, now);
  const hasEmailConsent = (input.consents ?? []).some((consent) => consent.channel === "email");
  if (input.email && !hasEmailConsent) {
    recordConsent(db, businessId, id, "email", input.imported ? "Imported without a WhatsApp consent basis" : "email address supplied on the lead", input.source, now);
  }
  const config = configOf(db, businessId);
  for (const [field, value] of Object.entries(input.known ?? {})) {
    const question = questionsOf(db, businessId).find((item) => item.field === field);
    const extracted = extractAnswer({ field, text: value, options: question ? (JSON.parse(question.options_json) as AnswerOption[]) : [], ranges: ranges(config), areas: areas(config), evidenceMessageId: null });
    if (extracted.normalized_value) {
      db.prepare(`INSERT INTO qualification_answers (id, business_id, lead_id, field, value, normalized, confidence, source_message_id, verified, clarified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1, 0, ?)`).run(
        crypto.randomUUID(),
        businessId,
        id,
        field,
        extracted.value,
        extracted.normalized_value,
        extracted.confidence,
        now.toISOString()
      );
    }
  }
  const lead = leadOf(db, businessId, id);
  if (!chooseChannel(db, lead)) {
    db.prepare(`INSERT INTO tasks (id, business_id, title, detail, status, due_at, assignee_member_id, source_type, source_id, created_at) VALUES (?, ?, 'No consented channel; contact manually', ?, 'open', ?, NULL, 'outreach_lead', ?, ?)`).run(
      crypto.randomUUID(),
      businessId,
      lead.name,
      now.toISOString(),
      id,
      now.toISOString()
    );
    logAction(db, businessId, id, "lead.manual", null, "No consented channel");
    return { ok: true as const, leadId: id, channel: null };
  }
  enroll(db, businessId, id, "arrival", now);
  tickSequences(db, businessId, new Date(now.getTime() + 5 * 60 * 1000), providers);
  return { ok: true as const, leadId: id, channel: chooseChannel(db, leadOf(db, businessId, id)) };
}

export function tickSequences(db: Database.Database, businessId: string, now: Date, providers: ProviderSet) {
  ready(db, businessId);
  const config = configOf(db, businessId);
  const due = db.prepare(
    `SELECT enrollment.id, enrollment.lead_id, enrollment.current_step, enrollment.created_at, enrollment.sequence_id, sequences.key AS sequence_key, sequences.status AS sequence_status
     FROM sequence_enrollments enrollment JOIN sequences ON sequences.id = enrollment.sequence_id
     WHERE enrollment.business_id = ? AND enrollment.status = 'active' AND enrollment.next_run_at IS NOT NULL AND enrollment.next_run_at <= ?`
  ).all(businessId, now.toISOString()) as { id: string; lead_id: string; current_step: number; created_at: string; sequence_id: string; sequence_key: string; sequence_status: string }[];
  for (const enrollment of due) {
    if (enrollment.sequence_status !== "active") continue;
    const lead = leadOf(db, businessId, enrollment.lead_id);
    const lastOutbound = db.prepare(`SELECT created_at FROM outreach_messages WHERE lead_id = ? AND direction = 'outbound' ORDER BY created_at DESC LIMIT 1`).get(lead.id) as { created_at: string } | undefined;
    const replied = !!lastOutbound && !!db.prepare(`SELECT id FROM outreach_messages WHERE lead_id = ? AND direction = 'inbound' AND created_at > ?`).get(lead.id, lastOutbound.created_at);
    const reason = currentStop(db, lead, replied);
    if (reason) {
      db.prepare(`UPDATE sequence_enrollments SET status = 'stopped', stop_reason = ?, next_run_at = NULL WHERE id = ?`).run(reason, enrollment.id);
      continue;
    }
    const step = db.prepare(`SELECT template_name, position FROM sequence_steps WHERE sequence_id = ? AND position = ?`).get(enrollment.sequence_id, enrollment.current_step) as { template_name: string; position: number } | undefined;
    if (!step) {
      db.prepare(`UPDATE sequence_enrollments SET status = 'completed', next_run_at = NULL WHERE id = ?`).run(enrollment.id);
      continue;
    }
    const result = sendCurrentQuestion(db, config, lead, step.template_name, now, providers, `${enrollment.id}:${step.position}`, enrollment.id, step.position);
    if (result.status === "queued" || result.status === "scheduled") {
      db.prepare(`UPDATE sequence_enrollments SET status = 'waiting_approval', next_run_at = NULL WHERE id = ?`).run(enrollment.id);
      continue;
    }
    if (result.status === "deferred" || result.status === "blocked") continue;
    advanceEnrollment(db, config, leadOf(db, businessId, lead.id), enrollment, now);
  }
  const scheduled = db.prepare(`SELECT id, lead_id, body, channel FROM outreach_messages WHERE business_id = ? AND status = 'scheduled' AND scheduled_for IS NOT NULL AND scheduled_for <= ?`).all(businessId, now.toISOString()) as { id: string; lead_id: string; body: string; channel: string }[];
  for (const message of scheduled) {
    const lead = leadOf(db, businessId, message.lead_id);
    if (currentStop(db, lead, false)) {
      db.prepare(`UPDATE outreach_messages SET status = 'rejected', error = 'Stopped before send' WHERE id = ?`).run(message.id);
      continue;
    }
    const provider = message.channel === "whatsapp" ? providers.whatsapp : providers.email;
    const result = provider.send({ to: message.channel === "whatsapp" ? lead.phone || "" : lead.email || "", body: message.body, language: lead.language, category: "utility" });
    db.prepare(`UPDATE outreach_messages SET status = ?, provider_message_id = ?, sent_at = ?, error = ? WHERE id = ?`).run(
      result.status,
      result.providerMessageId ?? null,
      result.status === "sent" ? now.toISOString() : null,
      result.status === "sent" ? null : result.reason,
      message.id
    );
  }
  const summaryKey = `${istParts(now).year}-${istParts(now).month + 1}-${istParts(now).day}`;
  if (!db.prepare(`SELECT id FROM outreach_actions WHERE business_id = ? AND action = 'daily.summary' AND detail = ?`).get(businessId, summaryKey)) {
    const parts = istParts(now);
    const start = fromIst(parts.year, parts.month, parts.day, 0, 0).toISOString();
    const created = (db.prepare(`SELECT COUNT(*) AS total FROM outreach_leads WHERE business_id = ? AND created_at >= ?`).get(businessId, start) as { total: number }).total;
    const qualified = (db.prepare(`SELECT COUNT(*) AS total FROM outreach_leads WHERE business_id = ? AND stage IN ('qualified','site_visit_scheduled')`).get(businessId) as { total: number }).total;
    const visits = (db.prepare(`SELECT COUNT(*) AS total FROM site_visits WHERE business_id = ? AND status = 'scheduled'`).get(businessId) as { total: number }).total;
    const review = (db.prepare(`SELECT COUNT(*) AS total FROM outreach_leads WHERE business_id = ? AND stage = 'needs_review'`).get(businessId) as { total: number }).total;
    db.prepare(`INSERT INTO notifications (id, business_id, title, body, created_at) VALUES (?, ?, 'Daily lead summary', ?, ?)`).run(
      crypto.randomUUID(),
      businessId,
      `${created} new leads today, ${qualified} qualified, ${visits} visits booked, ${review} need you.`,
      now.toISOString()
    );
    logAction(db, businessId, null, "daily.summary", null, summaryKey);
  }
}

function saveAnswer(db: Database.Database, businessId: string, leadId: string, field: string, extracted: { value: string; normalized_value: string; confidence: number }, messageId: string, verified: number, clarified: number, now: Date) {
  db.prepare(
    `INSERT INTO qualification_answers (id, business_id, lead_id, field, value, normalized, confidence, source_message_id, verified, clarified, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(lead_id, field) DO UPDATE SET value = excluded.value, normalized = excluded.normalized, confidence = excluded.confidence, source_message_id = excluded.source_message_id, verified = excluded.verified, clarified = excluded.clarified`
  ).run(crypto.randomUUID(), businessId, leadId, field, extracted.value, extracted.normalized_value, extracted.confidence, messageId, verified, clarified, now.toISOString());
}

function bookSlot(db: Database.Database, config: Config, lead: Lead, slot: { start_at: string; label: string }, now: Date, providers: ProviderSet) {
  db.prepare(`INSERT INTO site_visits (id, business_id, lead_id, designer_name, start_at, status, address, created_at) VALUES (?, ?, ?, 'Rohan', ?, 'scheduled', ?, ?)`).run(
    crypto.randomUUID(),
    lead.business_id,
    lead.id,
    slot.start_at,
    config.studio_address,
    now.toISOString()
  );
  db.prepare(`DELETE FROM offered_slots WHERE lead_id = ?`).run(lead.id);
  db.prepare(`UPDATE outreach_leads SET stage = 'site_visit_scheduled', updated_at = ? WHERE id = ?`).run(now.toISOString(), lead.id);
  stopEnrollments(db, lead.id, "booked");
  db.prepare(`INSERT INTO notifications (id, business_id, title, body, created_at) VALUES (?, ?, 'Site visit booked', ?, ?)`).run(crypto.randomUUID(), lead.business_id, `${lead.name} · ${slot.label} · Rohan`, now.toISOString());
  attemptSend(db, config, leadOf(db, lead.business_id, lead.id), { templateName: "booking_confirmed", questionText: "", kind: "template", idempotencyKey: `${lead.id}:booked`, now, providers, automated: true });
  for (const hours of [24, 2]) {
    const at = new Date(new Date(slot.start_at).getTime() - hours * 60 * 60 * 1000);
    if (at.getTime() <= now.getTime()) continue;
    const row = messageBase(lead, ensureConversation(db, lead.business_id, lead.id, chooseChannel(db, lead) || "whatsapp").id, chooseChannel(db, lead) || "whatsapp", "", "scheduled", null, "system", null, {
      templateName: "visit_reminder",
      questionText: "",
      kind: "template",
      idempotencyKey: `${lead.id}:reminder:${hours}`,
      now: at,
      providers,
      automated: true,
    });
    const rendered = render(db, config, leadOf(db, lead.business_id, lead.id), "visit_reminder", "");
    row.body = rendered.body;
    row.template_id = rendered.templateId;
    row.scheduled_for = at.toISOString();
    row.created_at = now.toISOString();
    insertMessage(db, row);
  }
  logAction(db, lead.business_id, lead.id, "visit.booked", null, slot.label);
}

export function receiveInbound(
  db: Database.Database,
  businessId: string,
  input: { leadId?: string; phone?: string; email?: string; text: string; providerMessageId?: string; origin: "webhook" | "operator" | "demo" },
  now: Date,
  providers: ProviderSet
) {
  ready(db, businessId);
  const phone = input.phone ? toE164India(input.phone) : null;
  const lead = input.leadId
    ? leadOf(db, businessId, input.leadId)
    : (db.prepare(`SELECT * FROM outreach_leads WHERE business_id = ? AND (phone = ? OR lower(email) = ?) ORDER BY created_at DESC LIMIT 1`).get(businessId, phone, input.email?.toLowerCase() ?? "") as Lead | undefined);
  if (!lead) return { ok: false as const, reason: "Lead not found" };
  const channel = chooseChannel(db, lead) || (lead.phone ? "whatsapp" : "email");
  const conversation = ensureConversation(db, businessId, lead.id, channel);
  const messageId = crypto.randomUUID();
  const inboundKey = input.providerMessageId ? `in:${input.providerMessageId}` : `in:${messageId}`;
  if (input.providerMessageId && db.prepare(`SELECT id FROM outreach_messages WHERE business_id = ? AND idempotency_key = ?`).get(businessId, inboundKey)) {
    return { ok: true as const, leadId: lead.id, duplicate: true };
  }
  db.prepare(
    `INSERT INTO outreach_messages (id, business_id, conversation_id, lead_id, direction, channel, provider_message_id, template_id, body, media_json, interaction_json, status, error, origin, policy_id, approved_by, cost_category, enrollment_id, step_index, idempotency_key, scheduled_for, sent_at, created_at)
     VALUES (?, ?, ?, ?, 'inbound', ?, ?, NULL, ?, '[]', '{}', 'received', NULL, ?, NULL, NULL, NULL, NULL, NULL, ?, NULL, NULL, ?)`
  ).run(messageId, businessId, conversation.id, lead.id, channel, input.providerMessageId ?? null, input.text, input.origin, inboundKey, now.toISOString());
  if (input.origin === "webhook") db.prepare(`UPDATE conversations SET window_expires_at = ? WHERE id = ?`).run(windowExpiry(now.toISOString()), conversation.id);
  const language = languageOf(input.text);
  db.prepare(`UPDATE outreach_leads SET language = ?, updated_at = ? WHERE id = ?`).run(language, now.toISOString(), lead.id);
  if (isOptOut(input.text)) {
    const config = configOf(db, businessId);
    attemptSend(db, config, leadOf(db, businessId, lead.id), { templateName: "opt_out_confirm", questionText: "", kind: "template", idempotencyKey: `${lead.id}:opt-out`, now, providers, automated: true });
    db.prepare(`UPDATE consents SET withdrawn_at = ? WHERE lead_id = ? AND withdrawn_at IS NULL`).run(now.toISOString(), lead.id);
    const address = channel === "whatsapp" ? lead.phone : lead.email;
    if (address) db.prepare(`INSERT OR IGNORE INTO suppression_list (id, business_id, channel, address, reason, created_at) VALUES (?, ?, ?, ?, 'opt_out', ?)`).run(crypto.randomUUID(), businessId, channel, address, now.toISOString());
    db.prepare(`UPDATE outreach_leads SET stage = 'opted_out', updated_at = ? WHERE id = ?`).run(now.toISOString(), lead.id);
    stopEnrollments(db, lead.id, "opted_out");
    logAction(db, businessId, lead.id, "lead.opt_out", null, "Opt-out detected");
    return { ok: true as const, leadId: lead.id, optedOut: true };
  }
  if (lead.human_active) {
    db.prepare(`INSERT INTO notifications (id, business_id, title, body, created_at) VALUES (?, ?, 'Reply while you have the conversation', ?, ?)`).run(crypto.randomUUID(), businessId, `${lead.name} replied during takeover.`, now.toISOString());
    return { ok: true as const, leadId: lead.id, paused: true };
  }
  const config = configOf(db, businessId);
  const current = leadOf(db, businessId, lead.id);
  if (mentionsSensitiveData(input.text) || needsHumanTone(input.text) || (asksForPrice(input.text) && current.awaiting_field !== "budget_range") || isPromptInjection(input.text)) {
    const reason = mentionsSensitiveData(input.text) ? "Sensitive information" : needsHumanTone(input.text) ? "Complaint or anger" : asksForPrice(input.text) ? "Pricing question" : "Message asked to change the assistant rules";
    handoff(db, config, current, reason, now, providers);
    return { ok: true as const, leadId: lead.id, handoff: true };
  }
  const slots = db.prepare(`SELECT position, start_at, label FROM offered_slots WHERE lead_id = ? ORDER BY position`).all(lead.id) as { position: number; start_at: string; label: string }[];
  if (slots.length && current.stage === "qualified") {
    const choice = input.text.match(/\d+/)?.[0];
    const slot = slots.find((item) => String(item.position) === choice);
    if (slot) {
      bookSlot(db, config, current, slot, now, providers);
      return { ok: true as const, leadId: lead.id, booked: true };
    }
  }
  const question = questionsOf(db, businessId).find((item) => item.field === (current.clarification_field || current.awaiting_field)) || nextQuestion(db, businessId, lead.id);
  if (!question) return { ok: true as const, leadId: lead.id };
  const extracted = extractAnswer({
    field: question.field as QuestionField,
    text: input.text,
    options: JSON.parse(question.options_json) as AnswerOption[],
    ranges: ranges(config),
    areas: areas(config),
    evidenceMessageId: messageId,
  });
  const low = extracted.confidence < config.confidence_threshold || !extracted.normalized_value;
  const prior = db.prepare(`SELECT clarified FROM qualification_answers WHERE lead_id = ? AND field = ?`).get(lead.id, question.field) as { clarified: number } | undefined;
  if (low && !prior?.clarified) {
    saveAnswer(db, businessId, lead.id, question.field, extracted, messageId, 0, 1, now);
    db.prepare(`UPDATE outreach_leads SET clarification_field = ? WHERE id = ?`).run(question.field, lead.id);
    stopEnrollments(db, lead.id, "replied");
    attemptSend(db, config, leadOf(db, businessId, lead.id), {
      templateName: "clarify",
      questionText: promptFor(question, language),
      kind: "template",
      idempotencyKey: `${lead.id}:clarify:${question.field}`,
      options: JSON.parse(question.options_json) as AnswerOption[],
      now,
      providers,
      automated: true,
    });
    return { ok: true as const, leadId: lead.id, clarify: true };
  }
  saveAnswer(db, businessId, lead.id, question.field, extracted, messageId, low ? 0 : 1, prior?.clarified ? 1 : 0, now);
  db.prepare(`UPDATE outreach_leads SET clarification_field = NULL WHERE id = ?`).run(lead.id);
  refreshScore(db, config, leadOf(db, businessId, lead.id));
  stopEnrollments(db, lead.id, "replied");
  const outcome = applyOutcome(db, config, leadOf(db, businessId, lead.id), now, providers);
  if (outcome === "continue") {
    sendCurrentQuestion(db, config, leadOf(db, businessId, lead.id), "intro", now, providers, `${lead.id}:q:${question.field}:next`);
    enroll(db, businessId, lead.id, "partial", now);
  }
  return { ok: true as const, leadId: lead.id, outcome };
}

export function approveMessage(db: Database.Database, businessId: string, messageId: string, actor: string, now: Date, providers: ProviderSet) {
  const message = db.prepare(`SELECT id, lead_id, status, body, channel, enrollment_id FROM outreach_messages WHERE id = ? AND business_id = ?`).get(messageId, businessId) as
    | { id: string; lead_id: string; status: string; body: string; channel: string; enrollment_id: string | null }
    | undefined;
  if (!message || message.status !== "queued") return { ok: false as const, reason: "Message is not waiting for approval" };
  const lead = leadOf(db, businessId, message.lead_id);
  const provider = message.channel === "whatsapp" ? providers.whatsapp : providers.email;
  const result = provider.send({ to: message.channel === "whatsapp" ? lead.phone || "" : lead.email || "", body: message.body, language: lead.language, category: "utility" });
  db.prepare(`UPDATE outreach_messages SET status = ?, provider_message_id = ?, approved_by = ?, sent_at = ?, error = ? WHERE id = ?`).run(
    result.status,
    result.providerMessageId ?? null,
    actor,
    result.status === "sent" ? now.toISOString() : null,
    result.status === "sent" ? null : result.reason,
    message.id
  );
  if (message.enrollment_id) {
    const enrollment = db.prepare(
      `SELECT sequence_enrollments.id, current_step, sequence_enrollments.created_at, sequence_id, sequences.key AS sequence_key
       FROM sequence_enrollments JOIN sequences ON sequences.id = sequence_enrollments.sequence_id WHERE sequence_enrollments.id = ?`
    ).get(message.enrollment_id) as { id: string; current_step: number; created_at: string; sequence_id: string; sequence_key: string };
    advanceEnrollment(db, configOf(db, businessId), lead, enrollment, now);
  }
  logAction(db, businessId, lead.id, "message.approved", null, result.status);
  return { ok: true as const, status: result.status };
}

export function rejectMessage(db: Database.Database, businessId: string, messageId: string) {
  const message = db.prepare(`SELECT lead_id, enrollment_id FROM outreach_messages WHERE id = ? AND business_id = ? AND status = 'queued'`).get(messageId, businessId) as { lead_id: string; enrollment_id: string | null } | undefined;
  if (!message) return { ok: false as const };
  db.prepare(`UPDATE outreach_messages SET status = 'rejected', error = 'Rejected in the approval centre' WHERE id = ?`).run(messageId);
  if (message.enrollment_id) db.prepare(`UPDATE sequence_enrollments SET status = 'stopped', stop_reason = 'rejected' WHERE id = ?`).run(message.enrollment_id);
  logAction(db, businessId, message.lead_id, "message.rejected", null, "Rejected");
  return { ok: true as const };
}

export function takeOver(db: Database.Database, businessId: string, leadId: string, now: Date) {
  const lead = leadOf(db, businessId, leadId);
  db.prepare(`UPDATE outreach_leads SET human_active = 1, updated_at = ? WHERE id = ?`).run(now.toISOString(), leadId);
  db.prepare(`UPDATE conversations SET ai_active = 0, human_owner_id = 'salesperson' WHERE lead_id = ?`).run(leadId);
  stopEnrollments(db, leadId, "human_takeover");
  logAction(db, businessId, leadId, "conversation.takeover", null, "Salesperson took over");
  return { ok: true as const, lead };
}

export function handBack(db: Database.Database, businessId: string, leadId: string, now: Date, providers: ProviderSet) {
  db.prepare(`UPDATE outreach_leads SET human_active = 0, updated_at = ? WHERE id = ?`).run(now.toISOString(), leadId);
  db.prepare(`UPDATE conversations SET ai_active = 1, human_owner_id = NULL WHERE lead_id = ?`).run(leadId);
  sendCurrentQuestion(db, configOf(db, businessId), leadOf(db, businessId, leadId), "intro", now, providers, `${leadId}:handback:${now.toISOString()}`);
  logAction(db, businessId, leadId, "conversation.handback", null, "Handed back to the assistant");
  return { ok: true as const };
}

export function saveOperatorReply(db: Database.Database, businessId: string, leadId: string, body: string, now: Date) {
  const lead = leadOf(db, businessId, leadId);
  const channel = chooseChannel(db, lead) || "whatsapp";
  const conversation = ensureConversation(db, businessId, leadId, channel);
  takeOver(db, businessId, leadId, now);
  return insertMessage(
    db,
    messageBase(lead, conversation.id, channel, body, "awaiting_provider", "Saved in Aayaam. The provider did not send it.", "operator", null, {
      templateName: "operator",
      questionText: "",
      kind: "freeform",
      idempotencyKey: `operator:${crypto.randomUUID()}`,
      now,
      providers: { whatsapp: {} as MessagingProvider, email: {} as MessagingProvider },
      automated: false,
    })
  );
}

export function setManualStage(db: Database.Database, businessId: string, leadId: string, stage: string, now: Date) {
  leadOf(db, businessId, leadId);
  db.prepare(`UPDATE outreach_leads SET stage = ?, manual_stage = 1, updated_at = ? WHERE id = ?`).run(stage, now.toISOString(), leadId);
  stopEnrollments(db, leadId, "stage_changed");
  logAction(db, businessId, leadId, "lead.stage", null, stage);
}

export function pauseSequences(db: Database.Database, businessId: string, paused: boolean) {
  ready(db, businessId);
  db.prepare(`UPDATE sequences SET status = ? WHERE business_id = ?`).run(paused ? "paused" : "active", businessId);
  logAction(db, businessId, null, paused ? "sequences.paused" : "sequences.resumed", null, "Whole business");
}

export function saveQualificationSettings(
  db: Database.Database,
  businessId: string,
  input: { autonomy?: Config["autonomy"]; assistantName?: string; minBudgetPaise?: number; quietStart?: string; quietEnd?: string; threshold?: number; address?: string; hours?: string; portfolio?: string; holidays?: string[]; dailyCap?: number; weeklyCap?: number }
) {
  const current = configOf(db, businessId);
  db.prepare(
    `UPDATE qualification_configs SET autonomy = ?, assistant_name = ?, min_budget_paise = ?, quiet_start = ?, quiet_end = ?, confidence_threshold = ?, studio_address = ?, working_hours = ?, portfolio_url = ?, holidays_json = ?, daily_cap = ?, weekly_cap = ?, updated_at = ? WHERE business_id = ?`
  ).run(
    input.autonomy || current.autonomy,
    input.assistantName || current.assistant_name,
    input.minBudgetPaise ?? current.min_budget_paise,
    input.quietStart || current.quiet_start,
    input.quietEnd || current.quiet_end,
    input.threshold ?? current.confidence_threshold,
    input.address ?? current.studio_address,
    input.hours ?? current.working_hours,
    input.portfolio ?? current.portfolio_url,
    input.holidays ? JSON.stringify(input.holidays) : current.holidays_json,
    input.dailyCap ?? current.daily_cap,
    input.weeklyCap ?? current.weekly_cap,
    new Date().toISOString(),
    businessId
  );
}

export function simulateSequence(db: Database.Database, businessId: string, leadId: string, now: Date) {
  const config = configOf(db, businessId);
  const lead = leadOf(db, businessId, leadId);
  const channel = chooseChannel(db, lead);
  const question = rememberQuestion(db, config, lead);
  return sequenceBlueprints
    .find((item) => item.key === "arrival")!
    .steps.map((step) => {
      const at = scheduleAt(config, now, step.offsetDays, lead.id);
      const rendered = render(db, config, lead, step.template, question.text);
      return { at: at.toISOString(), channel: channel || "none", template: step.template, body: rendered.body, status: "simulation" as const };
    })
    .filter((step) => new Date(step.at).getTime() <= now.getTime() + 14 * 24 * 60 * 60 * 1000);
}

export function placeFreeform(db: Database.Database, businessId: string, leadId: string, body: string, now: Date, providers: ProviderSet) {
  return attemptSend(db, configOf(db, businessId), leadOf(db, businessId, leadId), {
    templateName: "__freeform__",
    questionText: body,
    kind: "freeform",
    idempotencyKey: `free:${crypto.randomUUID()}`,
    now,
    providers,
    automated: true,
  });
}

export function recordCallInterest(db: Database.Database, businessId: string, now: Date) {
  ready(db, businessId);
  db.prepare(`INSERT INTO feature_interest (id, business_id, feature, created_at) VALUES (?, ?, 'calling', ?)`).run(crypto.randomUUID(), businessId, now.toISOString());
  logAction(db, businessId, null, "calling.interest", null, "Notify me");
}

export function unsubscribeLead(db: Database.Database, businessId: string, leadId: string, token: string, now: Date) {
  if (token !== unsubscribeToken(businessId, leadId)) return { ok: false as const };
  const lead = leadOf(db, businessId, leadId);
  db.prepare(`UPDATE consents SET withdrawn_at = ? WHERE lead_id = ? AND withdrawn_at IS NULL`).run(now.toISOString(), leadId);
  if (lead.email) db.prepare(`INSERT OR IGNORE INTO suppression_list (id, business_id, channel, address, reason, created_at) VALUES (?, ?, 'email', ?, 'unsubscribe', ?)`).run(crypto.randomUUID(), businessId, lead.email, now.toISOString());
  db.prepare(`UPDATE outreach_leads SET stage = 'opted_out', updated_at = ? WHERE id = ?`).run(now.toISOString(), leadId);
  stopEnrollments(db, leadId, "opted_out");
  return { ok: true as const };
}

export function applyProviderStatus(db: Database.Database, businessId: string, providerMessageId: string, status: string) {
  const row = db.prepare(`SELECT id, status FROM outreach_messages WHERE business_id = ? AND provider_message_id = ?`).get(businessId, providerMessageId) as { id: string; status: string } | undefined;
  if (!row) return { ok: false as const };
  const next = nextDeliveryStatus(row.status, status);
  db.prepare(`UPDATE outreach_messages SET status = ? WHERE id = ?`).run(next, row.id);
  return { ok: true as const, status: next };
}

export function seedDemoLead(db: Database.Database, businessId: string) {
  if ((db.prepare(`SELECT COUNT(*) AS total FROM outreach_leads WHERE business_id = ?`).get(businessId) as { total: number }).total > 0) return;
  ready(db, businessId);
  const now = new Date();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO outreach_leads (id, business_id, lead_id, name, phone, email, source, language, stage, score, score_reasons_json, outcome_reason, human_active, manual_stage, awaiting_field, clarification_field, demo, archived_at, created_at, updated_at)
     VALUES (?, ?, NULL, 'Jayanagar flat', '+919845300001', 'meera@example.com', 'Google', 'en', 'qualifying', 0, '[]', NULL, 0, 0, 'project_scope', NULL, 1, NULL, ?, ?)`
  ).run(id, businessId, now.toISOString(), now.toISOString());
  recordConsent(db, businessId, id, "whatsapp", "owner-confirmed", "demo", now);
  recordConsent(db, businessId, id, "email", "owner-confirmed", "demo", now);
  const conversation = ensureConversation(db, businessId, id, "whatsapp");
  const lead = leadOf(db, businessId, id);
  db.prepare(
    `INSERT INTO outreach_messages (id, business_id, conversation_id, lead_id, direction, channel, provider_message_id, template_id, body, media_json, interaction_json, status, error, origin, policy_id, approved_by, cost_category, enrollment_id, step_index, idempotency_key, scheduled_for, sent_at, created_at)
     VALUES (?, ?, ?, ?, 'inbound', 'whatsapp', NULL, NULL, 'We need a full home in Jayanagar.', '[]', '{}', 'received', NULL, 'demo', NULL, NULL, NULL, NULL, NULL, ?, NULL, NULL, ?)`
  ).run(crypto.randomUUID(), businessId, conversation.id, id, `demo-in:${id}`, now.toISOString());
  const rendered = render(db, configOf(db, businessId), lead, "intro", "What would you like us to design?");
  insertMessage(db, {
    ...messageBase(lead, conversation.id, "whatsapp", rendered.body, "queued", null, "system", `${businessId}:assisted`, {
      templateName: "intro",
      questionText: "",
      kind: "template",
      idempotencyKey: `demo-out:${id}`,
      now,
      providers: { whatsapp: {} as MessagingProvider, email: {} as MessagingProvider },
      automated: false,
    }),
    template_id: rendered.templateId,
  });
}

export function outreachSnapshot(db: Database.Database, businessId: string, providers: ProviderSet) {
  seedDemoLead(db, businessId);
  const config = configOf(db, businessId);
  const leads = db.prepare(`SELECT id, name, phone, email, source, language, stage, score, score_reasons_json, outcome_reason, human_active, awaiting_field, demo, created_at FROM outreach_leads WHERE business_id = ? ORDER BY updated_at DESC`).all(businessId) as { id: string; stage: string; source: string }[];
  const messages = db.prepare(`SELECT id, lead_id, direction, channel, body, status, error, origin, policy_id, cost_category, created_at, sent_at FROM outreach_messages WHERE business_id = ? ORDER BY created_at`).all(businessId);
  const answers = db.prepare(`SELECT lead_id, field, value, normalized, confidence, source_message_id, verified FROM qualification_answers WHERE business_id = ?`).all(businessId);
  const visits = db.prepare(`SELECT id, lead_id, designer_name, start_at, status, address FROM site_visits WHERE business_id = ?`).all(businessId) as { lead_id: string }[];
  const ids = (stage: string) => leads.filter((lead) => lead.stage === stage).map((lead) => lead.id);
  return {
    config: {
      autonomy: config.autonomy,
      assistantName: config.assistant_name,
      minBudgetPaise: config.min_budget_paise,
      quietStart: config.quiet_start,
      quietEnd: config.quiet_end,
      threshold: config.confidence_threshold,
      address: config.studio_address,
      hours: config.working_hours,
      portfolio: config.portfolio_url,
      holidays: JSON.parse(config.holidays_json) as string[],
      dailyCap: config.daily_cap,
      weeklyCap: config.weekly_cap,
      areas: areas(config).map((area) => area.name),
    },
    channels: { whatsapp: providers.whatsapp.health(), email: providers.email.health(), call: { state: "disabled" as const, detail: "Coming soon" } },
    leads,
    messages,
    answers,
    visits,
    sequences: db.prepare(`SELECT id, key, name, status FROM sequences WHERE business_id = ?`).all(businessId),
    steps: db.prepare(`SELECT sequence_id, position, offset_days, template_name, category FROM sequence_steps WHERE business_id = ? ORDER BY position`).all(businessId),
    templates: db.prepare(`SELECT id, name, channel, category, language, body, provider_status FROM message_templates WHERE business_id = ? AND language = 'en' ORDER BY name`).all(businessId),
    questions: questionsOf(db, businessId).map((question) => ({ field: question.field, position: question.position, prompt: question.prompt_en, optional: question.optional === 1 })),
    callInterest: (db.prepare(`SELECT COUNT(*) AS total FROM feature_interest WHERE business_id = ? AND feature = 'calling'`).get(businessId) as { total: number }).total,
    window: db.prepare(`SELECT lead_id, window_expires_at, ai_active FROM conversations WHERE business_id = ?`).all(businessId),
    analytics: {
      qualified: { leadIds: [...ids("qualified"), ...ids("site_visit_scheduled")] },
      booked: { leadIds: visits.map((visit) => visit.lead_id) },
      cold: { leadIds: ids("cold") },
      needsReview: { leadIds: ids("needs_review") },
      notAFit: { leadIds: ids("not_a_fit") },
      bySource: Object.entries(
        leads.reduce<Record<string, string[]>>((grouped, lead) => {
          grouped[lead.source] = grouped[lead.source] || [];
          grouped[lead.source].push(lead.id);
          return grouped;
        }, {})
      ).map(([source, leadIds]) => ({ source, leadIds })),
    },
  };
}
