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
  Globe
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { formatDuration, calculateUptime } from '../lib/utils'

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

const timeRanges: TimeRange[] = [
  { label: 'Últimas 24 horas', value: '24h', days: 1 },
  { label: 'Últimos 7 dias', value: '7d', days: 7 },
  { label: 'Últimos 30 dias', value: '30d', days: 30 },
  { label: 'Últimos 90 dias', value: '90d', days: 90 }
]

export function ReportsPage() {
  const [reports, setReports] = useState<ReportData[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d')
  const [selectedGroup, setSelectedGroup] = useState('all')
  const [exporting, setExporting] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    fetchData()
  }, [selectedTimeRange, selectedGroup])

  useEffect(() => {
    fetchGroups()
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
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
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
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
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

      {/* Detailed Reports */}
      <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }}>
        <CardHeader>
          <CardTitle style={{ color: '#ffffff' }}>Relatório Detalhado por Monitor</CardTitle>
          <CardDescription style={{ color: '#9ca3af' }}>
            Estatísticas individuais de cada monitor no período selecionado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 mx-auto mb-4" style={{ color: '#9ca3af' }} />
              <h3 className="text-lg font-medium mb-2" style={{ color: '#ffffff' }}>
                Nenhum dado encontrado
              </h3>
              <p style={{ color: '#9ca3af' }}>
                Não há dados suficientes para o período e filtros selecionados
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <div
                  key={report.monitor_id}
                  className="rounded-lg p-4 transition-colors"
                  style={{ 
                    backgroundColor: '#2c313a', 
                    borderColor: '#2c313a',
                    border: '1px solid'
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium" style={{ color: '#ffffff' }}>{report.monitor_name}</h4>
                        <Badge className={getUptimeBadgeColor(report.uptime_percentage)}>
                          {report.uptime_percentage?.toFixed(2) || '0.00'}% uptime
                        </Badge>
                      </div>
                      
                      <p className="text-sm mb-2" style={{ color: '#9ca3af' }}>{report.monitor_url}</p>
                      <p className="text-xs mb-3" style={{ color: '#9ca3af' }}>{report.group_name}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p style={{ color: '#9ca3af' }}>Verificações</p>
                          <p className="font-medium" style={{ color: '#ffffff' }}>
                            {report.successful_checks}/{report.total_checks}
                          </p>
                        </div>
                        
                        <div>
                          <p style={{ color: '#9ca3af' }}>Tempo de Resposta</p>
                          <p className="font-medium" style={{ color: '#ffffff' }}>
                            {Math.round(report.avg_response_time)}ms
                            <span className="text-xs ml-1" style={{ color: '#9ca3af' }}>
                              ({report.min_response_time}-{report.max_response_time}ms)
                            </span>
                          </p>
                        </div>
                        
                        <div>
                          <p style={{ color: '#9ca3af' }}>Incidentes</p>
                          <p className="font-medium text-red-600">{report.incidents}</p>
                        </div>
                        
                        <div>
                          <p style={{ color: '#9ca3af' }}>Último Incidente</p>
                          <p className="font-medium" style={{ color: '#ffffff' }}>
                            {report.last_incident 
                              ? new Date(report.last_incident).toLocaleDateString('pt-BR')
                              : 'Nenhum'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-4">
                      {report.uptime_percentage >= 99 ? (
                        <CheckCircle className="h-8 w-8 text-green-600" />
                      ) : report.uptime_percentage >= 95 ? (
                        <AlertTriangle className="h-8 w-8 text-yellow-600" />
                      ) : (
                        <TrendingDown className="h-8 w-8 text-red-600" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}