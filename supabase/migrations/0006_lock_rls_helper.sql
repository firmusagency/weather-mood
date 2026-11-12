-- Weather Mood: the event-trigger function that switches row level security on for every new public
-- table was executable by everyone (Supabase advisor 0028/0029). It returns event_trigger, so it
-- cannot really be called through the API, but nothing outside the database needs to see it.
-- Event triggers do not check EXECUTE when they fire, so the safety net keeps working.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
