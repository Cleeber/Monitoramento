SET lock_timeout = '3s';
SET statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.get_monitoring_bootstrap(p_monitor_ids uuid[], p_as_of timestamptz)
RETURNS TABLE(monitor_id uuid, samples jsonb, latest_checks jsonb)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $sql$
  SELECT wanted.id,
    coalesce((SELECT jsonb_agg(jsonb_build_array(floor(extract(epoch FROM c.checked_at)*1000)::bigint,
       CASE WHEN c.status='online' THEN 1 ELSE 0 END) ORDER BY c.checked_at)
      FROM public.monitor_checks c WHERE c.monitor_id=wanted.id
        AND c.checked_at >= p_as_of-interval '30 days' AND c.checked_at <= p_as_of), '[]'::jsonb),
    coalesce((SELECT jsonb_agg(to_jsonb(recent) ORDER BY recent.checked_at DESC, recent.id DESC)
      FROM (SELECT id,monitor_id,status,response_time,status_code,error_message,checked_at
        FROM public.monitor_checks WHERE monitor_id=wanted.id
          AND checked_at >= p_as_of-interval '30 days' AND checked_at <= p_as_of
        ORDER BY checked_at DESC,id DESC LIMIT 100) recent), '[]'::jsonb)
  FROM unnest(p_monitor_ids) wanted(id);
$sql$;

CREATE OR REPLACE FUNCTION public.get_monitor_report_metrics(p_monitor_id uuid, p_start timestamptz, p_end timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $sql$
  WITH checks AS MATERIALIZED (
    SELECT id,status,response_time,error_message,checked_at FROM public.monitor_checks
    WHERE monitor_id=p_monitor_id AND checked_at >= p_start AND checked_at <= p_end
  ), ordered AS (
    SELECT *,coalesce(sum(CASE WHEN status='online' THEN 1 ELSE 0 END)
      OVER (ORDER BY checked_at,id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) AS incident_group FROM checks
  ), incidents AS (
    SELECT incident_group,
      min(checked_at) FILTER(WHERE status <> 'online') AS started_at,
      max(checked_at) FILTER(WHERE status <> 'online') AS last_failure_at,
      min(checked_at) FILTER(WHERE status = 'online') AS resolved_at,
      (array_agg(error_message ORDER BY checked_at,id) FILTER(WHERE status <> 'online'))[1] AS message
    FROM ordered GROUP BY incident_group HAVING bool_or(status <> 'online')
  ), days AS (
    SELECT to_char(checked_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS date,
      count(*) AS total,count(*) FILTER(WHERE status='online') AS successful
    FROM checks GROUP BY 1
  )
  SELECT jsonb_build_object(
    'total_checks',count(*),
    'successful_checks',count(*) FILTER(WHERE status='online'),
    'failed_checks',count(*) FILTER(WHERE status <> 'online'),
    'warning_checks',count(*) FILTER(WHERE status='warning'),
    'offline_checks',count(*) FILTER(WHERE status='offline'),
    'uptime',coalesce(100.0*count(*) FILTER(WHERE status='online')/nullif(count(*),0),0),
    'response_time_samples',count(response_time) FILTER(WHERE status='online' AND response_time>0),
    'total_response_time',coalesce(sum(response_time) FILTER(WHERE status='online' AND response_time>0),0),
    'avg_response_time',coalesce(avg(response_time) FILTER(WHERE status='online' AND response_time>0),0),
    'min_response_time',coalesce(min(response_time) FILTER(WHERE status='online' AND response_time>0),0),
    'max_response_time',coalesce(max(response_time) FILTER(WHERE status='online' AND response_time>0),0),
    'incidents',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'date',to_char(started_at AT TIME ZONE 'UTC','YYYY-MM-DD'),'status','down',
      'duration',floor(extract(epoch FROM (coalesce(resolved_at,p_end)-started_at))/60+0.5),
      'message',message) ORDER BY started_at) FROM incidents),'[]'::jsonb),
    'daily',coalesce((SELECT jsonb_agg(jsonb_build_object('date',date,'total',total,
      'successful',successful,'uptime',round(100.0*successful/nullif(total,0),2)) ORDER BY date) FROM days),'[]'::jsonb)
  ) FROM checks;
$sql$;

REVOKE ALL ON FUNCTION public.get_monitoring_bootstrap(uuid[],timestamptz),
  public.get_monitor_report_metrics(uuid,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_monitoring_bootstrap(uuid[],timestamptz),
  public.get_monitor_report_metrics(uuid,timestamptz,timestamptz) TO service_role;

-- Equivalent indexes remain (including the UNIQUE constraints). PostgreSQL
-- rejects DROP if an unexpected dependent constraint exists; no CASCADE.
DROP INDEX IF EXISTS public.idx_monthly_report_configs_is_active;
DROP INDEX IF EXISTS public.idx_users_email;
DROP INDEX IF EXISTS public.idx_monitors_slug;

-- Trigger maintenance earlier as the retained table grows; no VACUUM FULL.
ALTER TABLE public.monitor_checks SET (autovacuum_vacuum_scale_factor=0.05,
  autovacuum_analyze_scale_factor=0.02);
ANALYZE public.monitor_checks;
RESET statement_timeout;
RESET lock_timeout;
