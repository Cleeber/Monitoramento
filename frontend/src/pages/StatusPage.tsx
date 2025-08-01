import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Activity,
  Globe,
  RefreshCw,
  Calendar
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { formatDuration } from '../lib/utils'

interface PublicMonitor {
  id: string
  name: string
  url: string
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

export function StatusPage() {
  const [data, setData] = useState<StatusPageData | null>(null)
  const [incidents, setIncidents] = useState<IncidentHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchStatusData()
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchStatusData, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchStatusData = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    
    try {
      const [statusResponse, incidentsResponse] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/public/status`),
        fetch(`${import.meta.env.VITE_API_URL}/public/incidents`)
      ])

      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        setData(statusData)
      }

      if (incidentsResponse.ok) {
        const incidentsData = await incidentsResponse.json()
        setIncidents(incidentsData)
      }
    } catch (error) {
      console.error('Erro ao buscar dados de status:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    fetchStatusData(true)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'offline':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      case 'warning':
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <Activity className="h-4 w-4 text-gray-600" />
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Erro ao carregar status</h2>
          <p className="text-gray-600 mb-4">Não foi possível carregar as informações de status</p>
          <Button onClick={handleRefresh}>
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  const statusInfo = getOverallStatusInfo(data.overall_status)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Status dos Serviços</h1>
          <p className="text-gray-600">Acompanhe o status em tempo real dos nossos serviços</p>
        </div>

        {/* Overall Status */}
        <Card className={`mb-8 border-2 ${statusInfo.bgColor}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {statusInfo.icon}
                <div>
                  <h2 className={`text-xl font-semibold ${statusInfo.color}`}>
                    {statusInfo.text}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Última atualização: {new Date(data.last_updated).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Services Status */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Status dos Serviços</CardTitle>
            <CardDescription>
              Status atual de todos os serviços monitorados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.monitors.length === 0 ? (
              <div className="text-center py-8">
                <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhum serviço configurado
                </h3>
                <p className="text-gray-600">
                  Não há serviços sendo monitorados no momento
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.monitors.map((monitor) => (
                  <div
                    key={monitor.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(monitor.status)}
                      <div>
                        <h4 className="font-medium text-gray-900">{monitor.name}</h4>
                        <p className="text-sm text-gray-600">{monitor.url}</p>
                        <p className="text-xs text-gray-500">{monitor.group_name}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-6">
                      {/* Uptime Stats */}
                      <div className="text-right hidden sm:block">
                        <div className="flex space-x-4 text-xs">
                          <div>
                            <p className="text-gray-500">24h</p>
                            <p className={`font-medium ${getUptimeColor(monitor.uptime_24h)}`}>
                              {monitor.uptime_24h?.toFixed(1) || '0.0'}%
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">7d</p>
                            <p className={`font-medium ${getUptimeColor(monitor.uptime_7d)}`}>
                              {monitor.uptime_7d?.toFixed(1) || '0.0'}%
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">30d</p>
                            <p className={`font-medium ${getUptimeColor(monitor.uptime_30d)}`}>
                              {monitor.uptime_30d?.toFixed(1) || '0.0'}%
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Response Time */}
                      {monitor.response_time && (
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {formatDuration(monitor.response_time)}
                          </p>
                          <p className="text-xs text-gray-500">resposta</p>
                        </div>
                      )}
                      
                      {/* Status Badge */}
                      <Badge className={getStatusColor(monitor.status)}>
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

        {/* Incident History */}
        {incidents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Histórico de Incidentes</span>
              </CardTitle>
              <CardDescription>
                Incidentes recentes e suas resoluções
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {incidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="border-l-4 border-gray-200 pl-4 py-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-gray-900">{incident.title}</h4>
                          <Badge className={getIncidentStatusColor(incident.status)}>
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