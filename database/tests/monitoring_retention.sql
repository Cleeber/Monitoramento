-- Run only through scripts/supabase-sql.mjs with --rollback-test.
-- The final exception rolls back ALL writes, including deleted real expired tokens.
DO $test$
DECLARE
  monitor uuid;
  app_user uuid;
  old_one uuid := gen_random_uuid();
  old_two uuid := gen_random_uuid();
  recent uuid := gen_random_uuid();
  boundary uuid := gen_random_uuid();
  undated uuid := gen_random_uuid();
  old_token uuid := gen_random_uuid();
  valid_token uuid := gen_random_uuid();
  old_run bigint;
  running_run bigint;
  result jsonb;
BEGIN
  SELECT id INTO STRICT monitor FROM public.monitors LIMIT 1;
  SELECT id INTO STRICT app_user FROM public.users LIMIT 1;

  INSERT INTO public.monitor_checks(id, monitor_id, status, checked_at) VALUES
    (old_one, monitor, 'online', timestamptz '2000-01-01 00:00:00+00'),
    (old_two, monitor, 'offline', timestamptz '2000-01-02 00:00:00+00'),
    (recent, monitor, 'online', now() - interval '179 days'),
    (boundary, monitor, 'online', now() - interval '180 days'),
    (undated, monitor, 'online', null);

  INSERT INTO public.refresh_tokens(id, user_id, token_hash, expires_at) VALUES
    (old_token, app_user, old_token::text, timestamptz '2000-01-01 00:00:00+00'),
    (valid_token, app_user, valid_token::text, now() + interval '1 day');

  -- Use unused negative IDs without touching the scheduler's protected sequence.
  SELECT least(coalesce(min(runid), 0), 0) - 1 INTO old_run FROM cron.job_run_details;
  running_run := old_run - 1;
  INSERT INTO cron.job_run_details(runid, jobid, status, start_time, end_time)
  SELECT old_run, jobid, 'succeeded', now() - interval '41 days', now() - interval '40 days'
  FROM cron.job WHERE jobname = 'monitoring-retention-180-days'
  RETURNING runid INTO STRICT old_run;
  INSERT INTO cron.job_run_details(runid, jobid, status, start_time)
  SELECT running_run, jobid, 'running', now() - interval '41 days'
  FROM cron.job WHERE jobname = 'monitoring-retention-180-days'
  RETURNING runid INTO STRICT running_run;

  result := maintenance.cleanup_monitoring_data(1);
  IF result->>'checks_deleted' <> '1' THEN
    RAISE EXCEPTION 'Cleanup exceeded or failed the one-row batch limit: %', result;
  END IF;
  IF EXISTS (SELECT 1 FROM public.monitor_checks WHERE id = old_one)
     OR NOT EXISTS (SELECT 1 FROM public.monitor_checks WHERE id = old_two) THEN
    RAISE EXCEPTION 'Oldest-first deletion failed';
  END IF;
  IF (SELECT count(*) FROM public.monitor_checks WHERE id IN (recent, boundary, undated)) <> 3 THEN
    RAISE EXCEPTION 'Recent, boundary, or undated checks were removed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.refresh_tokens WHERE id = old_token)
     OR NOT EXISTS (SELECT 1 FROM public.refresh_tokens WHERE id = valid_token) THEN
    RAISE EXCEPTION 'Expired-token retention failed';
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job_run_details WHERE runid = old_run)
     OR NOT EXISTS (SELECT 1 FROM cron.job_run_details WHERE runid = running_run) THEN
    RAISE EXCEPTION 'Cron history cleanup removed a running job or kept an expired completed run';
  END IF;

  BEGIN
    PERFORM maintenance.cleanup_monitoring_data(0);
    RAISE EXCEPTION 'Invalid batch size was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Batch size must be between 1 and 5000' THEN RAISE; END IF;
  END;
  IF has_function_privilege('anon', 'maintenance.cleanup_monitoring_data(integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'maintenance.cleanup_monitoring_data(integer)', 'EXECUTE')
     OR has_function_privilege('service_role', 'maintenance.cleanup_monitoring_data(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Maintenance is accessible to an API role';
  END IF;

  RAISE EXCEPTION 'RETENTION_TEST_PASSED_ROLLED_BACK';
END;
$test$;
