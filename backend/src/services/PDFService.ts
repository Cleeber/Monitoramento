import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { databaseService } from './DatabaseService.js'

export interface PDFReportOptions {
  title?: string
  includeCharts?: boolean
  includeIncidents?: boolean
  period?: string
}

export class PDFService {
  // Removido: captura com Puppeteer. A geração agora é totalmente baseada em PDFKit e dados do banco.
  
  /**
   * Gera PDF dinâmico da página de status com dados dos últimos 30 dias
   */
  async generateDynamicStatusPDF(monitorSlug: string, monitorName: string): Promise<Buffer> {
    try {
      console.log(`📊 Gerando PDF dinâmico (texto) para monitor: ${monitorName} (${monitorSlug})`)

      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const chunks: Buffer[] = []
      doc.on('data', chunk => chunks.push(chunk))

      return new Promise(async (resolve, reject) => {
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks)
          console.log(`✅ PDF dinâmico gerado (${Math.round(pdfBuffer.length / 1024)}KB)`)
          resolve(pdfBuffer)
        })
        doc.on('error', reject)

        // Cabeçalho
        this.addHeader(doc, monitorName || 'Página de Status')

        // Recuperar monitor por slug
        try {
          const monitors = await databaseService.getMonitors()
          const monitor = monitors.find((m: any) => m.slug === monitorSlug)

          if (monitor) {
            this.addMonitorDetails(doc, monitor)
            await this.addMonthlyStats(doc, monitor, new Date().getFullYear(), new Date().getMonth() + 1)
            this.addUptimeChart(doc, monitor)
            this.addIncidentsList(doc, monitor)
          } else {
            doc.fontSize(12)
               .fillColor('#dc2626')
               .text('Monitor não encontrado para o slug informado.', 50, doc.y)
          }

          this.addFooter(doc)
        } catch (e) {
          doc.fontSize(12)
             .fillColor('#dc2626')
             .text('Erro ao recuperar dados para o PDF.', 50, doc.y)
        }

        doc.end()
      })
    } catch (error) {
      console.error('❌ Erro ao gerar PDF dinâmico:', error)
      throw error
    }
  }

  /**
   * Gera PDF otimizado a partir de captura de página de status
   */
  async generateOptimizedStatusPDF(monitorSlug: string, monitorName: string): Promise<Buffer> {
    try {
      console.log(`📄 Gerando PDF otimizado (texto) para: ${monitorName}`)

      const doc = new PDFDocument({ margin: 50 })
      const chunks: Buffer[] = []
      doc.on('data', chunk => chunks.push(chunk))

      return new Promise(async (resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)

        // Cabeçalho
        this.addHeader(doc, monitorName || 'Status')

        // Carregar dados
        const monitors = await databaseService.getMonitors()

        // Primeiro: tentar encontrar MONITOR pelo slug para evitar colisão com slug de grupo
        const monitor = monitors.find((m: any) => m.slug === monitorSlug)
        if (monitor) {
          // Se for monitor, gerar relatório estilo mensal
          this.addMonitorDetails(doc, monitor)
          await this.addMonthlyStats(doc, monitor, new Date().getFullYear(), new Date().getMonth() + 1)
          this.addUptimeChart(doc, monitor)
          this.addIncidentsList(doc, monitor)
          this.addFooter(doc)
          doc.end()
          return
        }

        doc.fontSize(12)
           .fillColor('#dc2626')
           .text('Monitor não encontrado para o slug informado.', 50, 150)
        this.addFooter(doc)
        doc.end()
      })
    } catch (error) {
      console.error('❌ Erro ao gerar PDF otimizado:', error)
      throw error
    }
  }

  /**
   * Gera PDF otimizado SOMENTE para um monitor (sem considerar grupos)
   * Usado para garantir que exportações mensais retornem o PDF do monitor selecionado.
   */
  async generateOptimizedMonitorPDF(monitorSlug: string, monitorName: string, year?: number, month?: number): Promise<Buffer> {
    try {
      const doc = new PDFDocument({ margin: 50 })
      const chunks: Buffer[] = []
      doc.on('data', chunk => chunks.push(chunk))

      return new Promise(async (resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)

        // Cabeçalho
        this.addHeader(doc, monitorName || 'Status')

        // Carregar dados
        const monitors = await databaseService.getMonitors()

        // Apenas tentar encontrar MONITOR pelo slug
        const monitor = monitors.find((m: any) => m.slug === monitorSlug)
        if (monitor) {
          // Relatório estilo mensal do monitor
          this.addMonitorDetails(doc, monitor)
          await this.addMonthlyStats(doc, monitor, year || new Date().getFullYear(), (month || (new Date().getMonth() + 1)))
          this.addUptimeChart(doc, monitor)
          this.addIncidentsList(doc, monitor)
          this.addFooter(doc)
          doc.end()
          return
        }

        // Se não encontrar monitor pelo slug, deixar o caller decidir o fallback
        doc.fontSize(12)
           .fillColor('#dc2626')
           .text('Monitor não encontrado para o slug informado.', 50, 150)
        this.addFooter(doc)
        doc.end()
      })
    } catch (error) {
      console.error('❌ Erro ao gerar PDF otimizado de monitor:', error)
      throw error
    }
  }
  /**
   * Gera PDF com status de todos os monitores usando captura otimizada quando possível
   */
  async generateStatusPDF(options: PDFReportOptions = {}): Promise<Buffer> {
    try {
      // Buscar dados dos monitores
      const monitors = await databaseService.getMonitors()
      
      console.log(`📄 Gerando PDF de status básico`)
      
      // Fallback para o método original
      return this.generateBasicStatusPDF(options, monitors)
    } catch (error) {
      console.error('❌ Erro ao gerar PDF de status:', error)
      throw error
    }
  }
  
  /**
   * Gera PDF básico com status de todos os monitores (fallback)
   */
  private async generateBasicStatusPDF(options: PDFReportOptions, monitors: any[]): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 })
        const chunks: Buffer[] = []

        doc.on('data', chunk => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)

        // Cabeçalho do documento
        this.addHeader(doc, options.title || 'Status dos Monitores')
        
        // Informações gerais
        this.addGeneralInfo(doc, monitors)
        
        // Lista de Monitores (substituindo grupos)
        this.addMonitorsList(doc, monitors)
        
        // Resumo de estatísticas
        this.addStatisticsSummary(doc, monitors)
        
        // Rodapé
        this.addFooter(doc)

        doc.end()
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Adiciona lista de monitores
   */
  private addMonitorsList(doc: PDFKit.PDFDocument, monitors: any[]) {
    doc.fontSize(16)
       .fillColor('#1f2937')
       .text('Lista de Monitores', 50, doc.y)
    
    doc.moveDown(1)
    
    monitors.forEach(monitor => {
      const statusIcon = this.getStatusIcon(monitor.status)
      const uptimeText = monitor.uptime_24h ? `${monitor.uptime_24h.toFixed(1)}%` : 'N/A'
      const responseTime = monitor.avg_response_time ? `${monitor.avg_response_time}ms` : 'N/A'
      
      doc.fontSize(11)
         .fillColor('#374151')
         .text(`${statusIcon} ${monitor.name}`, 70, doc.y)
      
      doc.fontSize(9)
         .fillColor('#6b7280')
         .text(`${monitor.url} | Uptime 24h: ${uptimeText} | Resposta: ${responseTime}`, 90, doc.y + 15)
      
      doc.moveDown(1.5)
    })
    
    doc.moveDown(1)
  }

  /**
   * Gera PDF de relatório mensal para um monitor específico usando captura otimizada
   */
  async generateMonthlyReportPDF(monitorId: string, year: number, month: number): Promise<Buffer> {
    try {
      // Buscar dados do monitor
      const monitors = await databaseService.getMonitors()
      const monitor = monitors.find((m: any) => m.id === monitorId)
      
      if (!monitor) {
        throw new Error('Monitor não encontrado')
      }

      // Verificar se o monitor tem slug para página de status
      if (monitor.slug) {
        console.log(`📄 Gerando relatório mensal otimizado (monitor-only) para: ${monitor.name}`)
        
        // Forçar geração apenas do monitor; se falhar, fazer fallback para o básico
        try {
          return await this.generateOptimizedMonitorPDF(monitor.slug, `${monitor.name} - Relatório Mensal`, year, month)
        } catch (e) {
          console.warn('⚠️ Fallback para relatório mensal básico (slug não encontrado como monitor):', e)
          return this.generateBasicMonthlyReportPDF(monitorId, year, month)
        }
      } else {
        console.log(`📄 Gerando relatório mensal básico para: ${monitor.name} (sem página de status)`)
        
        // Fallback para o método original se não houver slug
        return this.generateBasicMonthlyReportPDF(monitorId, year, month)
      }
    } catch (error) {
      console.error('❌ Erro ao gerar relatório mensal:', error)
      throw error
    }
  }
  
  /**
   * Gera PDF básico de relatório mensal (fallback)
   */
  private async generateBasicMonthlyReportPDF(monitorId: string, year: number, month: number): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 })
        const chunks: Buffer[] = []

        doc.on('data', chunk => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)

        // Buscar dados do monitor
        const monitors = await databaseService.getMonitors()
        const monitor = monitors.find((m: any) => m.id === monitorId)
        
        if (!monitor) {
          reject(new Error('Monitor não encontrado'))
          return
        }

        const monthName = this.getMonthName(month)
        const title = `Relatório Mensal - ${monitor.name}`
        const period = `${monthName} ${year}`

        // Cabeçalho
        this.addHeader(doc, title, period)
        
        // Informações do monitor
        this.addMonitorDetails(doc, monitor)
        
        // Estatísticas do período
        await this.addMonthlyStats(doc, monitor, year, month)
        
        // Gráfico de uptime (simulado)
        this.addUptimeChart(doc, monitor)
        
        // Incidentes do período
        this.addIncidentsList(doc, monitor)
        
        // Rodapé
        this.addFooter(doc)

        doc.end()
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Adiciona cabeçalho ao documento
   */
  private addHeader(doc: PDFKit.PDFDocument, title: string, subtitle?: string) {
    // Logo/Título principal
    doc.fontSize(24)
       .fillColor('#2563eb')
       .text('Uptime Monitor', 50, 50)
    
    // Título do relatório
    doc.fontSize(18)
       .fillColor('#1f2937')
       .text(title, 50, 90)
    
    if (subtitle) {
      doc.fontSize(14)
         .fillColor('#6b7280')
         .text(subtitle, 50, 120)
    }
    
    // Data de geração
    const now = new Date()
    doc.fontSize(10)
       .fillColor('#9ca3af')
       .text(`Gerado em: ${now.toLocaleString('pt-BR')}`, 50, subtitle ? 145 : 125)
    
    // Linha separadora
    doc.moveTo(50, subtitle ? 170 : 150)
       .lineTo(550, subtitle ? 170 : 150)
       .strokeColor('#e5e7eb')
       .stroke()
    
    doc.moveDown(2)
  }

  /**
   * Adiciona informações gerais
   */
  private addGeneralInfo(doc: PDFKit.PDFDocument, monitors: any[]) {
    const totalMonitors = monitors.length
    const onlineMonitors = monitors.filter(m => m.status === 'up').length
    const offlineMonitors = monitors.filter(m => m.status === 'down').length
    const unknownMonitors = monitors.filter(m => !m.status || m.status === 'unknown').length
    
    const startY = doc.y + 20
    
    doc.fontSize(16)
       .fillColor('#1f2937')
       .text('Resumo Geral', 50, startY)
    
    doc.fontSize(12)
       .fillColor('#374151')
    
    const infoY = startY + 30
    doc.text(`Total de Monitores: ${totalMonitors}`, 50, infoY)
    doc.text(`🟢 Online: ${onlineMonitors}`, 50, infoY + 20)
    doc.text(`🔴 Offline: ${offlineMonitors}`, 50, infoY + 40)
    doc.text(`⚪ Desconhecido: ${unknownMonitors}`, 50, infoY + 60)
    
    // Percentual de disponibilidade geral
    const overallUptime = totalMonitors > 0 ? ((onlineMonitors / totalMonitors) * 100).toFixed(1) : '0'
    doc.fontSize(14)
       .fillColor('#059669')
       .text(`Disponibilidade Geral: ${overallUptime}%`, 300, infoY + 20)
    
    doc.moveDown(4)
  }



  /**
   * Adiciona resumo de estatísticas
   */
  private addStatisticsSummary(doc: PDFKit.PDFDocument, monitors: any[]) {
    // Nova página se necessário
    if (doc.y > 600) {
      doc.addPage()
    }
    
    doc.fontSize(16)
       .fillColor('#1f2937')
       .text('Estatísticas Detalhadas', 50, doc.y)
    
    doc.moveDown(1)
    
    // Calcular estatísticas
    const avgUptime = monitors.length > 0 
      ? monitors.reduce((sum, m) => sum + (m.uptime_24h || 0), 0) / monitors.length 
      : 0
    
    const avgResponseTime = monitors.length > 0 
      ? monitors.reduce((sum, m) => sum + (m.avg_response_time || 0), 0) / monitors.length 
      : 0
    
    doc.fontSize(12)
       .fillColor('#374151')
       .text(`Uptime Médio (24h): ${avgUptime.toFixed(2)}%`, 50, doc.y)
       .text(`Tempo de Resposta Médio: ${Math.round(avgResponseTime)}ms`, 50, doc.y + 20)
    
    doc.moveDown(2)
  }

  /**
   * Adiciona detalhes do monitor
   */
  private addMonitorDetails(doc: PDFKit.PDFDocument, monitor: any) {
    doc.fontSize(14)
       .fillColor('#1f2937')
       .text('Informações do Monitor', 50, doc.y)
    
    doc.moveDown(1)
    
    doc.fontSize(11)
       .fillColor('#374151')
       .text(`Nome: ${monitor.name}`, 50, doc.y)
       .text(`URL: ${monitor.url}`, 50, doc.y + 20)
       .text(`Tipo: ${monitor.type}`, 50, doc.y + 40)
       .text(`Status: ${this.getStatusIcon(monitor.status)} ${this.getStatusText(monitor.status)}`, 50, doc.y + 60)
    
    doc.moveDown(3)
  }

  /**
   * Adiciona estatísticas mensais
   */
  private async addMonthlyStats(doc: PDFKit.PDFDocument, monitor: any, _: number, __: number) {
    doc.fontSize(14)
       .fillColor('#1f2937')
       .text('Estatísticas do Período', 50, doc.y)
    
    doc.moveDown(1)
    
    // Dados simulados - você pode implementar a lógica real
    const uptime = monitor.uptime_30d || 99.5
    const totalChecks = 2880 // 30 dias * 24 horas * 4 checks/hora
    const successfulChecks = Math.round(totalChecks * (uptime / 100))
    const failedChecks = totalChecks - successfulChecks
    
    doc.fontSize(11)
       .fillColor('#374151')
       .text(`Uptime: ${uptime.toFixed(2)}%`, 50, doc.y)
       .text(`Total de Verificações: ${totalChecks.toLocaleString('pt-BR')}`, 50, doc.y + 20)
       .text(`Verificações Bem-sucedidas: ${successfulChecks.toLocaleString('pt-BR')}`, 50, doc.y + 40)
       .text(`Verificações com Falha: ${failedChecks.toLocaleString('pt-BR')}`, 50, doc.y + 60)
       .text(`Tempo Médio de Resposta: ${monitor.avg_response_time || 250}ms`, 50, doc.y + 80)
    
    doc.moveDown(3)
  }

  /**
   * Adiciona gráfico de uptime (representação textual)
   */
  private addUptimeChart(doc: PDFKit.PDFDocument, _: any) {
    doc.fontSize(14)
       .fillColor('#1f2937')
       .text('Gráfico de Disponibilidade', 50, doc.y)
    
    doc.moveDown(1)
    
    // Simular dados de uptime dos últimos 30 dias
    const days = 30
    let chartLine = ''
    
    for (let i = 0; i < days; i++) {
      const uptime = Math.random() > 0.05 ? '█' : ' ' // 95% de chance de estar online
      chartLine += uptime
    }
    
    doc.fontSize(8)
       .font('Courier')
       .fillColor('#059669')
       .text(chartLine, 50, doc.y)
    
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor('#6b7280')
       .text('█ Online    Offline', 50, doc.y + 15)
       .text('(Últimos 30 dias)', 50, doc.y + 30)
    
    doc.moveDown(3)
  }

  /**
   * Adiciona lista de incidentes
   */
  private addIncidentsList(doc: PDFKit.PDFDocument, _: any) {
    doc.fontSize(14)
       .fillColor('#1f2937')
       .text('Incidentes Recentes', 50, doc.y)
    
    doc.moveDown(1)
    
    // Dados simulados de incidentes
    const incidents = [
      { date: '2024-01-15', duration: '5 min', reason: 'Timeout de conexão' },
      { date: '2024-01-08', duration: '12 min', reason: 'Servidor indisponível' }
    ]
    
    if (incidents.length === 0) {
      doc.fontSize(11)
         .fillColor('#059669')
         .text('🎉 Nenhum incidente registrado no período!', 50, doc.y)
    } else {
      incidents.forEach((incident, index) => {
        doc.fontSize(11)
           .fillColor('#374151')
           .text(`${index + 1}. ${incident.date} - Duração: ${incident.duration}`, 50, doc.y)
           .text(`   Motivo: ${incident.reason}`, 50, doc.y + 15)
        
        doc.moveDown(1.5)
      })
    }
    
    doc.moveDown(2)
  }

  /**
   * Adiciona rodapé
   */
  private addFooter(doc: PDFKit.PDFDocument) {
    const pageHeight = doc.page.height
    const footerY = pageHeight - 50
    
    doc.fontSize(8)
       .fillColor('#9ca3af')
       .text('Gerado automaticamente pelo Uptime Monitor', 50, footerY)
       .text(`Página ${doc.bufferedPageRange().count}`, 500, footerY)
  }

  /**
   * Gera PDF de status para um monitor específico pelo ID
   * Garante que não haverá fallback para relatório geral
   */
  async generateMonitorStatusPDF(monitorId: string, monitorName: string, year?: number, month?: number): Promise<Buffer> {
    try {
      console.log(`📄 Gerando PDF de status (texto) para monitor ID: ${monitorId}`)

      const doc = new PDFDocument({ margin: 50 })
      const chunks: Buffer[] = []
      doc.on('data', chunk => chunks.push(chunk))

      return new Promise(async (resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)

        // Cabeçalho
        this.addHeader(doc, monitorName || 'Status')

        // Buscar monitor pelo ID diretamente
        const monitor = await databaseService.getMonitorById(monitorId)
        
        if (monitor) {
          // Relatório estilo mensal do monitor
          this.addMonitorDetails(doc, monitor)
          await this.addMonthlyStats(doc, monitor, year || new Date().getFullYear(), (month || (new Date().getMonth() + 1)))
          this.addUptimeChart(doc, monitor)
          this.addIncidentsList(doc, monitor)
        } else {
          doc.fontSize(12)
             .fillColor('#dc2626')
             .text('Monitor não encontrado.', 50, 150)
        }

        this.addFooter(doc)
        doc.end()
      })
    } catch (error) {
      console.error('❌ Erro ao gerar PDF de status do monitor:', error)
      throw error
    }
  }

  /**
   * Obtém ícone do status
   */
  private getStatusIcon(status: string): string {
    const icons: { [key: string]: string } = {
      'up': '🟢',
      'down': '🔴',
      'unknown': '⚪'
    }
    return icons[status] || '⚪'
  }

  /**
   * Obtém texto do status
   */
  private getStatusText(status: string): string {
    const texts: { [key: string]: string } = {
      'up': 'Online',
      'down': 'Offline',
      'unknown': 'Desconhecido'
    }
    return texts[status] || 'Desconhecido'
  }

  /**
   * Obtém nome do mês
   */
  private getMonthName(month: number): string {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]
    return months[month - 1] || 'Mês Inválido'
  }

  /**
   * Salva PDF em arquivo
   */
  async savePDFToFile(pdfBuffer: Buffer, filename: string): Promise<string> {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'reports')
    
    // Criar diretório se não existir
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }
    
    const filePath = path.join(uploadsDir, filename)
    fs.writeFileSync(filePath, pdfBuffer)
    
    return filePath
  }
}

export const pdfService = new PDFService()