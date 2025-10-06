import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Monitor,
  TrendingUp,
  ArrowUpDown
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
// Removido import não utilizado: Link
// import { Link } from 'react-router-dom'
import { cn, formatDuration, calculateUptime } from '../lib/utils'
import { apiGet } from '../utils/apiUtils'
// Removidos imports não utilizados: formatDistanceToNow, ptBR
// import { formatDistanceToNow } from 'date-fns'
// import { ptBR } from 'date-fns/locale'

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
  const [sortBy, setSortBy] = useState<'recent' | 'alphabetical' | 'status'>('recent')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    fetchDashboardData()
    
    // Atualizar dados a cada 30 segundos
    const interval = setInterval(fetchDashboardData, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      
      if (!token) {
        console.log('Token não encontrado, redirecionando para login')
        window.location.href = '/login'
        return
      }

      const [statsResult, monitorsResult] = await Promise.all([
        apiGet('/dashboard/stats'),
        apiGet('/dashboard/monitors')
      ])

      // Verificar se alguma resposta indica token inválido
      if (statsResult.status === 401 || monitorsResult.status === 401) {
        console.log('Token inválido, removendo do localStorage e redirecionando')
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user_data')
        window.location.href = '/login'
        return
      }

      if (statsResult.success && monitorsResult.success) {
        setStats(statsResult.data)
        setMonitors(monitorsResult.data)
      } else {
        console.error('Erro nas respostas da API:', {
          stats: statsResult.error,
          monitors: monitorsResult.error
        })
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
        return <CheckCircle className="h-4 w-4 text-green-400" />
      case 'offline':
        return <XCircle className="h-4 w-4 text-red-400" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-400" />
      default:
        return <Activity className="h-4 w-4 text-gray-400" />
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

  const getSortedMonitors = () => {
    const monitorsCopy = [...monitors].filter(monitor => monitor.id)
    let sorted: Monitor[]
    
    switch (sortBy) {
      case 'alphabetical':
        sorted = monitorsCopy.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'status':
        const statusOrder: { [key: string]: number } = { 'offline': 0, 'warning': 1, 'online': 2, 'unknown': 3 }
        sorted = monitorsCopy.sort((a, b) => (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3))
        break
      case 'recent':
      default:
        sorted = monitorsCopy.sort((a, b) => {
          if (!a.last_check && !b.last_check) return 0
          if (!a.last_check) return 1
          if (!b.last_check) return -1
          return new Date(b.last_check).getTime() - new Date(a.last_check).getTime()
        })
        break
    }
    
    return sortOrder === 'desc' ? sorted : sorted.reverse()
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

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border" style={{backgroundColor: '#181b20', borderColor: '#2c313a'}}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total de Sites</CardTitle>
              <Monitor className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.total_monitors}</div>
              <p className="text-xs text-gray-400">
                {stats.total_groups > 0 ? `Distribuídos em ${stats.total_groups} grupo${stats.total_groups > 1 ? 's' : ''}` : 'Nenhum grupo configurado'}
              </p>
            </CardContent>
          </Card>

          <Card className="border" style={{backgroundColor: '#181b20', borderColor: '#2c313a'}}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Sites Online</CardTitle>
              <CheckCircle className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.online_monitors}</div>
              <p className="text-xs text-green-400">
                {stats.total_monitors > 0 ? `${((stats.online_monitors / stats.total_monitors) * 100).toFixed(1)}% do total` : 'Nenhum site configurado'}
              </p>
            </CardContent>
          </Card>

          <Card className="border" style={{backgroundColor: '#181b20', borderColor: '#2c313a'}}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Sites Offline</CardTitle>
              <XCircle className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.offline_monitors}</div>
              <p className="text-xs text-red-400">
                {stats.offline_monitors > 0 ? `${stats.warning_monitors > 0 ? `+${stats.warning_monitors} com problemas` : 'Requer atenção imediata'}` : 'Todos os sites funcionando'}
              </p>
            </CardContent>
          </Card>

          <Card className="border" style={{backgroundColor: '#181b20', borderColor: '#2c313a'}}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Uptime Médio</CardTitle>
              <TrendingUp className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.avg_uptime?.toFixed(1) || '0.0'}%</div>
              <p className="text-xs text-gray-400">
                {stats.avg_response_time ? `Tempo médio: ${stats.avg_response_time.toFixed(0)}ms` : 'Sem dados de resposta'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sites Monitorados Section */}
      <Card className="border" style={{backgroundColor: '#181b20', borderColor: '#2c313a'}}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Sites Monitorados</CardTitle>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1 rounded hover:bg-gray-700 transition-colors"
                title={`Ordenação ${sortOrder === 'asc' ? 'crescente' : 'decrescente'}`}
              >
                <ArrowUpDown className={`h-4 w-4 text-gray-400 transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
              </button>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'recent' | 'alphabetical' | 'status')}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Mais Recentes</SelectItem>
                  <SelectItem value="alphabetical">Ordem Alfabética</SelectItem>
                  <SelectItem value="status">Por Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {monitors.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow style={{borderColor: '#2c313a'}}>
                  <TableHead className="text-gray-300">Status</TableHead>
                  <TableHead className="text-gray-300">Nome</TableHead>
                  <TableHead className="text-gray-300">URL</TableHead>
                  <TableHead className="text-gray-300">Grupo</TableHead>
                  <TableHead className="text-gray-300">Uptime 24h</TableHead>
                  <TableHead className="text-gray-300">Tempo de Resposta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getSortedMonitors().map((monitor) => (
                  <TableRow key={monitor.id} style={{borderColor: '#2c313a'}} className="hover:bg-gray-800/50">
                    <TableCell className="text-white">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(monitor.status)}
                        <span className="text-xs capitalize">{monitor.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-white">
                      <span className="font-medium">{monitor.name}</span>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      <code className="text-xs bg-gray-800 px-2 py-1 rounded">
                        {monitor.url}
                      </code>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {monitor.group_name || 'Sem grupo'}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      <Badge className={getStatusColor(monitor.status)}>
                        {monitor.uptime_24h?.toFixed(0) || '0'}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      <span className="text-sm">{monitor.response_time || 0}ms</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Monitor className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Nenhum monitor configurado</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}