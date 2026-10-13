export interface PublicMonitor {
  id: string
  name: string
  url: string
  logo_url?: string | null
  status: 'online' | 'offline' | 'warning' | 'unknown'
  last_check: string | null
  response_time: number | null
  uptime_24h: number
  uptime_7d: number
  uptime_30d: number
}

export interface PublicIncident {
  id: string
  monitor_name: string
  status: 'resolved' | 'investigating' | 'identified'
  title: string
  description: string
  started_at: string
  resolved_at: string | null
}

interface MonitorStats {
  totalChecks: number
  successfulChecks: number
  failedChecks: number
  avgResponseTime: number
}

export interface UptimePoint { date: string; uptime: number }

export interface PublicReport {
  monitors: PublicMonitor[]
  lastUpdated: string
  history: UptimePoint[]
  incidents: PublicIncident[] | null
  averageResponse: number | null
  partial: boolean
}

async function getPublicData<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal })
  if (!response.ok) {
    throw new Error(response.status === 404
      ? 'Página de status não encontrada.'
      : 'Não foi possível atualizar os dados. Tente novamente em instantes.')
  }
  return response.json() as Promise<T>
}

export async function loadPublicReport(slug: string | undefined, signal: AbortSignal): Promise<PublicReport> {
  const path = !slug || slug === 'all' ? 'all' : `monitor/${encodeURIComponent(slug)}`
  const status = await getPublicData<{ monitors: PublicMonitor[]; last_updated: string }>(
    `/api/public/status/${path}`, signal,
  )
  const historyByDate = new Map<string, number[]>()
  const incidents: PublicIncident[] = []
  let incidentFailure = false
  let partial = false
  let responseTotal = 0
  let responseChecks = 0

  // Limit concurrent requests for the overview, which may include many monitors.
  for (let offset = 0; offset < status.monitors.length; offset += 4) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    const details = await Promise.all(status.monitors.slice(offset, offset + 4).map(async monitor => {
      const id = encodeURIComponent(monitor.id)
      const [history, occurrences, stats] = await Promise.allSettled([
        getPublicData<UptimePoint[]>(`/api/public/uptime-history?monitor_id=${id}&days=30`, signal),
        getPublicData<PublicIncident[]>(`/api/public/incidents?monitor_id=${id}&limit=50`, signal),
        getPublicData<MonitorStats>(`/api/public/monitor-stats/${id}`, signal),
      ])
      return { monitor, history, occurrences, stats }
    }))

    for (const { monitor, history, occurrences, stats } of details) {
      if (history.status === 'fulfilled') {
        for (const point of history.value) {
          if (!Number.isFinite(point.uptime)) continue
          const values = historyByDate.get(point.date) ?? []
          values.push(point.uptime)
          historyByDate.set(point.date, values)
        }
      } else partial = true

      if (occurrences.status === 'fulfilled') {
        incidents.push(...occurrences.value.map(incident => ({
          ...incident, id: `${monitor.id}-${incident.id}`, monitor_name: monitor.name,
        })))
      } else {
        incidentFailure = true
        partial = true
      }

      if (stats.status === 'fulfilled' && stats.value.successfulChecks > 0 && Number.isFinite(stats.value.avgResponseTime)) {
        responseTotal += stats.value.avgResponseTime * stats.value.successfulChecks
        responseChecks += stats.value.successfulChecks
      } else if (stats.status === 'rejected') partial = true
    }
  }

  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  const periodStart = new Date(status.last_updated).getTime() - 30 * 86_400_000
  return {
    monitors: status.monitors,
    lastUpdated: status.last_updated,
    history: [...historyByDate].sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => ({
      date, uptime: values.reduce((sum, value) => sum + value, 0) / values.length,
    })),
    incidents: incidentFailure ? null : incidents.filter(incident =>
      new Date(incident.resolved_at ?? status.last_updated).getTime() >= periodStart,
    ).sort((a, b) => b.started_at.localeCompare(a.started_at)),
    averageResponse: responseChecks > 0 ? Math.round(responseTotal / responseChecks) : null,
    partial,
  }
}

export function incidentDuration(incident: PublicIncident, now: string): number | null {
  const start = new Date(incident.started_at).getTime()
  const end = new Date(incident.resolved_at ?? now).getTime()
  // The legacy API sometimes sends the check timestamp as both start and end.
  // That placeholder is not evidence of a zero-duration, resolved incident.
  if (incident.resolved_at && end === start) return null
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : null
}

export function reportDuration(milliseconds: number): string {
  if (milliseconds === 0) return '0 min'
  if (milliseconds < 60_000) return '< 1 min'
  const minutes = Math.round(milliseconds / 60_000)
  if (minutes < 60) return `${minutes} min`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`
  return `${Math.floor(minutes / 1440)} d ${Math.floor((minutes % 1440) / 60)} h`
}

export function reportDomain(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}
