-- Run with scripts/supabase-sql.mjs --rollback-test.
-- Verify grants (including TRUNCATE, which RLS does not restrict), policies,
-- functions, monitor slug triggers, report writes and the existing Cron schedule.
DO $test$
DECLARE
  table_name text;
  api_role text;
  privilege text;
  monitor uuid := gen_random_uuid();
  config uuid := gen_random_uuid();
BEGIN
  FOREACH table_name IN ARRAY ARRAY['users','smtp_config','monitors','monitor_checks',
    'reports','monthly_report_configs','monthly_report_history','refresh_tokens'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || table_name)::regclass) THEN
      RAISE EXCEPTION 'RLS disabled on %', table_name;
    END IF;
    FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      FOREACH privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
        IF has_table_privilege(api_role, 'public.' || table_name, privilege) THEN
          RAISE EXCEPTION '% can % on %', api_role, privilege, table_name;
        END IF;
      END LOOP;
      IF has_any_column_privilege(api_role, 'public.' || table_name, 'SELECT,INSERT,UPDATE,REFERENCES') THEN
        RAISE EXCEPTION 'Unexpected column grant for % on %', api_role, table_name;
      END IF;
    END LOOP;
    FOREACH privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
      IF NOT has_table_privilege('service_role','public.' || table_name,privilege) THEN
        RAISE EXCEPTION 'Backend % privilege missing on %', privilege, table_name;
      END IF;
    END LOOP;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres')
      AND (has_function_privilege('anon',p.oid,'EXECUTE')
        OR has_function_privilege('authenticated',p.oid,'EXECUTE')
        OR NOT coalesce(p.proconfig @> ARRAY['search_path=pg_catalog, public, extensions'],false))
  ) THEN RAISE EXCEPTION 'An application function is public or has a mutable lookup path'; END IF;

  IF (SELECT prosecdef FROM pg_proc WHERE oid='public.cleanup_expired_refresh_tokens()'::regprocedure) THEN
    RAISE EXCEPTION 'Expired-token compatibility function still elevates privileges';
  END IF;
  IF NOT has_function_privilege('service_role','public.exec_sql(text)','EXECUTE') THEN
    RAISE EXCEPTION 'Administrative access was lost';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename IN ('monthly_report_configs','monthly_report_history','monitors','monitor_checks')
    AND roles && ARRAY['public','anon','authenticated']::name[]) THEN
    RAISE EXCEPTION 'A client policy remains on backend-only tables';
  END IF;

  INSERT INTO public.monitors(id,name,url,is_active)
  VALUES (monitor,'Segurança','https://security-fixture.example.test',false);
  IF NOT EXISTS (SELECT 1 FROM public.monitors WHERE id=monitor AND slug IS NOT NULL) THEN
    RAISE EXCEPTION 'Monitor slug trigger failed';
  END IF;
  IF public.generate_slug('Segurança') <> 'seguranca' THEN
    RAISE EXCEPTION 'Accent removal failed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
    WHERE e.extname='unaccent' AND n.nspname='extensions') THEN
    RAISE EXCEPTION 'unaccent must be outside the exposed public schema';
  END IF;
  INSERT INTO public.monthly_report_configs(id,monitor_id,email,send_day)
  VALUES (config,monitor,'security-fixture@example.test',1);
  UPDATE public.monthly_report_configs SET send_day=2 WHERE id=config;
  DELETE FROM public.monthly_report_configs WHERE id=config;
  DELETE FROM public.monitors WHERE id=monitor;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='monitoring-retention-180-days'
    AND active AND schedule='17 5 * * *') THEN RAISE EXCEPTION 'Daily cleanup changed'; END IF;

  RAISE EXCEPTION 'SECURITY_TEST_PASSED_ROLLED_BACK';
END;
$test$;
