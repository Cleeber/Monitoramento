import { databaseService } from './DatabaseService.js'
import { emailService } from './EmailService.js'
import { pdfService } from './PDFService.js'
import MonitoringService from '../monitoring/MonitoringService.js'

export interface MonitorStats {
  id: string
  name: string
  url: string
  status: string
  uptime_24h: number
  uptime_7d: number
  uptime_30d: number
  total_checks: number
  successful_checks: number
  failed_checks: number
  warning_checks: number
  offline_checks: number
  response_time_samples: number
  total_response_time: number
  min_response_time: number
  max_response_time: number
  avg_response_time: number
  incidents: Array<{
    date: string
    status: string
    duration: number
    message?: string
  }>
}

export interface MonthlyReport {
  monitor_id: string
  monitor_name: string
  period: string
  generated_at: string
  stats: MonitorStats
  text_content: string
}

export class ReportService {
  private monitoringService: MonitoringService | null = null

  /**
   * Define a instância do MonitoringService
   */
  setMonitoringService(monitoringService: MonitoringService) {
    this.monitoringService = monitoringService
  }

  /**
   * Gera relatório mensal em texto para um monitor específico
   */
  async generateMonthlyTextReport(monitorId: string, year: number, month: number): Promise<MonthlyReport | null> {
    try {
      // Buscar dados do monitor
      const monitors = await databaseService.getMonitors()
      const monitor = monitors.find((m: any) => m.id === monitorId)
      
      if (!monitor) {
        console.error(`Monitor ${monitorId} não encontrado`)
        return null
      }

      // Calcular período do relatório
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0, 23, 59, 59)
      const periodText = `${this.getMonthName(month)} ${year}`

      // Coletar estatísticas do período
      const stats = await this.collectMonitorStats(monitorId, startDate, endDate)
      
      // Gerar conteúdo em texto
      const textContent = this.generateTextContent(monitor, stats, periodText)

      const report: MonthlyReport = {
        monitor_id: monitorId,
        monitor_name: monitor.name,
        period: periodText,
        generated_at: new Date().toISOString(),
        stats,
        text_content: textContent
      }

      return report
    } catch (error) {
      console.error('Erro ao gerar relatório mensal:', error)
      return null
    }
  }

  /**
   * Coleta estatísticas de um monitor para um período específico
   */
  public async collectMonitorStats(monitorId: string, startDate: Date, endDate: Date): Promise<MonitorStats> {
    try {
      const monitor = await databaseService.getMonitorById(monitorId)
      if (!monitor) {
        throw new Error(`Monitor ${monitorId} não encontrado`)
      }

      const metrics = await databaseService.getMonitorReportMetrics(monitorId, startDate, endDate)
      const totalChecks = Number(metrics.total_checks) || 0
      const successfulChecks = Number(metrics.successful_checks) || 0
      const warningChecks = Number(metrics.warning_checks) || 0
      const offlineChecks = Number(metrics.offline_checks) || 0
      const responseTimeSamples = Number(metrics.response_time_samples) || 0
      const incidents = Array.isArray(metrics.incidents) ? metrics.incidents : []

      // Obter status em tempo real do MonitoringService
      const realTimeMonitor = this.monitoringService?.getMonitor(monitor.id)
      const currentStatus = realTimeMonitor?.status || monitor.status || 'unknown'

      return {
        id: monitor.id,
        name: monitor.name,
        url: monitor.url,
        status: currentStatus,
        uptime_24h: realTimeMonitor?.uptime_24h ?? monitor.uptime_24h ?? 0,
        uptime_7d: realTimeMonitor?.uptime_7d ?? monitor.uptime_7d ?? 0,
        uptime_30d: totalChecks > 0 ? Number(metrics.uptime) : 0,
        total_checks: totalChecks,
        successful_checks: successfulChecks,
        failed_checks: Number(metrics.failed_checks) || 0,
        warning_checks: warningChecks,
        offline_checks: offlineChecks,
        response_time_samples: responseTimeSamples,
        total_response_time: Number(metrics.total_response_time) || 0,
        min_response_time: Number(metrics.min_response_time) || 0,
        max_response_time: Number(metrics.max_response_time) || 0,
        avg_response_time: Math.round(Number(metrics.avg_response_time) || 0),
        incidents
      }
    } catch (error) {
      console.error('Erro ao coletar estatísticas do monitor:', error)
      throw error
    }
  }

  /**
   * Gera o conteúdo em texto do relatório
   */
  private generateTextContent(monitor: any, stats: MonitorStats, period: string): string {
    const content = `
=== RELATÓRIO MENSAL DE MONITORAMENTO ===

Período: ${period}
Gerado em: ${new Date().toLocaleString('pt-BR')}

--- INFORMAÇÕES DO MONITOR ---
Nome: ${monitor.name}
URL: ${monitor.url}
Tipo: ${monitor.type}
Status Atual: ${this.getStatusText(stats.status)}

--- ESTATÍSTICAS DO PERÍODO ---
Uptime: ${stats.uptime_30d.toFixed(2)}%
Total de Verificações: ${stats.total_checks.toLocaleString('pt-BR')}
Verificações Bem-sucedidas: ${stats.successful_checks.toLocaleString('pt-BR')}
Verificações com Falha: ${stats.failed_checks.toLocaleString('pt-BR')}
Tempo Médio de Resposta: ${stats.avg_response_time}ms

--- RESUMO DE DISPONIBILIDADE ---
${this.generateUptimeSummary(stats.uptime_30d)}

--- INCIDENTES REGISTRADOS ---
${this.generateIncidentsSummary(stats.incidents)}

--- ANÁLISE ---
${this.generateAnalysis(stats)}

=== FIM DO RELATÓRIO ===
`
    return content
  }

  private generateUptimeSummary(uptime: number): string {
    if (uptime >= 99.9) {
      return '✅ Excelente disponibilidade! O serviço manteve-se estável durante todo o período.'
    } else if (uptime >= 99.0) {
      return '🟡 Boa disponibilidade, com algumas interrupções menores.'
    } else if (uptime >= 95.0) {
      return '🟠 Disponibilidade regular, recomenda-se investigar as causas das interrupções.'
    } else {
      return '🔴 Baixa disponibilidade, é necessário tomar ações imediatas para melhorar a estabilidade.'
    }
  }

  private generateIncidentsSummary(incidents: any[]): string {
    if (incidents.length === 0) {
      return 'Nenhum incidente registrado no período. 🎉'
    }

    let summary = `Total de incidentes: ${incidents.length}\n\n`
    
    incidents.forEach((incident, index) => {
      const durationText = incident.duration < 60 
        ? `${incident.duration} minutos`
        : `${Math.round(incident.duration / 60)} horas`
      
      summary += `${index + 1}. ${incident.date} - Duração: ${durationText}\n`
      if (incident.message) {
        summary += `   Erro: ${incident.message}\n`
      }
      summary += '\n'
    })

    return summary
  }

  private generateAnalysis(stats: MonitorStats): string {
    let analysis = ''
    
    // Análise de uptime
    if (stats.uptime_30d >= 99.9) {
      analysis += 'O serviço apresentou excelente estabilidade no período. '
    } else if (stats.uptime_30d < 95.0) {
      analysis += 'O serviço apresentou instabilidade significativa. Recomenda-se investigação técnica. '
    }
    
    // Análise de tempo de resposta
    if (stats.avg_response_time < 200) {
      analysis += 'Tempo de resposta excelente. '
    } else if (stats.avg_response_time < 500) {
      analysis += 'Tempo de resposta adequado. '
    } else {
      analysis += 'Tempo de resposta elevado, pode impactar a experiência do usuário. '
    }
    
    // Análise de incidentes
    if (stats.incidents.length === 0) {
      analysis += 'Período sem incidentes registrados.'
    } else if (stats.incidents.length > 5) {
      analysis += 'Alto número de incidentes, recomenda-se análise das causas raiz.'
    }
    
    return analysis || 'Desempenho dentro dos parâmetros esperados.'
  }

  private getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'up': '🟢 Online',
      'down': '🔴 Offline',
      'unknown': '⚪ Desconhecido'
    }
    return statusMap[status] || status
  }

  private getMonthName(month: number): string {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]
    return months[month - 1] || 'Mês Inválido'
  }

  /**
   * Envia relatório mensal dinâmico com dados dos últimos 30 dias
   */
  async sendMonthlyReportDynamic(
    monitorId: string,
    email: string
  ): Promise<void> {
    try {
      console.log(`📧 Enviando relatório mensal dinâmico para ${email}...`)
      
      // Buscar dados do monitor
      const monitors = await databaseService.getMonitors()
      const monitor = monitors.find((m: any) => m.id === monitorId)
      if (!monitor) {
        throw new Error('Monitor não encontrado')
      }
      
      // Calcular período dos últimos 30 dias
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)
      
      // Coletar estatísticas dos últimos 30 dias
      const stats = await this.collectMonitorStats(monitorId, startDate, endDate)
      
      if (!stats) {
        throw new Error('Não foi possível coletar estatísticas do monitor')
      }
      
      // Gerar PDF usando o novo serviço modular
      let pdfBuffer: Buffer | undefined
      
      try {
        const now = new Date()
        const monthName = now.toLocaleDateString('pt-BR', { month: 'long' })
        const yearNum = now.getFullYear()
        const periodTitle = `${monthName} de ${yearNum}`

        console.log(`📄 Gerando PDF modular para monitor: ${monitor.name}`)
        
        pdfBuffer = await pdfService.generateReportPDF({
          monitor: {
            name: monitor.name,
            url: monitor.url,
            type: monitor.type,
            status: stats.status,
            slug: monitor.slug
          },
          stats: {
            uptime: stats.uptime_30d,
            total_checks: stats.total_checks,
            successful_checks: stats.successful_checks,
            failed_checks: stats.failed_checks,
            avg_response_time: stats.avg_response_time,
            incidents: stats.incidents
          },
          period: periodTitle,
          title: `${monitor.name} - Relatório Mensal`
        })
        
        console.log(`✅ PDF gerado com sucesso (${pdfBuffer.length} bytes)`)
      } catch (pdfError) {
        console.warn('⚠️ Erro ao gerar PDF, enviando sem anexo:', pdfError)
        pdfBuffer = undefined
      }
      
      // Montar link da página de status (se disponível)
      const baseUrl = process.env.FRONTEND_BASE_URL || 'https://monitor.pagina1digital.com.br'
      const statusLink = monitor.slug
        ? `${baseUrl}/status/${monitor.slug}`
        : undefined
      
      // Nome amigável do arquivo
      const now = new Date()
      const monthName = now.toLocaleDateString('pt-BR', { month: 'long' })
      const yearNum = now.getFullYear()
      const friendlyFileName = `Relatório Mensal - ${monitor.name} - ${monthName} de ${yearNum}.pdf`
      
      // Enviar email
      const result = await emailService.sendMonthlyReport(
        email,
        monitor.name,
        pdfBuffer,
        pdfBuffer ? friendlyFileName : undefined,
        statusLink
      )
      
      if (!result.success) {
        throw new Error(result.message)
      }
      
      console.log(`✅ Relatório mensal dinâmico enviado com sucesso para ${email}`)
      
      // Salvar histórico do envio
      try {
        const now = new Date()
        await databaseService.createMonthlyReportHistory({
          monitor_id: monitorId,
          email: email,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          report_data: JSON.stringify(stats),
          sent_at: now.toISOString(),
          status: 'sent'
        })
      } catch (historyError) {
        console.warn(`⚠️ Erro ao salvar histórico:`, historyError)
      }
      
    } catch (error) {
      console.error('❌ Erro ao enviar relatório mensal dinâmico:', error)
      throw error
    }
  }

  async reloadSmtpConfig() {
    await emailService.reloadConfig()
  }

  async sendTestEmail(email: string) {
    return await emailService.sendTestEmail(email)
  }

  async sendMonthlyReport(
    monitorId: string, 
    toEmail: string, 
    year: number, 
    month: number,
    includePdf: boolean = true
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`📊 Iniciando geração de relatório mensal - Monitor: ${monitorId}, Período: ${month}/${year}`)
      
      const monitors = await databaseService.getMonitors()
      const monitor = monitors.find((m: any) => m.id === monitorId)
      
      if (!monitor) {
        return { success: false, message: `Monitor não encontrado: ${monitorId}` }
      }

      const stats = await this.collectMonitorStats(monitorId, new Date(year, month - 1, 1), new Date(year, month, 0, 23, 59, 59))
      
      let pdfBuffer: Buffer | undefined
      let fileName: string | undefined
      
      if (includePdf) {
        try {
          console.log(`📄 Gerando PDF do relatório mensal...`)
          const monthName = this.getMonthName(month)
          
          pdfBuffer = await pdfService.generateReportPDF({
            monitor: {
              name: monitor.name,
              url: monitor.url,
              type: monitor.type,
              status: stats.status,
              slug: monitor.slug
            },
            stats: {
              uptime: stats.uptime_30d,
              total_checks: stats.total_checks,
              successful_checks: stats.successful_checks,
              failed_checks: stats.failed_checks,
              avg_response_time: stats.avg_response_time,
              incidents: stats.incidents
            },
            period: `${monthName} de ${year}`,
            title: `${monitor.name} - Relatório Mensal`
          })
          
          fileName = `relatorio-mensal-${monitor.name.replace(/[^a-zA-Z0-9]/g, '-')}-${month}-${year}.pdf`
          console.log(`✅ PDF gerado (${pdfBuffer.length} bytes)`) 
        } catch (pdfError) {
          console.warn('⚠️ Erro ao gerar PDF, enviando apenas texto:', pdfError)
        }
      }
      
      const baseUrl2 = process.env.FRONTEND_BASE_URL || 'https://monitor.pagina1digital.com.br'
      const statusLink = monitor.slug ? `${baseUrl2}/status/${monitor.slug}` : undefined
      
      const result = await emailService.sendMonthlyReport(
        toEmail,
        monitor.name,
        pdfBuffer,
        fileName,
        statusLink
      )
      
      if (result.success) {
        try {
          await databaseService.createMonthlyReportHistory({
            monitor_id: monitorId,
            email: toEmail,
            year,
            month,
            report_data: JSON.stringify(stats),
            sent_at: new Date().toISOString(),
            status: 'sent'
          })
        } catch (historyError) {
          console.warn(`⚠️ Erro ao salvar histórico:`, historyError)
        }
      }
      
      return result
    } catch (error) {
      console.error(`❌ Erro ao enviar relatório mensal:`, error)
      return {
        success: false,
        message: `Erro ao enviar relatório: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      }
    }
  }

  async sendMonthlyReportWithStatusPDF(
    monitorId: string, 
    toEmail: string, 
    year: number, 
    month: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`📊📄 Iniciando geração de relatório completo - Monitor: ${monitorId}, Período: ${month}/${year}`)
      
      const monitors = await databaseService.getMonitors()
      const monitor = monitors.find((m: any) => m.id === monitorId)
      
      if (!monitor) {
        return { success: false, message: `Monitor não encontrado: ${monitorId}` }
      }

      const stats = await this.collectMonitorStats(monitorId, new Date(year, month - 1, 1), new Date(year, month, 0, 23, 59, 59))
      const reportContent = this.generateTextContent(monitor, stats, `${this.getMonthName(month)} ${year}`)
      
      const attachments: any[] = []
      
      try {
        // 1. PDF do Monitor
        const monthlyPdfBuffer = await pdfService.generateReportPDF({
          monitor: {
            name: monitor.name,
            url: monitor.url,
            type: monitor.type,
            status: stats.status,
            slug: monitor.slug
          },
          stats: {
            uptime: stats.uptime_30d,
            total_checks: stats.total_checks,
            successful_checks: stats.successful_checks,
            failed_checks: stats.failed_checks,
            avg_response_time: stats.avg_response_time,
            incidents: stats.incidents
          },
          period: `${this.getMonthName(month)} de ${year}`,
          title: `${monitor.name} - Relatório Mensal`
        })

        const monthlyFileName = `relatorio-mensal-${monitor.name.replace(/[^a-zA-Z0-9]/g, '-')}-${month}-${year}.pdf`
        attachments.push({
          filename: monthlyFileName,
          content: monthlyPdfBuffer,
          contentType: 'application/pdf'
        })
        
        // 2. PDF Geral (Visão Global)
        const statusPdfBuffer = await pdfService.generateOverviewPDF(monitors)
        const statusFileName = `status-geral-${new Date().toISOString().split('T')[0]}.pdf`
        
        attachments.push({
          filename: statusFileName,
          content: statusPdfBuffer,
          contentType: 'application/pdf'
        })
        
      } catch (pdfError) {
        console.warn('⚠️ Erro ao gerar PDFs:', pdfError)
      }
      
      const baseUrl = process.env.FRONTEND_BASE_URL || 'https://monitor.pagina1digital.com.br'
      const statusLink = `${baseUrl}/status/${monitor.slug}`
      
      const result = await emailService.sendNotificationEmail(
        [toEmail],
        `📊 Relatório Completo - ${monitor.name} - ${month}/${year}`,
        `
          <h3>Relatório Mensal Completo</h3>
          <p><strong>Monitor:</strong> ${monitor.name}</p>
          <p><strong>Período:</strong> ${month}/${year}</p>
          
          <div style="background-color: white; padding: 15px; border-radius: 6px; border-left: 4px solid #2563eb;">
            ${reportContent.replace(/\n/g, '<br>')}
          </div>
          
          ${attachments.length > 0 ? '<p><strong>📎 Anexos:</strong> Relatório mensal e status geral em PDF</p>' : ''}
          ${statusLink ? `
          <div style="background-color: #ecfeff; padding: 15px; border-radius: 6px; margin-top: 20px; border-left: 4px solid #06b6d4;">
            <p style="margin: 0; color: #0e7490;"><strong>🔗 Acompanhe o status em tempo real:</strong><br>
              <a href="${statusLink}" target="_blank" style="color: #0369a1; text-decoration: none;">${statusLink}</a>
            </p>
          </div>` : ''}
        `,
        attachments
      )
      
      if (result.success) {
        try {
          await databaseService.createMonthlyReportHistory({
            monitor_id: monitorId,
            email: toEmail,
            year,
            month,
            report_data: JSON.stringify(stats),
            sent_at: new Date().toISOString(),
            status: 'sent'
          })
        } catch (historyError) {
          console.warn(`⚠️ Erro ao salvar histórico:`, historyError)
        }
      }
      
      return result
    } catch (error) {
      console.error(`❌ Erro ao enviar relatório completo:`, error)
      return {
        success: false,
        message: `Erro ao enviar relatório: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      }
    }
  }
}

export const reportService = new ReportService()
