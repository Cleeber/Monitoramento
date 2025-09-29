import cron from 'node-cron'
import { databaseService } from './DatabaseService.js'
import { reportService } from './ReportService.js'

export class SchedulerService {
  private jobs: Map<string, cron.ScheduledTask> = new Map()
  private isInitialized = false

  /**
   * Inicializa o serviço de agendamento
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('📅 Serviço de agendamento já inicializado')
      return
    }

    try {
      console.log('📅 Inicializando SchedulerService...')
      
      // Agendar relatórios individuais para cada monitor
      await this.scheduleIndividualMonitorReports()
      
      // Agendar limpeza de logs antigos (opcional)
      this.scheduleLogCleanup()
      
      this.isInitialized = true
      console.log('✅ SchedulerService inicializado com sucesso')
      console.log(`📋 Jobs agendados: ${this.jobs.size}`)
      
      // Listar jobs agendados
      this.jobs.forEach((_, jobName) => {
        console.log(`   - ${jobName}: agendado`)
      })
    } catch (error) {
      console.error('❌ Erro ao inicializar serviço de agendamento:', error)
      throw error
    }
  }

  /**
   * Agenda relatórios individuais para cada monitor baseado no horário configurado
   */
  private async scheduleIndividualMonitorReports(): Promise<void> {
    try {
      // Buscar configurações de relatório mensal ativas e monitores
      const configs = await databaseService.getMonthlyReportConfigs()
      const monitors = await databaseService.getMonitors()

      let scheduledCount = 0

      for (const config of configs) {
        if (!config?.is_active) continue
        const monitor = monitors.find(m => m.id === config.monitor_id)
        if (monitor && monitor.report_send_time && config.email && config.send_day) {
          // Compor dados a partir da config e do monitor (mantendo mínimo impacto)
          const composedMonitor = {
            ...monitor,
            report_email: config.email,
            report_send_day: config.send_day
            // report_send_time já vem do monitor
          }
          await this.scheduleMonitorReport(composedMonitor)
          scheduledCount++
        }
      }

      console.log(`📅 Agendados relatórios para ${scheduledCount} monitores`)
    } catch (error) {
      console.error('❌ Erro ao agendar relatórios individuais:', error)
    }
  }

  /**
   * Agenda relatório para um monitor específico
   */
  private async scheduleMonitorReport(monitor: any): Promise<void> {
    const jobName = `monthly-report-${monitor.id}`
    
    // Remover job existente se houver
    if (this.jobs.has(jobName)) {
      this.jobs.get(jobName)?.stop()
      this.jobs.delete(jobName)
    }
    
    // Extrair hora e minuto do report_send_time (formato HH:MM)
    const [hour, minute] = monitor.report_send_time.split(':')
    const day = monitor.report_send_day
    
    // Criar expressão cron: minuto hora dia * *
    const cronExpression = `${minute} ${hour} ${day} * *`
    
    const task = cron.schedule(cronExpression, async () => {
      console.log(`📊 Enviando relatório mensal para monitor: ${monitor.name}`)
      await this.sendMonthlyReportForMonitor(monitor)
    }, {
      scheduled: false,
      timezone: 'America/Sao_Paulo'
    })
    
    this.jobs.set(jobName, task)
    task.start()
    
    console.log(`📅 Relatório agendado para monitor '${monitor.name}' - dia ${day} às ${hour}:${minute}`)
  }

  /**
   * Agenda limpeza de logs antigos
   * Executa todo domingo às 02:00
   */
  private scheduleLogCleanup(): void {
    const task = cron.schedule('0 2 * * 0', async () => {
      console.log('🧹 Executando limpeza semanal de logs antigos...')
      console.log('🧹 Executando limpeza de logs antigos...')
      await this.cleanupOldLogs()
    }, {
      scheduled: true,
      timezone: 'America/Sao_Paulo'
    })

    this.jobs.set('log-cleanup', task)
    console.log('📅 Agendamento de limpeza de logs configurado (02:00 aos domingos)')
  }

  /**
   * Envia relatório mensal para um monitor específico
   */
  private async sendMonthlyReportForMonitor(monitor: any): Promise<void> {
    try {
      const today = new Date()
      const reportMonth = today.getMonth() + 1
      const reportYear = today.getFullYear()
      const todayStr = today.toISOString().split('T')[0] // YYYY-MM-DD
      
      console.log(`📧 Processando relatório para monitor ${monitor.name} (${monitor.id})`)
      
      // Verificar se já foi enviado HOJE (não apenas este mês)
      const history = await databaseService.getMonthlyReportHistory({
        monitor_id: monitor.id,
        year: reportYear,
        month: reportMonth,
        limit: 10 // Buscar mais registros para verificar hoje
      })
      
      // Verificar se algum relatório foi enviado hoje
      const sentToday = history.some(report => {
        const reportDate = new Date(report.sent_at).toISOString().split('T')[0]
        return reportDate === todayStr && report.status === 'sent'
      })
      
      if (sentToday) {
        console.log(`⏭️ Relatório já enviado hoje para monitor ${monitor.name} (${todayStr})`)
        return
      }
      
      try {
        // Gerar e enviar relatório dinamicamente com dados dos últimos 30 dias
        await reportService.sendMonthlyReportDynamic(monitor.id, monitor.report_email)
        
        // Registrar no histórico
        await databaseService.createMonthlyReportHistory({
          monitor_id: monitor.id,
          email: monitor.report_email,
          year: reportYear,
          month: reportMonth,
          report_data: { success: true, sent_at: new Date().toISOString() },
          sent_at: new Date().toISOString(),
          status: 'sent'
        })
        
        console.log(`✅ Relatório enviado com sucesso para ${monitor.report_email}`)
      } catch (error) {
        console.error(`❌ Erro ao enviar relatório para ${monitor.report_email}:`, error)
        
        // Registrar erro no histórico
        await databaseService.createMonthlyReportHistory({
          monitor_id: monitor.id,
          email: monitor.report_email,
          year: reportYear,
          month: reportMonth,
          report_data: { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' },
          sent_at: new Date().toISOString(),
          status: 'failed'
        })
      }
    } catch (error) {
      console.error('❌ Erro ao processar relatório mensal:', error)
    }
  }

  /**
   * Limpa logs antigos (mais de 30 dias)
   */
  private async cleanupOldLogs(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      console.log(`🗑️ Iniciando limpeza de logs anteriores a ${thirtyDaysAgo.toLocaleDateString('pt-BR')}...`)
      
      // Contar logs antes da limpeza
      const totalLogsBefore = await databaseService.countMonitoringLogs()
      console.log(`📊 Total de logs antes da limpeza: ${totalLogsBefore}`)
      
      // Limpar logs de monitoramento antigos
      const deletedCount = await databaseService.deleteOldMonitoringLogs(thirtyDaysAgo)
      
      const totalLogsAfter = await databaseService.countMonitoringLogs()
      console.log(`📊 Total de logs após a limpeza: ${totalLogsAfter}`)
      console.log(`🗑️ Logs removidos: ${deletedCount}`)
      
      console.log('✅ Limpeza de logs concluída com sucesso')
    } catch (error) {
      console.error('❌ Erro na limpeza de logs:', error)
    }
  }

  /**
   * Agenda um relatório personalizado
   */
  async scheduleCustomReport(
    jobId: string,
    cronExpression: string,
    monitorId: string,
    email: string,
    includePdf: boolean = true
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Validar expressão cron
      if (!cron.validate(cronExpression)) {
        return {
          success: false,
          message: 'Expressão cron inválida'
        }
      }

      // Remover job existente se houver
      if (this.jobs.has(jobId)) {
        this.jobs.get(jobId)?.stop()
        this.jobs.delete(jobId)
      }

      // Criar novo job
      const task = cron.schedule(cronExpression, async () => {
        console.log(`📊 Executando relatório personalizado: ${jobId}`)
        
        const now = new Date()
        const month = now.getMonth() + 1
        const year = now.getFullYear()
        
        try {
          const result = await reportService.sendMonthlyReport(
            monitorId,
            email,
            year,
            month,
            includePdf
          )
          
          if (result.success) {
            console.log(`✅ Relatório personalizado ${jobId} enviado com sucesso`)
          } else {
            console.error(`❌ Erro no relatório personalizado ${jobId}:`, result.message)
          }
        } catch (error) {
          console.error(`❌ Erro ao executar relatório personalizado ${jobId}:`, error)
        }
      }, {
        scheduled: true,
        timezone: 'America/Sao_Paulo'
      })

      this.jobs.set(jobId, task)
      
      return {
        success: true,
        message: `Relatório personalizado ${jobId} agendado com sucesso`
      }
    } catch (error) {
      console.error('❌ Erro ao agendar relatório personalizado:', error)
      return {
        success: false,
        message: `Erro ao agendar relatório: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      }
    }
  }

  /**
   * Remove um job agendado
   */
  removeScheduledJob(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (job) {
      job.stop()
      this.jobs.delete(jobId)
      console.log(`📅 Job ${jobId} removido`)
      return true
    }
    return false
  }

  /**
   * Lista todos os jobs ativos
   */
  getActiveJobs(): string[] {
    return Array.from(this.jobs.keys())
  }

  /**
   * Lista todos os jobs com detalhes
   */
  listJobs(): Array<{ id: string; name: string; status: string }> {
    return Array.from(this.jobs.entries()).map(([jobId, _]) => ({
      id: jobId,
      name: jobId,
      status: 'scheduled' // node-cron não possui propriedade 'running'
    }))
  }

  /**
   * Reagenda relatório para um monitor específico (usado quando configurações são alteradas)
   */
  async rescheduleMonitorReport(monitorId: string): Promise<void> {
    try {
      const monitor = await databaseService.getMonitorById(monitorId)
      const config = await databaseService.getMonthlyReportConfigByMonitor(monitorId)

      const jobName = `monthly-report-${monitorId}`

      // Se não existir monitor, apenas remove o job (se houver)
      if (!monitor) {
        if (this.jobs.has(jobName)) {
          this.jobs.get(jobName)?.stop()
          this.jobs.delete(jobName)
          console.log(`📅 Job removido para monitor inexistente ${monitorId}`)
        }
        return
      }

      // Reagendar baseado na configuração mensal (mínimo impacto: usar hora do monitor e e-mail/dia da config)
      if (config?.is_active && monitor.report_send_time && config.email && config.send_day) {
        const composedMonitor = {
          ...monitor,
          report_email: config.email,
          report_send_day: config.send_day
          // report_send_time permanece do monitor
        }
        await this.scheduleMonitorReport(composedMonitor)
        return
      }

      // Caso contrário, remover job existente
      if (this.jobs.has(jobName)) {
        this.jobs.get(jobName)?.stop()
        this.jobs.delete(jobName)
        console.log(`📅 Job removido para monitor ${monitor.name} (${monitorId}) por ausência de configuração ativa`)
      }
    } catch (error) {
      console.error(`❌ Erro ao reagendar job do monitor ${monitorId}:`, error)
    }
  }

  /**
   * Para todos os jobs e limpa o serviço
   */
  shutdown(): void {
    console.log('📅 Parando serviço de agendamento...')
    
    for (const [jobId, job] of this.jobs) {
      job.stop()
      console.log(`📅 Job ${jobId} parado`)
    }
    
    this.jobs.clear()
    this.isInitialized = false
    
    console.log('📅 Serviço de agendamento parado')
  }

  /**
   * Força execução imediata da verificação de relatórios mensais
   */
  async triggerMonthlyReportsCheck(): Promise<void> {
    console.log('🚀 Executando verificação de relatórios mensais manualmente...')
    // Método não implementado - usar scheduleIndividualMonitorReports
    await this.scheduleIndividualMonitorReports()
  }

  /**
   * Força a execução da verificação de relatórios mensais
   */
  async forceCheckMonthlyReports(): Promise<void> {
    console.log('🔄 Forçando verificação manual de relatórios mensais...')
    const startTime = Date.now()
    
    try {
      // Usar método existente para verificar relatórios individuais
      await this.scheduleIndividualMonitorReports()
      const duration = Date.now() - startTime
      console.log(`✅ Verificação manual concluída em ${duration}ms`)
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`❌ Erro na verificação manual após ${duration}ms:`, error)
      throw error
    }
  }
}

export const schedulerService = new SchedulerService()