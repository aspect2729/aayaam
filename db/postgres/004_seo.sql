-- Local SEO tables. Not applied.
-- businesses.id in db/supabase/001_activity.sql is text, so these keys are text too.
-- Row level security below is written and not active until you run this file
-- and the app sets app.business_id from the server session.

create table if not exists public.seo_settings (
  business_id text primary key references public.businesses(id),
  website_url text,
  cms_type text,
  gbp_location_id text,
  place_id text,
  primary_keywords jsonb not null default '[]',
  localities jsonb not null default '[]',
  grid_size int not null default 5,
  post_cadence_days int not null default 3 check (post_cadence_days between 2 and 7),
  autonomy text not null default 'assisted',
  updated_at timestamptz not null default now()
);

create table if not exists public.seo_state_snapshots (
  id text primary key,
  business_id text not null references public.businesses(id),
  taken_at timestamptz not null default now(),
  summary jsonb not null
);

create table if not exists public.seo_keywords (
  id text primary key,
  business_id text not null references public.businesses(id),
  keyword text not null,
  language text not null default 'en',
  locality text,
  volume int,
  difficulty numeric,
  source text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.seo_rank_checks (
  id text primary key,
  business_id text not null references public.businesses(id),
  keyword text not null,
  lat numeric not null,
  lng numeric not null,
  rank int,
  provider text not null,
  checked_at timestamptz not null default now()
);

create table if not exists public.seo_findings (
  id text primary key,
  business_id text not null references public.businesses(id),
  type text not null,
  severity text not null,
  url text,
  evidence jsonb not null default '{}',
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists public.seo_tasks (
  id text primary key,
  business_id text not null references public.businesses(id),
  title text not null,
  agent text not null,
  priority int not null default 0,
  status text not null default 'open',
  due_on date,
  created_at timestamptz not null default now()
);

create table if not exists public.seo_experiments (
  id text primary key,
  business_id text not null references public.businesses(id),
  change_ref text not null,
  baseline jsonb not null,
  measurements jsonb not null default '[]',
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists public.gbp_posts (
  id text primary key,
  business_id text not null references public.businesses(id),
  status text not null check (status in ('draft','awaiting_approval','awaiting_provider','published','failed','skipped')),
  provider_id text,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.citations (
  id text primary key,
  business_id text not null references public.businesses(id),
  directory text not null,
  listing_url text,
  nap_found jsonb,
  consistency_score int,
  status text not null default 'not_checked',
  last_checked timestamptz
);

create table if not exists public.content_drafts (
  id text primary key,
  business_id text not null references public.businesses(id),
  type text not null,
  target text,
  body text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

alter table public.seo_settings enable row level security;
alter table public.seo_state_snapshots enable row level security;
alter table public.seo_keywords enable row level security;
alter table public.seo_rank_checks enable row level security;
alter table public.seo_findings enable row level security;
alter table public.seo_tasks enable row level security;
alter table public.seo_experiments enable row level security;
alter table public.gbp_posts enable row level security;
alter table public.citations enable row level security;
alter table public.content_drafts enable row level security;

create policy seo_settings_tenant on public.seo_settings
  using (business_id = current_setting('app.business_id', true))
  with check (business_id = current_setting('app.business_id', true));
create policy seo_snapshots_tenant on public.seo_state_snapshots
  using (business_id = current_setting('app.business_id', true))
  with check (business_id = current_setting('app.business_id', true));
create policy seo_keywords_tenant on public.seo_keywords
  using (business_id = current_setting('app.business_id', true))
  with check (business_id = current_setting('app.business_id', true));
create policy seo_ranks_tenant on public.seo_rank_checks
  using (business_id = current_setting('app.business_id', true))
  with check (business_id = current_setting('app.business_id', true));
create policy seo_findings_tenant on public.seo_findings
  using (business_id = current_setting('app.business_id', true))
  with check (business_id = current_setting('app.business_id', true));
create policy seo_tasks_tenant on public.seo_tasks
  using (business_id = current_setting('app.business_id', true))
  with check (business_id = current_setting('app.business_id', true));
create policy seo_experiments_tenant on public.seo_experiments
  using (business_id = current_setting('app.business_id', true))
  with check (business_id = current_setting('app.business_id', true));
create policy gbp_posts_tenant on public.gbp_posts
  using (business_id = current_setting('app.business_id', true))
  with check (business_id = current_setting('app.business_id', true));
create policy citations_tenant on public.citations
  using (business_id = current_setting('app.business_id', true))
  with check (business_id = current_setting('app.business_id', true));
create policy content_drafts_tenant on public.content_drafts
  using (business_id = current_setting('app.business_id', true))
  with check (business_id = current_setting('app.business_id', true));
