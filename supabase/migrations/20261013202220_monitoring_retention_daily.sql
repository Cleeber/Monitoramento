-- One daily job at 02:17 America/Sao_Paulo, equivalent to 05:17 UTC.
-- Keep two bounded 5,000-row batches: one batch would not keep up with
-- the current 5,184 checks/day. No application redeployment is required.
DO $daily$
DECLARE
  retention_job bigint;
BEGIN
  IF coalesce(current_setting('cron.timezone', true), '') NOT IN ('GMT', 'UTC', 'Etc/UTC') THEN
    RAISE EXCEPTION 'Expected a UTC cron.timezone before applying the 05:17 UTC schedule';
  END IF;

  SELECT jobid INTO STRICT retention_job FROM cron.job
  WHERE jobname = 'monitoring-retention-180-days';

  PERFORM cron.alter_job(
    retention_job,
    schedule := '17 5 * * *',
    command := $$SET statement_timeout = '20s'; SET lock_timeout = '2s'; SELECT maintenance.cleanup_monitoring_data() FROM pg_catalog.generate_series(1, 2);$$
  );
END;
$daily$;
