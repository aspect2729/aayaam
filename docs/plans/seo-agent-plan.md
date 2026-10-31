# Local SEO agent plan

This extends the orchestrator in `docs/plans/agent-orchestrator-plan.md`. The purple Marketing screen stays. Demo rankings, the health ring, Search Console-style chart, and AEO mentions stay on the screen and are labelled as demo figures. A connection list shows what is actually waiting on accounts.

The owner-authored prompt file named in `docs/prompts/README.md` is still not in the repo. This plan follows the Local SEO prompt, the short master context, and the code that is already here.

## Reuse

- Policy classes in `lib/agents/policy.ts`. SEO name, address, phone, primary category, and service-area edits stay Class 4 through `lib/seo/policy.ts`.
- The rule router in `lib/agents/router.ts`. A due GBP post and a new review propose a draft. They are not marked published.
- The model gateway in `lib/ai/gateway.ts`. SEO drafts do not call a model unless `FEATURE_AI` and a key exist. This pass does not call one. Keyword lists, completeness, NAP comparison, grids, and cool-downs are code.
- Workspace services, localities, and languages from `WorkspaceConfig` when the owner has applied a setup. Otherwise the demo business city is the only locality.
- Feature flags in `server/flags.ts`.

## Not built as a live worker

- Inngest is installed and not connected. Monday 07:00 IST is the intended schedule. Nothing runs on that clock until `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` exist.
- No browser worker is deployed. Read-mode checks (robots.txt, private-network block, Google Search and Maps block, password fields, CAPTCHA pause) live in `lib/seo/browser.ts` and are tested. Playwright, Browserbase, and Browserless are not called.
- No adapter calls Google, DataForSEO, WordPress, Bing, or IndexNow. A present key is reported as keys present and not called.
- `db/postgres/004_seo.sql` is written for the owner to run later. It is not applied. Row-level security in that file is not active on Supabase.

## What this pass adds

1. Connection catalogue for Places, PageSpeed Insights, CrUX, Search Console, Business Profile, keyword data, rank data, WordPress, the browser worker, IndexNow, and optional backlinks.
2. Code for NAP comparison, the keyword universe, the rank grid, profile completeness, post and reply safety checks, JSON-LD checks, UTM links, and cool-downs.
3. A weekly plan object: tasks for the SEO lead and specialists, with no invented rank or traffic number.
4. Marketing → Local SEO shows those candidates, the directory list as “Not checked”, and the connection statuses.

## Explicitly refused

- Scraping Google Search or Google Maps.
- The Google Indexing API for ordinary pages. Official scope is job postings and livestream videos: https://developers.google.com/search/apis/indexing-api/v3/quickstart
- Storing or typing owner passwords, solving CAPTCHAs, or signing in to Google headlessly.
- Doorway pages, keyword stuffing, link buying, review gating, and fabricated reviews.
- A ranking promise or a score that did not come from a source.
