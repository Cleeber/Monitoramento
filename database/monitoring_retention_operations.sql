-- Administrative SQL Editor only. This schema is not exposed through the API.
-- Current schedule: 17 5 * * * (05:17 UTC = 02:17 America/Sao_Paulo), once/day.
-- The single daily job processes up to two 5,000-check batches.
-- Configuration and status (read-only).
SELECT jobid, jobname, schedule, active, username FROM cron.job
WHERE jobname = 'monitoring-retention-180-days';

SELECT runs.status, runs.start_time, runs.end_time, runs.return_message
FROM cron.job_run_details AS runs
JOIN cron.job AS jobs ON jobs.jobid = runs.jobid
WHERE jobs.jobname = 'monitoring-retention-180-days'
ORDER BY runs.start_time DESC LIMIT 24;

-- Activation, pause, and manual execution: run ONE command when needed.
-- SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'monitoring-retention-180-days'), active := true);
-- SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'monitoring-retention-180-days'), active := false);
-- SELECT maintenance.cleanup_monitoring_data();

-- Vacuum runs outside an explicit transaction/function. Use after a large backlog,
-- if autovacuum has not caught up. Avoid VACUUM FULL in the routine (exclusive lock).
-- VACUUM (ANALYZE) public.monitor_checks;
