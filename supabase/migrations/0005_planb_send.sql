-- Weather Mood: the plan-B notification leaves at 08:30 Athens, not with the 05:50 check.
-- The check stays early (the reception sees the change on the dashboard); guests are told when awake.
select cron.schedule('wm-planb-send', '30 * * * *', $$select ops.dispatch_if_athens('planb-send.yml', 8)$$);   -- 08:30 Athens
