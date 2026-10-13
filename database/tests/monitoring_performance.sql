-- Fixtures and assertions are rolled back by the final exception.
DO $test$
DECLARE
  monitor uuid := gen_random_uuid();
  empty_monitor uuid := gen_random_uuid();
  metrics jsonb;
  bootstrap record;
  moment timestamptz := '2026-10-13T12:00:00Z';
BEGIN
  INSERT INTO public.monitors(id,name,url,is_active) VALUES
    (monitor,'Performance fixture','https://performance-fixture.example.test',false),
    (empty_monitor,'Empty fixture','https://empty-fixture.example.test',false);
  INSERT INTO public.monitor_checks(id,monitor_id,status,response_time,checked_at,error_message)
  SELECT gen_random_uuid(),monitor,status,response_time,moment + delta,error_message FROM (VALUES
    ('online',100,interval '-31 days',null::text),
    ('online',100,interval '-30 days',null),
    ('online',100,interval '-20 minutes',null),
    ('offline',999,interval '-15 minutes','first failure'),
    ('warning',999,interval '-10 minutes','warning'),
    ('online',200,interval '-5 minutes',null),
    ('offline',null,interval '-2 minutes','open failure'),
    ('online',100,interval '1 second',null)
  ) fixture(status,response_time,delta,error_message);

  metrics := public.get_monitor_report_metrics(monitor,moment-interval '25 minutes',moment);
  IF metrics->>'total_checks' <> '5' OR metrics->>'successful_checks' <> '2'
    OR metrics->>'failed_checks' <> '3' OR metrics->>'warning_checks' <> '1'
    OR metrics->>'offline_checks' <> '2' OR metrics->>'response_time_samples' <> '2'
    OR metrics->>'total_response_time' <> '300' OR (metrics->>'avg_response_time')::numeric <> 150
    OR (metrics->>'uptime')::numeric <> 40 THEN
    RAISE EXCEPTION 'Unexpected metrics: %', metrics;
  END IF;
  IF jsonb_array_length(metrics->'incidents') <> 2
    OR metrics#>>'{incidents,0,duration}' <> '10'
    OR metrics#>>'{incidents,0,message}' <> 'first failure'
    OR metrics#>>'{incidents,1,duration}' <> '2'
    OR metrics#>>'{daily,0,total}' <> '5' THEN
    RAISE EXCEPTION 'Unexpected incident/day aggregates: %',metrics;
  END IF;
  metrics := public.get_monitor_report_metrics(empty_monitor,moment-interval '30 days',moment);
  IF metrics->>'total_checks' <> '0' OR metrics->>'uptime' <> '0'
    OR metrics->'incidents' <> '[]'::jsonb OR metrics->'daily' <> '[]'::jsonb THEN
    RAISE EXCEPTION 'Empty monitor fabricated metrics: %',metrics;
  END IF;
  SELECT * INTO bootstrap FROM public.get_monitoring_bootstrap(ARRAY[monitor],moment);
  IF jsonb_array_length(bootstrap.samples) <> 6 OR jsonb_array_length(bootstrap.latest_checks) <> 6
    OR bootstrap.samples#>>'{0,1}' <> '1' THEN
    RAISE EXCEPTION 'Bootstrap included old/future samples or missed the cutoff';
  END IF;
  INSERT INTO public.monitor_checks(id,monitor_id,status,checked_at)
  SELECT gen_random_uuid(),monitor,'online',moment - i*interval '1 second' FROM generate_series(1,150) i;
  SELECT * INTO bootstrap FROM public.get_monitoring_bootstrap(ARRAY[monitor],moment);
  IF jsonb_array_length(bootstrap.latest_checks) <> 100 OR jsonb_array_length(bootstrap.samples) <> 156 THEN
    RAISE EXCEPTION 'Compact bootstrap must preserve all samples but cap full records';
  END IF;
  IF has_function_privilege('anon','public.get_monitor_report_metrics(uuid,timestamptz,timestamptz)','EXECUTE')
    OR has_function_privilege('authenticated','public.get_monitoring_bootstrap(uuid[],timestamptz)','EXECUTE') THEN
    RAISE EXCEPTION 'New RPC is accessible to client roles';
  END IF;
  RAISE EXCEPTION 'PERFORMANCE_TEST_PASSED_ROLLED_BACK';
END;
$test$;
