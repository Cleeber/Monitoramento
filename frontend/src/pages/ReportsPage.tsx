import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Download, Mail, Activity, TrendingUp, Clock, AlertTriangle, PieChart } from 'lucide-react'
import { PeriodFilter, DEFAULT_TIME_RANGE } from '@/components/shared/PeriodFilter'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
)

interface Monitor {
  id: string
  name: string
  url: string
  status: string
  group_name?: string
}

interface Report {
  monitor_id: string
  monitor_name: string
  uptime_percentage: number
  total_checks: number
  successful_checks: number
  failed_checks: number
  avg_response_time: number
  min_response_time: number
  max_response_time: number
  incidents: number
  last_incident?: string
}

interface MonitorCheck {
  id: string
  monitor_id: string
  status: string
  response_time: number
  checked_at: string
  error_message?: string
}

interface OverallStats {
  total_checks: number
  total_incidents: number
  avg_uptime: number
  avg_response_time: number
}

interface ChartData {
  labels: string[]
  datasets: any[]
}

type TimeRange = 'yesterday' | 'last_week' | 'last_month' | '7d' | '30d' | '90d'

function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [selectedMonitor, setSelectedMonitor] = useState<string>('all')
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>(DEFAULT_TIME_RANGE as TimeRange)
  const [monitorChecks, setMonitorChecks] = useState<MonitorCheck[]>([])
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)

  const calculatePeriodRange = (timeRange: TimeRange) => {
    const now = new Date()
    const start = new Date()
    
    switch (timeRange) {
      case 'yesterday':
        start.setDate(now.getDate() - 1)
        start.setHours(0, 0, 0, 0)
        now.setDate(now.getDate() - 1)
        now.setHours(23, 59, 59, 999)
        break
      case 'last_week':
        // Semana passada (segunda a domingo)
        const lastWeekEnd = new Date()
        lastWeekEnd.setDate(now.getDate() - now.getDay()) // Domingo da semana atual
        lastWeekEnd.setHours(23, 59, 59, 999)
        
        start.setDate(lastWeekEnd.getDate() - 6) // Segunda da semana passada
        start.setHours(0, 0, 0, 0)
        
        now.setTime(lastWeekEnd.getTime())
        break
      case 'last_month':
        // Mês passado completo
        start.setMonth(now.getMonth() - 1, 1)
        start.setHours(0, 0, 0, 0)
        now.setDate(0) // Último dia do mês passado
        now.setHours(23, 59, 59, 999)
        break
      case '7d':
        start.setDate(now.getDate() - 7)
        break
      case '30d':
        start.setDate(now.getDate() - 30)
        break
      case '90d':
        start.setDate(now.getDate() - 90)
        break
    }
    
    return { start, end: now }
  }

  const getPeriodLabel = (timeRange: TimeRange): string => {
    switch (timeRange) {
      case 'yesterday':
        return 'Ontem'
      case 'last_week':
        return 'Semana passada'
      case 'last_month':
        return 'Mês passado'
      case '7d':
        return 'Últimos 7 dias'
      case '30d':
        return 'Últimos 30 dias'
      case '90d':
        return 'Últimos 3 meses'
      default:
        return 'Período selecionado'
    }
  }

  const fetchReports = async () => {
    try {
      setLoading(true)
      const { start, end } = calculatePeriodRange(selectedTimeRange)
      
      const params = new URLSearchParams({
        start_date: start.toISOString(),
        end_date: end.toISOString()
      })
      
      if (selectedMonitor !== 'all') {
        params.append('monitor_id', selectedMonitor)
      }
      
      const response = await fetch(`/api/reports?${params}`)
      if (!response.ok) {
        throw new Error('Erro ao carregar relatórios')
      }
      
      const data = await response.json()
      setReports(data.reports || [])
      setOverallStats(data.overall_stats || null)
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error)
      toast.error('Erro ao carregar relatórios')
    } finally {
      setLoading(false)
    }
  }

  const fetchMonitors = async () => {
    try {
      const response = await fetch('/api/monitors')
      if (!response.ok) {
        throw new Error('Erro ao carregar monitores')
      }
      
      const data = await response.json()
      setMonitors(data)
    } catch (error) {
      console.error('Erro ao carregar monitores:', error)
      toast.error('Erro ao carregar monitores')
    }
  }

  const fetchMonitorChecks = async () => {
    if (selectedMonitor === 'all') {
      setMonitorChecks([])
      return
    }
    
    try {
      const { start, end } = calculatePeriodRange(selectedTimeRange)
      
      const params = new URLSearchParams({
        monitor_id: selectedMonitor,
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        limit: '1000'
      })
      
      const response = await fetch(`/api/monitor-checks?${params}`)
      if (!response.ok) {
        throw new Error('Erro ao carregar verificações do monitor')
      }
      
      const data = await response.json()
      setMonitorChecks(data)
    } catch (error) {
      console.error('Erro ao carregar verificações do monitor:', error)
      toast.error('Erro ao carregar verificações do monitor')
    }
  }

  useEffect(() => {
    fetchMonitors()
  }, [])

  useEffect(() => {
    fetchReports()
    fetchMonitorChecks()
  }, [selectedTimeRange, selectedMonitor])

  const handleExport = async () => {
    try {
      setExporting(true)
      
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 20
      
      pdf.setFontSize(20)
      pdf.text('Relatório de Monitoramento', margin, 30)
      
      pdf.setFontSize(12)
      pdf.text(`Período: ${getPeriodLabel(selectedTimeRange)}`, margin, 45)
      pdf.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, margin, 55)
      
      if (selectedMonitor !== 'all') {
        const monitor = monitors.find(m => m.id === selectedMonitor)
        if (monitor) {
          pdf.text(`Monitor: ${monitor.name}`, margin, 65)
        }
      }
      
      let yPosition = 80
      
      if (overallStats) {
        pdf.setFontSize(16)
        pdf.text('Estatísticas Gerais', margin, yPosition)
        yPosition += 15
        
        pdf.setFontSize(12)
        pdf.text(`Uptime Médio: ${overallStats.avg_uptime?.toFixed(2) || '0.00'}%`, margin, yPosition)
        yPosition += 10
        pdf.text(`Total de Verificações: ${overallStats.total_checks.toLocaleString()}`, margin, yPosition)
        yPosition += 10
        pdf.text(`Total de Incidentes: ${overallStats.total_incidents}`, margin, yPosition)
        yPosition += 10
        pdf.text(`Tempo de Resposta Médio: ${Math.round(overallStats.avg_response_time)}ms`, margin, yPosition)
        yPosition += 20
      }
      
      const chartElements = ['uptime-chart', 'response-time-chart', 'status-distribution-chart']
      
      for (const elementId of chartElements) {
        const element = document.getElementById(elementId)
        if (element && yPosition < pageHeight - 100) {
          try {
            const canvas = await html2canvas(element, {
              backgroundColor: '#181b20',
              scale: 1,
              logging: false
            })
            
            const imgData = canvas.toDataURL('image/png')
            const imgWidth = pageWidth - (margin * 2)
            const imgHeight = (canvas.height * imgWidth) / canvas.width
            
            if (yPosition + imgHeight > pageHeight - margin) {
              pdf.addPage()
              yPosition = margin
            }
            
            pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight)
            yPosition += imgHeight + 15
          } catch (error) {
            console.error(`Erro ao capturar gráfico ${elementId}:`, error)
          }
        }
      }
      
      if (reports.length > 0) {
        if (yPosition > pageHeight - 100) {
          pdf.addPage()
          yPosition = margin
        }
        
        pdf.setFontSize(16)
        pdf.text('Detalhes dos Monitores', margin, yPosition)
        yPosition += 15
        
        pdf.setFontSize(10)
        
        reports.forEach((report, index) => {
          if (yPosition > pageHeight - 40) {
            pdf.addPage()
            yPosition = margin
          }
          
          pdf.text(`${index + 1}. ${report.monitor_name}`, margin, yPosition)
          yPosition += 8
          pdf.text(`   Uptime: ${report.uptime_percentage.toFixed(2)}%`, margin + 5, yPosition)
          yPosition += 6
          pdf.text(`   Verificações: ${report.total_checks} (${report.successful_checks} sucesso, ${report.failed_checks} falha)`, margin + 5, yPosition)
          yPosition += 6
          pdf.text(`   Tempo de Resposta: ${report.avg_response_time.toFixed(0)}ms (min: ${report.min_response_time.toFixed(0)}ms, max: ${report.max_response_time.toFixed(0)}ms)`, margin + 5, yPosition)
          yPosition += 6
          pdf.text(`   Incidentes: ${report.incidents}`, margin + 5, yPosition)
          yPosition += 12
        })
      }
      
      const fileName = selectedMonitor === 'all' 
        ? `relatorio-geral-${selectedTimeRange}-${new Date().toISOString().slice(0, 10)}.pdf`
        : `relatorio-${monitors.find(m => m.id === selectedMonitor)?.name || 'monitor'}-${selectedTimeRange}-${new Date().toISOString().slice(0, 10)}.pdf`
      
      pdf.save(fileName)
      toast.success('Relatório exportado com sucesso!')
    } catch (error) {
      console.error('Erro ao exportar relatório:', error)
      toast.error('Erro ao exportar relatório')
    } finally {
      setExporting(false)
    }
  }

  const handleSendEmail = async () => {
    if (selectedMonitor === 'all') {
      toast.error('Selecione um monitor específico para enviar por e-mail')
      return
    }
    
    try {
      setSendingEmail(true)
      
      const monitor = monitors.find(m => m.id === selectedMonitor)
      const report = reports.find(r => r.monitor_id === selectedMonitor)
      
      if (!monitor || !report) {
        toast.error('Monitor ou relatório não encontrado')
        return
      }
      
      const emailData = {
        monitor_name: monitor.name,
        monitor_url: monitor.url,
        period: getPeriodLabel(selectedTimeRange),
        uptime_percentage: report.uptime_percentage,
        total_checks: report.total_checks,
        successful_checks: report.successful_checks,
        failed_checks: report.failed_checks,
        avg_response_time: report.avg_response_time,
        incidents: report.incidents,
        generated_at: new Date().toLocaleString('pt-BR')
      }
      
      const response = await fetch('/api/reports/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      })
      
      if (!response.ok) {
        throw new Error('Erro ao enviar e-mail')
      }
      
      toast.success('Relatório enviado por e-mail com sucesso!')
    } catch (error) {
      console.error('Erro ao enviar e-mail:', error)
      toast.error('Erro ao enviar relatório por e-mail')
    } finally {
      setSendingEmail(false)
    }
  }

  const getUptimeColor = (uptime: number) => {
    if (uptime >= 99) return 'text-green-600'
    if (uptime >= 95) return 'text-yellow-600'
    return 'text-red-600'
  }

  const calculateOverallStats = () => {
    if (!overallStats) return null

    return {
      totalChecks: overallStats.total_checks,
      totalSuccessful: overallStats.total_checks - overallStats.total_incidents,
      totalIncidents: overallStats.total_incidents,
      avgUptime: overallStats.avg_uptime,
      avgResponseTime: overallStats.avg_response_time,
      monitorsCount: selectedMonitor !== 'all' ? 1 : reports.length
    }
  }

  const generateUptimeChartData = (): ChartData => {
    if (selectedMonitor === 'all') {
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
      const periodRange = calculatePeriodRange(selectedTimeRange)
      
      const dailyData: { [key: string]: { total: number, successful: number } } = {}
      
      monitorChecks.forEach(check => {
        const day = new Date(check.checked_at).toISOString().slice(0, 10)
        if (!dailyData[day]) {
          dailyData[day] = { total: 0, successful: 0 }
        }
        dailyData[day].total++
        if (check.status === 'online') {
          dailyData[day].successful++
        }
      })
      
      const availableDays = Object.keys(dailyData).sort()
      
      const labels: string[] = []
      const uptimeData: number[] = []
      
      availableDays.forEach(day => {
        const date = new Date(day + 'T00:00:00')
        const label = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        
        labels.push(label)
        
        const data = dailyData[day]
        const uptime = (data.successful / data.total) * 100
        uptimeData.push(uptime)
      })
      
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
      if (monitorChecks.length === 0) {
        return { labels: [], datasets: [] }
      }
      
      const periodRange = calculatePeriodRange(selectedTimeRange)
      const labels: string[] = []
      const responseTimeData: number[] = []
      
      const groupedData: { [key: string]: number[] } = {}
      
      monitorChecks.forEach(check => {
        let groupKey: string
        const checkDate = new Date(check.checked_at)
        
        if (selectedTimeRange === 'yesterday') {
          groupKey = checkDate.toISOString().slice(0, 13)
        } else {
          groupKey = checkDate.toISOString().slice(0, 10)
        }
        
        if (!groupedData[groupKey]) {
          groupedData[groupKey] = []
        }
        groupedData[groupKey].push(check.response_time)
      })
      
      const sortedKeys = Object.keys(groupedData).sort()
      
      sortedKeys.forEach(key => {
        const responseTimes = groupedData[key]
        const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        
        let label: string
        if (selectedTimeRange === 'yesterday') {
          const date = new Date(key + ':00:00')
          label = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        } else {
          const date = new Date(key)
          label = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        }
        
        labels.push(label)
        responseTimeData.push(Math.round(avgResponseTime))
      })
      
      return {
        labels,
        datasets: [
          {
            label: 'Tempo de Resposta Médio (ms)',
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

  const overallStatsCalculated = calculateOverallStats()
  const periodRange = calculatePeriodRange(selectedTimeRange)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#ffffff' }}>Relatórios</h1>
          <p style={{ color: '#9ca3af' }}>Análise detalhada do desempenho dos monitores</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button 
            onClick={handleSendEmail}
            disabled={sendingEmail || selectedMonitor === 'all'}
            variant="outline"
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-blue-500 hover:border-blue-600 shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendingEmail ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            {sendingEmail ? 'Enviando...' : 'Enviar por E-mail'}
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={exporting || reports.length === 0}
          >
            {exporting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {exporting ? 'Exportando...' : 'Exportar PDF'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <PeriodFilter 
          selectedTimeRange={selectedTimeRange} 
          onTimeRangeChange={setSelectedTimeRange}
          className="w-full sm:w-auto"
        />
        
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

      {overallStatsCalculated && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: '#ffffff' }}>Uptime Médio</CardTitle>
              <TrendingUp className="h-4 w-4" style={{ color: '#9ca3af' }} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getUptimeColor(overallStatsCalculated.avgUptime)}`}>
                {overallStatsCalculated.avgUptime?.toFixed(2) || '0.00'}%
              </div>
              <p className="text-xs" style={{ color: '#9ca3af' }}>
                {selectedMonitor !== 'all' ? 'Monitor selecionado' : getPeriodLabel(selectedTimeRange).toLowerCase()}
              </p>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: '#ffffff' }}>Verificações</CardTitle>
              <Activity className="h-4 w-4" style={{ color: '#9ca3af' }} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" style={{ color: '#ffffff' }}>{overallStatsCalculated.totalChecks.toLocaleString()}</div>
              <p className="text-xs" style={{ color: '#9ca3af' }}>
                {overallStatsCalculated.totalSuccessful.toLocaleString()} bem-sucedidas
              </p>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: '#ffffff' }}>Incidentes</CardTitle>
              <AlertTriangle className="h-4 w-4" style={{ color: '#9ca3af' }} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{overallStatsCalculated.totalIncidents}</div>
              <p className="text-xs" style={{ color: '#9ca3af' }}>
                {selectedMonitor !== 'all' ? 'Incidentes do monitor' : `${overallStatsCalculated.monitorsCount} monitores`}
              </p>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: '#ffffff' }}>Tempo de Resposta</CardTitle>
              <Clock className="h-4 w-4" style={{ color: '#9ca3af' }} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" style={{ color: '#ffffff' }}>{Math.round(overallStatsCalculated.avgResponseTime)}ms</div>
              <p className="text-xs" style={{ color: '#9ca3af' }}>
                {selectedMonitor !== 'all' ? 'Tempo médio do monitor' : 'Média geral'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {(reports.length > 0 || monitorChecks.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }} id="uptime-chart">
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

            <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }} id="response-time-chart">
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

            <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }} id="status-distribution-chart">
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
                        <Badge className={`${config.color} text-white hover:${config.color} cursor-default`}>
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

export default ReportsPage