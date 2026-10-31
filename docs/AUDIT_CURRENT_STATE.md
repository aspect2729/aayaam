# Audit of the open loops

Reviewed against the code in this repository on 31 Oct 2026. The deployed site at `https://aayaam-hcvs.vercel.app/` was described in the execution plan. The designed screens still read `lib/mock-data.ts`. The local SQLite database and the Supabase activity tables are a second store.

`docs/Aayaam_Master_Project_Context.md` in this repo is a short stand-in. The original master file was not supplied. The data-connectors prompt was not supplied. See `docs/prompts/README.md`.

## A. Foundation

| # | Item | Status | Where |
| --- | --- | --- | --- |
| 1 | Authentication and registration | Partial | Email and password: `app/login/page.tsx`, `app/register/page.tsx`, `server/auth.ts`. Session name: `app/api/auth/session/route.ts`, `lib/session-context.tsx`. Unsigned use is labeled Demo workspace. Phone OTP and Google sign-in are not built. Blocked: owner action 1. |
| 2 | Real database | Partial | Local SQLite: `server/db.ts`. Supabase activity tables: `server/supabase.ts`, `db/supabase/001_activity.sql`. Health text: `app/api/health/route.ts`, Settings. Full migrations, RLS on every table, and one database for every screen are missing. Blocked: owner actions 1 and 2. |
| 3 | Organizations, businesses, members, roles | Partial | Registration creates an org, business, branch, and owner in `server/auth.ts`. Roles exist in `server/permissions.ts`. Invite delivery is not sent. Team invite UI is missing. |
| 4 | Demo mode vs real mode | Partial | Unsigned screens say Demo workspace. Signed-in accounts use SQLite. The purple screens still show the three demo profiles from `lib/mock-data.ts`, so a signed-in user can still open demo figures. |
| 5 | Remove hard-coded screen data | Missing | Overview, sales, customers, marketing, commerce, finance, operations, and agents still render `lib/mock-data.ts`. Outreach for interior studios reads SQLite. |

## B. Onboarding

| # | Item | Status | Where |
| --- | --- | --- | --- |
| 6 | Business details step | Missing | `app/onboarding/page.tsx` is still type, tools, and ready. |
| 7 | Type-specific questions | Missing | Same page. |
| 8 | Answers create records | Missing | Registration creates the business row only. |

## C. Business-type isolation

| # | Item | Status | Where |
| --- | --- | --- | --- |
| 9 | Gym showing other businesses’ rows | Done for the demo profiles | Gym events, agents, and approvals in `lib/mock-data.ts`. Covered by `tests/workspace-isolation.test.ts`. |
| 10 | Gym inventory card | Done | Overview uses Renewals due for a gym and Site visits for an interior studio. `app/(app)/page.tsx`. |
| 11 | Integrations filtered by type | Done | Shopify, WooCommerce, and Shiprocket are hidden unless the business is a handicraft store or “Show all integrations” is on. `app/(app)/integrations/page.tsx`. |
| 12 | POS wording | Done in the demo copy | Gym rows say add-on and Recorded. Cash KPIs say Recorded cash. Receipt rule: `docs/Aayaam_Master_Project_Context.md`. |

## D. Navigation and UI

| # | Item | Status | Where |
| --- | --- | --- | --- |
| 13 | Raw settings path in the top bar | Done | Account menu labels: Settings, System status, Plans, Sign in. `components/shell/topbar.tsx`. |
| 14 | Reports and Analytics labels | Done | Sidebar and top pills say Agent activity and Finance. `components/shell/nav.ts`. |
| 15 | Business Brain page | Partial | `/brain` lists this business’s demo insights and an approval queue that records a decision and does not send anything. `app/(app)/brain/page.tsx`. Numbers are still demo. |
| 16 | Gated breadcrumb | Done | The heading uses the path name. `lib/page-title.ts`. |
| 17 | Enquiries helper text | Done | `app/(app)/sales/page.tsx`. |
| 18 | Upgrade Now | Done | Opens `/plans`. Contact us does not take payment. `app/(app)/plans/page.tsx`. |
| 19 | Asia/Kolkata date | Done | Sidebar, overview schedule, and Operations use `Asia/Kolkata`. `lib/ist.ts`, `app/(app)/operations/page.tsx`. |

## E–M. Later milestones

| # | Item | Status | Where |
| --- | --- | --- | --- |
| 20 | Gym members, plans, attendance, dues | Missing | Customers page is demo cards. |
| 21 | Gym WhatsApp reminders | Partial | Qualification engine can draft and hold messages for an interior studio. Gym reminder rules are demo toggles. No provider send. Blocked: owner actions 8–11. |
| 22 | Membership receipt PDF | Missing | E-commerce invoice PDF exists for an order. A service receipt does not. |
| 23 | Operations templates as real rules | Partial | Toggles are local to the page. They are not a scheduler. |
| 24 | Interior pipeline depth | Partial | Pipeline UI exists on demo leads. Quotations, merge, and CSV are not a database workflow. |
| 25 | Qualification | Partial | `/outreach` for interior workspaces. Calling stays Coming soon. Live WhatsApp and email are awaiting setup. |
| 26 | Lead recovery banner | Partial | The count is `recoveryCount` on the demo profile, and the button filters never-contacted demo leads. |
| 27 | Handicraft commerce | Partial | Commerce UI is demo. Order ingest and invoices exist on SQLite and are not what the purple screen reads. |
| 28 | Google Business Profile | Partial | Card says API approval required. No OAuth handshake. Blocked: owner actions 4–6. |
| 29 | Post scheduler | Partial | Marketing drafts are demo. Nothing is published. |
| 30 | Reviews and rankings | Partial | Demo figures, labeled Demo data. |
| 31 | Sheets, Zoho, Notion, Odoo | Missing | Cards say Awaiting setup. The connectors prompt was not in the repo. |
| 32 | WhatsApp adapter | Partial | `server/outreach/providers.ts` does not call Meta. Webhook verify exists. Blocked: owner actions 8–11. |
| 33 | Email provider | Partial | Email card and webhook verifier exist. No mail is sent. Blocked: owner action 12. |
| 34 | Rule insights with drill-down | Partial | `/brain` drills into demo notes. SQLite `runBrain` cites ledger rows and is not the screen. |
| 35 | Approval buttons | Partial | They record an in-app decision and say no outside system changed. |
| 36 | Agent runs from the database | Missing | `/agents` reads demo `business.agents`. |
| 37 | Ask Business Brain | Partial | Drawer answers are scripted per demo business. No model call. |
| 38 | Finance from records | Missing on the screen | Screen KPIs are demo. SQLite ledger math exists and is not the screen. |
| 39 | Export and filter | Partial | Export downloads the demo revenue series. Filter sets the chart range and shows a toast. |
| 40 | Jobs, Sentry, PostHog, rate limit, backups, privacy, terms | Partial | Login is rate-limited in memory. Privacy and terms are drafts: `app/privacy/page.tsx`, `app/terms/page.tsx`. System status: `app/(app)/settings/system/page.tsx`. No Inngest, Sentry, PostHog, or restore test. |
| 41 | Playwright and CI | Missing | Vitest covers reliability, business types, qualification, and gym isolation. No Playwright. No GitHub Action. |

## What this pass did not claim

The app is not a finished product. A new visitor still lands in the demo workspace. Hidden modules still 404 from the product rule already in `lib/business-types.ts` by showing the not-part-of-this-business page.
