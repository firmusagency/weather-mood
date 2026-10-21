-- Weather Mood: guest feedback + anonymous page opens.
-- Run once in the project's SQL editor (Supabase dashboard → SQL Editor → New query → Run).

-- Guest / reception feedback on a visited spot, tied to the forecast day.
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  property_id text not null check (char_length(property_id) between 1 and 64),
  source text not null check (source in ('guest', 'reception')),
  visit_date date not null,
  spot_id text not null check (char_length(spot_id) between 1 and 64),
  verdict text not null check (verdict in ('up', 'down')),
  tag text check (tag in ('wave', 'wind', 'crowd', 'rain', 'heat', 'cold', 'other')),
  profile text check (profile is null or char_length(profile) <= 32),
  lang text check (lang is null or char_length(lang) <= 8),
  note text check (note is null or char_length(note) <= 280),
  party_size int check (party_size is null or party_size between 1 and 50),
  client_id text not null check (char_length(client_id) between 8 and 64),
  app_version text check (app_version is null or char_length(app_version) <= 32),
  constraint feedback_one_per_visit unique (client_id, visit_date, spot_id, source)
);
create index feedback_visit_date_idx on public.feedback (visit_date);
create index feedback_created_at_idx on public.feedback (created_at);

-- Anonymous page opens, for the property's usage report (no personal data).
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  property_id text not null check (char_length(property_id) between 1 and 64),
  view text not null check (view in ('phone', 'lobby', 'reception')),
  lang text check (lang is null or char_length(lang) <= 8),
  profile text check (profile is null or char_length(profile) <= 32),
  client_id text not null check (char_length(client_id) between 8 and 64),
  plan_date date,
  app_version text check (app_version is null or char_length(app_version) <= 32)
);
create index visits_created_at_idx on public.visits (created_at);

alter table public.feedback enable row level security;
alter table public.visits enable row level security;

-- The public (anon) key may only insert, and only for recent dates. Reading is done
-- server-side (GitHub Action with the service key) and published as aggregates.
create policy "anon can insert recent feedback" on public.feedback
  for insert to anon
  with check (visit_date between current_date - 7 and current_date);

create policy "anon can log a visit" on public.visits
  for insert to anon
  with check (true);

revoke all on public.feedback from anon;
revoke all on public.visits from anon;
grant insert on public.feedback to anon;
grant insert on public.visits to anon;

-- The nightly export (GitHub Action) reads with the service key. With "Automatically expose
-- new tables" switched off in the project, privileges must be granted explicitly.
grant select on public.feedback to service_role;
grant select on public.visits to service_role;
grant delete on public.feedback to service_role;
grant delete on public.visits to service_role;
