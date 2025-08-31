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
  /**
   * Gera PDF com status de todos os monitores
   */
  async generateStatusPDF(options: PDFReportOptions = {}): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 })
        const chunks: Buffer[] = []

        doc.on('data', chunk => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)

        // Buscar dados dos monitores
        const monitors = await databaseService.getMonitors()
        const groups = await databaseService.getGroups()

        // Cabeçalho do documento
        this.addHeader(doc, options.title || 'Status dos Monitores')
        
        // Informações gerais
        this.addGeneralInfo(doc, monitors)
        
        // Status por grupo
        await this.addMonitorsByGroup(doc, monitors, groups)
        
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
   * Gera PDF de relatório mensal para um monitor específico
   */
  async generateMonthlyReportPDF(monitorId: string, year: number, month: number): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 })
        const chunks: Buffer[] = []

        doc.on('data', chunk => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)

        // Buscar dados do monitor
        const monitors = await databaseService.getMonitors()
        const monitor = monitors.find(m => m.id === monitorId)
        
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
   * Adiciona monitores agrupados
   */
  private async addMonitorsByGroup(doc: PDFKit.PDFDocument, monitors: any[], groups: any[]) {
    doc.fontSize(16)
       .fillColor('#1f2937')
       .text('Status por Grupo', 50, doc.y)
    
    doc.moveDown(1)
    
    // Monitores sem grupo
    const monitorsWithoutGroup = monitors.filter(m => !m.group_id)
    if (monitorsWithoutGroup.length > 0) {
      this.addGroupSection(doc, 'Sem Grupo', monitorsWithoutGroup)
    }
    
    // Monitores por grupo
    for (const group of groups) {
      const groupMonitors = monitors.filter(m => m.group_id === group.id)
      if (groupMonitors.length > 0) {
        this.addGroupSection(doc, group.name, groupMonitors)
      }
    }
  }

  /**
   * Adiciona seção de grupo
   */
  private addGroupSection(doc: PDFKit.PDFDocument, groupName: string, monitors: any[]) {
    // Verificar se precisa de nova página
    if (doc.y > 700) {
      doc.addPage()
    }
    
    doc.fontSize(14)
       .fillColor('#4b5563')
       .text(groupName, 50, doc.y)
    
    doc.moveDown(0.5)
    
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
  private async addMonthlyStats(doc: PDFKit.PDFDocument, monitor: any, year: number, month: number) {
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
  private addUptimeChart(doc: PDFKit.PDFDocument, monitor: any) {
    doc.fontSize(14)
       .fillColor('#1f2937')
       .text('Gráfico de Disponibilidade', 50, doc.y)
    
    doc.moveDown(1)
    
    // Simular dados de uptime dos últimos 30 dias
    const days = 30
    let chartLine = ''
    
    for (let i = 0; i < days; i++) {
      const uptime = Math.random() > 0.05 ? '█' : '▁' // 95% de chance de estar online
      chartLine += uptime
    }
    
    doc.fontSize(8)
       .font('Courier')
       .fillColor('#059669')
       .text(chartLine, 50, doc.y)
    
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor('#6b7280')
       .text('█ Online  ▁ Offline', 50, doc.y + 15)
       .text('(Últimos 30 dias)', 50, doc.y + 30)
    
    doc.moveDown(3)
  }

  /**
   * Adiciona lista de incidentes
   */
  private addIncidentsList(doc: PDFKit.PDFDocument, monitor: any) {
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