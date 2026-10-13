-- Application authentication happens in the backend. Browsers use /api/public/*
-- for status pages; neither anon nor authenticated needs direct table access.
SET lock_timeout = '3s';
SET statement_timeout = '30s';

ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role all on refresh_tokens" ON public.refresh_tokens;
CREATE POLICY "service_role all on refresh_tokens" ON public.refresh_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on monthly_report_configs" ON public.monthly_report_configs;
DROP POLICY IF EXISTS "Allow all operations on monthly_report_history" ON public.monthly_report_history;
DROP POLICY IF EXISTS "anon read monitors public fields" ON public.monitors;
DROP POLICY IF EXISTS "anon read checks of active monitors" ON public.monitor_checks;

REVOKE ALL ON TABLE public.users, public.smtp_config, public.monitors,
  public.monitor_checks, public.reports, public.monthly_report_configs,
  public.monthly_report_history, public.refresh_tokens
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users, public.smtp_config,
  public.monitors, public.monitor_checks, public.reports,
  public.monthly_report_configs, public.monthly_report_history, public.refresh_tokens
TO service_role;

-- Do not reintroduce broad grants when the backend creates a missing table.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

-- Keep the compatibility RPC backend-only, without elevated execution.
ALTER FUNCTION public.cleanup_expired_refresh_tokens() SECURITY INVOKER;

-- Restrict application functions and pin their lookup paths. Extension-owned
-- functions are excluded: their ownership and schema are managed by Supabase.
DO $functions$
DECLARE
  application_function record;
BEGIN
  FOR application_function IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND p.proowner = (SELECT oid FROM pg_roles WHERE rolname = 'postgres')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public, extensions', application_function.signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', application_function.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', application_function.signature);
  END LOOP;
END;
$functions$;

RESET statement_timeout;
RESET lock_timeout;
