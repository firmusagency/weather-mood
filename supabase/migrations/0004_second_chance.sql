-- Weather Mood: a second chance for the two runs a guest waits for.
--
-- On 12 Nov 2026 the 17:40 evening run died on a connect timeout at the weather provider and nothing
-- ran again until the owner noticed. The workflows now retry and fall back to the last snapshot, and
-- the scheduler dispatches each of them once more half an hour later with only_if_missing=true: the
-- workflow's own guard then does nothing when the first run produced its output.

create or replace function ops.dispatch_if_athens(workflow text, athens_hour int, athens_isodow int default null, inputs jsonb default '{}'::jsonb)
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
  perform ops.dispatch_workflow(workflow, inputs);
end;
$$;

-- the three-argument version is replaced by the one above (same name, one more defaulted argument)
drop function if exists ops.dispatch_if_athens(text, int, int);
revoke all on function ops.dispatch_if_athens(text, int, int, jsonb) from public, anon, authenticated;

select cron.schedule('wm-evening-retry',       '10 * * * *', $$select ops.dispatch_if_athens('evening.yml', 18, null, '{"only_if_missing":"true"}'::jsonb)$$);        -- 18:10 Athens
select cron.schedule('wm-morning-check-retry', '15 * * * *', $$select ops.dispatch_if_athens('morning-check.yml', 6, null, '{"only_if_missing":"true"}'::jsonb)$$);   -- 06:15 Athens
