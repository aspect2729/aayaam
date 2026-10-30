# Aayaam architecture

Aayaam is one Next.js application. The existing App Router interface stays the visual system. Business records live in a single tenant-isolated database, and every module reads and writes that database through server services.

## What already existed

- Next.js 14, React 18, TypeScript, Tailwind, Radix UI primitives, Recharts, Framer Motion.
- A clickable dashboard with mock data in `lib/mock-data.ts`.
- No database, authentication, API, or integration runtime.

The mock layer is no longer the system of record. Screens load the signed-in workspace.

## What was not available

- The Figma file `XoqqsWCVcSwDx4tk4LcO1N` refused the Figma connection because this account does not have edit access. The running interface keeps the purple dashboard already built from that design: white sidebar, `#F4F5F8` canvas, `#6D4AFF` accent, card radius, and the overview composition.
- No Supabase project, Postgres instance, Redis, or provider credentials are configured in this environment.

## Runtime choices

| Concern | Choice | Why |
|---|---|---|
| Application | Next.js route handlers on the Node.js runtime | Already the app. No second service. |
| Local database | SQLite via `better-sqlite3` at `data/aayaam.sqlite` | Runs without a hosted database. Foreign keys and transactions are on. |
| Production database | PostgreSQL schema and RLS in `db/postgres/` | Target for Supabase. Not applied to a live project. |
| Money | Integer paise | No floating-point currency math. |
| Jobs | `sync_jobs` rows processed in-process | One durable queue. Inngest or Trigger.dev can wrap the same handlers later. A second queue is not installed. |
| AI | Provider interface in `server/ai.ts` | Deterministic queries produce figures. A model may only narrate when a server key exists. |
| Auth | scrypt password hashes, HTTP-only session cookie | No auth vendor is configured. Email delivery is not claimed. |

Historical amounts keep the currency stored on the row. Changing a business default currency does not rewrite old rows.

## Tenancy

Platform → organization → business → branch → member → records.

Every tenant table has `business_id`. Services take an actor resolved from the session and reject a record whose business does not match. The client cannot choose another tenant by sending an id. PostgreSQL policies in `db/postgres/002_rls.sql` are the production equivalent of these checks. SQLite has no row-level security, so the repository checks are mandatory and tested.

## Modules and the rule that connects them

There is no point-of-sale and no counter-billing screen.

- Service and local businesses use customers, leads, tasks, expenses, and an append-only ledger.
- E-commerce billing (invoices, credit notes, order-linked tax breakdowns, invoice PDF) exists only when `businesses.ecommerce_billing = 1`.
- An invoice is created from one e-commerce order, inside a transaction, and a second attempt returns the original invoice.
- Inventory moves only through `stock_movements`. A fulfilled order posts one movement per variant. Retries hit a unique source key.
- Payments store one row per tender. Allocations are separate rows. Pending UPI does not reduce the book balance. Bank-settled requires a reference and settlement evidence.
- Posted ledger rows are never updated or deleted. Corrections are reversals.
- A payment reminder is a draft. It is blocked when a pending or unsettled payment could change the amount due. Nothing is sent without a configured messaging provider and an approval or an explicit send policy.

## Reliability rules taken from the competitor research

Reviews of Khatabook and Vyapar are treated as failure modes to design against, not as measured defect rates. The implementation prioritizes:

1. Split tenders that stay consistent across invoice, allocation, and ledger.
2. Explicit payment states, including pending and reversed.
3. Idempotent webhook and order processing.
4. Staff roles that hide purchase cost, margin, bank activity, and supplier dues.
5. Export, backup snapshot, and a tested restore onto a second database.
6. Import reconciliation that reports duplicates instead of dropping them.
7. Traceable insights. The Business Brain cites record ids and separates observed figures from hypotheses.

Counter checkout, barcode POS, and parked carts are intentionally absent.

## Request path

1. Browser sends the session cookie.
2. `server/http.ts` loads the user, active business, and role.
3. The service checks permission, then opens a SQLite transaction for multi-row financial writes.
4. An audit event is appended in that same transaction.
5. The workspace endpoint returns the records the interface is allowed to see. Sensitive fields are removed before the response.

Webhook path: verify signature, store the event id once, enqueue a job, apply the order through the same idempotent commerce service.

## Ownership

- `server/` domain services and persistence.
- `app/api/` HTTP adapters only.
- `app/(app)/*` interface.
- `tests/` behavioral tests against an in-memory database.
- `db/postgres/` production schema, not executed locally.
