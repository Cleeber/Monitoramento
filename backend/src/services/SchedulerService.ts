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
      
      // Agendar verificação diária para envio de relatórios
      this.scheduleMonthlyReportsCheck()
      
      // Agendar limpeza de logs antigos (opcional)
      this.scheduleLogCleanup()
      
      this.isInitialized = true
      console.log('✅ SchedulerService inicializado com sucesso')
      console.log(`📋 Jobs agendados: ${this.jobs.size}`)
      
      // Listar jobs agendados
      this.jobs.forEach((task, jobName) => {
        console.log(`   - ${jobName}: agendado`)
      })
    } catch (error) {
      console.error('❌ Erro ao inicializar serviço de agendamento:', error)
      throw error
    }
  }

  /**
   * Agenda verificação diária para envio de relatórios mensais
   * Executa todos os dias às 09:00
   */
  private scheduleMonthlyReportsCheck(): void {
    const task = cron.schedule('0 9 * * *', async () => {
      console.log('⏰ Executando verificação diária de relatórios mensais...')
      console.log('📅 Verificando relatórios mensais para envio...')
      await this.checkAndSendMonthlyReports()
    }, {
      scheduled: true,
      timezone: 'America/Sao_Paulo'
    })

    this.jobs.set('monthly-reports-check', task)
    console.log('📅 Agendamento de relatórios mensais configurado (09:00 diariamente)')
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
   * Verifica e envia relatórios mensais que devem ser enviados hoje
   */
  private async checkAndSendMonthlyReports(): Promise<void> {
    try {
      const today = new Date()
      const currentDay = today.getDate()
      const currentMonth = today.getMonth() + 1
      const currentYear = today.getFullYear()
      
      console.log(`📅 Verificando relatórios para o dia ${currentDay}...`)
      
      // Buscar todas as configurações de relatórios mensais
      const configs = await databaseService.getMonthlyReportConfigs()
      
      console.log(`📋 Encontradas ${configs.length} configurações de relatórios`)
      
      let sentCount = 0
      let errorCount = 0
      let skippedCount = 0
      
      for (const config of configs) {
        // Verificar se hoje é o dia de envio configurado
        if (config.report_send_day === currentDay) {
          console.log(`📊 Processando relatório mensal para monitor ${config.monitor_id} (${config.report_email})...`)
          
          try {
            // Calcular mês anterior para o relatório
            let reportMonth = currentMonth - 1
            let reportYear = currentYear
            
            if (reportMonth === 0) {
              reportMonth = 12
              reportYear = currentYear - 1
            }
            
            console.log(`📆 Período do relatório: ${reportMonth}/${reportYear}`)
            
            // Verificar se já foi enviado este mês
            const history = await databaseService.getMonthlyReportHistory({
              monitor_id: config.monitor_id,
              year: reportYear,
              month: reportMonth
            })
            const alreadySent = history.some(h => 
              h.monitor_id === config.monitor_id &&
              h.email === config.report_email
            )
            
            if (alreadySent) {
              console.log(`⏭️ Relatório já enviado para monitor ${config.monitor_id} em ${reportMonth}/${reportYear}`)
              skippedCount++
              continue
            }
            
            // Enviar relatório
            const result = await reportService.sendMonthlyReport(
              config.monitor_id,
              config.report_email,
              reportYear,
              reportMonth,
              true // incluir PDF
            )
            
            if (result.success) {
              console.log(`✅ Relatório enviado com sucesso para ${config.report_email}`)
              sentCount++
            } else {
              console.error(`❌ Falha ao enviar relatório para ${config.report_email}: ${result.message}`)
              errorCount++
            }
            
          } catch (error) {
            console.error(`❌ Erro ao processar relatório para monitor ${config.monitor_id}:`, error)
            errorCount++
          }
        } else {
          console.log(`⏭️ Monitor ${config.monitor_id}: agendado para o dia ${config.report_send_day} (hoje é ${currentDay})`)
        }
      }
      
      console.log(`📊 Resumo da verificação: ${sentCount} enviados, ${errorCount} erros, ${skippedCount} já enviados, ${configs.length - sentCount - errorCount - skippedCount} não agendados para hoje`)
      
    } catch (error) {
      console.error('❌ Erro ao verificar relatórios mensais:', error)
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
        this.jobs.get(jobId)?.destroy()
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
      job.destroy()
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
   * Para todos os jobs e limpa o serviço
   */
  shutdown(): void {
    console.log('📅 Parando serviço de agendamento...')
    
    for (const [jobId, job] of this.jobs) {
      job.destroy()
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
    await this.checkAndSendMonthlyReports()
  }

  /**
   * Força a execução da verificação de relatórios mensais
   */
  async forceCheckMonthlyReports(): Promise<void> {
    console.log('🔄 Forçando verificação manual de relatórios mensais...')
    const startTime = Date.now()
    
    try {
      await this.checkAndSendMonthlyReports()
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