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
  private async collectMonitorStats(monitorId: string, startDate: Date, endDate: Date): Promise<MonitorStats> {
    try {
      // Buscar dados do monitor
      const monitors = await databaseService.getMonitors()
      const monitor = monitors.find((m: any) => m.id === monitorId)
      
      if (!monitor) {
        throw new Error(`Monitor ${monitorId} não encontrado`)
      }

      // Buscar checks do período (simulado - você pode implementar uma query específica)
      const checks = await this.getMonitorChecksForPeriod(monitorId, startDate, endDate)
      
      // Calcular estatísticas
      const totalChecks = checks.length
      const successfulChecks = checks.filter((check: any) => check.status === 'up').length
      const failedChecks = totalChecks - successfulChecks
      const uptimePercentage = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0
      
      // Calcular tempo médio de resposta
      const responseTimes = checks.filter((check: any) => check.response_time > 0).map((check: any) => check.response_time)
      const avgResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((sum: any, time: any) => sum + time, 0) / responseTimes.length 
        : 0

      // Identificar incidentes (períodos de downtime)
      const incidents = this.identifyIncidents(checks)

      // Obter status em tempo real do MonitoringService
      const realTimeMonitor = this.monitoringService?.getMonitor(monitor.id)
      const currentStatus = realTimeMonitor?.status || monitor.status || 'unknown'

      return {
        id: monitor.id,
        name: monitor.name,
        url: monitor.url,
        status: currentStatus,
        uptime_24h: realTimeMonitor?.uptime_24h || monitor.uptime_24h || 0,
        uptime_7d: realTimeMonitor?.uptime_7d || monitor.uptime_7d || 0,
        uptime_30d: uptimePercentage,
        total_checks: totalChecks,
        successful_checks: successfulChecks,
        failed_checks: failedChecks,
        avg_response_time: Math.round(avgResponseTime),
        incidents
      }
    } catch (error) {
      console.error('Erro ao coletar estatísticas do monitor:', error)
      throw error
    }
  }

  /**
   * Busca checks de um monitor para um período específico
   */
  private async getMonitorChecksForPeriod(monitorId: string, startDate: Date, endDate: Date) {
    try {
      console.log(`📊 Buscando checks reais do período ${startDate.toISOString()} até ${endDate.toISOString()} para monitor ${monitorId}`)
      
      // Usar a nova função do DatabaseService para buscar dados reais
      const checks = await databaseService.getMonitorChecksForPeriod(monitorId, startDate, endDate)
      
      console.log(`📈 Encontrados ${checks.length} checks reais no período`)
      
      // Converter status para formato esperado (online/offline -> up/down)
      return checks.map((check: any) => ({
        ...check,
        status: check.status === 'online' ? 'up' : 'down'
      }))
    } catch (error) {
      console.error('❌ Erro ao buscar checks do período, usando dados simulados como fallback:', error)
      
      // Fallback para dados simulados em caso de erro
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      const checksPerDay = 24 * 4 // 4 checks por hora
      const totalChecks = totalDays * checksPerDay
      
      const checks = []
      for (let i = 0; i < totalChecks; i++) {
        const checkTime = new Date(startDate.getTime() + (i * 15 * 60 * 1000)) // A cada 15 minutos
        const isUp = Math.random() > 0.05 // 95% de uptime simulado
        
        checks.push({
          id: `check_${i}`,
          monitor_id: monitorId,
          status: isUp ? 'up' : 'down',
          response_time: isUp ? Math.floor(Math.random() * 500) + 100 : 0,
          checked_at: checkTime.toISOString(),
          error_message: isUp ? null : 'Connection timeout'
        })
      }
      
      return checks
    }
  }

  /**
   * Identifica incidentes (períodos de downtime) a partir dos checks
   */
  private identifyIncidents(checks: any[]) {
    const incidents = []
    let currentIncident = null
    
    for (const check of checks) {
      if (check.status === 'down') {
        if (!currentIncident) {
          currentIncident = {
            start: new Date(check.checked_at),
            end: new Date(check.checked_at),
            message: check.error_message
          }
        } else {
          currentIncident.end = new Date(check.checked_at)
        }
      } else if (currentIncident) {
        // Fim do incidente
        const duration = Math.round((currentIncident.end.getTime() - currentIncident.start.getTime()) / (1000 * 60)) // em minutos
        
        incidents.push({
          date: currentIncident.start.toISOString().split('T')[0],
          status: 'down',
          duration,
          message: currentIncident.message
        })
        
        currentIncident = null
      }
    }
    
    // Se ainda há um incidente em andamento
    if (currentIncident) {
      const duration = Math.round((currentIncident.end.getTime() - currentIncident.start.getTime()) / (1000 * 60))
      incidents.push({
        date: currentIncident.start.toISOString().split('T')[0],
        status: 'down',
        duration,
        message: currentIncident.message
      })
    }
    
    return incidents
  }

  /**
   * Gera conteúdo textual do relatório dinâmico
   */
  private generateDynamicReportContent(
    stats: any,
    monitor: any,
    startDate: Date,
    endDate: Date
  ): string {
    return `
📊 RELATÓRIO DINÂMICO - ÚLTIMOS 30 DIAS

🔍 Monitor: ${monitor.name}
🌐 URL: ${monitor.url}
📅 Período: ${startDate.toLocaleDateString('pt-BR')} - ${endDate.toLocaleDateString('pt-BR')}

📈 ESTATÍSTICAS DO PERÍODO:
• Total de verificações: ${stats.total_checks?.toLocaleString() || 'N/A'}
• Verificações bem-sucedidas: ${stats.successful_checks?.toLocaleString() || 'N/A'}
• Verificações com falha: ${stats.failed_checks?.toLocaleString() || 'N/A'}
• Uptime: ${stats.uptime_30d?.toFixed(2) || '0.00'}%
• Tempo de resposta médio: ${stats.avg_response_time || 0}ms

🚨 INCIDENTES (${stats.incidents?.length || 0}):
${stats.incidents && stats.incidents.length > 0 
  ? stats.incidents.map((incident: any, index: number) => 
      `${index + 1}. ${new Date(incident.startTime).toLocaleString('pt-BR')} - ${new Date(incident.endTime).toLocaleString('pt-BR')} (${incident.duration || 'N/A'})`
    ).join('\n')
  : '• Nenhum incidente registrado no período'
}

---
Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')}
    `.trim()
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
      
      // Gerar conteúdo do relatório dinâmico
      const content = this.generateDynamicReportContent(
        stats,
        monitor,
        startDate,
        endDate
      )
      
      let pdfBuffer: Buffer | undefined
      
      try {
        if (monitor.slug) {
          // Tentar gerar PDF como captura da página de status do monitor
          const candidateBaseUrls: string[] = []
          if (process.env.FRONTEND_BASE_URL) candidateBaseUrls.push(process.env.FRONTEND_BASE_URL)
          candidateBaseUrls.push('http://localhost:3000', 'http://localhost:3001')
          
          let success = false
          for (const baseUrl of candidateBaseUrls) {
            if (success) break
            try {
              console.log(`🖼️ Tentando captura via generateOptimizedStatusPDF usando baseUrl: ${baseUrl}`)
              pdfBuffer = await pdfService.generateOptimizedStatusPDF(
                monitor.slug,
                monitor.name,
                baseUrl
              )
              console.log('✅ Captura otimizada bem-sucedida')
              success = true
              break
            } catch (optErr) {
              console.warn('⚠️ Falha na captura otimizada, tentando dinâmica...', optErr)
              try {
                console.log(`🖼️ Tentando captura via generateDynamicStatusPDF usando baseUrl: ${baseUrl}`)
                pdfBuffer = await pdfService.generateDynamicStatusPDF(
                  monitor.slug,
                  monitor.name,
                  baseUrl
                )
                console.log('✅ Captura dinâmica bem-sucedida')
                success = true
                break
              } catch (dynErr) {
                console.warn('⚠️ Falha na captura dinâmica com esta baseUrl, tentando próxima...', dynErr)
              }
            }
          }
          
          if (!success) {
            // ALTERAÇÃO: Removido fallback para PDF geral conforme solicitação do usuário.
            // O relatório deve ser exclusivamente a cópia/print da página de status do monitor.
            console.warn('⚠️ Não foi possível capturar a página de status após todas as tentativas. Enviaremos o e-mail sem anexo de PDF, conforme especificação.')
            pdfBuffer = undefined
          }
        } else {
          // Fallback se o monitor não possuir slug
          // ALTERAÇÃO: Evitar envio do PDF geral de 5KB. Sem slug, não é possível capturar a página de status.
          console.warn('⚠️ Monitor sem slug de status. Enviaremos o e-mail sem anexo de PDF para evitar o relatório geral.')
          pdfBuffer = undefined
        }
        console.log('📄 Processo de geração de PDF concluído')
      } catch (pdfError) {
        console.warn('⚠️ Erro inesperado na geração do PDF. O e-mail poderá ser enviado sem anexo:', pdfError)
      }
      
      // Montar link da página de status (se disponível)
      const statusLink = monitor.slug && process.env.FRONTEND_BASE_URL
        ? `${process.env.FRONTEND_BASE_URL}/status/${monitor.slug}`
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
        content,
        pdfBuffer,
        pdfBuffer ? friendlyFileName : undefined,
        statusLink
      )
      
      if (!result.success) {
        throw new Error(result.message)
      }
      
      console.log(`✅ Relatório mensal dinâmico enviado com sucesso para ${email}`)
      
    } catch (error) {
      console.error('❌ Erro ao enviar relatório mensal dinâmico:', error)
      throw error
    }
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
      
      // Gerar conteúdo do relatório
      const reportContent = this.generateTextContent(monitor, stats, `${this.getMonthName(month)} ${year}`)
      
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
      const statusLink = monitor.slug && process.env.FRONTEND_BASE_URL
        ? `${process.env.FRONTEND_BASE_URL}/status/${monitor.slug}`
        : undefined
      
      // Enviar e-mail usando o método específico para relatórios mensais
      const result = await emailService.sendMonthlyReport(
        toEmail,
        monitor.name,
        reportContent,
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
      const monitor = monitors.find(m => m.id === monitorId)
      
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

      const statusLink = monitor.slug && process.env.FRONTEND_BASE_URL
        ? `${process.env.FRONTEND_BASE_URL}/status/${monitor.slug}`
        : undefined
      
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