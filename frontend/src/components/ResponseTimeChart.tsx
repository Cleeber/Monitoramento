import React, { useEffect, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface PublicMonitor {
  id: string
  name: string
  url: string
  status: 'online' | 'offline' | 'warning'
  response_time?: number
  uptime_percentage: number
  last_checked?: string
}

interface ResponseTimeChartProps {
  monitors: PublicMonitor[]
}

// Resolve API base garantindo URL absoluta mesmo se VITE_API_URL for relativa
const resolveApiBase = () => {
  const raw = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  const isAbsolute = /^https?:\/\//i.test(raw)
  if (isAbsolute) return raw
  const origin = (import.meta.env.VITE_BACKEND_ORIGIN || '').replace(/\/$/, '')
  if (origin) return `${origin}${raw || '/api'}`
  return '/api'
}

const buildApiBases = (): string[] => {
  const base = resolveApiBase()
  const backendOrigin = (import.meta.env.VITE_BACKEND_ORIGIN || '').replace(/\/$/, '')
  const raw = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  const fallback = (import.meta.env.VITE_FALLBACK_API_URL || '').replace(/\/$/, '')
  const bases: string[] = []
  const isAbsolute = /^https?:\/\//i.test(raw)
  if (isAbsolute) bases.push(raw)
  bases.push(base)
  if (fallback) bases.push(fallback)
  if (!isAbsolute && backendOrigin) bases.push(`${backendOrigin}${raw || '/api'}`)
  return Array.from(new Set(bases))
}

const ResponseTimeChart: React.FC<ResponseTimeChartProps> = ({ monitors }) => {
  const [chartData, setChartData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const generateChartData = async () => {
      setLoading(true)
      
      if (monitors.length === 0) {
        const last30Days = Array.from({ length: 30 }, (_, i) => {
          const date = new Date()
          date.setDate(date.getDate() - (29 - i))
          return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        })
        
        setChartData({
          labels: last30Days,
          datasets: [{
            label: 'Tempo de Resposta (ms)',
            data: last30Days.map(() => 0),
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderColor: '#3b82f6',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#3b82f6',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
          }],
        })
        setLoading(false)
        return
      }
      
      try {
        // Buscar dados históricos reais do primeiro monitor ativo
        const activeMonitor = monitors[0]
        // Tentar múltiplas bases de API para contornar falhas de proxy
        let checks: any[] = []
        let fetched = false
        for (const base of buildApiBases()) {
          try {
            const response = await fetch(`${base}/public/monitors/${activeMonitor.id}/checks?limit=100`)
            if (response.ok) {
              checks = await response.json()
              fetched = true
              break
            }
          } catch (_) { /* tentar próxima base */ }
        }
        if (!fetched) throw new Error('Falha ao buscar dados históricos')
        
        // Agrupar checks por dia e calcular média de tempo de resposta
        const dailyData = new Map()
        
        checks.forEach((check: any) => {
          const date = new Date(check.checked_at)
          const dayKey = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          
          if (!dailyData.has(dayKey)) {
            dailyData.set(dayKey, { total: 0, count: 0 })
          }
          
          const dayStats = dailyData.get(dayKey)
          dayStats.total += check.response_time || 0
          dayStats.count += 1
        })
        
        // Gerar últimos 30 dias
        const last30Days = Array.from({ length: 30 }, (_, i) => {
          const date = new Date()
          date.setDate(date.getDate() - (29 - i))
          return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        })
        
        const chartDataValues = last30Days.map(day => {
          const dayStats = dailyData.get(day)
          return dayStats ? Math.round(dayStats.total / dayStats.count) : null
        })
        
        // Preencher valores nulos com interpolação
        for (let i = 0; i < chartDataValues.length; i++) {
          if (chartDataValues[i] === null) {
            // Encontrar valores válidos antes e depois
            let prevValue = null
            let nextValue = null
            
            for (let j = i - 1; j >= 0; j--) {
              if (chartDataValues[j] !== null) {
                prevValue = chartDataValues[j]
                break
              }
            }
            
            for (let j = i + 1; j < chartDataValues.length; j++) {
              if (chartDataValues[j] !== null) {
                nextValue = chartDataValues[j]
                break
              }
            }
            
            // Interpolar ou usar valor padrão
            if (prevValue !== null && nextValue !== null) {
              chartDataValues[i] = Math.round((prevValue + nextValue) / 2)
            } else if (prevValue !== null) {
              chartDataValues[i] = prevValue
            } else if (nextValue !== null) {
              chartDataValues[i] = nextValue
            } else {
              chartDataValues[i] = 100 // Valor padrão
            }
          }
        }
        
        setChartData({
          labels: last30Days,
          datasets: [{
            label: 'Tempo de Resposta (ms)',
            data: chartDataValues,
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderColor: '#3b82f6',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#3b82f6',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
          }],
        })
      } catch (error) {
        console.error('Erro ao gerar dados do gráfico:', error)
        // Fallback para dados simulados em caso de erro
        const last30Days = Array.from({ length: 30 }, (_, i) => {
          const date = new Date()
          date.setDate(date.getDate() - (29 - i))
          return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        })
        
        const avgResponseTime = monitors.length > 0 && monitors.some(m => m.response_time)
          ? monitors
              .filter(m => m.response_time)
              .reduce((acc, m) => acc + (m.response_time || 0), 0) / 
            monitors.filter(m => m.response_time).length
          : 100
        
        setChartData({
          labels: last30Days,
          datasets: [{
            label: 'Tempo de Resposta (ms)',
            data: last30Days.map(() => Math.round(avgResponseTime + (Math.random() - 0.5) * 50)),
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderColor: '#3b82f6',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#3b82f6',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
          }],
        })
      }
      
      setLoading(false)
    }

    generateChartData()
  }, [monitors])

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: '#3b82f6',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: function(context: any) {
            return `${context.parsed.y}ms`
          }
        }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#6b7280',
          font: {
            size: 12,
          },
          callback: function(value: any) {
            return value + 'ms'
          }
        },
        grid: {
          color: 'rgba(229, 231, 235, 0.5)',
          drawBorder: false,
        },
        border: {
          display: false,
        }
      },
      x: {
        ticks: {
          color: '#6b7280',
          font: {
            size: 11,
          },
          maxRotation: 0,
          maxTicksLimit: 8,
        },
        grid: {
          display: false,
        },
        border: {
          display: false,
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    elements: {
      point: {
        hoverBackgroundColor: '#1d4ed8',
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!chartData) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Nenhum dado disponível
      </div>
    )
  }

  return <Line data={chartData} options={options} />
}

export default ResponseTimeChart