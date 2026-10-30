# Functional modules plan

`docs/Aayaam_Master_Project_Context.md` is not in the repository or in Downloads. This plan follows the Cursor prompt that was pasted, including no POS, e-commerce-only billing, and no claim that a message was sent unless a provider confirmed it.

The existing purple screens stay. This work does not replace their layout.

## What exists

- Designed screens for overview, sales, customers, marketing, commerce, finance, operations, reports, integrations, and settings. They render the three demo businesses from `lib/mock-data.ts`.
- A local SQLite system of record for auth, ledger, orders, and invoices. It is not what those screens read. E-commerce invoice APIs already reject a business with billing turned off.
- Supabase is not connected. There is no `DATABASE_URL` project.

## What is still demo data

Every figure on the designed screens is seeded demo data. The badge says "Demo data". Stage changes made in the lead sheet are kept in the browser session. WhatsApp opens a `wa.me` link and is labelled "not confirmed sent".

## Milestone 1 — done in this pass

- `lib/business-types.ts` decides modules and labels.
- Interior design: lead pipeline stays, customers are labelled Clients, Commerce is hidden.
- Gym: sales is labelled Enquiries, customers are labelled Members, Commerce is hidden.
- Handicraft store: Commerce stays, the lead pipeline is hidden.
- Settings can change the type. Records are not deleted.
- Direct visits to a hidden module show an unavailable state. The screen file is unchanged for businesses that use it.
- Phone normalisation and an explainable lead score exist as tested functions. The score is not applied over the demo cards, so those numbers do not jump.

## Still to build

1. Lead management persistence: quotations, site visits, CSV import, duplicate merge, conflict on concurrent edit. The current pipeline is the existing screen, not a new kanban.
2. Gym memberships, attendance, and renewal reminders that re-check dues.
3. Handicraft catalogue movements, manual orders, invoices, and payment allocations on the existing commerce screen.
4. Messaging providers. Until then, WhatsApp stays a handoff.
5. Google Business Profile OAuth. Assisted manual mode only. No stored Google password.
6. Business Brain rules per type, computed from records.
7. PostgreSQL and row-level security once a Supabase project exists. Local SQLite remains the running database until then.

## Verification

- `npx vitest run`
- `npx tsc --noEmit`
- Switching Shakti Fitness hides Commerce. Switching Mitti Crafts hides Leads and shows Commerce. The overview layout stays.
