import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { 
  BarChart3, 
  Download, 
  Calendar, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Activity,
  AlertTriangle,
  CheckCircle,
  Globe,
  PieChart,
  LineChart
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { formatDuration, calculateUptime } from '../lib/utils'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

interface ReportData {
  monitor_id: string
  monitor_name: string
  monitor_url: string
  group_name: string
  total_checks: number
  successful_checks: number
  failed_checks: number
  uptime_percentage: number
  avg_response_time: number
  min_response_time: number
  max_response_time: number
  incidents: number
  last_incident: string | null
}

interface TimeRange {
  label: string
  value: string
  days: number
}

interface Group {
  id: string
  name: string
}

interface Monitor {
  id: string
  name: string
  url: string
  status: string
  group_id: string
  group_name: string
}

interface ChartData {
  labels: string[]
  datasets: any[]
}

interface MonitorCheck {
  id: string
  monitor_id: string
  status: string
  response_time: number
  checked_at: string
}

const timeRanges: TimeRange[] = [
  { label: 'Últimas 24 horas', value: '24h', days: 1 },
  { label: 'Últimos 7 dias', value: '7d', days: 7 },
  { label: 'Últimos 30 dias', value: '30d', days: 30 },
  { label: 'Últimos 90 dias', value: '90d', days: 90 }
]

export function ReportsPage() {
  const [reports, setReports] = useState<ReportData[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [selectedMonitor, setSelectedMonitor] = useState('all')
  const [monitorChecks, setMonitorChecks] = useState<MonitorCheck[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d')
  const [selectedGroup, setSelectedGroup] = useState('all')
  const [exporting, setExporting] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    fetchData()
    if (selectedMonitor !== 'all') {
      fetchMonitorChecks(selectedMonitor)
    }
  }, [selectedTimeRange, selectedGroup, selectedMonitor])

  useEffect(() => {
    fetchGroups()
    fetchMonitors()
  }, [])

  const fetchGroups = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`${import.meta.env.VITE_API_URL}/groups`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setGroups(data)
      }
    } catch (error) {
      console.error('Erro ao buscar grupos:', error)
    }
  }

  const fetchMonitors = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`${import.meta.env.VITE_API_URL}/monitors`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setMonitors(data)
      }
    } catch (error) {
      console.error('Erro ao buscar monitores:', error)
    }
  }

  const fetchMonitorChecks = async (monitorId: string) => {
    try {
      const token = localStorage.getItem('auth_token')
      const selectedRange = timeRanges.find(range => range.value === selectedTimeRange)
      const limit = selectedRange ? selectedRange.days * 24 * 2 : 200 // 2 checks por hora aproximadamente
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/monitors/${monitorId}/checks?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setMonitorChecks(data)
      }
    } catch (error) {
      console.error('Erro ao buscar checks do monitor:', error)
    }
  }

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const params = new URLSearchParams({
        period: selectedTimeRange,
        ...(selectedGroup !== 'all' && { group_id: selectedGroup })
      })
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/reports?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setReports(data)
      }
    } catch (error) {
      console.error('Erro ao buscar relatórios:', error)
      addToast('Erro ao carregar relatórios', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const token = localStorage.getItem('auth_token')
      const params = new URLSearchParams({
        period: selectedTimeRange,
        format: 'csv',
        ...(selectedGroup !== 'all' && { group_id: selectedGroup })
      })
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/reports/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `relatorio-${selectedTimeRange}-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        addToast('Relatório exportado com sucesso', 'success')
      } else {
        throw new Error('Erro ao exportar relatório')
      }
    } catch (error) {
      console.error('Erro ao exportar relatório:', error)
      addToast('Erro ao exportar relatório', 'error')
    } finally {
      setExporting(false)
    }
  }

  const getUptimeColor = (uptime: number) => {
    if (uptime >= 99) return 'text-green-600'
    if (uptime >= 95) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getUptimeBadgeColor = (uptime: number) => {
    if (uptime >= 99) return 'bg-green-100 text-green-800'
    if (uptime >= 95) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  const calculateOverallStats = () => {
    if (reports.length === 0) return null

    const totalChecks = reports.reduce((sum, report) => sum + report.total_checks, 0)
    const totalSuccessful = reports.reduce((sum, report) => sum + report.successful_checks, 0)
    const totalIncidents = reports.reduce((sum, report) => sum + report.incidents, 0)
    const avgUptime = reports.reduce((sum, report) => sum + report.uptime_percentage, 0) / reports.length
    const avgResponseTime = reports.reduce((sum, report) => sum + report.avg_response_time, 0) / reports.length

    return {
      totalChecks,
      totalSuccessful,
      totalIncidents,
      avgUptime,
      avgResponseTime,
      monitorsCount: reports.length
    }
  }

  const generateUptimeChartData = (): ChartData => {
    if (selectedMonitor === 'all') {
      // Dados agregados de todos os monitores
      const labels = reports.map(report => report.monitor_name)
      return {
        labels,
        datasets: [
          {
            label: 'Uptime (%)',
            data: reports.map(report => report.uptime_percentage),
            backgroundColor: reports.map(report => 
              report.uptime_percentage >= 99 ? '#10b981' :
              report.uptime_percentage >= 95 ? '#f59e0b' : '#ef4444'
            ),
            borderColor: reports.map(report => 
              report.uptime_percentage >= 99 ? '#059669' :
              report.uptime_percentage >= 95 ? '#d97706' : '#dc2626'
            ),
            borderWidth: 1,
          },
        ],
      }
    } else {
      // Dados históricos do monitor selecionado
      const selectedRange = timeRanges.find(range => range.value === selectedTimeRange)
      const hoursBack = selectedRange ? selectedRange.days * 24 : 168
      
      // Agrupar checks por hora
      const hourlyData: { [key: string]: { total: number, successful: number } } = {}
      
      monitorChecks.forEach(check => {
        const hour = new Date(check.checked_at).toISOString().slice(0, 13) + ':00:00'
        if (!hourlyData[hour]) {
          hourlyData[hour] = { total: 0, successful: 0 }
        }
        hourlyData[hour].total++
        if (check.status === 'online') {
          hourlyData[hour].successful++
        }
      })
      
      const labels: string[] = []
      const uptimeData: number[] = []
      
      for (let i = hoursBack; i >= 0; i--) {
        const date = new Date(Date.now() - i * 60 * 60 * 1000)
        const hour = date.toISOString().slice(0, 13) + ':00:00'
        const label = selectedRange?.days === 1 
          ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        
        labels.push(label)
        
        const data = hourlyData[hour]
        const uptime = data ? (data.successful / data.total) * 100 : 100
        uptimeData.push(uptime)
      }
      
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
      // Dados históricos do monitor selecionado
      const selectedRange = timeRanges.find(range => range.value === selectedTimeRange)
      const hoursBack = selectedRange ? selectedRange.days * 24 : 168
      
      const labels: string[] = []
      const responseTimeData: number[] = []
      
      // Agrupar por hora e calcular média
      const hourlyData: { [key: string]: number[] } = {}
      
      monitorChecks.forEach(check => {
        if (check.response_time) {
          const hour = new Date(check.checked_at).toISOString().slice(0, 13) + ':00:00'
          if (!hourlyData[hour]) {
            hourlyData[hour] = []
          }
          hourlyData[hour].push(check.response_time)
        }
      })
      
      for (let i = hoursBack; i >= 0; i--) {
        const date = new Date(Date.now() - i * 60 * 60 * 1000)
        const hour = date.toISOString().slice(0, 13) + ':00:00'
        const label = selectedRange?.days === 1 
          ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        
        labels.push(label)
        
        const times = hourlyData[hour] || []
        const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0
        responseTimeData.push(avgTime)
      }
      
      return {
        labels,
        datasets: [
          {
            label: 'Tempo de Resposta (ms)',
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
      const onlineCount = reports.filter(r => r.uptime_percentage >= 99).length
      const warningCount = reports.filter(r => r.uptime_percentage >= 95 && r.uptime_percentage < 99).length
      const offlineCount = reports.filter(r => r.uptime_percentage < 95).length
      
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

  const overallStats = calculateOverallStats()
  const selectedRange = timeRanges.find(range => range.value === selectedTimeRange)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#ffffff' }}>Relatórios</h1>
          <p style={{ color: '#9ca3af' }}>Análise detalhada do desempenho dos monitores</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button 
            onClick={handleExport} 
            disabled={exporting || reports.length === 0}
            variant="outline"
          >
            {exporting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {exporting ? 'Exportando...' : 'Exportar CSV'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Calendar className="h-4 w-4" />
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            {timeRanges.map((range) => (
              <SelectItem key={range.value} value={range.value}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Globe className="h-4 w-4" />
            <SelectValue placeholder="Grupo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os grupos</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedMonitor} onValueChange={setSelectedMonitor}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Activity className="h-4 w-4" />
            <SelectValue placeholder="Monitor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os monitores</SelectItem>
            {monitors.map((monitor) => (
              <SelectItem key={monitor.id} value={monitor.id}>
                {monitor.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Overall Stats */}
      {overallStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: '#ffffff' }}>Uptime Médio</CardTitle>
              <TrendingUp className="h-4 w-4" style={{ color: '#9ca3af' }} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getUptimeColor(overallStats.avgUptime)}`}>
                {overallStats.avgUptime?.toFixed(2) || '0.00'}%
              </div>
              <p className="text-xs" style={{ color: '#9ca3af' }}>
                {selectedRange?.label.toLowerCase()}
              </p>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: '#ffffff' }}>Verificações</CardTitle>
              <Activity className="h-4 w-4" style={{ color: '#9ca3af' }} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" style={{ color: '#ffffff' }}>{overallStats.totalChecks.toLocaleString()}</div>
              <p className="text-xs" style={{ color: '#9ca3af' }}>
                {overallStats.totalSuccessful.toLocaleString()} bem-sucedidas
              </p>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: '#ffffff' }}>Incidentes</CardTitle>
              <AlertTriangle className="h-4 w-4" style={{ color: '#9ca3af' }} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{overallStats.totalIncidents}</div>
              <p className="text-xs" style={{ color: '#9ca3af' }}>
                {overallStats.monitorsCount} monitores
              </p>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: '#ffffff' }}>Tempo de Resposta</CardTitle>
              <Clock className="h-4 w-4" style={{ color: '#9ca3af' }} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" style={{ color: '#ffffff' }}>{Math.round(overallStats.avgResponseTime)}ms</div>
              <p className="text-xs" style={{ color: '#9ca3af' }}>
                Média geral
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gráficos */}
      {(reports.length > 0 || monitorChecks.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coluna Esquerda - Cards Menores */}
          <div className="lg:col-span-1 space-y-6">
            {/* Gráfico de Uptime */}
            <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2" style={{ color: '#ffffff' }}>
                  <TrendingUp className="h-5 w-5" />
                  {selectedMonitor === 'all' ? 'Uptime por Monitor' : 'Histórico de Uptime'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
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
                          max: 100,
                          ticks: {
                            callback: function(value) {
                              return value + '%'
                            }
                          }
                        },
                        x: {
                          ticks: {
                            maxRotation: 45,
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
                          max: 100,
                          ticks: {
                            callback: function(value) {
                              return value + '%'
                            }
                          }
                        },
                        x: {
                          ticks: {
                            maxRotation: 45,
                          }
                        }
                      },
                    }} />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Gráfico de Tempo de Resposta */}
            <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2" style={{ color: '#ffffff' }}>
                  <Clock className="h-5 w-5" />
                  {selectedMonitor === 'all' ? 'Tempo de Resposta por Monitor' : 'Histórico de Tempo de Resposta'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  {selectedMonitor === 'all' ? (
                    <Bar data={generateResponseTimeChartData()} options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'top',
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            callback: function(value) {
                              return value + 'ms'
                            }
                          }
                        },
                        x: {
                          ticks: {
                            maxRotation: 45,
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
                          ticks: {
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

            {/* Gráfico de Distribuição de Status */}
            <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2" style={{ color: '#ffffff' }}>
                  <PieChart className="h-5 w-5" />
                  Distribuição de Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <Doughnut data={generateStatusDistributionData()} options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                      },
                    },
                  }} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna Direita - Card Maior */}
          {selectedMonitor !== 'all' && (
            <div className="lg:col-span-1">
              <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2" style={{ color: '#ffffff' }}>
                    <Activity className="h-5 w-5" />
                    Informações Detalhadas do Monitor
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
                        <Badge className={`${config.color} text-white`}>
                          {config.icon} {config.text}
                        </Badge>
                      )
                    }
                    
                    const getUptimeColor = (uptime: number) => {
                      if (uptime >= 99) return 'text-green-400'
                      if (uptime >= 95) return 'text-yellow-400'
                      return 'text-red-400'
                    }
                    
                    return (
                      <div className="space-y-6">
                        {/* Informações Básicas */}
                        <div>
                          <h3 className="text-lg font-semibold mb-3" style={{ color: '#ffffff' }}>Informações Básicas</h3>
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <tbody>
                                <tr className="border-b" style={{ borderColor: '#2c313a' }}>
                                  <td className="py-3 px-4 font-medium" style={{ color: '#9ca3af' }}>Nome do Monitor</td>
                                  <td className="py-3 px-4" style={{ color: '#ffffff' }}>{monitor.name}</td>
                                </tr>
                                <tr className="border-b" style={{ borderColor: '#2c313a' }}>
                                  <td className="py-3 px-4 font-medium" style={{ color: '#9ca3af' }}>URL Monitorada</td>
                                  <td className="py-3 px-4">
                                    <a href={monitor.url} target="_blank" rel="noopener noreferrer" 
                                       className="text-blue-400 hover:text-blue-300 break-all">
                                      {monitor.url}
                                    </a>
                                  </td>
                                </tr>
                                <tr className="border-b" style={{ borderColor: '#2c313a' }}>
                                  <td className="py-3 px-4 font-medium" style={{ color: '#9ca3af' }}>Grupo</td>
                                  <td className="py-3 px-4" style={{ color: '#ffffff' }}>{monitor.group_name || 'Sem grupo'}</td>
                                </tr>
                                <tr className="border-b" style={{ borderColor: '#2c313a' }}>
                                  <td className="py-3 px-4 font-medium" style={{ color: '#9ca3af' }}>Status Atual</td>
                                  <td className="py-3 px-4">{getStatusBadge(monitor.status)}</td>
                                </tr>
                                <tr className="border-b" style={{ borderColor: '#2c313a' }}>
                                  <td className="py-3 px-4 font-medium" style={{ color: '#9ca3af' }}>ID do Monitor</td>
                                  <td className="py-3 px-4" style={{ color: '#9ca3af', fontFamily: 'monospace' }}>{monitor.id}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                        
                        {/* Estatísticas de Performance */}
                        <div>
                          <h3 className="text-lg font-semibold mb-3" style={{ color: '#ffffff' }}>Estatísticas de Performance</h3>
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <tbody>
                                <tr className="border-b" style={{ borderColor: '#2c313a' }}>
                                  <td className="py-3 px-4 font-medium" style={{ color: '#9ca3af' }}>Uptime Geral</td>
                                  <td className="py-3 px-4">
                                    <span className={`text-xl font-bold ${getUptimeColor(report.uptime_percentage)}`}>
                                      {report.uptime_percentage.toFixed(2)}%
                                    </span>
                                  </td>
                                </tr>
                                <tr className="border-b" style={{ borderColor: '#2c313a' }}>
                                  <td className="py-3 px-4 font-medium" style={{ color: '#9ca3af' }}>Total de Verificações</td>
                                  <td className="py-3 px-4" style={{ color: '#ffffff' }}>
                                    {report.total_checks.toLocaleString()}
                                  </td>
                                </tr>
                                <tr className="border-b" style={{ borderColor: '#2c313a' }}>
                                  <td className="py-3 px-4 font-medium" style={{ color: '#9ca3af' }}>Verificações Bem-sucedidas</td>
                                  <td className="py-3 px-4" style={{ color: '#10b981' }}>
                                    {report.successful_checks.toLocaleString()}
                                  </td>
                                </tr>
                                <tr className="border-b" style={{ borderColor: '#2c313a' }}>
                                  <td className="py-3 px-4 font-medium" style={{ color: '#9ca3af' }}>Verificações Falhadas</td>
                                  <td className="py-3 px-4" style={{ color: '#ef4444' }}>
                                    {report.failed_checks.toLocaleString()}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                        
                        {/* Tempos de Resposta */}
                        <div>
                          <h3 className="text-lg font-semibold mb-3" style={{ color: '#ffffff' }}>Tempos de Resposta</h3>
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <tbody>
                                <tr className="border-b" style={{ borderColor: '#2c313a' }}>
                                  <td className="py-3 px-4 font-medium" style={{ color: '#9ca3af' }}>Tempo Médio</td>
                                  <td className="py-3 px-4" style={{ color: '#ffffff' }}>
                                    <span className="text-xl font-bold">{report.avg_response_time.toFixed(0)}ms</span>
                                  </td>
                                </tr>
                                <tr className="border-b" style={{ borderColor: '#2c313a' }}>
                                  <td className="py-3 px-4 font-medium" style={{ color: '#9ca3af' }}>Tempo Mínimo</td>
                                  <td className="py-3 px-4" style={{ color: '#10b981' }}>
                                    {report.min_response_time.toFixed(0)}ms
                                  </td>
                                </tr>
                                <tr className="border-b" style={{ borderColor: '#2c313a' }}>
                                  <td className="py-3 px-4 font-medium" style={{ color: '#9ca3af' }}>Tempo Máximo</td>
                                  <td className="py-3 px-4" style={{ color: '#ef4444' }}>
                                    {report.max_response_time.toFixed(0)}ms
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                        
                        {/* Incidentes e Problemas */}
                        <div>
                          <h3 className="text-lg font-semibold mb-3" style={{ color: '#ffffff' }}>Incidentes e Problemas</h3>
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <tbody>
                                <tr className="border-b" style={{ borderColor: '#2c313a' }}>
                                  <td className="py-3 px-4 font-medium" style={{ color: '#9ca3af' }}>Total de Incidentes</td>
                                  <td className="py-3 px-4">
                                    <span className={`text-xl font-bold ${report.incidents > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                      {report.incidents}
                                    </span>
                                  </td>
                                </tr>
                                <tr className="border-b" style={{ borderColor: '#2c313a' }}>
                                  <td className="py-3 px-4 font-medium" style={{ color: '#9ca3af' }}>Último Incidente</td>
                                  <td className="py-3 px-4" style={{ color: '#ffffff' }}>
                                    {report.last_incident 
                                      ? new Date(report.last_incident).toLocaleString('pt-BR')
                                      : 'Nenhum incidente registrado'
                                    }
                                  </td>
                                </tr>
                                <tr>
                                  <td className="py-3 px-4 font-medium" style={{ color: '#9ca3af' }}>Taxa de Sucesso</td>
                                  <td className="py-3 px-4">
                                    <span className={`font-bold ${getUptimeColor((report.successful_checks / report.total_checks) * 100)}`}>
                                      {((report.successful_checks / report.total_checks) * 100).toFixed(2)}%
                                    </span>
                                    <span style={{ color: '#9ca3af' }}> ({report.successful_checks}/{report.total_checks})</span>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )
                  })()} 
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}


    </div>
  )
}