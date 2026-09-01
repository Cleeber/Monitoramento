
interface MonitorStats {
  totalChecks: number
  successfulChecks: number
  failedChecks: number
  minResponseTime: number
  maxResponseTime: number
  avgResponseTime: number
}

// Função para buscar dados históricos reais de uptime
export const fetchUptimeHistory = async (monitorId?: string) => {
  try {
    const params = new URLSearchParams({
      days: '30'
    })
    
    if (monitorId && monitorId !== 'all') {
      params.append('monitor_id', monitorId)
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
export const fetchMonitorStats = async (monitorId: string): Promise<MonitorStats | null> => {
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
