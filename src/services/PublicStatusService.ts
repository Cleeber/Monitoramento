import { databaseService } from './DatabaseService.js'
import type MonitoringService from '../monitoring/MonitoringService.js'

export interface PublicStatusMonitor {
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

export interface PublicStatusIncident {
  id: string
  monitor_name: string
  status: 'resolved' | 'investigating' | 'identified'
  title: string
  description: string
  started_at: string
  resolved_at: string | null
}

export interface PublicStatusReport {
  monitors: PublicStatusMonitor[]
  lastUpdated: string
  history: Array<{ date: string; uptime: number }>
  incidents: PublicStatusIncident[] | null
  averageResponse: number | null
  partial: boolean
}

export interface Check {
  id: string
  status: string
  response_time?: number | null
  error_message?: string | null
  checked_at: string
}

export class PublicStatusService {
  private monitoringService: MonitoringService | null = null

  setMonitoringService(service: MonitoringService) {
    this.monitoringService = service
  }

  async getReport(slug: string): Promise<PublicStatusReport | null> {
    const now = new Date()
    const lastUpdated = now.toISOString()
    const historyStart = new Date(now.getTime() - 30 * 86_400_000)
    const monitors = await this.resolveMonitors(slug)
    if (!monitors) return null

    const historyByDate = new Map<string, { total: number; successful: number }>()
    const incidents: PublicStatusIncident[] = []
    let partial = false
    let responseTotal = 0
    let responseChecks = 0

    for (let offset = 0; offset < monitors.length; offset += 4) {
      const batch = monitors.slice(offset, offset + 4)
      const details = await Promise.all(batch.map(async monitor => {
        let historyResult: PromiseSettledResult<Check[]>
        try {
          historyResult = {
            status: 'fulfilled',
            value: await databaseService.getMonitorChecksForPeriod(monitor.id, historyStart, now) as Check[],
          }
        } catch (reason) {
          historyResult = { status: 'rejected', reason }
        }
        return { monitor, historyResult }
      }))

      for (const { monitor, historyResult } of details) {
        if (historyResult.status === 'fulfilled') {
          const checks = historyResult.value
          this.addHistory(historyByDate, checks)
          const successfulChecks = checks.filter(check => check.status === 'online').length
          monitor.total_checks = checks.length
          monitor.successful_checks = successfulChecks
          monitor.uptime_30d = checks.length ? (successfulChecks / checks.length) * 100 : null
          if (checks.length === 0) partial = true

          const sevenDayStart = new Date(now.getTime() - 7 * 86_400_000)
          const dayChecks = checks.filter(check => new Date(check.checked_at).getTime() >= sevenDayStart.getTime())
          const daySuccesses = dayChecks.filter(check => check.status === 'online').length
          monitor.uptime_7d = dayChecks.length ? (daySuccesses / dayChecks.length) * 100 : null

          const oneDayStart = new Date(now.getTime() - 86_400_000)
          const recentChecks = checks.filter(check => new Date(check.checked_at).getTime() >= oneDayStart.getTime())
          const recentSuccesses = recentChecks.filter(check => check.status === 'online').length
          monitor.uptime_24h = recentChecks.length ? (recentSuccesses / recentChecks.length) * 100 : null

          incidents.push(...this.getIncidents(monitor, checks))
          const responseTimes = historyResult.value
            .filter(check => check.status === 'online')
            .map(check => Number(check.response_time))
            .filter(responseTime => Number.isFinite(responseTime) && responseTime > 0)
          responseTotal += responseTimes.reduce((sum, value) => sum + value, 0)
          responseChecks += responseTimes.length
        } else {
          partial = true
        }
      }
    }

    const history = [...historyByDate]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, counts]) => ({
        date,
        uptime: Number(((counts.successful / counts.total) * 100).toFixed(2)),
      }))

    return {
      monitors,
      lastUpdated,
      history,
      incidents: partial ? null : incidents.sort((left, right) => right.started_at.localeCompare(left.started_at)),
      averageResponse: !partial && responseChecks > 0 ? Math.round(responseTotal / responseChecks) : null,
      partial,
    }
  }

  private async resolveMonitors(slug: string): Promise<PublicStatusMonitor[] | null> {
    let monitors: any[]
    if (slug === 'all') {
      monitors = (await databaseService.getMonitors()).filter((monitor: any) => monitor.is_active === true)
    } else {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)
      let monitor: any
      try {
        monitor = isUuid
          ? await databaseService.getMonitorById(slug)
          : await databaseService.getMonitorBySlug(slug)
      } catch (error) {
        if ((error as { code?: string }).code === 'PGRST116') return null
        throw error
      }
      if (!monitor || monitor.is_active !== true) return null
      monitors = [monitor]
    }

    return monitors.map(monitor => {
      const live = this.monitoringService?.getMonitor(monitor.id)
      return {
        id: monitor.id,
        name: monitor.name,
        url: monitor.url,
        logo_url: monitor.logo_url ?? null,
        status: live?.status ?? monitor.status ?? 'unknown',
        last_check: live ? live.last_check : monitor.last_check ?? null,
        response_time: live ? live.response_time : monitor.response_time ?? null,
        uptime_24h: null,
        uptime_7d: null,
        uptime_30d: null,
        total_checks: 0,
        successful_checks: 0,
      }
    })
  }

  private addHistory(historyByDate: Map<string, { total: number; successful: number }>, checks: Check[]) {
    for (const check of checks) {
      const date = check.checked_at.slice(0, 10)
      const counts = historyByDate.get(date) ?? { total: 0, successful: 0 }
      counts.total += 1
      if (check.status === 'online') counts.successful += 1
      historyByDate.set(date, counts)
    }
  }

  private getIncidents(monitor: PublicStatusMonitor, checks: Check[]): PublicStatusIncident[] {
    const incidents: PublicStatusIncident[] = []
    let current: PublicStatusIncident | null = null

    const chronologicalChecks = [...checks].sort((left, right) =>
      left.checked_at.localeCompare(right.checked_at) || left.id.localeCompare(right.id),
    )
    for (const check of chronologicalChecks) {
      if (check.status !== 'online') {
        if (!current) {
          current = {
            id: `${monitor.id}-inc-${check.id}`,
            monitor_name: monitor.name,
            status: 'investigating',
            title: check.status === 'offline' ? 'Serviço indisponível' : 'Latência alta',
            description: check.error_message || 'Falha na verificação',
            started_at: check.checked_at,
            resolved_at: check.checked_at,
          }
        }
      } else if (current) {
        current.resolved_at = check.checked_at
        current.status = 'resolved'
        incidents.push(current)
        current = null
      }
    }

    if (current) {
      current.status = 'investigating'
      current.resolved_at = null
      incidents.push(current)
    }
    return incidents
  }
}

export const publicStatusService = new PublicStatusService()
