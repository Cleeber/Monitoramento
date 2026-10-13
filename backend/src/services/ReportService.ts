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

  /**
   * Gera resumo de uptime
   */
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

  /**
   * Gera resumo de incidentes
   */
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

  /**
   * Gera análise do desempenho
   */
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

  /**
   * Converte status para texto legível
   */
  private getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'up': '🟢 Online',
      'down': '🔴 Offline',
      'unknown': '⚪ Desconhecido'
    }
    return statusMap[status] || status
  }

  /**
   * Converte número do mês para nome
   */
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

      // Conteúdo do relatório será gerado dinamicamente no email

      let pdfBuffer: Buffer | undefined

      try {
        if (monitor.slug) {
          console.log(`📄 Gerando PDF otimizado para monitor: ${monitor.name} (${monitor.slug})`)

          // Usar o mesmo método que funciona na exportação manual
          pdfBuffer = await pdfService.generateOptimizedStatusPDF(
            monitor.slug,
            `${monitor.name} - Relatório Mensal`
          )

          if (pdfBuffer && pdfBuffer.length > 10000) { // Verificar se o PDF tem tamanho razoável (>10KB)
            console.log(`✅ PDF otimizado gerado com sucesso (${Math.round(pdfBuffer.length / 1024)}KB)`)
          } else {
            console.warn('⚠️ PDF gerado muito pequeno, enviando e-mail sem anexo')
            pdfBuffer = undefined
          }
        } else {
          console.warn('⚠️ Monitor sem slug de status. Enviaremos o e-mail sem anexo de PDF.')
          pdfBuffer = undefined
        }
        console.log('📄 Processo de geração de PDF concluído')
      } catch (pdfError) {
        console.warn('⚠️ Erro inesperado na geração do PDF. O e-mail será enviado sem anexo:', pdfError)
        pdfBuffer = undefined
      }

      // Montar link da página de status (se disponível)
      // Ajuste: adicionar fallback público quando FRONTEND_BASE_URL não estiver definido
      const baseUrl = process.env.FRONTEND_BASE_URL || 'https://monitor.pagina1digital.com.br'
      const statusLink = monitor.slug
        ? `${baseUrl}/status/${monitor.slug}`
        : undefined

      // Nome amigável do arquivo: "Relatório Mensal - Nome do monitor - mês de ano"
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
        console.log(`💾 Histórico do relatório dinâmico salvo no banco de dados`)
      } catch (historyError) {
        console.warn(`⚠️ Erro ao salvar histórico (e-mail foi enviado com sucesso):`, historyError)
      }

    } catch (error) {
      console.error('❌ Erro ao enviar relatório mensal dinâmico:', error)

      // Salvar histórico de erro
      try {
        const now = new Date()
        await databaseService.createMonthlyReportHistory({
          monitor_id: monitorId,
          email: email,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          report_data: JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
          sent_at: now.toISOString(),
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Erro desconhecido'
        })
        console.log(`💾 Histórico de erro salvo no banco de dados`)
      } catch (historyError) {
        console.warn(`⚠️ Erro ao salvar histórico de erro:`, historyError)
      }

      throw error
    }
  }

  /**
   * Recarrega configuração SMTP
   */
  async reloadSmtpConfig() {
    await emailService.reloadConfig()
  }

  /**
   * Envia email de teste
   */
  async sendTestEmail(email: string) {
    return await emailService.sendTestEmail(email)
  }

  /**
   * Envia relatório mensal por e-mail
   */
  async sendMonthlyReport(
    monitorId: string,
    toEmail: string,
    year: number,
    month: number,
    includePdf: boolean = true
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`📊 Iniciando geração de relatório mensal - Monitor: ${monitorId}, Período: ${month}/${year}`)

      // Buscar dados do monitor
      const monitors = await databaseService.getMonitors()
      const monitor = monitors.find((m: any) => m.id === monitorId)

      if (!monitor) {
        const error = `Monitor não encontrado: ${monitorId}`
        console.error(`❌ ${error}`)
        return {
          success: false,
          message: error
        }
      }

      console.log(`📋 Monitor encontrado: ${monitor.name} (${monitor.url})`)
      console.log(`📝 Gerando estatísticas do período...`)

      // Gerar estatísticas
      const stats = await this.collectMonitorStats(monitorId, new Date(year, month - 1, 1), new Date(year, month, 0, 23, 59, 59))

      console.log(`📈 Estatísticas coletadas - Uptime: ${stats.uptime_30d.toFixed(2)}%, Checks: ${stats.total_checks}`)
      console.log(`📝 Gerando conteúdo do relatório...`)

      // Conteúdo do relatório será gerado dinamicamente no email

      let pdfBuffer: Buffer | undefined
      let fileName: string | undefined

      // Gerar PDF se solicitado
      if (includePdf) {
        try {
          console.log(`📄 Gerando PDF do relatório mensal...`)
          pdfBuffer = await pdfService.generateMonthlyReportPDF(monitorId, year, month)
          fileName = `relatorio-mensal-${monitor.name.replace(/[^a-zA-Z0-9]/g, '-')}-${month}-${year}.pdf`
          console.log(`✅ PDF do relatório gerado (${Math.round(pdfBuffer.length / 1024)}KB)`)
        } catch (pdfError) {
          console.warn('⚠️ Erro ao gerar PDF, enviando apenas texto:', pdfError)
        }
      }

      console.log(`📧 Enviando relatório para: ${toEmail}`)

      // Montar link da página de status (se disponível)
      // Ajuste: adicionar fallback público quando FRONTEND_BASE_URL não estiver definido
      const baseUrl2 = process.env.FRONTEND_BASE_URL || 'https://monitor.pagina1digital.com.br'
      const statusLink = monitor.slug
        ? `${baseUrl2}/status/${monitor.slug}`
        : undefined

      // Enviar e-mail usando o método específico para relatórios mensais
      const result = await emailService.sendMonthlyReport(
        toEmail,
        monitor.name,
        pdfBuffer,
        fileName,
        statusLink
      )

      if (result.success) {
        console.log(`✅ Relatório mensal enviado com sucesso`)

        // Tentar salvar histórico (não falhar se houver erro)
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
          console.log(`💾 Histórico do relatório salvo no banco de dados`)
        } catch (historyError) {
          console.warn(`⚠️ Erro ao salvar histórico (e-mail foi enviado com sucesso):`, historyError)
        }
      } else {
        console.error(`❌ Falha ao enviar relatório: ${result.message}`)
      }

      return result
    } catch (error) {
      console.error(`❌ Erro ao enviar relatório mensal (Monitor: ${monitorId}, ${month}/${year}):`, error)
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
      console.log(`📊📄 Iniciando geração de relatório mensal + status PDF - Monitor: ${monitorId}, Período: ${month}/${year}`)

      // Buscar dados do monitor
      const monitors = await databaseService.getMonitors()
      const monitor = monitors.find((m: any) => m.id === monitorId)

      if (!monitor) {
        const error = `Monitor não encontrado: ${monitorId}`
        console.error(`❌ ${error}`)
        return {
          success: false,
          message: error
        }
      }

      console.log(`📋 Monitor encontrado: ${monitor.name} (${monitor.url})`)
      console.log(`📝 Gerando estatísticas do período...`)

      // Gerar estatísticas
      const stats = await this.collectMonitorStats(monitorId, new Date(year, month - 1, 1), new Date(year, month, 0, 23, 59, 59))

      console.log(`📈 Estatísticas coletadas - Uptime: ${stats.uptime_30d.toFixed(2)}%, Checks: ${stats.total_checks}`)
      console.log(`📝 Gerando conteúdo do relatório...`)

      // Gerar conteúdo do relatório
      const reportContent = this.generateTextContent(monitor, stats, `${this.getMonthName(month)} ${year}`)

      let attachments: any[] = []

      try {
        console.log(`📄 Gerando PDF do relatório mensal...`)
        // Gerar PDF do relatório mensal
        const monthlyPdfBuffer = await pdfService.generateMonthlyReportPDF(monitorId, year, month)
        const monthlyFileName = `relatorio-mensal-${monitor.name.replace(/[^a-zA-Z0-9]/g, '-')}-${month}-${year}.pdf`

        console.log(`✅ PDF do relatório mensal gerado (${Math.round(monthlyPdfBuffer.length / 1024)}KB)`)

        attachments.push({
          filename: monthlyFileName,
          content: monthlyPdfBuffer,
          contentType: 'application/pdf'
        })

        console.log(`📄 Gerando PDF do status geral...`)
        // Gerar PDF do status geral
        const statusPdfBuffer = await pdfService.generateStatusPDF()
        const statusFileName = `status-geral-${new Date().toISOString().split('T')[0]}.pdf`

        console.log(`✅ PDF do status geral gerado (${Math.round(statusPdfBuffer.length / 1024)}KB)`)

        attachments.push({
          filename: statusFileName,
          content: statusPdfBuffer,
          contentType: 'application/pdf'
        })

      } catch (pdfError) {
        console.warn('⚠️ Erro ao gerar PDFs, enviando apenas texto:', pdfError)
      }

      console.log(`📧 Enviando relatório com ${attachments.length} anexos PDF para: ${toEmail}`)

      // Montar link público da página de status SEM depender de variável de ambiente
      // Observação: todos os monitores possuem página pública; sempre incluir o link
      const baseUrl = process.env.FRONTEND_BASE_URL || 'https://monitor.pagina1digital.com.br'
      const statusLink = `${baseUrl}/status/${monitor.slug}`

      // Enviar e-mail com anexos
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
        console.log(`✅ Relatório mensal + status PDF enviado com sucesso`)

        // Tentar salvar histórico (não falhar se houver erro)
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
          console.log(`💾 Histórico do relatório salvo no banco de dados`)
        } catch (historyError) {
          console.warn(`⚠️ Erro ao salvar histórico (e-mail foi enviado com sucesso):`, historyError)
        }
      } else {
        console.error(`❌ Falha ao enviar relatório: ${result.message}`)
      }

      return result
    } catch (error) {
      console.error(`❌ Erro ao enviar relatório completo (Monitor: ${monitorId}, ${month}/${year}):`, error)
      return {
        success: false,
        message: `Erro ao enviar relatório: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      }
    }
  }
}

export const reportService = new ReportService()
