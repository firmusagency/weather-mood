-- Weather Mood: page opens are kept for 90 days, then deleted (RETENTION.visitDays in src/engine/retention.ts,
-- stated to guests in the privacy note). The usage figures the properties see are weekly aggregates that are
-- archived as reports; the raw rows, with their random per-browser code, are not needed after that.
select cron.schedule('wm-visits-cleanup', '20 3 * * *', $$delete from public.visits where created_at < now() - interval '90 days'$$);
