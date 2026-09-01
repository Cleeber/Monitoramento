import PDFDocument from 'pdfkit'

export interface PDFReportMonitorData {
  name: string
  url: string
  type: string
  status: string
  slug?: string
}

export interface PDFReportStatsData {
  uptime: number
  total_checks: number
  successful_checks: number
  failed_checks: number
  avg_response_time: number
  incidents: Array<{
    date: string
    duration: number | string
    message?: string
  }>
}

export interface PDFReportOptions {
  monitor: PDFReportMonitorData
  stats: PDFReportStatsData
  period: string
  title?: string
}

export class PDFService {
  
  /**
   * Gera um PDF de relatório mensal de forma modular e pura (sem acesso a banco de dados)
   */
  async generateReportPDF(options: PDFReportOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`📄 Gerando PDF modular para: ${options.monitor.name}`)
        
        const doc = new PDFDocument({ margin: 50, size: 'A4' })
        const chunks: Buffer[] = []

        doc.on('data', chunk => chunks.push(chunk))
        doc.on('end', () => {
          const result = Buffer.concat(chunks)
          console.log(`✅ PDF gerado com sucesso: ${result.length} bytes`)
          resolve(result)
        })
        doc.on('error', reject)

        // 1. Cabeçalho
        this.addHeader(doc, options.title || 'Relatório Mensal', options.period)

        // 2. Informações do Monitor
        this.addMonitorDetails(doc, options.monitor)

        // 3. Estatísticas
        this.addStats(doc, options.stats)

        // 4. Gráfico de Disponibilidade (Simulado Visualmente)
        this.addUptimeVisual(doc, options.stats.uptime)

        // 5. Lista de Incidentes
        this.addIncidents(doc, options.stats.incidents)

        // 6. Rodapé
        this.addFooter(doc)

        doc.end()
      } catch (error) {
        console.error('❌ Erro ao gerar PDF:', error)
        reject(error)
      }
    })
  }

  private addHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
    // Logo/Brand
    doc.fontSize(24)
       .fillColor('#2563eb') // Blue 600
       .text('Uptime Monitor', 50, 50)
    
    // Título
    doc.fontSize(18)
       .fillColor('#1f2937') // Gray 800
       .text(title, 50, 90)
    
    // Subtítulo (Período)
    doc.fontSize(14)
       .fillColor('#6b7280') // Gray 500
       .text(subtitle, 50, 120)

    // Linha divisória
    doc.moveTo(50, 150)
       .lineTo(545, 150) // A4 width is ~595. 595 - 50 = 545
       .lineWidth(1)
       .strokeColor('#e5e7eb')
       .stroke()
  }

  private addMonitorDetails(doc: PDFKit.PDFDocument, monitor: PDFReportMonitorData) {
    const startY = 180
    
    doc.fontSize(14)
       .fillColor('#1f2937')
       .text('Informações do Monitor', 50, startY)

    doc.fontSize(11)
       .fillColor('#374151') // Gray 700
       
    const details = [
      { label: 'Nome', value: monitor.name },
      { label: 'URL', value: monitor.url },
      { label: 'Tipo', value: monitor.type.toUpperCase() },
      { label: 'Status Atual', value: this.formatStatus(monitor.status) }
    ]

    let currentY = startY + 30
    details.forEach(item => {
      doc.font('Helvetica-Bold').text(`${item.label}:`, 50, currentY)
      doc.font('Helvetica').text(item.value, 150, currentY)
      currentY += 20
    })
  }

  private addStats(doc: PDFKit.PDFDocument, stats: PDFReportStatsData) {
    const startY = doc.y + 30
    
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('#1f2937')
       .text('Estatísticas do Período', 50, startY)

    const boxTop = startY + 30
    
    // Desenhar caixas de estatísticas
    this.drawStatBox(doc, 50, boxTop, 'Uptime', `${stats.uptime.toFixed(2)}%`, stats.uptime >= 99 ? '#059669' : '#dc2626')
    this.drawStatBox(doc, 180, boxTop, 'Checks Totais', stats.total_checks.toString())
    this.drawStatBox(doc, 310, boxTop, 'Falhas', stats.failed_checks.toString(), stats.failed_checks > 0 ? '#dc2626' : '#059669')
    this.drawStatBox(doc, 440, boxTop, 'Resp. Média', `${Math.round(stats.avg_response_time)}ms`)
  }

  private drawStatBox(doc: PDFKit.PDFDocument, x: number, y: number, label: string, value: string, color: string = '#1f2937') {
    doc.rect(x, y, 110, 60)
       .fillAndStroke('#f9fafb', '#e5e7eb')
    
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#6b7280')
       .text(label, x + 10, y + 10, { width: 90, align: 'center' })
       
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor(color)
       .text(value, x + 10, y + 30, { width: 90, align: 'center' })
  }

  private addUptimeVisual(doc: PDFKit.PDFDocument, uptime: number) {
    const startY = doc.y + 80 // Espaço após as caixas
    
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('#1f2937')
       .text('Disponibilidade', 50, startY)

    // Barra de progresso visual
    const barWidth = 495
    const barHeight = 20
    const filledWidth = (uptime / 100) * barWidth

    // Fundo da barra
    doc.rect(50, startY + 30, barWidth, barHeight)
       .fill('#e5e7eb')

    // Parte preenchida (verde se alto uptime, vermelho se baixo)
    const color = uptime >= 98 ? '#059669' : (uptime >= 90 ? '#d97706' : '#dc2626')
    doc.rect(50, startY + 30, filledWidth, barHeight)
       .fill(color)
       
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#6b7280')
       .text('0%', 50, startY + 55)
       .text('100%', 50 + barWidth - 25, startY + 55)
  }

  private addIncidents(doc: PDFKit.PDFDocument, incidents: any[]) {
    const startY = doc.y + 80
    
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('#1f2937')
       .text('Histórico de Incidentes', 50, startY)

    if (!incidents || incidents.length === 0) {
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('#059669')
         .text('Nenhum incidente registrado no período. O serviço operou perfeitamente! 🎉', 50, startY + 30)
      return
    }

    let currentY = startY + 30
    
    incidents.forEach((incident, index) => {
      // Verificar se precisa de nova página
      if (currentY > 700) {
        doc.addPage()
        currentY = 50
      }

      const duration = typeof incident.duration === 'number' 
        ? (incident.duration < 60 ? `${incident.duration} min` : `${Math.round(incident.duration/60)}h`)
        : incident.duration

      doc.rect(50, currentY, 495, 50)
         .fillAndStroke('#fef2f2', '#fee2e2')

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor('#991b1b')
         .text(`🔴 Falha em ${incident.date} - Duração: ${duration}`, 60, currentY + 10)
      
      if (incident.message) {
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#7f1d1d')
           .text(`Motivo: ${incident.message}`, 60, currentY + 30)
      }

      currentY += 60
    })
  }

  private addFooter(doc: PDFKit.PDFDocument) {
    const bottom = doc.page.height - 50
    
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#9ca3af')
       .text('Gerado automaticamente pelo Uptime Monitor', 50, bottom)
       .text(new Date().toLocaleString('pt-BR'), 50, bottom + 12)
  }

  private formatStatus(status: string): string {
    const map: any = {
      'up': 'Online',
      'down': 'Offline',
      'paused': 'Pausado',
      'maintenance': 'Manutenção'
    }
    return map[status] || status
  }

  /**
   * Gera um PDF com visão geral de todos os monitores
   */
  async generateOverviewPDF(monitors: any[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' })
        const chunks: Buffer[] = []

        doc.on('data', chunk => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)

        this.addHeader(doc, 'Visão Geral do Sistema', new Date().toLocaleDateString('pt-BR'))

        const total = monitors.length
        const up = monitors.filter(m => m.status === 'up').length
        const down = monitors.filter(m => m.status === 'down').length
        const uptimeAvg = monitors.reduce((acc, m) => acc + (m.uptime_24h || 0), 0) / (total || 1)

        // Resumo
        doc.fontSize(14).text('Resumo', 50, doc.y + 20)
        doc.fontSize(11).text(`Total: ${total} | Online: ${up} | Offline: ${down}`, 50, doc.y + 10)
        doc.text(`Disponibilidade Média (24h): ${uptimeAvg.toFixed(2)}%`)

        // Lista
        doc.moveDown(2)
        monitors.forEach(m => {
          const color = m.status === 'up' ? '#059669' : '#dc2626'
          doc.fillColor(color).text(m.status === 'up' ? '●' : '●', 50, doc.y)
          doc.fillColor('#1f2937').text(m.name, 70, doc.y - 11)
          doc.fontSize(9).fillColor('#6b7280').text(`${m.url} - ${m.uptime_24h?.toFixed(2)}%`, 70, doc.y + 2)
          doc.fontSize(11).moveDown(0.5)
        })

        this.addFooter(doc)
        doc.end()
      } catch (error) {
        reject(error)
      }
    })
  }
}

export const pdfService = new PDFService()
