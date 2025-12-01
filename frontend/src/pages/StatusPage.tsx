import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { StatusPageTemplate } from '../components/templates/StatusPageTemplate'
import { fetchUptimeHistory, fetchMonitorStats } from '../utils/statusApi'

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

export function StatusPage() {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<StatusPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [incidents, setIncidents] = useState<IncidentHistory[]>([])
  const [pageTitle, setPageTitle] = useState<string>('')
  const [uptimeChartData, setUptimeChartData] = useState<any>(null)
  const [monitorStats, setMonitorStats] = useState<MonitorStats | null>(null)
  const [uptimeData, setUptimeData] = useState<any>(null)
  const [incidentsData, setIncidentsData] = useState<any>(null)
  const [responseTimeData, setResponseTimeData] = useState<any>(null)
  
  useEffect(() => {
    fetchStatusData()
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(() => {
      fetchStatusData()
    }, 30000)
    return () => clearInterval(interval)
  }, [slug])

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
      // Se for página geral, não passa ID. Se for monitor, passa ID do primeiro monitor
      const monitorId = (!slug || slug === 'all') ? undefined : data?.monitors[0]?.id
      const chartData = await fetchUptimeHistory(monitorId)
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
      
      if (!slug || slug === 'all') {
        statusUrl = `/api/public/status/all`
        incidentsUrl = `/api/public/incidents`
        setPageTitle('Status Geral dos Serviços')
      } else {
        statusUrl = `/api/public/status/monitor/${slug}`
        incidentsUrl = `/api/public/incidents` // Será ajustado após obter o ID
      }
        
      const statusResponse = await fetch(statusUrl)

      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        setData(statusData)
        
        if (slug && slug !== 'all') {
            setPageTitle(statusData.monitor?.name || 'Status do Serviço')
            // Ajustar URL de incidentes com o ID do monitor
            if (statusData.monitor?.id) {
                incidentsUrl = `/api/public/incidents?monitor_id=${statusData.monitor.id}`
            }
        }

        // Buscar incidentes com os filtros apropriados
        const incidentsResponse = await fetch(incidentsUrl)
        if (incidentsResponse.ok) {
            const incidentsData = await incidentsResponse.json()
            setIncidents(incidentsData)
        }
      } else {
        setPageTitle('Página não encontrada')
      }
    } catch (error) {
      console.error('Erro ao buscar dados de status:', error)
      setPageTitle('Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

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
    <StatusPageTemplate
      data={data}
      incidents={incidents}
      pageTitle={pageTitle}
      uptimeChartData={uptimeChartData}
      uptimeData={uptimeData}
      monitorStats={monitorStats}
      incidentsData={incidentsData}
      responseTimeData={responseTimeData}
      loading={loading}
      logoSrc={logoSrc}
    />
  )
}