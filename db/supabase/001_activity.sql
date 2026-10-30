create table if not exists public.businesses (
  id text primary key,
  name text not null,
  city text not null,
  business_type text not null,
  ecommerce_billing boolean not null default false
);

create table if not exists public.customers (
  id text primary key,
  business_id text not null references public.businesses(id),
  name text not null,
  phone text
);

create table if not exists public.leads (
  id text primary key,
  business_id text not null references public.businesses(id),
  name text not null,
  phone text,
  source text not null,
  stage text not null
);

create table if not exists public.tasks (
  id text primary key,
  business_id text not null references public.businesses(id),
  title text not null,
  status text not null default 'open'
);

create table if not exists public.activity_log (
  id text primary key,
  business_key text not null,
  action text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

alter table public.businesses enable row level security;
alter table public.customers enable row level security;
alter table public.leads enable row level security;
alter table public.tasks enable row level security;
alter table public.activity_log enable row level security;

revoke all on public.businesses, public.customers, public.leads, public.tasks, public.activity_log from anon, authenticated;

insert into public.businesses (id, name, city, business_type, ecommerce_billing) values
  ('shakti', 'Shakti Fitness', 'Hubballi', 'gym', false),
  ('mitti', 'Mitti Crafts', 'Mysuru', 'ecommerce_handicraft', true),
  ('aangan', 'Studio Aangan', 'Bengaluru', 'interior_design', false)
on conflict (id) do nothing;

insert into public.customers (id, business_id, name, phone) values
  ('shakti-imran', 'shakti', 'Imran', '+919845011122'),
  ('mitti-ananya', 'mitti', 'Ananya Rao', '+919845044444'),
  ('aangan-meera', 'aangan', 'Meera', '+919845066666')
on conflict (id) do nothing;

insert into public.leads (id, business_id, name, phone, source, stage) values
  ('shakti-kavya', 'shakti', 'Kavya Hegde', '+919845099911', 'walk_in', 'new'),
  ('aangan-jayanagar', 'aangan', 'Jayanagar flat', '+919845077777', 'referral', 'new')
on conflict (id) do nothing;

insert into public.tasks (id, business_id, title) values
  ('shakti-followup', 'shakti', 'Follow up the new trial enquiry'),
  ('mitti-stock', 'mitti', 'Review teak lamp stock')
on conflict (id) do nothing;
