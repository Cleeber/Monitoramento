import { useState, useEffect, useCallback, useRef } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Download, Mail, Activity, TrendingUp, Clock, AlertTriangle, PieChart } from 'lucide-react'
import { PeriodFilter, DEFAULT_TIME_RANGE } from '@/components/shared/PeriodFilter'
import { calculatePeriodRange, getPeriodLabel } from '@/utils/periodUtils'
import { toast } from 'sonner'
import { apiGet, apiPost } from '@/utils/apiUtils'
// Geração de PDF é feita no backend (pdfkit); nada de html2pdf no frontend.
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import { normalizeChecksArray } from '@/lib/adapters/monitorChecksAdapter'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
)


interface Monitor {
  id: string
  name: string
  url: string
  status: string
  is_active: boolean
  slug?: string
}

interface Report {
  monitor_id: string
  monitor_name: string
  uptime_percentage: number | null
  total_checks: number
  successful_checks: number
  failed_checks: number
  warning_checks: number
  offline_checks: number
  response_time_samples: number
  avg_response_time: number | null
  min_response_time: number | null
  max_response_time: number | null
  incidents: number
  last_incident?: string
}

interface MonitorCheck {
  id: string
  monitor_id: string
  status: string
  response_time: number | null
  checked_at: string
  error_message?: string
}

interface OverallStats {
  total_checks: number
  total_incidents: number
  successful_checks: number
  failed_checks: number
  avg_uptime: number
  response_time_samples: number
  avg_response_time: number
  partial: boolean
}

interface ChartData {
  labels: string[]
  datasets: any[]
}

type TimeRange = '24h' | '7d' | '30d'

function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [selectedMonitor, setSelectedMonitor] = useState<string>('all')
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>(DEFAULT_TIME_RANGE as TimeRange)
  const [monitorChecks, setMonitorChecks] = useState<MonitorCheck[]>([])
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [checksLoading, setChecksLoading] = useState(false)
  const [checksError, setChecksError] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const reportsRequestRef = useRef(0)
  const checksRequestRef = useRef(0)

  const fetchReports = useCallback(async () => {
    const requestId = ++reportsRequestRef.current
    try {
      setLoading(true)
      const periodRange = calculatePeriodRange(selectedTimeRange)
      
      const params = new URLSearchParams({
        start_date: periodRange.startDate.toISOString(),
        end_date: periodRange.endDate.toISOString()
      })
      
      if (selectedMonitor !== 'all') {
        params.append('monitor_id', selectedMonitor)
      }
      
      const result = await apiGet(`/reports?${params}`)
      if (!result.success) {
        throw new Error(result.error || 'Erro ao carregar relatórios')
      }
      if (requestId !== reportsRequestRef.current) return
      
      setReports(result.data.reports || [])
      setOverallStats(result.data.overall_stats || null)
    } catch (error) {
      if (requestId !== reportsRequestRef.current) return
      console.error('Erro ao carregar relatórios:', error)
      setReports([])
      setOverallStats(null)
      toast.error('Erro ao carregar relatórios')
    } finally {
      if (requestId === reportsRequestRef.current) setLoading(false)
    }
  }, [selectedMonitor, selectedTimeRange])

  const fetchMonitors = useCallback(async () => {
    try {
      const result = await apiGet('/monitors')
      if (!result.success) {
        throw new Error(result.error || 'Erro ao carregar monitores')
      }
      
      setMonitors(result.data)
      
      // Começar por um monitor que também tenha página pública de status.
      if (result.data.length > 0) {
        const defaultMonitor = result.data.find((monitor: Monitor) => monitor.is_active) || result.data[0]
        setSelectedMonitor(current => current === 'all' ? defaultMonitor.id : current)
      }
    } catch (error) {
      console.error('Erro ao carregar monitores:', error)
      toast.error('Erro ao carregar monitores')
    }
  }, [])

  const fetchMonitorChecks = useCallback(async () => {
    const requestId = ++checksRequestRef.current
    if (selectedMonitor === 'all') {
      setMonitorChecks([])
      setChecksLoading(false)
      setChecksError(false)
      return
    }
    
    try {
      setChecksLoading(true)
      setChecksError(false)
      const periodRange = calculatePeriodRange(selectedTimeRange)
      
      const params = new URLSearchParams({
        monitor_id: selectedMonitor,
        start_date: periodRange.startDate.toISOString(),
        end_date: periodRange.endDate.toISOString()
      })
      
      const result = await apiGet(`/monitor-checks?${params}`)
      if (!result.success) {
        throw new Error(result.error || 'Erro ao carregar verificações do monitor')
      }
      if (requestId !== checksRequestRef.current) return
      
      const normalized = normalizeChecksArray(result.data)
      setMonitorChecks(normalized)
    } catch (error) {
      if (requestId !== checksRequestRef.current) return
      console.error('Erro ao carregar verificações do monitor:', error)
      setMonitorChecks([])
      setChecksError(true)
      toast.error('Erro ao carregar verificações do monitor')
    } finally {
      setChecksLoading(false)
    }
  }, [selectedMonitor, selectedTimeRange])

  useEffect(() => {
    void fetchMonitors()
  }, [fetchMonitors])

  useEffect(() => {
    void fetchReports()
    void fetchMonitorChecks()
  }, [fetchReports, fetchMonitorChecks])

  const handleExport = async () => {
    if (selectedMonitor === 'all') {
      toast.error('Selecione um monitor específico para exportar PDF')
      return
    }

    try {
      setExporting(true)
      
      const monitor = monitors.find(m => m.id === selectedMonitor)
      if (!monitor) throw new Error('Monitor não encontrado')

      const periodRange = calculatePeriodRange(selectedTimeRange)
      const params = new URLSearchParams({
        start_date: periodRange.startDate.toISOString(),
        end_date: periodRange.endDate.toISOString(),
      })
      const response = await fetch(`/api/pdf/monthly-report/${encodeURIComponent(monitor.id)}?${params}`, {
        credentials: 'same-origin',
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Erro ao gerar PDF: ${errorText}`)
      }

      // Criar blob e link para download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const fileMonitor = (monitor.slug || monitor.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-]+/g, '-')
      a.download = `relatorio-${fileMonitor}-${selectedTimeRange}-${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
      
      toast.success('Relatório exportado com sucesso!')
    } catch (error) {
      console.error('Erro ao exportar relatório:', error)
      toast.error('Erro ao gerar PDF')
    } finally {
      setExporting(false)
    }
  }

  const handleSendEmail = async () => {
    if (selectedMonitor === 'all') {
      toast.error('Selecione um monitor específico para enviar por e-mail')
      return
    }
    
    try {
      setSendingEmail(true)
      
      // Obter e-mail configurado para o relatório mensal do monitor
      const configResult = await apiGet(`/monthly-reports/configs/monitor/${selectedMonitor}`)
      if (!configResult.success || !configResult.data || !configResult.data.email) {
        throw new Error(configResult.error || 'E-mail do relatório mensal não configurado para este monitor')
      }
      
      const email = configResult.data.email as string
      
      const result = await apiPost('/reports/send-monthly', {
        monitor_id: selectedMonitor,
        email,
        includePdf: true,
        forceDynamic: true
      })
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao enviar e-mail')
      }
      
      toast.success('Status público dos últimos 30 dias enviado por e-mail!')
    } catch (error) {
      console.error('Erro ao enviar e-mail:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar relatório por e-mail')
    } finally {
      setSendingEmail(false)
    }
  }

  const getUptimeColor = (uptime: number | null) => {
    if (uptime === null || !Number.isFinite(uptime)) return 'text-muted-foreground'
    if (uptime >= 99) return 'text-green-600'
    if (uptime >= 95) return 'text-yellow-600'
    return 'text-red-600'
  }

  const calculateOverallStats = () => {
    if (!overallStats) return null

    return {
      totalChecks: overallStats.total_checks,
      totalSuccessful: overallStats.successful_checks,
      totalIncidents: overallStats.total_incidents,
      avgUptime: overallStats.avg_uptime,
      avgResponseTime: overallStats.avg_response_time,
      responseTimeSamples: overallStats.response_time_samples,
      partial: overallStats.partial,
      monitorsCount: selectedMonitor !== 'all' ? 1 : reports.length
    }
  }

  const generateUptimeChartData = (): ChartData => {
    if (selectedMonitor === 'all') {
      const labels = reports.map(report => report.monitor_name)
      return {
        labels,
        datasets: [
          {
            label: 'Uptime (%)',
            data: reports.map(report => report.uptime_percentage),
            backgroundColor: reports.map(report => 
              report.uptime_percentage == null ? '#6b7280' : report.uptime_percentage >= 99 ? '#10b981' :
              report.uptime_percentage >= 95 ? '#f59e0b' : '#ef4444'
            ),
            borderColor: reports.map(report => 
              report.uptime_percentage == null ? '#4b5563' : report.uptime_percentage >= 99 ? '#059669' :
              report.uptime_percentage >= 95 ? '#d97706' : '#dc2626'
            ),
            borderWidth: 1,
          },
        ],
      }
    } else {
      const dailyData: { [key: string]: { total: number, successful: number } } = {}
      
      monitorChecks.forEach(check => {
        const day = new Date(check.checked_at).toISOString().slice(0, 10)
        if (!dailyData[day]) {
          dailyData[day] = { total: 0, successful: 0 }
        }
        dailyData[day].total++
        if (check.status === 'online') {
          dailyData[day].successful++
        }
      })
      
      const availableDays = Object.keys(dailyData).sort()
      
      const labels: string[] = []
      const uptimeData: number[] = []
      
      availableDays.forEach(day => {
        const date = new Date(day + 'T00:00:00')
        const label = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        
        labels.push(label)
        
        const data = dailyData[day]
        const uptime = (data.successful / data.total) * 100
        uptimeData.push(uptime)
      })
      
      return {
        labels,
        datasets: [
          {
            label: 'Uptime (%)',
            data: uptimeData,
            backgroundColor: uptimeData.map(uptime => 
              uptime >= 99 ? '#10b981' :
              uptime >= 95 ? '#f59e0b' : '#ef4444'
            ),
            borderColor: uptimeData.map(uptime => 
              uptime >= 99 ? '#059669' :
              uptime >= 95 ? '#d97706' : '#dc2626'
            ),
            borderWidth: 1,
          },
        ],
      }
    }
  }

  const generateResponseTimeChartData = (): ChartData => {
    if (selectedMonitor === 'all') {
      const labels = reports.map(report => report.monitor_name)
      return {
        labels,
        datasets: [
          {
            label: 'Tempo Médio (ms)',
            data: reports.map(report => report.avg_response_time),
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            borderColor: '#3b82f6',
            borderWidth: 1,
          },
          {
            label: 'Tempo Mínimo (ms)',
            data: reports.map(report => report.min_response_time),
            backgroundColor: 'rgba(16, 185, 129, 0.5)',
            borderColor: '#10b981',
            borderWidth: 1,
          },
          {
            label: 'Tempo Máximo (ms)',
            data: reports.map(report => report.max_response_time),
            backgroundColor: 'rgba(239, 68, 68, 0.5)',
            borderColor: '#ef4444',
            borderWidth: 1,
          },
        ],
      }
    } else {
      if (monitorChecks.length === 0) {
        return { labels: [], datasets: [] }
      }
      
      const labels: string[] = []
      const responseTimeData: number[] = []
      
      const groupedData: { [key: string]: number[] } = {}
      
      monitorChecks.forEach(check => {
        if (check.status !== 'online' || check.response_time == null || Number(check.response_time) <= 0) return
        let groupKey: string
        const checkDate = new Date(check.checked_at)
        
        if (selectedTimeRange === '24h') {
          groupKey = checkDate.toISOString().slice(0, 13)
        } else {
          groupKey = checkDate.toISOString().slice(0, 10)
        }
        
        if (!groupedData[groupKey]) {
          groupedData[groupKey] = []
        }
        groupedData[groupKey].push(Number(check.response_time))
      })
      
      const sortedKeys = Object.keys(groupedData).sort()
      
      sortedKeys.forEach(key => {
        const responseTimes = groupedData[key]
        const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        
        let label: string
        if (selectedTimeRange === '24h') {
          const date = new Date(key + ':00:00')
          label = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        } else {
          const date = new Date(key)
          label = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        }
        
        labels.push(label)
        responseTimeData.push(Math.round(avgResponseTime))
      })
      
      return {
        labels,
        datasets: [
          {
            label: 'Tempo de Resposta Médio (ms)',
            data: responseTimeData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.1,
            fill: true,
          },
        ],
      }
    }
  }

  const generateStatusDistributionData = (): ChartData => {
    if (selectedMonitor === 'all') {
      const onlineCount = reports.reduce((sum, report) => sum + report.successful_checks, 0)
      const warningCount = reports.reduce((sum, report) => sum + report.warning_checks, 0)
      const offlineCount = reports.reduce((sum, report) => sum + report.offline_checks, 0)
      
      return {
        labels: ['Online', 'Aviso', 'Offline'],
        datasets: [
          {
            data: [onlineCount, warningCount, offlineCount],
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
            borderColor: ['#059669', '#d97706', '#dc2626'],
            borderWidth: 1,
          },
        ],
      }
    } else {
      const onlineCount = monitorChecks.filter(c => c.status === 'online').length
      const warningCount = monitorChecks.filter(c => c.status === 'warning').length
      const offlineCount = monitorChecks.filter(c => c.status === 'offline').length
      
      return {
        labels: ['Online', 'Aviso', 'Offline'],
        datasets: [
          {
            data: [onlineCount, warningCount, offlineCount],
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
            borderColor: ['#059669', '#d97706', '#dc2626'],
            borderWidth: 1,
          },
        ],
      }
    }
  }

  const overallStatsCalculated = calculateOverallStats()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios" description="Análise detalhada do desempenho dos monitores" actions={<>
          <Button 
            onClick={handleSendEmail}
            disabled={sendingEmail || selectedMonitor === 'all'}
            variant="outline"
            className="border-blue-500/40 bg-blue-600/10 text-blue-300 hover:bg-blue-600/20"
          >
            {sendingEmail ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            {sendingEmail ? 'Enviando...' : 'Enviar status público (30 dias)'}
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={exporting || selectedMonitor === 'all'}
          >
            {exporting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {exporting ? 'Exportando...' : 'Exportar PDF'}
          </Button>
      </>} />

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-end">
        <PeriodFilter 
          selectedTimeRange={selectedTimeRange} 
          onTimeRangeChange={(value) => setSelectedTimeRange(value as TimeRange)}
          className="w-full sm:w-auto"
        />
        
        <Select value={selectedMonitor} onValueChange={setSelectedMonitor}>
          <SelectTrigger className="w-full gap-2 sm:w-[280px]" aria-label="Monitor do relatório">
            <Activity className="h-4 w-4" />
            <SelectValue placeholder="Monitor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os monitores ativos</SelectItem>
            {monitors.map((monitor) => (
              <SelectItem key={monitor.id} value={monitor.id}>
                {monitor.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedMonitor === 'all' && overallStats?.partial && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="status">
          Há monitores ativos sem verificações neste período. Disponibilidade, incidentes e resposta média agregados ficam indisponíveis até haver dados para todos.
        </p>
      )}
      {selectedMonitor !== 'all' && checksError && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="status">
          O histórico detalhado não está disponível. Os indicadores do período foram carregados separadamente.
        </p>
      )}
      
      <div className="space-y-5 rounded-lg" style={{ backgroundColor: exporting ? '#0d1117' : 'transparent' }}>
      {overallStatsCalculated && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: '#ffffff' }}>Uptime Médio</CardTitle>
              <TrendingUp className="h-4 w-4" style={{ color: '#9ca3af' }} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${overallStatsCalculated.totalChecks > 0 && !overallStatsCalculated.partial ? getUptimeColor(overallStatsCalculated.avgUptime) : 'text-muted-foreground'}`}>
                {overallStatsCalculated.totalChecks > 0 && !overallStatsCalculated.partial ? `${overallStatsCalculated.avgUptime.toFixed(2)}%` : '—'}
              </div>
              <p className="text-xs" style={{ color: '#9ca3af' }}>
                {overallStatsCalculated.partial ? selectedMonitor === 'all' ? 'Há monitores sem verificações neste período' : 'Sem verificações suficientes neste período' : selectedMonitor !== 'all' ? 'Monitor selecionado' : getPeriodLabel(selectedTimeRange).toLowerCase()}
              </p>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: '#ffffff' }}>Verificações</CardTitle>
              <Activity className="h-4 w-4" style={{ color: '#9ca3af' }} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" style={{ color: '#ffffff' }}>{overallStatsCalculated.totalChecks.toLocaleString()}</div>
              <p className="text-xs" style={{ color: '#9ca3af' }}>
                {overallStatsCalculated.totalSuccessful.toLocaleString()} bem-sucedidas
              </p>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: '#ffffff' }}>Incidentes</CardTitle>
              <AlertTriangle className="h-4 w-4" style={{ color: '#9ca3af' }} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${overallStatsCalculated.totalChecks > 0 && !overallStatsCalculated.partial ? 'text-red-600' : 'text-muted-foreground'}`}>{overallStatsCalculated.totalChecks > 0 && !overallStatsCalculated.partial ? overallStatsCalculated.totalIncidents : '—'}</div>
              <p className="text-xs" style={{ color: '#9ca3af' }}>
                {selectedMonitor !== 'all' ? 'Incidentes do monitor' : `${overallStatsCalculated.monitorsCount} monitores`}
              </p>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: '#ffffff' }}>Tempo de Resposta</CardTitle>
              <Clock className="h-4 w-4" style={{ color: '#9ca3af' }} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" style={{ color: '#ffffff' }}>{overallStatsCalculated.responseTimeSamples > 0 && !overallStatsCalculated.partial ? `${Math.round(overallStatsCalculated.avgResponseTime)}ms` : '—'}</div>
              <p className="text-xs" style={{ color: '#9ca3af' }}>
                {selectedMonitor !== 'all' ? 'Tempo médio do monitor' : 'Média geral'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {!checksLoading && !checksError && (reports.some(report => report.total_checks > 0) || monitorChecks.length > 0) && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }} id="uptime-chart">
              <CardHeader>
                <CardTitle className="flex items-center gap-2" style={{ color: '#ffffff' }}>
                  <TrendingUp className="h-5 w-5" />
                  {selectedMonitor === 'all' ? 'Uptime por Monitor' : 'Histórico de Uptime'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 min-w-0 2xl:h-72">
                  {selectedMonitor === 'all' ? (
                    <Bar data={generateUptimeChartData()} options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          grid: { color: "rgba(156, 163, 175, 0.08)" },
                          max: 100,
                          ticks: {
                            color: "#9ca3af",
                            callback: function(value) {
                              return value + '%'
                            }
                          }
                        },
                        x: {
                          ticks: {
                            color: "#9ca3af",
                            maxRotation: 45,
                            maxTicksLimit: 8,
                          }
                        }
                      },
                    }} />
                  ) : (
                    <Bar data={generateUptimeChartData()} options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          grid: { color: "rgba(156, 163, 175, 0.08)" },
                          max: 100,
                          ticks: {
                            color: "#9ca3af",
                            callback: function(value) {
                              return value + '%'
                            }
                          }
                        },
                        x: {
                          ticks: {
                            color: "#9ca3af",
                            maxRotation: 45,
                            maxTicksLimit: 8,
                          }
                        }
                      },
                    }} />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }} id="response-time-chart">
              <CardHeader>
                <CardTitle className="flex items-center gap-2" style={{ color: '#ffffff' }}>
                  <Clock className="h-5 w-5" />
                  {selectedMonitor === 'all' ? 'Tempo de Resposta por Monitor' : 'Histórico de Tempo de Resposta'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 min-w-0 2xl:h-72">
                  {selectedMonitor === 'all' ? (
                    <Bar data={generateResponseTimeChartData()} options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'top',
                          labels: { color: '#9ca3af', boxWidth: 12, boxHeight: 8, padding: 16 },
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          grid: { color: "rgba(156, 163, 175, 0.08)" },
                          ticks: {
                            color: "#9ca3af",
                            callback: function(value) {
                              return value + 'ms'
                            }
                          }
                        },
                        x: {
                          ticks: {
                            color: "#9ca3af",
                            maxRotation: 45,
                            maxTicksLimit: 8,
                          }
                        }
                      },
                    }} />
                  ) : (
                    <Line data={generateResponseTimeChartData()} options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          grid: { color: "rgba(156, 163, 175, 0.08)" },
                          ticks: {
                            color: "#9ca3af",
                            callback: function(value) {
                              return value + 'ms'
                            }
                          }
                        }
                      },
                    }} />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }} id="status-distribution-chart">
              <CardHeader>
                <CardTitle className="flex items-center gap-2" style={{ color: '#ffffff' }}>
                  <PieChart className="h-5 w-5" />
                  Distribuição de Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 min-w-0 2xl:h-72">
                  <Doughnut data={generateStatusDistributionData()} options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: { color: '#9ca3af', boxWidth: 12, boxHeight: 8, padding: 16 },
                      },
                    },
                  }} />
                </div>
              </CardContent>
            </Card>
          </div>

          {selectedMonitor !== 'all' && (
            <div className="min-w-0">
              <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2" style={{ color: '#ffffff' }}>
                    <Activity className="h-5 w-5" />
                    Detalhes do Monitor
                  </CardTitle>
                  <CardDescription style={{ color: '#9ca3af' }}>
                    Todas as informações relevantes do monitor selecionado
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const monitor = monitors.find(m => m.id === selectedMonitor)
                    const report = reports.find(r => r.monitor_id === selectedMonitor)
                    
                    if (!monitor || !report) {
                      return <p style={{ color: '#9ca3af' }}>Carregando informações...</p>
                    }
                    
                    const getStatusBadge = (status: string) => {
                      const statusConfig = {
                        'online': { color: 'bg-green-500', text: 'Online', icon: '🟢' },
                        'offline': { color: 'bg-red-500', text: 'Offline', icon: '🔴' },
                        'warning': { color: 'bg-yellow-500', text: 'Atenção', icon: '🟡' },
                        'unknown': { color: 'bg-gray-500', text: 'Desconhecido', icon: '⚪' }
                      }
                      const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.unknown
                      return (
                        <Badge className={`${config.color} text-white hover:${config.color} cursor-default`}>
                          {config.icon} {config.text}
                        </Badge>
                      )
                    }
                    
                    const getUptimeColor = (uptime: number | null) => {
                      if (uptime === null || !Number.isFinite(uptime)) return 'text-muted-foreground'
                      if (uptime >= 99) return 'text-green-400'
                      if (uptime >= 95) return 'text-yellow-400'
                      return 'text-red-400'
                    }
                    
                    return (
                      <div className="report-details grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-4">
                        <section>
                          <h3 className="mb-1 font-semibold">Informações Básicas</h3>
                          <dl>
                            <div><dt>Nome</dt><dd className="font-medium">{monitor.name}</dd></div>
                            <div><dt>URL</dt><dd><a href={monitor.url} target="_blank" rel="noopener noreferrer" className="break-all text-blue-400 hover:underline">{monitor.url}</a></dd></div>
                            <div><dt>Status Atual</dt><dd>{getStatusBadge(monitor.status)}</dd></div>
                            <div><dt>ID</dt><dd className="break-all font-mono text-xs text-muted-foreground">{monitor.id}</dd></div>
                          </dl>
                        </section>
                        <section>
                          <h3 className="mb-1 font-semibold">Estatísticas de Performance</h3>
                          <dl>
                            <div><dt>Uptime Geral</dt><dd className={getUptimeColor(report.uptime_percentage)}>{report.uptime_percentage == null ? '—' : `${report.uptime_percentage.toFixed(2)}%`}</dd></div>
                            <div><dt>Total de Verificações</dt><dd>{report.total_checks.toLocaleString()}</dd></div>
                            <div><dt>Bem-sucedidas</dt><dd className="text-green-400">{report.successful_checks.toLocaleString()}</dd></div>
                            <div><dt>Falhadas</dt><dd className="text-red-400">{report.failed_checks.toLocaleString()}</dd></div>
                          </dl>
                        </section>
                        <section>
                          <h3 className="mb-1 font-semibold">Tempos de Resposta</h3>
                          <dl>
                            <div><dt>Tempo Médio</dt><dd className="font-semibold">{report.avg_response_time == null ? '—' : `${report.avg_response_time.toFixed(0)}ms`}</dd></div>
                            <div><dt>Tempo Mínimo</dt><dd className="text-green-400">{report.min_response_time == null ? '—' : `${report.min_response_time.toFixed(0)}ms`}</dd></div>
                            <div><dt>Tempo Máximo</dt><dd className="text-red-400">{report.max_response_time == null ? '—' : `${report.max_response_time.toFixed(0)}ms`}</dd></div>
                          </dl>
                        </section>
                        <section>
                          <h3 className="mb-1 font-semibold">Incidentes e Problemas</h3>
                          <dl>
                            <div><dt>Total de Incidentes</dt><dd className={report.total_checks === 0 ? 'text-muted-foreground' : report.incidents > 0 ? 'text-red-400' : 'text-green-400'}>{report.total_checks === 0 ? '—' : report.incidents}</dd></div>
                            <div><dt>Último Incidente</dt><dd>{report.total_checks === 0 ? 'Sem verificações no período' : report.last_incident ? new Date(report.last_incident).toLocaleString('pt-BR') : 'Nenhum incidente registrado'}</dd></div>
                            <div><dt>Taxa de Sucesso</dt><dd className={getUptimeColor(report.total_checks ? (report.successful_checks / report.total_checks) * 100 : null)}>{report.total_checks ? `${((report.successful_checks / report.total_checks) * 100).toFixed(2)}%` : '—'}<span className="block text-xs text-muted-foreground">{report.successful_checks}/{report.total_checks} verificações</span></dd></div>
                          </dl>
                        </section>
                      </div>
                    )
                  })()} 
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
      {(reports.length === 0 || reports.every(report => report.total_checks === 0)) && monitorChecks.length === 0 && (
        <Card className="p-8 text-center">
          <Activity className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h2 className="font-medium">Nenhum dado neste período</h2>
          <p className="mt-1 text-sm text-muted-foreground">Selecione outro período ou monitor para visualizar o relatório.</p>
        </Card>
      )}
      </div>
      
    </div>
  )
}

export default ReportsPage
