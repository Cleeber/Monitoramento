import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { formatDuration } from '@/lib/utils'
import { Bar, Doughnut } from 'react-chartjs-2'

// Interfaces (copied from StatusPage.tsx to ensure type safety)
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

interface StatusPageTemplateProps {
  data: StatusPageData | null
  incidents: IncidentHistory[]
  pageTitle: string
  uptimeChartData: any
  uptimeData: any
  monitorStats: MonitorStats | null
  incidentsData: any
  responseTimeData: any
  loading: boolean
  logoSrc: string | null
  isPdf?: boolean
}

function getStatusIcon(status: string, id?: string) {
  switch (status) {
    case 'online':
      return <CheckCircle className="h-5 w-5 text-green-500" />
    case 'offline':
      return <AlertTriangle className="h-5 w-5 text-red-500" />
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />
    default:
      return <Activity className="h-5 w-5 text-gray-400" />
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'online':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'offline':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'warning':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

function getUptimeColor(uptime: number) {
  if (!uptime && uptime !== 0) return 'text-gray-400'
  if (uptime >= 99) return 'text-green-600'
  if (uptime >= 95) return 'text-yellow-600'
  return 'text-red-600'
}

function getIncidentStatusColor(status: string) {
  switch (status) {
    case 'resolved':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'investigating':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'identified':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

function generateStatusDistributionData(monitors: PublicMonitor[]) {
  const online = monitors.filter(m => m.status === 'online').length
  const warning = monitors.filter(m => m.status === 'warning').length
  const offline = monitors.filter(m => m.status === 'offline').length
  const unknown = monitors.filter(m => m.status === 'unknown').length

  return {
    labels: ['Online', 'Aviso', 'Offline', 'Desconhecido'],
    datasets: [
      {
        data: [online, warning, offline, unknown],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#6b7280'],
        borderColor: ['#059669', '#d97706', '#dc2626', '#4b5563'],
        borderWidth: 1,
      },
    ],
  }
}

export function StatusPageTemplate({
  data,
  incidents,
  pageTitle,
  uptimeChartData,
  uptimeData,
  monitorStats,
  incidentsData,
  responseTimeData,
  loading,
  logoSrc,
  isPdf = false
}: StatusPageTemplateProps) {
  // Calcular totalServices baseado nos dados
  const totalServices = data ? data.monitors.length : 0

  if (loading) {
    // ...
  }

  if (!data) {
    // ...
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
      {/* Hero Section */}
      <div className="w-full px-4" style={{ 
        backgroundColor: '#0282ff',
        backgroundImage: 'linear-gradient(135deg, #0282ff 0%, #0369a1 100%)',
        paddingTop: isPdf ? '1.5rem' : '4rem',
        paddingBottom: isPdf ? '2.5rem' : '4rem'
      }}>
        <div className="max-w-4xl mx-auto text-center">
        <div className="flex items-center gap-4 justify-center md:justify-start">
          {logoSrc ? (
            <img 
              src={logoSrc} 
              alt="Logo" 
              className={`${isPdf ? 'h-12 w-12' : 'h-24 w-24'} object-contain rounded-lg bg-white p-1 shadow-md`}
            />
          ) : (
            <div className="p-3 bg-white/10 rounded-lg backdrop-blur-sm">
              <Globe className={`${isPdf ? 'h-6 w-6' : 'h-12 w-12'} text-white`} />
            </div>
          )}
          <div className="text-left">
            <h1 className="font-bold text-white shadow-sm" style={{ fontSize: isPdf ? '20px' : '36px', lineHeight: '1.2' }}>{pageTitle}</h1>
          </div>
        </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8" style={{ 
        backgroundColor: '#ffffff', 
        margin: '0 auto', 
        borderRadius: '12px 12px 0 0', 
        marginTop: isPdf ? '-1.5rem' : '-2rem', 
        position: 'relative', 
        zIndex: 10, 
        boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)',
        paddingTop: isPdf ? '1rem' : '2rem',
        paddingBottom: isPdf ? '1rem' : '2rem'
      }}>


        {/* Key Metrics */}
        <div className={`grid grid-cols-1 md:grid-cols-2 ${isPdf ? 'gap-3 mb-4' : 'gap-6 mb-8'}`}>
          <Card className="border shadow-sm text-gray-900 overflow-hidden" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
            <CardHeader className="pb-2" style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', padding: isPdf ? '0.75rem' : '1.5rem 1.5rem 1rem 1.5rem', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
              <CardTitle className="flex items-center text-lg font-semibold" style={{ color: '#111827', fontSize: isPdf ? '0.9rem' : '1.125rem' }}><TrendingUp className="h-4 w-4 mr-2 text-gray-600" />Disponibilidade 30 dias</CardTitle>
            </CardHeader>
            <CardContent className={isPdf ? 'pt-3 pb-3 px-3' : 'pt-6'}>
              <CardTitle className={`text-2xl font-bold mb-3 ${uptimeData ? (uptimeData.uptime_percentage >= 90 ? 'text-green-600' : 'text-red-600') : 'text-gray-900'}`} style={{ fontSize: isPdf ? '1.1rem' : '1.5rem' }}>
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
            <CardHeader className="pb-2" style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', padding: isPdf ? '0.75rem' : '1.5rem 1.5rem 1rem 1.5rem', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
              <CardTitle className="flex items-center text-lg font-semibold" style={{ color: '#111827', fontSize: isPdf ? '0.9rem' : '1.125rem' }}><Globe className="h-4 w-4 mr-2 text-gray-600" />Total de Serviços</CardTitle>
            </CardHeader>
            <CardContent className={isPdf ? 'pt-3 pb-3 px-3' : 'pt-6'}>
              <CardTitle className="text-2xl font-bold text-gray-900 mb-3" style={{ fontSize: isPdf ? '1.1rem' : '1.5rem' }}>
                {totalServices}
              </CardTitle>
              <p className="text-sm text-gray-600">Serviços monitorados neste grupo</p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm text-gray-900 overflow-hidden" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
            <CardHeader className="pb-2" style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', padding: isPdf ? '0.75rem' : '1.5rem 1.5rem 1rem 1.5rem', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
              <CardTitle className="flex items-center text-lg font-semibold" style={{ color: '#111827', fontSize: isPdf ? '0.9rem' : '1.125rem' }}><AlertTriangle className="h-4 w-4 mr-2 text-gray-600" />Problemas 24h</CardTitle>
            </CardHeader>
            <CardContent className={isPdf ? 'pt-3 pb-3 px-3' : 'pt-6'}>
              <CardTitle className="text-2xl font-bold text-gray-900 mb-3" style={{ fontSize: isPdf ? '1.1rem' : '1.5rem' }}>
                {incidentsData ? incidentsData.total_incidents : 'Carregando...'}
              </CardTitle>
              <p className="text-sm text-gray-600">Incidentes nas últimas 24 horas</p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm text-gray-900 overflow-hidden" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
            <CardHeader className="pb-2" style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', padding: isPdf ? '0.75rem' : '1.5rem 1.5rem 1rem 1.5rem', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
              <CardTitle className="flex items-center text-lg font-semibold" style={{ color: '#111827', fontSize: isPdf ? '0.9rem' : '1.125rem' }}><BarChart3 className="h-4 w-4 mr-2 text-gray-600" />Tempo de Resposta</CardTitle>
            </CardHeader>
            <CardContent className={isPdf ? 'pt-3 pb-3 px-3' : 'pt-6'}>
              <CardTitle className="text-2xl font-bold text-gray-900 mb-3" style={{ fontSize: isPdf ? '1.1rem' : '1.5rem' }}>
                {responseTimeData ? `${responseTimeData.avg_response_time}ms` : 'Carregando...'}
              </CardTitle>
              <p className="text-sm text-gray-600">Última medição</p>
            </CardContent>
          </Card>
        </div>

        {/* Services Status */}
        <Card className={`border shadow-lg text-gray-900 ${isPdf ? 'mb-4' : 'mb-8'}`} style={{ 
          backgroundColor: '#ffffff', 
          borderColor: '#e5e7eb',
          borderWidth: '1px',
          borderRadius: '12px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
        }}>
          <CardHeader style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', padding: isPdf ? '0.75rem' : '1.5rem 1.5rem 1rem 1.5rem', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
            <CardTitle style={{ color: '#111827', fontSize: isPdf ? '1rem' : '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>Status dos Serviços</CardTitle>
            <CardDescription style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              Status atual de todos os serviços monitorados
            </CardDescription>
          </CardHeader>
          <CardContent style={{ padding: isPdf ? '0.75rem' : '1.5rem' }}>
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
                      borderColor: '#f3f4f6',
                      padding: isPdf ? '0.5rem' : '1rem'
                    }}
                  >
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(monitor.status, monitor.id)}
                      <div>
                        <h4 className="font-medium" style={{ color: '#1f2937', fontSize: isPdf ? '0.85rem' : '1rem' }}>{monitor.name}</h4>
                        <p className="text-sm" style={{ color: '#6b7280' }}>{monitor.url}</p>
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
          <div className={`grid grid-cols-1 lg:grid-cols-2 ${isPdf ? 'gap-3 mb-4' : 'gap-6 mb-8'}`}>
            {/* Histórico de Uptime */}
            <Card className="border shadow-lg hover:shadow-xl transition-shadow duration-300" style={{ 
              backgroundColor: '#ffffff', 
              borderColor: '#e5e7eb',
              borderWidth: '1px',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            }}>
              <CardHeader style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', padding: isPdf ? '0.75rem' : '1.5rem 1.5rem 1rem 1.5rem', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
                <CardTitle className="flex items-center gap-2" style={{ color: '#111827', fontSize: isPdf ? '1rem' : '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                  <TrendingUp className="h-5 w-5" />
                  Histórico de Uptime
                </CardTitle>
              </CardHeader>
              <CardContent style={{ padding: isPdf ? '0.75rem' : '1.5rem' }}>
                <div className={isPdf ? 'h-40' : 'h-64'}>
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
              <CardHeader style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', padding: isPdf ? '0.75rem' : '1.5rem 1.5rem 1rem 1.5rem', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
                <CardTitle className="flex items-center gap-2" style={{ color: '#111827', fontSize: isPdf ? '1rem' : '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                  <PieChart className="h-5 w-5" />
                  Distribuição de Status
                </CardTitle>
              </CardHeader>
              <CardContent style={{ padding: isPdf ? '0.75rem' : '1.5rem' }}>
                <div className={isPdf ? 'h-40' : 'h-64'}>
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
                <CardHeader style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', padding: isPdf ? '0.75rem' : '1.5rem 1.5rem 1rem 1.5rem', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
                  <CardTitle className="flex items-center gap-2" style={{ color: '#111827', fontSize: isPdf ? '1rem' : '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    <BarChart3 className="h-5 w-5" />
                    Informações Detalhadas do Monitor
                  </CardTitle>
                  <CardDescription style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                    Estatísticas de performance do monitor selecionado
                  </CardDescription>
                </CardHeader>
                <CardContent style={{ padding: isPdf ? '0.75rem' : '1.5rem' }}>
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
            <CardHeader style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', padding: isPdf ? '0.75rem' : '1.5rem 1.5rem 1rem 1.5rem', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
              <CardTitle className="flex items-center space-x-2" style={{ color: '#111827', fontSize: isPdf ? '1rem' : '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                <Calendar className="h-5 w-5" />
                <span>Histórico de Incidentes</span>
              </CardTitle>
              <CardDescription style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                Incidentes recentes e suas resoluções
              </CardDescription>
            </CardHeader>
            <CardContent style={{ padding: isPdf ? '0.75rem' : '1.5rem' }}>
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