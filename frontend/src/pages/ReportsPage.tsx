import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { 
  Download, 
  Clock, 
  TrendingUp, 
  Activity,
  AlertTriangle,
  PieChart,
  Mail
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { apiGet, apiPost } from '../utils/apiUtils'
import { PeriodFilter, DEFAULT_TIME_RANGE } from '../components/shared/PeriodFilter'
import { calculatePeriodRange, formatDateForAPI, getPeriodLabel } from '../utils/periodUtils'
// Importações removidas: formatDuration, calculateUptime não utilizadas
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
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
import { Bar, Line, Doughnut } from 'react-chartjs-2'

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





interface Monitor {
  id: string
  name: string
  url: string
  status: string
  group_id: string
  group_name: string
  report_email?: string
  report_send_day?: number
  slug: string
}

interface ChartData {
  labels: string[]
  datasets: any[]
}

interface MonitorCheck {
  id: string
  monitor_id: string
  status: string
  response_time: number
  checked_at: string
}

interface OverallStats {
  avg_uptime: number
  total_checks: number
  total_incidents: number
  avg_response_time: number
}

export function ReportsPage() {
  const [reports, setReports] = useState<ReportData[]>([])
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [selectedMonitor, setSelectedMonitor] = useState('all')
  const [monitorChecks, setMonitorChecks] = useState<MonitorCheck[]>([])
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTimeRange, setSelectedTimeRange] = useState(DEFAULT_TIME_RANGE)
  const [exporting, setExporting] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    fetchData()
    fetchOverallStats()
    if (selectedMonitor !== 'all') {
      fetchMonitorChecks(selectedMonitor)
    }
  }, [selectedTimeRange, selectedMonitor])

  useEffect(() => {
    fetchMonitors()
  }, [])







  const fetchMonitors = async () => {
    try {
      const result = await apiGet('/monitors')

      if (result.success) {
        setMonitors(result.data)
        // Seleciona automaticamente o primeiro monitor da lista
        if (result.data.length > 0 && selectedMonitor === 'all') {
          setSelectedMonitor(result.data[0].id)
        }
      } else {
        console.error('Erro ao buscar monitores:', result.error)
      }
    } catch (error) {
      console.error('Erro ao buscar monitores:', error)
    }
  }

  const fetchMonitorChecks = async (monitorId: string) => {
    try {
      const periodRange = calculatePeriodRange(selectedTimeRange)
      const startDate = formatDateForAPI(periodRange.startDate)
      const endDate = formatDateForAPI(periodRange.endDate)
      
      const result = await apiGet(`/monitors/${monitorId}/checks?start_date=${startDate}&end_date=${endDate}&limit=1000`)

      if (result.success) {
        setMonitorChecks(result.data)
      } else {
        console.error('Erro ao buscar checks do monitor:', result.error)
      }
    } catch (error) {
      console.error('Erro ao buscar checks do monitor:', error)
    }
  }

  const fetchData = async () => {
    try {
      const params = new URLSearchParams({
        period: selectedTimeRange
      })
      
      const result = await apiGet(`/reports?${params}`)

      if (result.success) {
        setReports(result.data)
      } else {
        addToast({ title: 'Erro ao carregar relatórios', description: result.error, variant: 'destructive' })
      }
    } catch (error) {
      console.error('Erro ao buscar relatórios:', error)
      addToast({ title: 'Erro ao carregar relatórios', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const fetchOverallStats = async () => {
    try {
      const params = new URLSearchParams({
        period: selectedTimeRange
      })
      
      if (selectedMonitor !== 'all') {
        params.append('monitor_id', selectedMonitor)
      }
      
      const result = await apiGet(`/reports/stats?${params}`)

      if (result.success) {
        setOverallStats(result.data)
      } else {
        console.error('Erro ao buscar estatísticas:', result.error)
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error)
    }
  }

  // Função captureChart removida por não ser utilizada

  const captureStatusPage = async (monitorSlug: string): Promise<string[] | null> => {
    try {
      // Construir URL da página de status pública
      const statusUrl = `${window.location.origin}/status/${monitorSlug}?forceMonitor=1`

      // Criar iframe invisível para carregar a página
      const iframe = document.createElement('iframe')
      iframe.style.position = 'absolute'
      iframe.style.left = '-9999px'
      iframe.style.top = '-9999px'
      iframe.style.width = '1920px'
      iframe.style.height = '1080px'
      iframe.style.border = 'none'
      iframe.src = statusUrl
      
      document.body.appendChild(iframe)
      
      // Aguardar a página carregar completamente
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          document.body.removeChild(iframe)
          reject(new Error('Timeout ao carregar página de status'))
        }, 15000) // 15 segundos de timeout
        
        iframe.onload = () => {
          clearTimeout(timeout)
          resolve(void 0)
        }
        
        iframe.onerror = () => {
          clearTimeout(timeout)
          document.body.removeChild(iframe)
          reject(new Error('Erro ao carregar página de status'))
        }
      })
      
      // Aguardar mais tempo para garantir que gráficos e componentes dinâmicos sejam renderizados
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
      if (!iframeDoc) {
        document.body.removeChild(iframe)
        throw new Error('Não foi possível acessar o documento da página de status')
      }

      // Aguardar todas as imagens carregarem no documento do iframe (inclui a logo)
      const waitForAllImages = async (doc: Document, timeoutMs = 15000) => {
        const imgs = Array.from(doc.images) as HTMLImageElement[]
        if (imgs.length === 0) return
        await Promise.all(
          imgs.map((img) =>
            new Promise<void>((resolve) => {
              try {
                // Garantir CORS anônimo quando aplicável
                if (!img.crossOrigin) img.crossOrigin = 'anonymous'
              } catch {}
              if (img.complete && img.naturalWidth > 0) return resolve()
              const to = setTimeout(() => resolve(), timeoutMs)
              const done = () => {
                clearTimeout(to)
                resolve()
              }
              img.addEventListener('load', done, { once: true })
              img.addEventListener('error', done, { once: true })
            })
          )
        )
      }
      await waitForAllImages(iframeDoc, 15000)

      // Determinar dimensões completas da página dentro do iframe (sem recorte)
      const docEl = iframeDoc.documentElement
      const bodyEl = iframeDoc.body
      const fullWidth = Math.ceil(Math.max(
        docEl?.scrollWidth || 0,
        bodyEl?.scrollWidth || 0,
        docEl?.clientWidth || 0,
        1920
      ))
      const fullHeight = Math.ceil(Math.max(
        docEl?.scrollHeight || 0,
        bodyEl?.scrollHeight || 0,
        docEl?.clientHeight || 0,
        1080
      ))

      // Ajustar o tamanho do iframe para abranger todo o conteúdo antes da captura
      iframe.style.width = `${fullWidth}px`
      iframe.style.height = `${fullHeight}px`

      // Configurações base de captura; os offsets/alturas serão ajustados por fatia
      const baseOptions = {
        useCORS: true,
        allowTaint: false,
        scale: 1.5, // Qualidade alta
        width: fullWidth,
        height: fullHeight, // será sobrescrito por fatia
        windowWidth: fullWidth,
        windowHeight: fullHeight, // será sobrescrito por fatia
        x: 0,
        y: 0, // será sobrescrito por fatia
        scrollX: 0,
        scrollY: 0,
        backgroundColor: '#ffffff',
        removeContainer: false,
        logging: false,
        imageTimeout: 15000,
        cacheBust: true,
        foreignObjectRendering: false, // Alterado para evitar problemas de imagem quebrada em alguns navegadores
        onclone: (clonedDoc: Document) => {
          const clonedBody = clonedDoc.body
          if (clonedBody) {
            clonedBody.style.transform = 'none'
            clonedBody.style.transformOrigin = 'top left'
            clonedBody.style.overflow = 'visible'
            clonedBody.style.height = 'auto'
            clonedBody.style.minHeight = 'auto'
          }
          const clonedHtml = clonedDoc.documentElement as HTMLElement
          if (clonedHtml) {
            clonedHtml.style.overflow = 'visible'
            clonedHtml.style.height = 'auto'
            clonedHtml.style.minHeight = 'auto'
            clonedHtml.style.width = 'auto'
          }
          const rootEl = clonedDoc.getElementById('root') as HTMLElement | null
          if (rootEl) {
            rootEl.style.overflow = 'visible'
            rootEl.style.height = 'auto'
            rootEl.style.minHeight = 'auto'
            rootEl.style.transform = 'none'
          }
          const styleEl = clonedDoc.createElement('style')
          styleEl.textContent = `
            *, *::before, *::after { overflow: visible !important; }
            html, body { height: auto !important; min-height: auto !important; margin: 0 !important; padding: 0 !important; }
            #root { margin: 0 !important; padding: 0 !important; }
            [style*="overflow"] { overflow: visible !important; }
            section, div { max-height: none !important; }
          `
          clonedDoc.head.appendChild(styleEl)
 
          // Garantir atributos CORS nas imagens do DOM clonado
          try {
            const imgs = Array.from(clonedDoc.images) as HTMLImageElement[]
            const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
            const appOrigin = window.location.origin
            const apiIsAbsolute = /^https?:\/\//i.test(apiBase)
            imgs.forEach((img) => {
              // Forçar atributos seguros
              img.referrerPolicy = 'no-referrer'

              const currentSrc = img.getAttribute('src') || img.src
              if (!currentSrc || currentSrc.startsWith('data:')) return

              const isAbsolute = /^https?:\/\//i.test(currentSrc)
              const isSameOrigin = isAbsolute ? currentSrc.startsWith(appOrigin) : true

              // 1) Qualquer imagem absoluta de outra origem -> proxy do backend
              if (isAbsolute && !isSameOrigin) {
                const proxied = `/api/proxy/html2canvas?url=${encodeURIComponent(currentSrc)}&cb=${Date.now()}`
                img.removeAttribute('crossorigin')
                img.setAttribute('src', proxied)
                return
              }

              // 2) Imagens apontando para a API base (quando relativo, ex.: /api/...)
              if (apiBase && currentSrc.startsWith(apiBase)) {
                let rewritten: string
                if (apiIsAbsolute) {
                  // Se for absoluto e chegou aqui, é mesma origem; mantém apenas o caminho
                  const apiPath = new URL(apiBase).pathname || ''
                  const rest = currentSrc.substring(apiBase.length)
                  rewritten = appOrigin + apiPath + rest
                } else {
                  // apiBase relativo (ex.: "/api") -> mantém o prefixo /api
                  rewritten = appOrigin + currentSrc
                }
                img.removeAttribute('crossorigin')
                const withBust = rewritten + (rewritten.includes('?') ? '&' : '?') + 'cb=' + Date.now()
                img.setAttribute('src', withBust)
                return
              }

              // 3) Demais casos (relativas da própria aplicação)
              if (!img.crossOrigin) img.crossOrigin = 'anonymous'
            })
          } catch {}
        }
      }

      // Substituição: captura única para seguir o padrão do PDF do backend (modo contain, sem fatias)
      // Ajuste dinâmico de escala para não exceder limites de canvas do navegador
      const MAX_DIMENSION = 12000
      const adaptiveScale = Math.min(1, MAX_DIMENSION / fullWidth, MAX_DIMENSION / fullHeight)
      const singleOptions = {
        ...baseOptions,
        scale: adaptiveScale,
        width: fullWidth,
        height: fullHeight,
        windowWidth: fullWidth,
        windowHeight: fullHeight,
        y: 0,
      } as any

      const canvas = await html2canvas(iframeDoc.documentElement, singleOptions)
      const images: string[] = [canvas.toDataURL('image/png')]
      
      // Remover o iframe
      document.body.removeChild(iframe)
      
      return images
    } catch (error) {
      console.error('Erro ao capturar página de status:', error)
      return null
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      // Verificar se um monitor específico foi selecionado
      if (selectedMonitor === 'all') {
        addToast({ 
          title: 'Selecione um monitor específico', 
          description: 'Para exportar a página de status, você deve selecionar um monitor específico.',
          variant: 'destructive' 
        })
        return
      }
      
      // Buscar o monitor selecionado para obter o slug
      const monitor = monitors.find(m => m.id === selectedMonitor)
      if (!monitor || !monitor.slug) {
        addToast({ 
          title: 'Monitor não encontrado', 
          description: 'Não foi possível encontrar o monitor selecionado ou ele não possui uma página de status.',
          variant: 'destructive' 
        })
        return
      }
      
      addToast({ 
        title: 'Gerando PDF otimizado...', 
        description: 'Capturando e processando a página de status para um PDF profissional.',
        variant: 'default' 
      })
      
      // Capturar a página de status pública (captura única, sem fatias) para seguir o mesmo padrão do backend
      const statusPageImages = await captureStatusPage(monitor.slug)
      
      if (!statusPageImages || statusPageImages.length === 0) {
        addToast({ 
          title: 'Erro ao capturar página', 
          description: 'Não foi possível capturar a página de status. Verifique se a página está acessível.',
          variant: 'destructive' 
        })
        return
      }
      
      // Criar novo documento PDF otimizado
      const doc = new jsPDF('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      
      const margin = 0 // sem margens para usar 100% da página
      const availableWidth = pageWidth - (margin * 2)
      const availableHeight = pageHeight - (margin * 2)

      // Adicionar cada imagem (fatia) como uma página sem qualquer corte, modo contain centralizado
      for (let i = 0; i < statusPageImages.length; i++) {
        const statusPageImage = statusPageImages[i]
        if (i > 0) doc.addPage('a4', 'p')

        const img = new Image()
        img.src = statusPageImage
        await new Promise((resolve) => (img.onload = resolve))
        const imgWidth = (img as HTMLImageElement).naturalWidth || img.width
        const imgHeight = (img as HTMLImageElement).naturalHeight || img.height

        const imgRatio = imgWidth / imgHeight
        const targetRatio = availableWidth / availableHeight
        let renderWidth = 0
        let renderHeight = 0
        if (imgRatio > targetRatio) {
          renderWidth = availableWidth
          renderHeight = renderWidth / imgRatio
        } else {
          renderHeight = availableHeight
          renderWidth = renderHeight * imgRatio
        }

        const posX = margin + (availableWidth - renderWidth) / 2
        const posY = margin // alinhar ao topo para evitar faixa branca superior

        // Inserir fatia sem recorte, centralizada
        doc.addImage(statusPageImage, 'PNG', Number(posX.toFixed(2)), Number(posY.toFixed(2)), Number(renderWidth.toFixed(2)), Number(renderHeight.toFixed(2)))
      }
      
      // Salvar o PDF com nome apropriado e otimizado
      const fileName = `status-${monitor.name.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(fileName)
      
      addToast({ 
        title: 'Página de status exportada com sucesso!', 
        description: `O PDF foi salvo como: ${fileName}`,
        variant: 'success' 
      })
    } catch (error) {
      console.error('Erro ao exportar página de status:', error)
      addToast({ 
        title: 'Erro ao exportar página de status', 
        description: 'Ocorreu um erro inesperado durante a exportação.',
        variant: 'destructive' 
      })
    } finally {
      setExporting(false)
    }
  }

  const handleSendEmail = async () => {
    if (selectedMonitor === 'all') {
      addToast({ title: 'Selecione um monitor específico para enviar o relatório por e-mail', variant: 'destructive' })
      return
    }

    // Buscar o monitor selecionado e seu e-mail cadastrado
    const monitor = monitors.find(m => m.id === selectedMonitor)
    if (!monitor) {
      addToast({ title: 'Monitor não encontrado', variant: 'destructive' })
      return
    }

    if (!monitor.report_email) {
      addToast({ title: 'E-mail não configurado para este monitor', description: 'Configure o e-mail do relatório nas configurações do monitor', variant: 'destructive' })
      return
    }

    const email = monitor.report_email

    setSendingEmail(true)
    try {
      const currentDate = new Date()
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1
      
      const result = await apiPost('/reports/send-monthly', {
        monitor_id: selectedMonitor,
        email: email,
        year: year,
        month: month,
        includePdf: true
      })

      if (result.success) {
        addToast({ title: 'Relatório enviado por e-mail com sucesso!', description: `O relatório foi enviado para ${email}`, variant: 'success' })
      } else {
        addToast({ title: 'Erro ao enviar relatório por e-mail', description: result.error, variant: 'destructive' })
      }
    } catch (error) {
      console.error('Erro ao enviar relatório por e-mail:', error)
      addToast({ title: 'Erro ao enviar relatório por e-mail', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'destructive' })
    } finally {
      setSendingEmail(false)
    }
  }

  const getUptimeColor = (uptime: number) => {
    if (uptime >= 99) return 'text-green-600'
    if (uptime >= 95) return 'text-yellow-600'
    return 'text-red-600'
  }

  // Função removida: getUptimeBadgeColor não utilizada

  const calculateOverallStats = () => {
    if (!overallStats) return null

    return {
      totalChecks: overallStats.total_checks,
      totalSuccessful: overallStats.total_checks - overallStats.total_incidents, // Aproximação baseada nos dados disponíveis
      totalIncidents: overallStats.total_incidents,
      avgUptime: overallStats.avg_uptime,
      avgResponseTime: overallStats.avg_response_time,
      monitorsCount: selectedMonitor !== 'all' ? 1 : reports.length
    }
  }

  const generateUptimeChartData = (): ChartData => {
    if (selectedMonitor === 'all') {
      // Dados agregados de todos os monitores
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
      // Dados históricos do monitor selecionado
      const periodRange = calculatePeriodRange(selectedTimeRange)
      
      // Agrupar checks por dia
      const dailyData: { [key: string]: { total: number, successful: number } } = {}
      
      monitorChecks.forEach(check => {
        const day = new Date(check.checked_at).toISOString().slice(0, 10) // YYYY-MM-DD
        if (!dailyData[day]) {
          dailyData[day] = { total: 0, successful: 0 }
        }
        dailyData[day].total++
        if (check.status === 'online') {
          dailyData[day].successful++
        }
      })
      
      // Obter apenas os dias que realmente têm dados
      const availableDays = Object.keys(dailyData).sort()
      
      const labels: string[] = []
      const uptimeData: number[] = []
      
      // Mostrar apenas os dias com dados reais disponíveis
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
      // Para monitor específico, usar dados reais dos monitorChecks
      if (monitorChecks.length === 0) {
        return { labels: [], datasets: [] }
      }
      
      const periodRange = calculatePeriodRange(selectedTimeRange)
      const labels: string[] = []
      const responseTimeData: number[] = []
      
      // Agrupar dados por período baseado no timeRange selecionado
      const groupedData: { [key: string]: number[] } = {}
      
      monitorChecks.forEach(check => {
        let groupKey: string
        const checkDate = new Date(check.checked_at)
        
        if (selectedTimeRange === 'yesterday') {
          // Para ontem, agrupar por hora
          groupKey = checkDate.toISOString().slice(0, 13) // YYYY-MM-DDTHH
        } else {
          // Para outros períodos, agrupar por dia
          groupKey = checkDate.toISOString().slice(0, 10) // YYYY-MM-DD
        }
        
        if (!groupedData[groupKey]) {
          groupedData[groupKey] = []
        }
        groupedData[groupKey].push(check.response_time)
      })
      
      // Ordenar as chaves por data e criar labels e dados
      const sortedKeys = Object.keys(groupedData).sort()
      
      sortedKeys.forEach(key => {
        const responseTimes = groupedData[key]
        const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        
        // Formatar label baseado no período
        let label: string
        if (selectedTimeRange === 'yesterday') {
          // Para ontem, mostrar hora
          const date = new Date(key + ':00:00')
          label = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        } else {
          // Para outros períodos, mostrar data
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

  const overallStats = calculateOverallStats()
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
      {/* Header */}
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

      {/* Filters */}
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
                {selectedMonitor !== 'all' ? 'Incidentes do monitor' : `${overallStats.monitorsCount} monitores`}
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
                {selectedMonitor !== 'all' ? 'Tempo médio do monitor' : 'Média geral'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gráficos */}
      {(reports.length > 0 || monitorChecks.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coluna Esquerda - Cards Menores */}
          <div className="lg:col-span-1 space-y-6">
            {/* Gráfico de Uptime */}
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

            {/* Gráfico de Tempo de Resposta */}
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

            {/* Gráfico de Distribuição de Status */}
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

          {/* Coluna Direita - Card Maior */}
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
                        {/* Informações Básicas */}
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
                        
                        {/* Estatísticas de Performance */}
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
                        
                        {/* Tempos de Resposta */}
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
                        
                        {/* Incidentes e Problemas */}
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