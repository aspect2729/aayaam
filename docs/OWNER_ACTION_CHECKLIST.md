# Owner action checklist

Status starts at Not started. Update the Status column when a step is finished. Do not paste secret values into git or into chat.

Prices are not stated here. Use the provider’s pricing page. Approval times are stated only where the provider documents them; otherwise they vary.

## P0 — accounts that block a real launch

### 1. Supabase Auth and the database

- **Why:** Sign-up, phone or Google sign-in, and a shared database for every screen.
- **Where:** [https://supabase.com/dashboard](https://supabase.com/dashboard)
- **Steps:**
  1. Open the Aayaam project. Prefer a region close to India if you create a new one.
  2. Authentication → Providers. Turn on Email. Turn on Phone only after a phone provider is configured. Turn on Google after item 4.
  3. Project Settings → API. Copy the project URL and the service role key.
  4. SQL editor: run `db/supabase/001_activity.sql` if the activity tables are not there yet. Do not run a second seed on top of live rows.
- **Give back:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Add `SUPABASE_ANON_KEY` only when phone or Google sign-in is wired. It is not used today.
- **Where to put it:** Vercel → Project → Settings → Environment Variables, for Preview and Production. Also `.env.local` on a development machine. Never `NEXT_PUBLIC_` for the service role key.
- **Waiting:** Immediate after the keys are saved and the app is redeployed.
- **Cost:** [https://supabase.com/pricing](https://supabase.com/pricing)
- **Status:** Not started

### 2. Vercel environment and domain

- **Why:** The live site otherwise has no keys, and the local database file does not exist on Vercel.
- **Where:** [https://vercel.com](https://vercel.com) and the domain registrar.
- **Steps:**
  1. Open the Aayaam project → Settings → Environment Variables.
  2. Add every value from `.env.example` that you have. Leave the rest blank.
  3. Add the domain and the DNS records Vercel shows.
- **Give back:** The production URL after DNS resolves.
- **Where to put it:** Vercel environment variables and the registrar’s DNS.
- **Waiting:** DNS often settles within a day. Check the registrar.
- **Cost:** [https://vercel.com/pricing](https://vercel.com/pricing) and the registrar’s domain price.
- **Status:** Not started

### 3. Rotate the Gemini key that was in the example file

- **Why:** `.env.example` previously contained a Gemini key. It is blank in the file now. The old value may still be in git history.
- **Where:** [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) or Google Cloud credentials.
- **Steps:**
  1. Delete or rotate that key.
  2. Leave `GEMINI_API_KEY` empty until you decide to call a model. The app does not call a model for numbers.
- **Give back:** Nothing, unless you later set `GEMINI_API_KEY` and `FEATURE_AI=1`.
- **Where to put it:** Vercel, only if you turn the flag on.
- **Waiting:** Immediate.
- **Cost:** [https://ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing)
- **Status:** Not started

## P1 — Google

### 4. Google Cloud OAuth

- **Why:** Business Profile, Search Console, and Sheets.
- **Where:** [https://console.cloud.google.com/](https://console.cloud.google.com/)
- **Steps:**
  1. Create a project. Configure the OAuth consent screen with the app name, logo, privacy policy URL (`/privacy`), and authorized domains.
  2. Create an OAuth client. Add the redirect URI you will use. The app does not have a live redirect handler yet, so do not expect a login to succeed.
  3. Enable the APIs you need: Business Profile, Search Console, Sheets.
- **Give back:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- **Where to put it:** Vercel, server-only.
- **Waiting:** App verification for sensitive scopes varies. Google’s verification docs: [https://support.google.com/cloud/answer/9110914](https://support.google.com/cloud/answer/9110914)
- **Cost:** [https://cloud.google.com/pricing](https://cloud.google.com/pricing)
- **Status:** Not started

### 5. Google Business Profile API access

- **Why:** Publishing posts and reading reviews through the API.
- **Where:** The access form linked from [https://developers.google.com/my-business/content/prereqs](https://developers.google.com/my-business/content/prereqs)
- **Steps:** Request API access. Until it is approved, use assisted manual posting and leave `FEATURE_GBP_API` blank. Leave `FEATURE_GBP_BROWSER_ASSIST` blank unless you explicitly approve that mode.
- **Give back:** Approval, then `FEATURE_GBP_API=1` together with the OAuth client.
- **Where to put it:** Vercel.
- **Waiting:** Google’s review. The docs do not promise a fixed number of days.
- **Cost:** Check Google’s API terms.
- **Status:** Not started

### 6. Search Console

- **Why:** Real queries instead of sample rankings.
- **Where:** [https://search.google.com/search-console](https://search.google.com/search-console)
- **Steps:** Verify the business website, then set `FEATURE_SEARCH_CONSOLE=1` after OAuth exists.
- **Give back:** Confirmation that the site is verified.
- **Where to put it:** Search Console, plus the Google OAuth client in Vercel.
- **Waiting:** Verification depends on the method.
- **Cost:** No separate Search Console fee is documented on the product page.
- **Status:** Not started

## P1 — WhatsApp and email

### 7. Meta business and WhatsApp

- **Why:** Template sends and delivery status.
- **Where:** [https://business.facebook.com/](https://business.facebook.com/) and [https://developers.facebook.com/docs/whatsapp/cloud-api/get-started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- **Steps:**
  1. Create the Meta business and complete business verification.
  2. Add a WhatsApp Business number. Submit the display name.
  3. Create a permanent token, and copy the phone number id and app secret.
  4. Set the webhook to `https://<your-domain>/api/webhooks/whatsapp` and a verify token you choose.
- **Give back:** `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `META_APP_SECRET`, `META_APP_ID`. Then `FEATURE_WHATSAPP=1`.
- **Where to put it:** Vercel, server-only.
- **Waiting:** Display name and template review. Meta’s review times vary. See [https://developers.facebook.com/docs/whatsapp/overview/business-accounts](https://developers.facebook.com/docs/whatsapp/overview/business-accounts)
- **Cost:** [https://developers.facebook.com/docs/whatsapp/pricing](https://developers.facebook.com/docs/whatsapp/pricing)
- **Status:** Not started

### 8. Templates the qualification desk expects

Submit these only for an interior-design WhatsApp account. Category and body must match what you send to Meta. The local templates are in `server/outreach/schema.ts` and are marked `not_submitted`.

- **Why:** WhatsApp will not deliver a business-initiated message without an approved template.
- **Where:** WhatsApp Manager → Message templates.
- **Steps:** Submit one template per language you will use (English, Hindi, Kannada) for: first hello, next qualifying question, not a fit, site-visit booking confirmation, visit reminder, and opt-out confirmation. Copy the approved template name back into the template rows. Do not mark them sent in the product until Meta returns an id.
- **Give back:** Approved template names and languages.
- **Where to put it:** WhatsApp Manager, then the template records once an admin screen exists. Until then, keep them unsubmitted.
- **Waiting:** Meta template review. Times vary.
- **Cost:** Same WhatsApp pricing page as item 8.
- **Status:** Not started

### 9. Calling

- **Why:** The Calling tab stays Coming soon on purpose.
- **Where:** No provider yet.
- **Steps:** Decide the telephony provider and read the Indian commercial-communication rules before any build.
- **Give back:** The decision, not a key.
- **Status:** Not started

### 10. Gym reminder copy

- **Why:** Welcome, renewal, birthday, and “we miss you” messages need approved templates and a consent line.
- **Where:** Same WhatsApp Manager.
- **Steps:** Write the gym templates and the consent sentence. Have them reviewed with the privacy policy.
- **Give back:** Approved template names.
- **Status:** Not started

### 11. Email domain

- **Why:** Email follow-up and inbound replies.
- **Where:** [https://resend.com](https://resend.com) or Amazon SES.
- **Steps:**
  1. Add the sending domain.
  2. Add the SPF, DKIM, and DMARC records the provider shows.
  3. Add an inbound domain and MX records if replies should land in Aayaam.
- **Give back:** `RESEND_API_KEY`, `EMAIL_FROM_DOMAIN`, `EMAIL_WEBHOOK_SECRET`, then `FEATURE_EMAIL=1`.
- **Where to put it:** DNS at the registrar, secrets in Vercel.
- **Waiting:** DNS checks usually follow the provider’s status page.
- **Cost:** [https://resend.com/pricing](https://resend.com/pricing)
- **Status:** Not started

## P1 — commerce

### 12. Shopify

- **Why:** Handicraft orders.
- **Where:** [https://dev.shopify.com/](https://dev.shopify.com/)
- **Steps:** Create a development store and a custom app. Copy the key, secret, and webhook secret.
- **Give back:** `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, then `FEATURE_SHOPIFY=1`.
- **Where to put it:** Vercel.
- **Waiting:** App review if you publish a public app. A custom app on a dev store is the provider’s own flow.
- **Cost:** [https://shopify.dev/docs/apps/launch/billing](https://shopify.dev/docs/apps/launch/billing)
- **Status:** Not started

### 13. WooCommerce

- **Give back:** `WOOCOMMERCE_CONSUMER_KEY`, `WOOCOMMERCE_CONSUMER_SECRET`, `WOOCOMMERCE_WEBHOOK_SECRET`, site URL, `FEATURE_WOOCOMMERCE=1`.
- **Where:** WooCommerce → Settings → Advanced → REST API, on the store.
- **Why:** An alternative catalogue to Shopify.
- **Status:** Not started

### 14. Razorpay

- **Where:** [https://dashboard.razorpay.com/](https://dashboard.razorpay.com/)
- **Why:** Payment links and webhooks. A captured payment is not marked bank-settled until you decide that mapping and the evidence is stored.
- **Give back:** Test and live key id, key secret, webhook secret: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `FEATURE_RAZORPAY=1`.
- **Waiting:** KYC activation. Razorpay’s dashboard shows the account state.
- **Cost:** [https://razorpay.com/pricing/](https://razorpay.com/pricing/)
- **Status:** Not started

### 15. Shiprocket

- **Where:** [https://app.shiprocket.in/](https://app.shiprocket.in/)
- **Give back:** `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, `FEATURE_SHIPROCKET=1`.
- **Why:** Pickups for handicraft orders. The adapter does not call Shiprocket yet.
- **Status:** Not started

## P1 — connectors

### 16. Zoho CRM, India data centre

- **Where:** [https://api-console.zoho.in/](https://api-console.zoho.in/)
- **Give back:** `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, redirect URI, `FEATURE_CONNECTOR_ZOHO=1`.
- **Why:** Lead import. The connector is not built. The card says Awaiting setup.
- **Status:** Not started

### 17. Notion

- **Where:** [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
- **Give back:** `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `FEATURE_CONNECTOR_NOTION=1`.
- **Status:** Not started

### 18. Odoo

- **Why:** Each customer creates their own API key. There is no Aayaam developer account.
- **Steps:** Document, for the customer: Odoo → Preferences → Account Security → New API key. The connector is not built.
- **Status:** Not started

### 19. Google Sheets

- **Give back:** The same Google OAuth client, plus `FEATURE_CONNECTOR_SHEETS=1` after verification.
- **Status:** Not started

## P2 — jobs, monitoring, legal, decisions

### 20. Background jobs

- **Where:** [https://www.inngest.com/](https://www.inngest.com/) or [https://trigger.dev/](https://trigger.dev/)
- **Why:** Reminders stop when the web process stops.
- **Give back:** The provider key after one provider is chosen. Do not add both.
- **Status:** Not started

### 21. Sentry and PostHog

- **Give back:** `SENTRY_DSN`. `POSTHOG_KEY` is optional.
- **Where:** [https://sentry.io/](https://sentry.io/) and [https://posthog.com/](https://posthog.com/)
- **Status:** Not started

### 22. Legal text

- **Why:** `/privacy` and `/terms` are drafts. WhatsApp and email consent text needs the same review.
- **Steps:** Have a lawyer replace both pages. Have a chartered accountant review receipt and invoice wording. The software does not file GST.
- **Status:** Not started

### 23. Decisions

- Beachhead business type and the first pilot customers.
- Whether Aayaam subscriptions are collected now. Plans currently say Contact us and take no payment.
- GBP browser-assist stays off unless you approve `FEATURE_GBP_BROWSER_ASSIST`.
- Membership receipts are allowed in the stand-in master context. Confirm that sentence if you replace the file.
- Assistant name, logo, default quiet hours, gym reminder schedule, and interior budget bands.

- **Status:** Not started

## P1 — AI gateway

### 24. Model accounts

- **Why:** Draft wording. Numbers, scores, and config choices stay in code. A missing key leaves the assistant on rules.
- **Where:** [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) and [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Steps:**
  1. Create a Gemini key and an OpenAI key. Set a spend limit in each dashboard.
  2. Set `FEATURE_AI=1` only after both keys exist if you want fallback. One key is enough for the primary provider.
  3. Set `AI_USD_INR_RATE` from the rate you actually use. The app does not invent one, so the ₹500 monthly budget is not enforced until this is set.
  4. Confirm the model ids in `.env.example` still match [Google pricing](https://ai.google.dev/gemini-api/docs/pricing) and [OpenAI pricing](https://developers.openai.com/api/docs/pricing). `gemini-3.8-flash` is listed at $0.75 / $3.75 per million tokens through 31 Dec 2026, then $1.50 / $7.50.
- **Give back:** `GOOGLE_GENERATIVE_AI_API_KEY` or `GEMINI_API_KEY`, `OPENAI_API_KEY`, `FEATURE_AI=1`, `AI_USD_INR_RATE`, `AI_GLOBAL_DAILY_BUDGET_USD`.
- **Where to put it:** Vercel, server-only. Never `NEXT_PUBLIC_`.
- **Cost:** The two pricing pages above.
- **Status:** Not started

### 25. Inngest

- **Why:** Schedules survive a restart. Until then, rule runs happen in the web process.
- **Where:** [https://www.inngest.com/](https://www.inngest.com/)
- **Give back:** `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`.
- **Status:** Not started

### 26. AI decisions

- Default autonomy for a new business: Assisted (approval before a customer message).
- Privacy policy must name Google and OpenAI if you turn `FEATURE_AI` on.
- Starter WhatsApp templates still need Meta approval. The configurator only stores drafts.
- Lead forwarding mail (`leads-<slug>@your-domain`) needs MX records before JustDial or IndiaMART mail can arrive. That inbox is not connected yet.

- **Status:** Not started

## What works with no keys

- The three demo workspaces, labeled Demo data.
- Switching business type, with hidden modules staying hidden.
- Recording an approval inside Aayaam. Nothing is sent.
- Opening WhatsApp with a `wa.me` link. The screen says it was opened, not sent.
- Interior qualification drafts, quiet hours, and site-visit slots in the local database.
- Email and password sign-in against the local database.
- Settings health text for the local database and Supabase activity tables when those keys exist.

## What each key unlocks

| Key | Unlocks |
| --- | --- |
| `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` | Activity rows in Supabase. Not the full product database. |
| `WHATSAPP_*` and `FEATURE_WHATSAPP=1` | A provider call is still not made until the adapter is switched from the test stub. The flag shows the keys as present. |
| `RESEND_API_KEY` and `FEATURE_EMAIL=1` | Same: keys can be present while no mail is sent. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Required before Business Profile, Search Console, or Sheets can be connected. |
| `SHOPIFY_*`, `WOOCOMMERCE_*`, `RAZORPAY_*`, `SHIPROCKET_*` | Handicraft commerce setup. Orders are not pulled until the adapter runs. |
| `FEATURE_AI=1` plus a model key | Still must not invent totals. Numbers stay computed in code. |
