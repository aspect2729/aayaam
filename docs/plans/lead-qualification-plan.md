# Lead qualification plan

`docs/Aayaam_Master_Project_Context.md` is not in this repository. This plan follows the pasted lead-qualification prompt, the earlier product rules, and the code that is already here.

The existing purple screens stay. Qualification is an added interior-design workspace, not a replacement for the pipeline.

## What already exists and will be reused

- The sales pipeline, lead sheet, and “Open in WhatsApp” handoff stay. That handoff remains “Opened in WhatsApp, not confirmed sent”. Automated sequences do not run through `wa.me`.
- `scoreLead` in `lib/lead-score.ts` remains the only score. The qualification flow fills fields and then calls that function. It does not accept a model score.
- `toE164India` validates Indian mobiles.
- Local SQLite is the running database. New tables are created with `CREATE TABLE IF NOT EXISTS` so the existing ledger schema is unchanged.
- The reminder `messages` table stays for payment drafts. Qualification messages use `outreach_messages` so the two flows do not share a status check.
- Jobs stay in-process. Inngest and Trigger.dev are not added. A sequence is due when `sequences.tick` runs, including when the qualification screen loads.
- There is no `MessagingProvider` in the repo yet. This work adds one interface and two adapters. Neither adapter calls Meta or an email API.

## Product choices

- Interior workspaces only for now. Gym and handicraft businesses do not see the screen. The engine is business-scoped so another service type can use the same tables later.
- Channels are WhatsApp and email. `call` exists on the channel list as disabled, with a Coming soon card and a “Notify me” interest row. No telephony, IVR, or voice AI.
- Default autonomy is assisted: fixed templates may be attempted automatically; nothing is stored as `sent` unless the provider returns an id. With no live provider, the status is `awaiting_provider`.
- Draft-only queues every outgoing message. Autonomous mode may attempt a fixed in-window reply, still only through the provider adapter.
- Imported leads with no recorded consent basis are email-only. If there is no email either, the salesperson gets a task: “No consented channel; contact manually.”
- Quiet hours default to 9 pm–9 am IST. Messages scheduled then move to the next allowed time. Stop conditions are checked again at send time.
- Opt-out in English, Hindi, or Kannada stops every sequence. One confirmation is attempted and is not marked sent without a provider id.
- The extractor is deterministic and validated with Zod. No model is called. Low confidence asks one clarifying question, then marks the field unverified.
- The agent text is only the configured questions, verified studio facts, booking templates, and the not-a-fit close. It does not quote prices, discounts, or timelines.
- Sheets, Zoho, Notion, and Odoo are not connected. A field change records `sync.skipped` instead of inventing a connector call.
- Google Calendar is not connected. Site visits are stored locally and shown on the Operations page as an extra card.
- Postgres policies are written in `db/postgres/003_outreach_rls.sql` and are not applied. SQLite still filters by `business_id` in the server.

## Screens

`/outreach` uses the current cards, chips, buttons, and type. It holds the inbox, qualification panel, approval queue, sequence list and simulator, templates, qualification settings, channel health, analytics with lead ids, and the calling card. The sales page keeps its layout and gains one link for interior studios.

## Honest statuses

`queued`, `awaiting_provider`, `sent`, `delivered`, `read`, `failed`, `received`, `rejected`. Demo rows and replies typed into Aayaam are labeled as such. A webhook is the only path that stores a provider inbound message as received from WhatsApp or email.
