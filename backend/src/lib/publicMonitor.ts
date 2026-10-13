/** Explicit public fields: never spread internal monitor settings into a response. */
export function publicMonitor(monitor: Record<string, any>, live?: Record<string, any> | null) {
  return {
    id: monitor.id,
    name: monitor.name,
    url: monitor.url,
    type: monitor.type,
    slug: monitor.slug,
    logo_url: monitor.logo_url,
    is_active: monitor.is_active,
    enabled: monitor.is_active,
    status: live?.status ?? monitor.status ?? 'unknown',
    last_check: live?.last_check ?? monitor.last_check,
    response_time: live?.response_time ?? monitor.response_time,
    uptime_24h: live?.uptime_24h ?? monitor.uptime_24h ?? 0,
    uptime_7d: live?.uptime_7d ?? monitor.uptime_7d ?? 0,
    uptime_30d: live?.uptime_30d ?? monitor.uptime_30d ?? 0,
  }
}

export async function findActivePublicMonitor(
  database: { getMonitorById(id: string): Promise<any> },
  id: unknown
) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null
  }
  try {
    const monitor = await database.getMonitorById(id)
    return monitor?.is_active === true ? monitor : null
  } catch (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null
    throw error
  }
}
