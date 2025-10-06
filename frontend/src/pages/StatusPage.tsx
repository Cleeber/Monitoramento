import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Activity,
  Globe,
  Calendar,
  TrendingUp,
  BarChart3,
  PieChart
} from 'lucide-react'
import { formatDuration } from '../lib/utils'
import { apiGet } from '../utils/apiUtils'

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
import { Bar, Doughnut } from 'react-chartjs-2'

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

interface PublicMonitor {
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
  group_name: string
}

interface StatusPageData {
  monitors: PublicMonitor[]
  overall_status: 'operational' | 'degraded' | 'outage'
  last_updated: string
}

interface IncidentHistory {
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
  minResponseTime: number
  maxResponseTime: number
  avgResponseTime: number
}

// Função para buscar dados históricos reais de uptime
const fetchUptimeHistory = async (groupId?: string) => {
  try {
    const params = new URLSearchParams({
      days: '30'
    })
    
    if (groupId && groupId !== 'all') {
      params.append('group_id', groupId)
    }
    
    const response = await fetch(`/api/public/uptime-history?${params}`)
    if (!response.ok) {
      throw new Error('Falha ao buscar histórico de uptime')
    }
    
    const uptimeData = await response.json()
    
    return {
      labels: uptimeData.map((item: any) => item.date),
      datasets: [
        {
          label: 'Uptime (%)',
          data: uptimeData.map((item: any) => item.uptime),
          backgroundColor: '#10b981',
          borderColor: '#10b981',
          borderWidth: 1,
        },
      ],
    }
  } catch (error) {
    console.error('Erro ao buscar histórico de uptime:', error)
    // Fallback para dados vazios em caso de erro
    return {
      labels: [],
      datasets: [
        {
          label: 'Uptime (%)',
          data: [],
          backgroundColor: '#10b981',
          borderColor: '#10b981',
          borderWidth: 1,
        },
      ],
    }
  }
}

// Função para buscar estatísticas reais do monitor
const fetchMonitorStats = async (monitorId: string): Promise<MonitorStats | null> => {
  try {
    const response = await fetch(`/api/public/monitor-stats/${monitorId}`)
    if (!response.ok) {
      throw new Error('Erro ao buscar estatísticas do monitor')
    }
    return await response.json()
  } catch (error) {
    console.error('Erro ao buscar estatísticas do monitor:', error)
    return null
  }
}

// Função para gerar dados do gráfico de distribuição de status
const generateStatusDistributionData = (monitors: PublicMonitor[]) => {
  const statusCounts = {
    online: monitors.filter(m => m.status === 'online').length,
    offline: monitors.filter(m => m.status === 'offline').length,
    warning: monitors.filter(m => m.status === 'warning').length,
    unknown: monitors.filter(m => m.status === 'unknown').length,
  }

  return {
    labels: ['Online', 'Offline', 'Aviso', 'Desconhecido'],
    datasets: [
      {
        data: [statusCounts.online, statusCounts.offline, statusCounts.warning, statusCounts.unknown],
        backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#6b7280'],
        borderColor: ['#059669', '#dc2626', '#d97706', '#4b5563'],
        borderWidth: 1,
      },
    ],
  }
}

export function StatusPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const [data, setData] = useState<StatusPageData | null>(null)
  const [loading, setLoading] = useState(true)
  // const [refreshing, setRefreshing] = useState(false)
  const [incidents, setIncidents] = useState<IncidentHistory[]>([])
  const [groupName, setGroupName] = useState<string>('')
  const [uptimeChartData, setUptimeChartData] = useState<any>(null)
  // Removido: responseTimeHistory não utilizado
  const [monitorStats, setMonitorStats] = useState<MonitorStats | null>(null)
  const [uptimeData, setUptimeData] = useState<any>(null)
  const [incidentsData, setIncidentsData] = useState<any>(null)
  const [responseTimeData, setResponseTimeData] = useState<any>(null)
  
  // Calcular totalServices baseado nos dados
  const totalServices = data ? data.monitors.length : 0

  useEffect(() => {
    fetchStatusData()
    fetchGroupName()
    loadUptimeData()
    loadIncidentsData()
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(() => {
      fetchStatusData()
      loadUptimeData()
      loadIncidentsData()
    }, 30000)
    return () => clearInterval(interval)
  }, [groupId])

  // Carregar estatísticas quando os dados do monitor estiverem disponíveis
  useEffect(() => {
    if (data && data.monitors.length > 0) {
      loadMonitorStats()
      loadUptimeData() // Recalcular uptime com os novos dados
      loadIncidentsData() // Atualizar dados de incidentes
    }
  }, [data])

  const loadUptimeData = async () => {
    try {
      const chartData = await fetchUptimeHistory(groupId)
      setUptimeChartData(chartData)
      
      // Calcular dados de uptime para os cards de métricas
      if (data && data.monitors.length > 0) {
        const totalUptime = data.monitors.reduce((sum, monitor) => sum + monitor.uptime_30d, 0)
        const avgUptime = totalUptime / data.monitors.length
        setUptimeData({ uptime_percentage: avgUptime })
        
        // Calcular tempo de resposta médio
        const validResponseTimes = data.monitors.filter(m => m.response_time !== null)
        if (validResponseTimes.length > 0) {
          const avgResponseTime = validResponseTimes.reduce((sum, m) => sum + (m.response_time || 0), 0) / validResponseTimes.length
          setResponseTimeData({ avg_response_time: Math.round(avgResponseTime) })
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados de uptime:', error)
    }
  }

  const loadMonitorStats = async () => {
    try {
      if (data && data.monitors.length > 0) {
        const stats = await fetchMonitorStats(data.monitors[0].id)
        setMonitorStats(stats)
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas do monitor:', error)
    }
  }

  const loadIncidentsData = async () => {
    try {
      // Simular dados de incidentes para os cards de métricas
      // Em um ambiente real, isso viria de uma API
      setIncidentsData({ total_incidents: incidents.length })
    } catch (error) {
      console.error('Erro ao carregar dados de incidentes:', error)
    }
  }

  const fetchStatusData = async () => {
    
    try {
      let statusUrl: string
      let incidentsUrl: string
      // Removido: isMonitorIndividual não utilizado
      let currentGroupId: string | null = null
      let currentMonitorId: string | null = null
      
      if (!groupId || groupId === 'all') {
        statusUrl = `/api/public/status/all`
        incidentsUrl = `/api/public/incidents`
      } else {
        // Primeiro, tentar buscar como slug de grupo
        statusUrl = `/api/public/status/group/${groupId}`
        incidentsUrl = `/api/public/incidents`
      }
        
      const statusResponse = await fetch(statusUrl)
      let statusData = null

      if (statusResponse.ok) {
        statusData = await statusResponse.json()
        setData(statusData)
        
        // Se é um grupo, usar o group_id para filtrar incidentes
        if (statusData.group && statusData.group.id) {
          currentGroupId = statusData.group.id
          incidentsUrl = `/api/public/incidents?group_id=${currentGroupId}`
        }
      } else if (statusResponse.status === 404 && groupId !== 'all') {
        // Se não encontrou como grupo, tentar buscar como monitor individual
        try {
          const monitorUrl = `/api/public/status/monitor/${groupId}`
          const monitorResponse = await fetch(monitorUrl)
          if (monitorResponse.ok) {
            const monitorData = await monitorResponse.json()
            // Converter a estrutura de monitor individual para o formato esperado
            const adaptedData = {
              monitors: [{
                ...monitorData.monitor,
                group_name: monitorData.monitor.name // Para monitor individual, usar o próprio nome
              }],
              overall_status: monitorData.overall_status,
              last_updated: monitorData.last_updated
            }
            setData(adaptedData)
            statusData = adaptedData
            // Removido: isMonitorIndividual = true (não utilizado)
            currentMonitorId = monitorData.monitor.id
            
            // Para monitor individual, filtrar incidentes por monitor_id
            incidentsUrl = `/api/public/incidents?monitor_id=${currentMonitorId}`
          }
        } catch (monitorError) {
          console.error('Erro ao buscar monitor por slug:', monitorError)
        }
      }

      // Buscar incidentes com os filtros apropriados
      const incidentsResponse = await fetch(incidentsUrl)
      if (incidentsResponse.ok) {
        const incidentsData = await incidentsResponse.json()
        setIncidents(incidentsData)
      }
    } catch (error) {
      console.error('Erro ao buscar dados de status:', error)
    } finally {
      setLoading(false)
      // refreshing removido conforme solicitação
    }
  }

  const fetchGroupName = async () => {
    if (!groupId || groupId === 'all') {
      setGroupName('Todos os Grupos')
      return
    }
    
    try {
      // Primeiro, tentar buscar como slug de grupo
      const groupResult = await apiGet(`/public/status/group/${groupId}`)
      if (groupResult.success && groupResult.data?.group) {
        setGroupName(groupResult.data.group.name)
        return
      }
      
      // Se não encontrou como grupo, tentar buscar como monitor individual
      const monitorResult = await apiGet(`/public/status/monitor/${groupId}`)
      if (monitorResult.success && monitorResult.data?.monitor) {
        setGroupName(monitorResult.data.monitor.name)
        return
      }
      
      setGroupName('Página não encontrada')
    } catch (error) {
      console.error('Erro ao buscar nome:', error)
      setGroupName('Erro ao carregar')
    }
  }

  // handleRefresh removido conforme solicitação

  const getStatusIcon = (status: string, monitorId?: string) => {
    const keyPrefix = monitorId ? `icon-${monitorId}` : `icon-${status}`;
    switch (status) {
      case 'online':
        return <CheckCircle key={keyPrefix} className="h-4 w-4 text-green-600" />
      case 'offline':
        return <AlertTriangle key={keyPrefix} className="h-4 w-4 text-red-600" />
      case 'warning':
        return <Clock key={keyPrefix} className="h-4 w-4 text-yellow-600" />
      default:
        return <Activity key={keyPrefix} className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-800'
      case 'offline':
        return 'bg-red-100 text-red-800'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getOverallStatusInfo = (status: string) => {
    switch (status) {
      case 'operational':
        return {
          text: 'Todos os sistemas operacionais',
          color: 'text-green-600',
          bgColor: 'bg-green-50 border-green-200',
          icon: <CheckCircle className="h-6 w-6 text-green-600" />
        }
      case 'degraded':
        return {
          text: 'Degradação parcial do serviço',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50 border-yellow-200',
          icon: <Clock className="h-6 w-6 text-yellow-600" />
        }
      case 'outage':
        return {
          text: 'Interrupção do serviço',
          color: 'text-red-600',
          bgColor: 'bg-red-50 border-red-200',
          icon: <AlertTriangle className="h-6 w-6 text-red-600" />
        }
      default:
        return {
          text: 'Status desconhecido',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50 border-gray-200',
          icon: <Activity className="h-6 w-6 text-gray-600" />
        }
    }
  }

  const getUptimeColor = (uptime: number) => {
    if (uptime >= 99) return 'text-green-600'
    if (uptime >= 95) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getIncidentStatusColor = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'bg-green-100 text-green-800'
      case 'investigating':
        return 'bg-red-100 text-red-800'
      case 'identified':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#ffffff' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#0282ff' }}></div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#ffffff' }}>
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2" style={{ color: '#1f2937' }}>Erro ao carregar status</h2>
          <p className="mb-4" style={{ color: '#6b7280' }}>Não foi possível carregar as informações de status</p>
          {/* Botão de tentar novamente removido conforme solicitação */}
        </div>
      </div>
    )
  }

  const statusInfo = getOverallStatusInfo(data.overall_status)

  // URL absoluta e segura para a logo (evita path relativo quebrado)
  const rawLogoUrl = data?.monitors.length === 1 ? data.monitors[0].logo_url : null
  const logoSrc = rawLogoUrl
    ? (
        rawLogoUrl.startsWith('http://') ||
        rawLogoUrl.startsWith('https://') ||
        rawLogoUrl.startsWith('data:')
          ? rawLogoUrl
          : `/api${rawLogoUrl.startsWith('/') ? '' : '/'}${rawLogoUrl}`
      )
    : null

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
      {/* Hero Section */}
      <div className="w-full py-16 px-4" style={{ 
        backgroundColor: '#0282ff',
        backgroundImage: 'linear-gradient(135deg, #0282ff 0%, #0369a1 100%)'
      }}>
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-semibold mb-6 text-white/80">Status dos Serviços</h1>
          
          {groupName && (
            <div className="flex items-center justify-center mb-4">
              {/* Exibir logo apenas para monitores individuais */}
              {data?.monitors.length === 1 && logoSrc && (
                <div className="w-24 h-24 bg-white rounded-xl shadow-lg flex items-center justify-center mr-6 p-3">
                  <img 
                    src={logoSrc}
                    alt={`Logo ${data.monitors[0].name}`}
                    className="w-full h-full object-contain"
                    style={{
                      aspectRatio: '1/1'
                    }}
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      const container = target.parentElement;
                      if (container) {
                        container.style.display = 'none';
                      }
                    }}
                  />
                </div>
              )}
              <h2 className="text-4xl font-bold text-white">
                {groupName}
              </h2>
            </div>
          )}
          
          <p className="text-lg text-white/90">Acompanhe o status em tempo real dos nossos serviços</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8" style={{ 
        backgroundColor: '#ffffff', 
        margin: '0 auto', 
        borderRadius: '12px 12px 0 0', 
        marginTop: '-2rem', 
        position: 'relative', 
        zIndex: 10, 
        boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)' 
      }}>
        {/* Overall Status */}
        <Card className="mb-8 border shadow-lg text-gray-900" style={{ 
          backgroundColor: '#ffffff', 
          borderColor: '#e5e7eb',
          borderWidth: '1px',
          borderRadius: '12px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
        }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {statusInfo.icon}
                <div>
                  <h2 className={`text-xl font-semibold ${statusInfo.color}`}>
                    {statusInfo.text}
                  </h2>
                  <p className="text-sm" style={{ color: '#6b7280' }}>
                    Última atualização: {new Date(data.last_updated).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
              {/* Botão de atualização removido conforme solicitação */}
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="border shadow-sm text-gray-900 overflow-hidden" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
            <CardHeader className="pb-2" style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', padding: '1.5rem 1.5rem 1rem 1.5rem', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
              <CardTitle className="flex items-center text-lg font-semibold" style={{ color: '#111827' }}><TrendingUp className="h-4 w-4 mr-2 text-gray-600" />Disponibilidade 30 dias</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <CardTitle className={`text-2xl font-bold mb-3 ${uptimeData ? (uptimeData.uptime_percentage >= 90 ? 'text-green-600' : 'text-red-600') : 'text-gray-900'}`}>
                {uptimeData ? `${uptimeData.uptime_percentage.toFixed(2)}%` : 'Carregando...'}
              </CardTitle>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`${uptimeData ? (uptimeData.uptime_percentage >= 90 ? 'bg-green-500' : 'bg-red-500') : 'bg-gray-300'} h-2 rounded-full`} 
                  style={{ width: uptimeData ? `${uptimeData.uptime_percentage}%` : '0%' }}
                ></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm text-gray-900 overflow-hidden" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
            <CardHeader className="pb-2" style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', padding: '1.5rem 1.5rem 1rem 1.5rem', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
              <CardTitle className="flex items-center text-lg font-semibold" style={{ color: '#111827' }}><Globe className="h-4 w-4 mr-2 text-gray-600" />Total de Serviços</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <CardTitle className="text-2xl font-bold text-gray-900 mb-3">
                {totalServices}
              </CardTitle>
              <p className="text-sm text-gray-600">Serviços monitorados neste grupo</p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm text-gray-900 overflow-hidden" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
            <CardHeader className="pb-2" style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', padding: '1.5rem 1.5rem 1rem 1.5rem', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
              <CardTitle className="flex items-center text-lg font-semibold" style={{ color: '#111827' }}><AlertTriangle className="h-4 w-4 mr-2 text-gray-600" />Problemas 24h</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <CardTitle className="text-2xl font-bold text-gray-900 mb-3">
                {incidentsData ? incidentsData.total_incidents : 'Carregando...'}
              </CardTitle>
              <p className="text-sm text-gray-600">Incidentes nas últimas 24 horas</p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm text-gray-900 overflow-hidden" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
            <CardHeader className="pb-2" style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', padding: '1.5rem 1.5rem 1rem 1.5rem', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
              <CardTitle className="flex items-center text-lg font-semibold" style={{ color: '#111827' }}><BarChart3 className="h-4 w-4 mr-2 text-gray-600" />Tempo de Resposta</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <CardTitle className="text-2xl font-bold text-gray-900 mb-3">
                {responseTimeData ? `${responseTimeData.avg_response_time}ms` : 'Carregando...'}
              </CardTitle>
              <p className="text-sm text-gray-600">Última medição</p>
            </CardContent>
          </Card>
        </div>

        {/* Services Status */}
        <Card className="mb-8 border shadow-lg text-gray-900" style={{ 
          backgroundColor: '#ffffff', 
          borderColor: '#e5e7eb',
          borderWidth: '1px',
          borderRadius: '12px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
        }}>
          <CardHeader style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', padding: '1.5rem 1.5rem 1rem 1.5rem', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
            <CardTitle style={{ color: '#111827', fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>Status dos Serviços</CardTitle>
            <CardDescription style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              Status atual de todos os serviços monitorados
            </CardDescription>
          </CardHeader>
          <CardContent style={{ padding: '1.5rem' }}>
            {data.monitors.length === 0 ? (
              <div className="text-center py-8">
                <Globe className="h-12 w-12 mx-auto mb-4" style={{ color: '#6b7280' }} />
                <h3 className="text-lg font-medium mb-2" style={{ color: '#1f2937' }}>
                  Nenhum serviço configurado
                </h3>
                <p style={{ color: '#6b7280' }}>
                  Não há serviços sendo monitorados no momento
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.monitors.map((monitor) => (
                  <div
                    key={monitor.id}
                    className="flex items-center justify-between p-4 rounded-lg transition-all duration-200 hover:shadow-sm"
                    style={{ 
                      backgroundColor: '#ffffff', 
                      border: '1px solid #f3f4f6',
                      borderColor: '#f3f4f6'
                    }}
                  >
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(monitor.status, monitor.id)}
                      <div>
                        <h4 className="font-medium" style={{ color: '#1f2937' }}>{monitor.name}</h4>
                        <p className="text-sm" style={{ color: '#6b7280' }}>{monitor.url}</p>
                        <p className="text-xs" style={{ color: '#6b7280' }}>{monitor.group_name}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-6">
                      {/* Uptime Stats */}
                      <div className="text-right hidden sm:block">
                        <div className="flex space-x-4 text-xs">
                          <div>
                            <p style={{ color: '#6b7280' }}>24h</p>
                            <p className={`font-medium ${getUptimeColor(monitor.uptime_24h)}`}>
                              {monitor.uptime_24h?.toFixed(1) || '0.0'}%
                            </p>
                          </div>
                          <div>
                            <p style={{ color: '#6b7280' }}>7d</p>
                            <p className={`font-medium ${getUptimeColor(monitor.uptime_7d)}`}>
                              {monitor.uptime_7d?.toFixed(1) || '0.0'}%
                            </p>
                          </div>
                          <div>
                            <p style={{ color: '#6b7280' }}>30d</p>
                            <p className={`font-medium ${getUptimeColor(monitor.uptime_30d)}`}>
                              {monitor.uptime_30d?.toFixed(1) || '0.0'}%
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Response Time */}
                      {monitor.response_time && (
                        <div className="text-right">
                          <p className="text-sm font-medium" style={{ color: '#1f2937' }}>
                            {formatDuration(monitor.response_time)}
                          </p>
                          <p className="text-xs" style={{ color: '#6b7280' }}>resposta</p>
                        </div>
                      )}
                      
                      {/* Status Badge */}
                      <Badge variant="status" className={getStatusColor(monitor.status)}>
                        {monitor.status === 'online' && 'Online'}
                        {monitor.status === 'offline' && 'Offline'}
                        {monitor.status === 'warning' && 'Aviso'}
                        {monitor.status === 'unknown' && 'Desconhecido'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Charts Section */}
        {data.monitors.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Histórico de Uptime */}
            <Card className="border shadow-lg hover:shadow-xl transition-shadow duration-300" style={{ 
              backgroundColor: '#ffffff', 
              borderColor: '#e5e7eb',
              borderWidth: '1px',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            }}>
              <CardHeader style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', padding: '1.5rem 1.5rem 1rem 1.5rem', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
                <CardTitle className="flex items-center gap-2" style={{ color: '#111827', fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                  <TrendingUp className="h-5 w-5" />
                  Histórico de Uptime
                </CardTitle>
              </CardHeader>
              <CardContent style={{ padding: '1.5rem' }}>
                <div className="h-64">
                  {uptimeChartData ? (
                    <Bar 
                      data={uptimeChartData} 
                      options={{
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
                              color: '#6b7280',
                              callback: function(value) {
                                return value + '%'
                              }
                            },
                            grid: {
                              color: '#e5e7eb'
                            }
                          },
                          x: {
                            ticks: {
                              color: '#6b7280',
                              maxRotation: 45,
                            },
                            grid: {
                              color: '#e5e7eb'
                            }
                          }
                        },
                      }} 
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      Carregando dados de uptime...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>



            {/* Distribuição de Status */}
            <Card className="border shadow-lg hover:shadow-xl transition-shadow duration-300" style={{ 
              backgroundColor: '#ffffff', 
              borderColor: '#e5e7eb',
              borderWidth: '1px',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            }}>
              <CardHeader style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', padding: '1.5rem 1.5rem 1rem 1.5rem', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
                <CardTitle className="flex items-center gap-2" style={{ color: '#111827', fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                  <PieChart className="h-5 w-5" />
                  Distribuição de Status
                </CardTitle>
              </CardHeader>
              <CardContent style={{ padding: '1.5rem' }}>
                <div className="h-64">
                  <Doughnut 
                    data={generateStatusDistributionData(data.monitors)} 
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            color: '#6b7280',
                            padding: 20,
                          }
                        },
                      },
                    }} 
                  />
                </div>
              </CardContent>
            </Card>

            {/* Informações Detalhadas do Monitor */}
            {data.monitors.length === 1 && (
              <Card className="border shadow-lg hover:shadow-xl transition-shadow duration-300 lg:col-span-2" style={{ 
                backgroundColor: '#ffffff', 
                borderColor: '#e5e7eb',
                borderWidth: '1px',
                borderRadius: '12px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
              }}>
                <CardHeader style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', padding: '1.5rem 1.5rem 1rem 1.5rem', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
                  <CardTitle className="flex items-center gap-2" style={{ color: '#111827', fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    <BarChart3 className="h-5 w-5" />
                    Informações Detalhadas do Monitor
                  </CardTitle>
                  <CardDescription style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                    Estatísticas de performance do monitor selecionado
                  </CardDescription>
                </CardHeader>
                <CardContent style={{ padding: '1.5rem' }}>
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium mb-4" style={{ color: '#1f2937' }}>Estatísticas de Performance</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span style={{ color: '#6b7280' }}>Uptime Geral</span>
                          <span className={`font-medium ${getUptimeColor(data.monitors[0].uptime_30d)}`}>
                            {data.monitors[0].uptime_30d?.toFixed(2) || '0.00'}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: '#6b7280' }}>Uptime 24h</span>
                          <span className={`font-medium ${getUptimeColor(data.monitors[0].uptime_24h)}`}>
                            {data.monitors[0].uptime_24h?.toFixed(2) || '0.00'}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: '#6b7280' }}>Uptime 7d</span>
                          <span className={`font-medium ${getUptimeColor(data.monitors[0].uptime_7d)}`}>
                            {data.monitors[0].uptime_7d?.toFixed(2) || '0.00'}%
                          </span>
                        </div>
                      </div>
                      
                      {data.monitors[0].response_time && (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span style={{ color: '#6b7280' }}>Tempo Médio</span>
                            <span style={{ color: '#1f2937' }}>{monitorStats?.avgResponseTime || 0}ms</span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: '#6b7280' }}>Tempo Mínimo</span>
                            <span className="text-green-600">{monitorStats?.minResponseTime || 0}ms</span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: '#6b7280' }}>Tempo Máximo</span>
                            <span className="text-red-600">{monitorStats?.maxResponseTime || 0}ms</span>
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span style={{ color: '#6b7280' }}>Total de Verificações</span>
                          <span style={{ color: '#1f2937' }}>{monitorStats?.totalChecks || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: '#6b7280' }}>Verificações Bem-sucedidas</span>
                          <span className="text-green-600">{monitorStats?.successfulChecks || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: '#6b7280' }}>Verificações Falhadas</span>
                          <span className="text-red-600">{monitorStats?.failedChecks || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Incident History */}
        {incidents.length > 0 && (
          <Card className="border shadow-lg hover:shadow-xl transition-shadow duration-300" style={{ 
            backgroundColor: '#ffffff', 
            borderColor: '#e5e7eb',
            borderWidth: '1px',
            borderRadius: '12px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          }}>
            <CardHeader style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', padding: '1.5rem 1.5rem 1rem 1.5rem', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
              <CardTitle className="flex items-center space-x-2" style={{ color: '#111827', fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                <Calendar className="h-5 w-5" />
                <span>Histórico de Incidentes</span>
              </CardTitle>
              <CardDescription style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                Incidentes recentes e suas resoluções
              </CardDescription>
            </CardHeader>
            <CardContent style={{ padding: '1.5rem' }}>
              <div className="space-y-4">
                {incidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="border-l-4 border-gray-200 pl-4 py-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium" style={{ color: '#1f2937' }}>{incident.title}</h4>
                          <Badge variant="status" className={getIncidentStatusColor(incident.status)}>
                            {incident.status === 'resolved' && 'Resolvido'}
                            {incident.status === 'investigating' && 'Investigando'}
                            {incident.status === 'identified' && 'Identificado'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{incident.description}</p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>Serviço: {incident.monitor_name}</span>
                          <span>•</span>
                          <span>Início: {new Date(incident.started_at).toLocaleString('pt-BR')}</span>
                          {incident.resolved_at && (
                            <>
                              <span>•</span>
                              <span>Resolvido: {new Date(incident.resolved_at).toLocaleString('pt-BR')}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>Esta página é atualizada automaticamente a cada 30 segundos</p>
        </div>
      </div>
    </div>
  )
}