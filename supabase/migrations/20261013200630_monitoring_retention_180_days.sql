-- Apply with an administrative database connection. No historical monitoring
-- rows are deleted while installing this migration.
SET lock_timeout = '3s';
SET statement_timeout = '30s';

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE SCHEMA IF NOT EXISTS maintenance;
REVOKE ALL ON SCHEMA maintenance FROM PUBLIC, anon, authenticated;

-- Existing production indexes support the time-based batch scans.
-- Keep index creation separate (CONCURRENTLY) if deploying to a database
-- that does not yet have checked_at/expires_at indexes.
DO $preflight$
BEGIN
  IF to_regclass('public.idx_monitor_checks_checked_at') IS NULL
     OR to_regclass('public.idx_refresh_tokens_expires_at') IS NULL THEN
    RAISE EXCEPTION 'Create the checked_at and expires_at indexes before enabling retention';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION maintenance.cleanup_monitoring_data(p_batch_size integer DEFAULT 5000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
SET lock_timeout = '2s'
AS $function$
DECLARE
  checks_deleted integer := 0;
  tokens_deleted integer := 0;
  cron_runs_deleted integer := 0;
BEGIN
  IF p_batch_size IS NULL OR p_batch_size < 1 OR p_batch_size > 5000 THEN
    RAISE EXCEPTION 'Batch size must be between 1 and 5000';
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtextextended('maintenance.cleanup_monitoring_data', 0)) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'already_running');
  END IF;

  WITH expired AS (
    SELECT id FROM public.monitor_checks
    WHERE checked_at < now() - interval '180 days'
    ORDER BY checked_at
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.monitor_checks AS checks USING expired
  WHERE checks.id = expired.id;
  GET DIAGNOSTICS checks_deleted = ROW_COUNT;

  -- Expired tokens are unusable. Keep seven additional days for diagnosis.
  WITH expired AS (
    SELECT id FROM public.refresh_tokens
    WHERE expires_at < now() - interval '7 days'
    ORDER BY expires_at
    LIMIT least(p_batch_size, 1000)
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.refresh_tokens AS tokens USING expired
  WHERE tokens.id = expired.id;
  GET DIAGNOSTICS tokens_deleted = ROW_COUNT;

  -- Only clean this routine's completed Cron runs; preserve other jobs' history.
  WITH expired AS (
    SELECT runs.runid FROM cron.job_run_details AS runs
    JOIN cron.job AS jobs ON jobs.jobid = runs.jobid
    WHERE jobs.jobname = 'monitoring-retention-180-days'
      AND runs.end_time < now() - interval '30 days'
    ORDER BY runs.end_time
    LIMIT least(p_batch_size, 1000)
    FOR UPDATE OF runs SKIP LOCKED
  )
  DELETE FROM cron.job_run_details AS runs USING expired
  WHERE runs.runid = expired.runid;
  GET DIAGNOSTICS cron_runs_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'skipped', false,
    'checks_deleted', checks_deleted,
    'refresh_tokens_deleted', tokens_deleted,
    'cron_runs_deleted', cron_runs_deleted
  );
END;
$function$;

REVOKE ALL ON FUNCTION maintenance.cleanup_monitoring_data(integer) FROM PUBLIC, anon, authenticated, service_role;

-- Hourly at minute 17 (independent of the application's uptime and timezone).
-- A maximum of 5,000 checks per run gives capacity for 120,000 expired checks/day.
SELECT cron.schedule(
  'monitoring-retention-180-days',
  '17 * * * *',
  $$SET statement_timeout = '20s'; SET lock_timeout = '2s'; SELECT maintenance.cleanup_monitoring_data();$$
);

-- Keep the job paused until the application no longer deletes at 30 days.
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'monitoring-retention-180-days'),
  active := false
);
-- Activate after disabling the legacy application cleanup and verifying the tests:
-- SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'monitoring-retention-180-days'), active := true);

RESET statement_timeout;
RESET lock_timeout;
