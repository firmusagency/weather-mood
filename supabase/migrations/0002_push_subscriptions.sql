-- Weather Mood: web push subscriptions for the evening message (one row per browser).
-- The public (anon) key may only insert; the nightly scripts read/update/delete with the service key.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  property_id text not null check (char_length(property_id) between 1 and 64),
  endpoint text not null unique check (char_length(endpoint) between 20 and 1024),
  p256dh text not null check (char_length(p256dh) between 20 and 256),
  auth text not null check (char_length(auth) between 10 and 128),
  lang text check (lang is null or char_length(lang) <= 8),
  profile text check (profile is null or char_length(profile) <= 32),
  client_id text not null check (char_length(client_id) between 8 and 64),
  app_version text check (app_version is null or char_length(app_version) <= 32),
  last_sent_at timestamptz,
  failures int not null default 0
);
create index push_subscriptions_property_idx on public.push_subscriptions (property_id);

alter table public.push_subscriptions enable row level security;
create policy "anon can subscribe" on public.push_subscriptions
  for insert to anon
  with check (true);

revoke all on public.push_subscriptions from anon;
grant insert on public.push_subscriptions to anon;
grant select, update, delete on public.push_subscriptions to service_role;
