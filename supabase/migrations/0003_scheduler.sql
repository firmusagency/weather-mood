-- Weather Mood: precise scheduler for the GitHub Actions.
--
-- GitHub runs `schedule:` workflows 4–6 hours late on this repository (observed Oct 2026: the
-- evening message landed at 20:20–22:45 Athens instead of 17:40, the morning plan-B check at
-- 09:40–11:05 instead of 05:50). pg_cron fires on time, so the database starts the workflows
-- through the GitHub `workflow_dispatch` API and the GitHub crons stay only as a late fallback
-- (the evening and morning workflows skip the fallback run when the dispatched run already did
-- the work).
--
-- Times are checked in Europe/Athens, so summer/winter time needs no change here.
--
-- One-time setup by the owner (SQL editor, never commit the token):
--   1. GitHub → Settings → Developer settings → Fine-grained tokens → repository
--      firmusagency/weather-mood, permission "Actions: Read and write".
--   2. select vault.create_secret('<token>', 'github_dispatch_token');
--   3. select ops.dispatch_workflow('snapshot.yml');      -- test; a run must appear on GitHub
--   4. select * from ops.dispatch_status;                 -- HTTP 204 = accepted
--
-- Token rotation: select vault.update_secret(id, '<new token>') from vault.secrets where name = 'github_dispatch_token'.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Not exposed through the REST API (only `public` is), so nothing here is reachable with the anon key.
create schema if not exists ops;
revoke all on schema ops from public, anon, authenticated;

create table if not exists ops.settings (
  key text primary key,
  value text not null
);
insert into ops.settings (key, value) values
  ('github_repo', 'firmusagency/weather-mood'),
  ('github_ref', 'claude/gifted-tesla-83gi9j')
on conflict (key) do nothing;

create table if not exists ops.dispatch_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  workflow text not null,
  outcome text not null,          -- 'sent' | 'no_token' | 'error'
  request_id bigint,              -- net._http_response.id (kept by pg_net for a few hours)
  note text
);
create index if not exists dispatch_log_at_idx on ops.dispatch_log (at desc);

-- Starts one workflow run on the working branch. Returns the pg_net request id (null when skipped).
create or replace function ops.dispatch_workflow(workflow text, inputs jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  token text;
  repo text;
  ref text;
  req bigint;
begin
  select decrypted_secret into token from vault.decrypted_secrets where name = 'github_dispatch_token' limit 1;
  if token is null or token = '' then
    insert into ops.dispatch_log (workflow, outcome, note) values (workflow, 'no_token', 'vault secret github_dispatch_token is missing');
    return null;
  end if;
  select value into repo from ops.settings where key = 'github_repo';
  select value into ref from ops.settings where key = 'github_ref';

  begin
    select net.http_post(
      url := format('https://api.github.com/repos/%s/actions/workflows/%s/dispatches', repo, workflow),
      body := jsonb_build_object('ref', ref, 'inputs', inputs),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || token,
        'Accept', 'application/vnd.github+json',
        'X-GitHub-Api-Version', '2022-11-28',
        'Content-Type', 'application/json',
        'User-Agent', 'weather-mood-scheduler'
      ),
      timeout_milliseconds := 15000
    ) into req;
    insert into ops.dispatch_log (workflow, outcome, request_id) values (workflow, 'sent', req);
  exception when others then
    insert into ops.dispatch_log (workflow, outcome, note) values (workflow, 'error', sqlerrm);
  end;
  return req;
end;
$$;

-- Called every hour by pg_cron; dispatches only when the Athens clock shows the wanted hour
-- (and weekday, ISO 1 = Monday, when given). The minute comes from the cron expression.
create or replace function ops.dispatch_if_athens(workflow text, athens_hour int, athens_isodow int default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  local_now timestamp := (now() at time zone 'Europe/Athens');
begin
  if extract(hour from local_now) <> athens_hour then return; end if;
  if athens_isodow is not null and extract(isodow from local_now) <> athens_isodow then return; end if;
  perform ops.dispatch_workflow(workflow);
end;
$$;

revoke all on function ops.dispatch_workflow(text, jsonb) from public, anon, authenticated;
revoke all on function ops.dispatch_if_athens(text, int, int) from public, anon, authenticated;

-- What happened to the last dispatches (joins the HTTP responses pg_net keeps for a few hours).
create or replace view ops.dispatch_status as
select l.at, l.workflow, l.outcome, r.status_code, coalesce(l.note, r.error_msg) as note
from ops.dispatch_log l
left join net._http_response r on r.id = l.request_id
order by l.at desc
limit 50;

-- Schedules (minute from cron, hour checked in Athens time). Re-running updates the job in place.
select cron.schedule('wm-evening',       '40 * * * *', $$select ops.dispatch_if_athens('evening.yml', 17)$$);        -- 17:40 Athens
select cron.schedule('wm-verify',        '35 * * * *', $$select ops.dispatch_if_athens('verify.yml', 5)$$);          -- 05:35 Athens
select cron.schedule('wm-morning-check', '50 * * * *', $$select ops.dispatch_if_athens('morning-check.yml', 5)$$);   -- 05:50 Athens
select cron.schedule('wm-feedback',      '5 * * * *',  $$select ops.dispatch_if_athens('feedback.yml', 6)$$);        -- 06:05 Athens
select cron.schedule('wm-weekly',        '40 * * * *', $$select ops.dispatch_if_athens('weekly.yml', 7, 1)$$);       -- Monday 07:40 Athens

-- Keep the log small.
select cron.schedule('wm-log-cleanup', '0 3 * * 0', $$delete from ops.dispatch_log where at < now() - interval '60 days'$$);
