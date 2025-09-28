import axios from 'axios'
import * as ping from 'ping'
import * as cron from 'node-cron'
import { EventEmitter } from 'events'

interface MonitorCheck {
  id: string
  monitor_id: string
  status: 'online' | 'offline' | 'warning'
  response_time: number | null
  error_message: string | null
  checked_at: string
}

interface Monitor {
  id: string
  name: string
  url: string
  type: 'http' | 'ping' | 'tcp'
  interval: number
  timeout: number
  is_active: boolean
  status: 'online' | 'offline' | 'warning' | 'unknown'
  last_check: string | null
  response_time: number | null
  uptime_24h: number
  uptime_7d: number
  uptime_30d: number
  group_id?: string | null
  group_name?: string
  // Campo opcional para URL da logo do monitor (alteração pontual para suportar exibição de logo na Página de Status)
  logo_url?: string | null
}

interface ContentValidationConfig {
  minContentLength: number
  minTextLength: number
  enabled: boolean
}

class MonitoringService extends EventEmitter {
  private monitors: Map<string, Monitor> = new Map()
  private checks: MonitorCheck[] = []
  private intervals: Map<string, NodeJS.Timeout> = new Map()
  private isRunning = false
  private databaseService: any = null
  private contentValidation: ContentValidationConfig = {
    minContentLength: 100,
    minTextLength: 50,
    enabled: true
  }

  constructor() {
    super()
    this.setupCleanupJob()
  }

  // Definir referência ao database service
  setDatabaseService(databaseService: any) {
    this.databaseService = databaseService
  }

  // Configurar validação de conteúdo
  setContentValidation(config: Partial<ContentValidationConfig>) {
    this.contentValidation = { ...this.contentValidation, ...config }
  }

  // Obter configuração atual de validação de conteúdo
  getContentValidation(): ContentValidationConfig {
    return { ...this.contentValidation }
  }

  // Iniciar o serviço de monitoramento
  start() {
    if (this.isRunning) return
    this.isRunning = true
    console.log('🔍 Serviço de monitoramento iniciado')
    
    // Iniciar monitoramento para todos os monitores ativos
    this.monitors.forEach(monitor => {
      if (monitor.is_active) {
        this.startMonitoring(monitor)
      }
    })
  }

  // Parar o serviço de monitoramento
  stop() {
    if (!this.isRunning) return
    this.isRunning = false
    
    // Parar todos os intervalos
    this.intervals.forEach(interval => clearInterval(interval))
    this.intervals.clear()
    
    console.log('⏹️ Serviço de monitoramento parado')
  }

  // Adicionar um monitor
  addMonitor(monitor: Monitor) {
    this.monitors.set(monitor.id, monitor)
    
    if (this.isRunning && monitor.is_active) {
      this.startMonitoring(monitor)
    }
  }

  // Remover um monitor
  removeMonitor(monitorId: string) {
    this.stopMonitoring(monitorId)
    this.monitors.delete(monitorId)
    
    // Remover checks antigos
    this.checks = this.checks.filter(check => check.monitor_id !== monitorId)
  }

  // Atualizar um monitor
  updateMonitor(monitor: Monitor) {
    const oldMonitor = this.monitors.get(monitor.id)
    this.monitors.set(monitor.id, monitor)
    
    // Se o intervalo mudou ou o monitor foi ativado/desativado, reiniciar
    if (oldMonitor && (
      oldMonitor.interval !== monitor.interval ||
      oldMonitor.is_active !== monitor.is_active ||
      oldMonitor.url !== monitor.url ||
      oldMonitor.type !== monitor.type
    )) {
      this.stopMonitoring(monitor.id)
      if (this.isRunning && monitor.is_active) {
        this.startMonitoring(monitor)
      }
    }
  }

  // Obter todos os monitores
  getMonitors(): Monitor[] {
    return Array.from(this.monitors.values())
  }

  // Obter um monitor específico
  getMonitor(id: string): Monitor | undefined {
    return this.monitors.get(id)
  }

  // Obter checks de um monitor
  getMonitorChecks(monitorId: string, limit = 100): MonitorCheck[] {
    return this.checks
      .filter(check => check.monitor_id === monitorId)
      .sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime())
      .slice(0, limit)
  }

  // Carregar verificações recentes do banco de dados
  async loadRecentChecks(databaseService: any) {
    try {
      const monitors = Array.from(this.monitors.keys())
      
      for (const monitorId of monitors) {
        // Carregar verificações das últimas 24 horas para cada monitor
        const checks = await databaseService.getMonitorChecks(monitorId, 200)
        
        // Converter para o formato interno e adicionar ao array
        const recentChecks = checks.map((check: any) => ({
          id: check.id,
          monitor_id: check.monitor_id,
          status: check.status,
          response_time: check.response_time,
          error_message: check.error_message,
          checked_at: check.checked_at
        }))
        
        this.checks.push(...recentChecks)
        
        // Atualizar o status do monitor com base na verificação mais recente
        if (recentChecks.length > 0) {
          const latestCheck = recentChecks.sort((a: MonitorCheck, b: MonitorCheck) => 
            new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime()
          )[0];
          
          const monitor = this.monitors.get(monitorId);
          if (monitor) {
            monitor.status = latestCheck.status;
            monitor.last_check = latestCheck.checked_at;
            monitor.response_time = latestCheck.response_time;
            this.monitors.set(monitorId, monitor);
          }
        }
      }
      
      // Recalcular uptime para todos os monitores
      this.monitors.forEach((monitor, id) => {
        monitor.uptime_24h = this.calculateUptime(id, 24)
        monitor.uptime_7d = this.calculateUptime(id, 24 * 7)
        monitor.uptime_30d = this.calculateUptime(id, 24 * 30)
        this.monitors.set(id, monitor)
      })
      
      console.log(`📊 Carregadas ${this.checks.length} verificações do banco de dados`)
    } catch (error) {
      console.error('❌ Erro ao carregar verificações do banco de dados:', error)
    }
  }

  // Calcular estatísticas de uptime
  calculateUptime(monitorId: string, hours: number): number {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000)
    const recentChecks = this.checks.filter(check => 
      check.monitor_id === monitorId && 
      new Date(check.checked_at) >= cutoffTime
    )
    
    if (recentChecks.length === 0) return 0
    
    const successfulChecks = recentChecks.filter(check => check.status === 'online').length
    return (successfulChecks / recentChecks.length) * 100
  }

  // Iniciar monitoramento de um monitor específico
  private startMonitoring(monitor: Monitor) {
    if (this.intervals.has(monitor.id)) {
      this.stopMonitoring(monitor.id)
    }

    console.log(`🔍 Iniciando monitoramento: ${monitor.name} (${monitor.url})`)
    
    // Fazer primeira verificação imediatamente
    this.performCheck(monitor)
    
    // Configurar verificações periódicas
    const interval = setInterval(() => {
      this.performCheck(monitor)
    }, monitor.interval)
    
    this.intervals.set(monitor.id, interval)
  }

  // Parar monitoramento de um monitor específico
  private stopMonitoring(monitorId: string) {
    const interval = this.intervals.get(monitorId)
    if (interval) {
      clearInterval(interval)
      this.intervals.delete(monitorId)
      console.log(`⏹️ Monitoramento parado para monitor: ${monitorId}`)
    }
  }

  // Realizar verificação de um monitor
  private async performCheck(monitor: Monitor) {
    let status: 'online' | 'offline' | 'warning' = 'offline'
    let responseTime: number | null = null
    let errorMessage: string | null = null

    try {
      switch (monitor.type) {
        case 'http':
          const result = await this.checkHttp(monitor.url, monitor.timeout)
          status = result.status
          responseTime = result.responseTime
          errorMessage = result.error
          break
          
        case 'ping':
          const pingResult = await this.checkPing(monitor.url, monitor.timeout)
          status = pingResult.status
          responseTime = pingResult.responseTime
          errorMessage = pingResult.error
          break
          
        case 'tcp':
          // Implementação básica para TCP (pode ser expandida)
          const tcpResult = await this.checkTcp(monitor.url, monitor.timeout)
          status = tcpResult.status
          responseTime = tcpResult.responseTime
          errorMessage = tcpResult.error
          break
      }
    } catch (error) {
      status = 'offline'
      errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    }

    // Criar registro de verificação
    const check: MonitorCheck = {
      id: `check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      monitor_id: monitor.id,
      status,
      response_time: responseTime,
      error_message: errorMessage,
      checked_at: new Date().toISOString()
    }

    this.checks.push(check)

    // Salvar verificação no banco de dados
    if (this.databaseService) {
      try {
        await this.databaseService.createMonitorCheck({
          monitor_id: monitor.id,
          status,
          response_time: responseTime,
          error_message: errorMessage
        })
      } catch (error) {
        console.error('❌ Erro ao salvar verificação no banco de dados:', error)
      }
    }

    // Atualizar dados do monitor
    const updatedMonitor = this.monitors.get(monitor.id)
    if (updatedMonitor) {
      updatedMonitor.status = status
      updatedMonitor.last_check = check.checked_at
      updatedMonitor.response_time = responseTime
      updatedMonitor.uptime_24h = this.calculateUptime(monitor.id, 24)
      updatedMonitor.uptime_7d = this.calculateUptime(monitor.id, 24 * 7)
      updatedMonitor.uptime_30d = this.calculateUptime(monitor.id, 24 * 30)
      
      this.monitors.set(monitor.id, updatedMonitor)
    }

    // Emitir evento de verificação
    this.emit('check', { monitor, check })

    // Log da verificação
    const statusEmoji = status === 'online' ? '✅' : status === 'warning' ? '⚠️' : '❌'
    console.log(`${statusEmoji} ${monitor.name}: ${status} (${responseTime}ms)`)
  }

  // Verificação HTTP
  private async checkHttp(url: string, timeout: number): Promise<{
    status: 'online' | 'offline' | 'warning'
    responseTime: number | null
    error: string | null
  }> {
    const startTime = Date.now()
    
    try {
      const response = await axios.get(url, {
        timeout,
        validateStatus: (status) => status < 500, // 4xx é warning, 5xx é offline
        headers: {
          'User-Agent': 'Uptime-Monitor/1.0'
        }
      })
      
      const responseTime = Date.now() - startTime
      
      if (response.status >= 200 && response.status < 400) {
        // Verificar conteúdo apenas se a validação estiver habilitada
        if (this.contentValidation.enabled) {
          const content = response.data || ''
          const contentLength = typeof content === 'string' ? content.length : JSON.stringify(content).length
          
          // Considerar página vazia ou com menos caracteres que o mínimo como warning
          if (contentLength < this.contentValidation.minContentLength) {
            return { 
              status: 'warning', 
              responseTime, 
              error: `Página com conteúdo insuficiente (${contentLength} caracteres, mínimo: ${this.contentValidation.minContentLength})` 
            }
          }
          
          // Verificar se é apenas HTML vazio ou com tags básicas
          if (typeof content === 'string') {
            const cleanContent = content
              .replace(/<[^>]*>/g, '') // Remove tags HTML
              .replace(/\s+/g, ' ')    // Normaliza espaços
              .trim()
            
            if (cleanContent.length < this.contentValidation.minTextLength) {
              return { 
                status: 'warning', 
                responseTime, 
                error: `Página com conteúdo textual insuficiente (${cleanContent.length} caracteres de texto, mínimo: ${this.contentValidation.minTextLength})` 
              }
            }
          }
        }
        
        return { status: 'online', responseTime, error: null }
      } else if (response.status >= 400 && response.status < 500) {
        return { 
          status: 'warning', 
          responseTime, 
          error: `HTTP ${response.status}: ${response.statusText}` 
        }
      } else {
        return { 
          status: 'offline', 
          responseTime, 
          error: `HTTP ${response.status}: ${response.statusText}` 
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          return { status: 'offline', responseTime: null, error: 'Timeout' }
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          return { status: 'offline', responseTime: null, error: 'Conexão recusada' }
        }
      }
      
      return { 
        status: 'offline', 
        responseTime: null, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }
    }
  }

  // Verificação Ping
  private async checkPing(host: string, timeout: number): Promise<{
    status: 'online' | 'offline' | 'warning'
    responseTime: number | null
    error: string | null
  }> {
    try {
      // Extrair hostname da URL se necessário
      const hostname = host.replace(/^https?:\/\//, '').split('/')[0]
      
      const result = await ping.promise.probe(hostname, {
        timeout: timeout / 1000, // ping usa segundos
        min_reply: 1
      })
      
      if (result.alive) {
        const responseTime = parseFloat(result.time as string) || null
        return { status: 'online', responseTime, error: null }
      } else {
        return { status: 'offline', responseTime: null, error: 'Host não responde ao ping' }
      }
    } catch (error) {
      return { 
        status: 'offline', 
        responseTime: null, 
        error: error instanceof Error ? error.message : 'Erro no ping' 
      }
    }
  }

  // Verificação TCP (implementação básica)
  private async checkTcp(url: string, timeout: number): Promise<{
    status: 'online' | 'offline' | 'warning'
    responseTime: number | null
    error: string | null
  }> {
    // Para TCP, vamos usar uma verificação HTTP simples por enquanto
    // Em uma implementação completa, seria necessário usar net.Socket
    return this.checkHttp(url, timeout)
  }

  // Job de limpeza para remover checks antigos
  private setupCleanupJob() {
    // Executar limpeza diariamente às 2:00
    cron.schedule('0 2 * * *', () => {
      this.cleanupOldChecks()
    })
  }

  // Limpar checks antigos (manter apenas 30 dias)
  private cleanupOldChecks() {
    const cutoffTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 dias
    const initialCount = this.checks.length
    
    this.checks = this.checks.filter(check => 
      new Date(check.checked_at) >= cutoffTime
    )
    
    const removedCount = initialCount - this.checks.length
    if (removedCount > 0) {
      console.log(`🧹 Limpeza concluída: ${removedCount} checks antigos removidos`)
    }
  }
}

export default MonitoringService
export type { MonitorCheck, Monitor }