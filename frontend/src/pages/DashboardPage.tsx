import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Globe, 
  TrendingUp,
  Users,
  XCircle
} from 'lucide-react'
import { cn, formatDuration, calculateUptime } from '../lib/utils'

interface Monitor {
  id: string
  name: string
  url: string
  status: 'online' | 'offline' | 'warning' | 'unknown'
  last_check: string | null
  response_time: number | null
  group_name: string
  uptime_24h: number
  uptime_7d: number
  uptime_30d: number
}

interface DashboardStats {
  total_monitors: number
  online_monitors: number
  offline_monitors: number
  warning_monitors: number
  avg_response_time: number
  total_groups: number
  avg_uptime: number
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
    
    // Atualizar dados a cada 30 segundos
    const interval = setInterval(fetchDashboardData, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const [statsResponse, monitorsResponse] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/dashboard/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${import.meta.env.VITE_API_URL}/dashboard/monitors`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ])

      if (statsResponse.ok && monitorsResponse.ok) {
        const [statsData, monitorsData] = await Promise.all([
          statsResponse.json(),
          monitorsResponse.json()
        ])
        setStats(statsData)
        setMonitors(monitorsData)
      }
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error)
    } finally {
      setLoading(false)
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Visão geral do monitoramento de sites</p>
        </div>
        <Button onClick={fetchDashboardData} variant="outline">
          <Activity className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Monitores</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_monitors}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total_groups} grupos ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status Online</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.online_monitors}</div>
              <p className="text-xs text-muted-foreground">
                {stats.warning_monitors} com aviso
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status Offline</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.offline_monitors}</div>
              <p className="text-xs text-muted-foreground">
                Monitores inativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Uptime Médio</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avg_uptime?.toFixed(1) || '0.0'}%</div>
              <p className="text-xs text-muted-foreground">
                Últimas 24 horas
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Monitors */}
      <Card>
        <CardHeader>
          <CardTitle>Status dos Monitores</CardTitle>
          <CardDescription>
            Status atual de todos os monitores ativos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {monitors.length === 0 ? (
            <div className="text-center py-8">
              <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum monitor configurado
              </h3>
              <p className="text-gray-600 mb-4">
                Comece adicionando seus primeiros domínios para monitorar
              </p>
              <Button>
                Adicionar Monitor
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {monitors.map((monitor) => (
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
                  
                  <div className="flex items-center space-x-4">
                    {monitor.response_time && (
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {formatDuration(monitor.response_time)}
                        </p>
                        <p className="text-xs text-gray-500">tempo de resposta</p>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-2">
                      <Badge className={monitor.status === 'unknown' ? 'bg-gray-100 text-gray-800' : getStatusColor(monitor.status)}>
                         {monitor.status === 'online' && 'Online'}
                         {monitor.status === 'offline' && 'Offline'}
                         {monitor.status === 'warning' && 'Aviso'}
                         {monitor.status === 'unknown' && 'Desconhecido'}
                       </Badge>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {monitor.uptime_24h?.toFixed(1) || '0.0'}%
                        </p>
                        <p className="text-xs text-gray-500">uptime 24h</p>
                      </div>
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