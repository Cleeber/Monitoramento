export interface PublicMonitor {
  id: string
  name: string
  url: string
  logo_url?: string | null
  status: 'online' | 'offline' | 'warning' | 'unknown'
  last_check: string | null
  response_time: number | null
  uptime_24h: number | null
  uptime_7d: number | null
  uptime_30d: number | null
  total_checks: number
  successful_checks: number
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
  const reportSlug = !slug ? 'all' : slug
  return getPublicData<PublicReport>(`/api/public/status-report/${encodeURIComponent(reportSlug)}`, signal)
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
