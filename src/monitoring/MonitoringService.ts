import axios from 'axios'
import * as ping from 'ping'
import * as cron from 'node-cron'
import { EventEmitter } from 'events'
import * as net from 'net'
import * as http from 'http'
import * as https from 'https'
import { exec } from 'child_process'
import { promisify } from 'util'
import type { CheckContext, Verdict } from './validators/types.js'
import { runAllValidators } from './validators/index.js'

const execAsync = promisify(exec)

interface MonitorCheck {
  id: string
  monitor_id: string
  status: 'online' | 'offline' | 'warning'
  response_time: number | null
  error_message: string | null
  status_code?: number | null
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
  // Flags específicas por monitor (opcionais)
  ignore_http_403?: boolean
  ignore_ssl_errors?: boolean
  content_validation_enabled?: boolean
  min_content_length?: number
  min_text_length?: number
  // Novos campos de validação
  expected_status_codes?: number[]
  expected_keywords?: string[]
  forbidden_keywords?: string[]
  api_health_enabled?: boolean
  api_health_path?: string
  api_health_expected_status?: number
  api_health_expected_body?: string
  check_ssl?: boolean
  content_pattern_ok?: string
  content_pattern_fail?: string
  require_css?: boolean
  require_js?: boolean
  require_html?: boolean
  response_time_warning_ms?: number
  response_time_critical_ms?: number
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

  // Executar verificação manual de um monitor e retornar o último check
  async triggerCheck(monitorId: string): Promise<MonitorCheck | null> {
    const monitor = this.monitors.get(monitorId)
    if (!monitor) {
      throw new Error('Monitor não encontrado')
    }
    await this.performCheck(monitor)
    const latest = this.getMonitorChecks(monitorId, 1)
    return latest.length ? latest[0] : null
  }

  // Carregar verificações recentes do banco de dados
  async loadRecentChecks(databaseService: any) {
    try {
      const monitors = Array.from(this.monitors.keys())
      
      for (const monitorId of monitors) {
        // Carregar verificações das últimas 24 horas para cada monitor
        const checks = await databaseService.getMonitorChecks(monitorId, 500000)
        
        // Converter para o formato interno e adicionar ao array
        const recentChecks: MonitorCheck[] = (checks.map((check: any) => ({
          id: check.id,
          monitor_id: check.monitor_id,
          status: check.status,
          response_time: check.response_time,
          error_message: check.error_message,
          status_code: check.status_code ?? null,
          checked_at: check.checked_at
        })) as MonitorCheck[])
        
        this.checks.push(...recentChecks)
        
        // Ajuste: usar a última verificação dentro de 24h; fallback para 'unknown'
        if (recentChecks.length > 0) {
          const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
          const latestIn24h = recentChecks
            .filter((c: MonitorCheck) => new Date(c.checked_at) >= cutoff24h)
            .sort((a: MonitorCheck, b: MonitorCheck) => 
              new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime()
            )[0];

          const monitor = this.monitors.get(monitorId);
          if (monitor) {
            if (latestIn24h) {
              monitor.status = latestIn24h.status;
              monitor.last_check = latestIn24h.checked_at;
              monitor.response_time = latestIn24h.response_time;
            } else {
              monitor.status = 'unknown';
              monitor.last_check = null;
              monitor.response_time = null;
            }
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

  // Obter estatísticas do monitoramento
  getStats() {
    const monitors = this.getMonitors()
    const total = monitors.length
    const active = monitors.filter(m => m.is_active).length
    const paused = total - active
    const online = monitors.filter(m => m.status === 'online').length
    const offline = monitors.filter(m => m.status === 'offline').length
    const warning = monitors.filter(m => m.status === 'warning').length
    
    return {
      total,
      active,
      paused,
      online,
      offline,
      warning,
      last_update: new Date().toISOString()
    }
  }

  // Iniciar monitoramento de um monitor específico
  public startMonitoring(monitor: Monitor) {
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
    // Ajuste intencional: iniciar como 'warning' para evitar falso 'offline' antes do resultado real
    let status: 'online' | 'offline' | 'warning' = 'warning'
    let responseTime: number | null = null
    let errorMessage: string | null = null
    let statusCode: number | null = null

    try {
      switch (monitor.type) {
        case 'http':
          const result = await this.checkHttpFromConfig(monitor)
          status = result.status
          responseTime = result.responseTime
          errorMessage = result.error
          statusCode = result.statusCode ?? null
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
      response_time: responseTime !== null ? Math.round(responseTime) : null,
      error_message: errorMessage,
      status_code: statusCode,
      checked_at: new Date().toISOString()
    }

    this.checks.push(check)

    // Salvar verificação no banco de dados
    if (this.databaseService) {
      try {
        await this.databaseService.createMonitorCheck({
          monitor_id: monitor.id,
          status,
          response_time: responseTime !== null ? Math.round(responseTime) : null,
          error_message: errorMessage,
          status_code: statusCode ?? undefined
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

    // Log da verificação (inclui status_code quando disponível)
    const statusEmoji = status === 'online' ? '✅' : status === 'warning' ? '⚠️' : '❌'
    const codeInfo = statusCode != null ? ` [${statusCode}]` : ''
    console.log(`${statusEmoji} ${monitor.name}: ${status} (${responseTime}ms)${codeInfo}`)
  }

  // Verificação HTTP
  private async checkHttp(url: string, timeout: number): Promise<{
    status: 'online' | 'offline' | 'warning'
    responseTime: number | null
    error: string | null
  }> {
    // Mantido para compatibilidade retro, mas não usado após ajuste
    return this.checkHttpFromConfig({ url, timeout })
  }

  // Helper para realizar requisição com fallback para IPv4
  private async requestWithFallback(
    method: 'head' | 'get', 
    url: string, 
    config: any, 
    monitor: Pick<Monitor, 'ignore_ssl_errors'>
  ): Promise<any> {
    // Agentes forçando IPv4
    const ipv4HttpsAgent = new https.Agent({ 
      keepAlive: true, 
      family: 4,
      rejectUnauthorized: !monitor.ignore_ssl_errors 
    })
    const ipv4HttpAgent = new http.Agent({ 
      keepAlive: true, 
      family: 4 
    })

    // Configuração para a tentativa padrão
    // Se precisarmos ignorar SSL, temos que passar um agente customizado.
    // Caso contrário, deixamos undefined para usar o globalAgent do Node/Axios, 
    // que provou ser mais robusto em alguns ambientes.
    let defaultHttpsAgent: https.Agent | undefined = undefined
    let defaultHttpAgent: http.Agent | undefined = undefined

    if (monitor.ignore_ssl_errors) {
      defaultHttpsAgent = new https.Agent({ 
        keepAlive: true, 
        rejectUnauthorized: false 
      })
      defaultHttpAgent = new http.Agent({ keepAlive: true })
    } else {
      // Opcional: Se quisermos keepAlive no default, teríamos que instanciar.
      // Mas como visto nos testes, instanciar um agente pode causar ECONNRESET em alguns casos (IPv4 local).
      // Então vamos confiar no default do Axios (sem keepAlive por padrão, ou usa globalAgent).
    }

    // Tentar primeiro com configuração padrão
    try {
      return await axios({
        method,
        url,
        ...config,
        httpAgent: defaultHttpAgent,
        httpsAgent: defaultHttpsAgent
      })
    } catch (error: any) {
      // Se o servidor respondeu (mesmo com erro 5xx), não precisamos tentar IPv4
      if (error.response) {
        throw error
      }
      
      // Se foi erro de rede (DNS, Timeout, Reset), tentar forçar IPv4
      try {
        return await axios({
          method,
          url,
          ...config,
          httpAgent: ipv4HttpAgent,
          httpsAgent: ipv4HttpsAgent
        })
      } catch (retryError) {
        throw retryError
      }
    }
  }

  // Nova versão: usa o sistema de validadores plugáveis
  private async checkHttpFromConfig(monitor: Pick<Monitor, 'url' | 'timeout' | 'ignore_http_403' | 'ignore_ssl_errors' | 'content_validation_enabled' | 'min_content_length' | 'min_text_length'>): Promise<{
    status: 'online' | 'offline' | 'warning'
    responseTime: number | null
    error: string | null
    statusCode?: number
  }> {
    const startTime = Date.now()

    // Derivar origem para headers
    let refererOrigin: string | undefined
    try {
      refererOrigin = new URL(monitor.url).origin
    } catch { /* ignora */ }

    let lastError: string | null = null
    let lastStatusCode: number | null = null
    let lastResponseTime: number | null = null
    let responseBody: string | null = null
    let responseHeaders: Record<string, string> = {}
    let isTimeout = false
    let isDnsFail = false
    let isConnectionRefused = false
    let isSslError = false

    try {
      // 1) Primeiro tenta HEAD
      try {
        const headStart = Date.now()
        const headResp = await this.requestWithFallback('head', monitor.url, {
          timeout: monitor.timeout,
          validateStatus: () => true,
          headers: {
            'User-Agent': process.env.MONITOR_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
            'Accept-Encoding': 'identity',
            'Connection': 'close',
            ...(refererOrigin ? { 'Origin': refererOrigin } : {}),
            ...(refererOrigin ? { 'Referer': refererOrigin } : {}),
          },
        }, monitor)
        lastResponseTime = Date.now() - headStart
        lastStatusCode = headResp.status
        responseHeaders = headResp.headers as Record<string, string>
      } catch (headErr: any) {
        this.parseError(headErr, { isTimeout, isDnsFail, isConnectionRefused, isSslError })
        lastError = headErr.message
      }

      // 2) Se HEAD retornou código < 500 e não precisamos de body, usa o resultado
      const validationEnabled = (monitor.content_validation_enabled ?? this.contentValidation.enabled) === true
      if (lastStatusCode !== null && lastStatusCode < 500 && !validationEnabled) {
        const outcome = await this.runValidation({
          url: monitor.url,
          statusCode: lastStatusCode,
          responseTime: lastResponseTime,
          responseHeaders,
          responseBody: null,
          error: lastError,
          isTimeout,
          isDnsFail,
          isConnectionRefused,
          isSslError,
          monitorId: monitor.url,
          monitorName: monitor.url,
          config: {
            expectedStatusCodes: undefined,
            expectedKeywords: undefined,
            forbiddenKeywords: undefined,
            apiHealthEnabled: false,
            checkSsl: false,
            requireCss: false,
            requireJs: false,
            requireHtml: false,
            responseTimeWarningMs: 5000,
            responseTimeCriticalMs: 30000,
            minContentLength: 1000,
            minTextLength: 100,
          },
        })
        return this.translateVerdict(outcome)
      }

      // 3) GET completo para validação de conteúdo
      const getStart = Date.now()
      try {
        const getResp = await this.requestWithFallback('get', monitor.url, {
          timeout: monitor.timeout,
          validateStatus: () => true,
          headers: {
            'User-Agent': process.env.MONITOR_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,*/*',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            ...(refererOrigin ? { 'Origin': refererOrigin } : {}),
            ...(refererOrigin ? { 'Referer': refererOrigin } : {}),
          },
        }, monitor)
        lastResponseTime = Date.now() - getStart
        lastStatusCode = getResp.status
        responseHeaders = getResp.headers as Record<string, string>
        responseBody = typeof getResp.data === 'string'
          ? getResp.data
          : JSON.stringify(getResp.data)
      } catch (getErr: any) {
        this.parseError(getErr, { isTimeout, isDnsFail, isConnectionRefused, isSslError })
        lastError = getErr.message
      }

      const outcome = await this.runValidation({
        url: monitor.url,
        statusCode: lastStatusCode,
        responseTime: lastResponseTime,
        responseHeaders,
        responseBody,
        error: lastError,
        isTimeout,
        isDnsFail,
        isConnectionRefused,
        isSslError,
        monitorId: monitor.url,
        monitorName: monitor.url,
        config: {
          expectedStatusCodes: undefined,
          expectedKeywords: undefined,
          forbiddenKeywords: undefined,
          apiHealthEnabled: false,
          checkSsl: false,
          requireCss: false,
          requireJs: false,
          requireHtml: false,
          responseTimeWarningMs: 5000,
          responseTimeCriticalMs: 30000,
          minContentLength: 1000,
          minTextLength: 100,
        },
      })
      return this.translateVerdict(outcome)

    } catch (error) {
      return {
        status: 'offline',
        responseTime: null,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }
    }
  }

  // Constrói o CheckContext a partir do monitor
  private buildCheckContext(monitor: Monitor, result: {
    statusCode: number | null
    responseTime: number | null
    responseBody: string | null
    responseHeaders: Record<string, string>
    error: string | null
    isTimeout: boolean
    isDnsFail: boolean
    isConnectionRefused: boolean
    isSslError: boolean
  }): CheckContext {
    return {
      url: monitor.url,
      statusCode: result.statusCode,
      responseTime: result.responseTime,
      responseHeaders: result.responseHeaders,
      responseBody: result.responseBody,
      error: result.error,
      isTimeout: result.isTimeout,
      isDnsFail: result.isDnsFail,
      isConnectionRefused: result.isConnectionRefused,
      isSslError: result.isSslError,
      monitorId: monitor.id,
      monitorName: monitor.name,
      config: {
        expectedStatusCodes: monitor.expected_status_codes,
        expectedKeywords: monitor.expected_keywords,
        forbiddenKeywords: monitor.forbidden_keywords,
        apiHealthEnabled: monitor.api_health_enabled,
        apiHealthPath: monitor.api_health_path,
        apiHealthExpectedStatus: monitor.api_health_expected_status,
        apiHealthExpectedBody: monitor.api_health_expected_body,
        checkSsl: monitor.check_ssl,
        contentPatternOk: monitor.content_pattern_ok,
        contentPatternFail: monitor.content_pattern_fail,
        requireCss: monitor.require_css,
        requireJs: monitor.require_js,
        requireHtml: monitor.require_html,
        responseTimeWarningMs: monitor.response_time_warning_ms,
        responseTimeCriticalMs: monitor.response_time_critical_ms,
        minContentLength: monitor.min_content_length,
        minTextLength: monitor.min_text_length,
      },
    }
  }

  // Executa todos os validadores
  private async runValidation(ctx: CheckContext) {
    return runAllValidators(ctx)
  }

  // Traduz Verdict dos validadores para o formato antigo do MonitoringService
  private translateVerdict(outcome: { verdict: Verdict; responseTime: number | null; error: string | null; statusCode: number | null }): {
    status: 'online' | 'offline' | 'warning'
    responseTime: number | null
    error: string | null
    statusCode?: number
  } {
    switch (outcome.verdict) {
      case 'online':
        return { status: 'online', responseTime: outcome.responseTime, error: null, statusCode: outcome.statusCode ?? undefined }
      case 'degraded':
        return { status: 'warning', responseTime: outcome.responseTime, error: outcome.error, statusCode: outcome.statusCode ?? undefined }
      case 'error':
      case 'offline':
        return { status: 'offline', responseTime: outcome.responseTime, error: outcome.error, statusCode: outcome.statusCode ?? undefined }
      default:
        return { status: 'offline', responseTime: outcome.responseTime, error: outcome.error, statusCode: outcome.statusCode ?? undefined }
    }
  }

  // Helper para classificar erros
  private parseError(err: any, flags: { isTimeout: boolean; isDnsFail: boolean; isConnectionRefused: boolean; isSslError: boolean }) {
    if (err.code === 'ECONNABORTED') flags.isTimeout = true
    if (err.code === 'ENOTFOUND') flags.isDnsFail = true
    if (err.code === 'ECONNREFUSED') flags.isConnectionRefused = true
    if (err.code === 'CERT_HAS_EXPIRED' || err.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || err.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
      flags.isSslError = true
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
      // Descobrir porta alvo para uma verificação TCP mínima caso ICMP esteja bloqueado
      let port = 443
      try {
        const u = new URL(host)
        port = u.protocol === 'http:' ? 80 : 443
      } catch {}

      // 1) Primeiro tenta o ping do sistema (busybox/iputils) via exec para evitar incompatibilidades da lib
      const timeoutSec = Math.max(1, Math.floor(timeout / 1000))
      const parseTimeMs = (output: string): number | null => {
        const m = output.match(/time[=|:](\s*?)(\d+(?:\.\d+)?)\s*ms/i)
        if (m && m[2]) return parseFloat(m[2])
        // Busybox também pode imprimir "round-trip min/avg/max"; usamos avg se disponível
        const m2 = output.match(/round-trip.*?=\s*(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)/i)
        if (m2 && m2[2]) return parseFloat(m2[2])
        return null
      }

      let sysPingOk = false
      let sysPingTime: number | null = null
      try {
        const { stdout } = await execAsync(`ping -4 -c 1 -W ${timeoutSec} ${hostname}`)
        sysPingOk = /packets received, 0% packet loss/i.test(stdout) || /1 packets received/i.test(stdout)
        sysPingTime = parseTimeMs(stdout)
      } catch {
        sysPingOk = false
      }
      if (!sysPingOk) {
        try {
          const { stdout } = await execAsync(`ping -6 -c 1 -W ${timeoutSec} ${hostname}`)
          sysPingOk = /packets received, 0% packet loss/i.test(stdout) || /1 packets received/i.test(stdout)
          sysPingTime = parseTimeMs(stdout)
        } catch {
          sysPingOk = false
        }
      }

      if (sysPingOk) {
        return { status: 'online', responseTime: sysPingTime, error: null }
      }

      // 2) Fallback adicional: tentar a lib ping (casos onde exec pode não estar acessível)
      try {
        let libResult = await ping.promise.probe(hostname, {
          timeout: timeoutSec,
          min_reply: 1,
          extra: ['-4']
        })
        if (!libResult.alive) {
          libResult = await ping.promise.probe(hostname, {
            timeout: timeoutSec,
            min_reply: 1,
            extra: ['-6']
          })
        }
        if (libResult.alive) {
          const responseTime = parseFloat(libResult.time as string) || null
          return { status: 'online', responseTime, error: null }
        }
      } catch {/* ignora erro da lib ping */}

      // 3) Fallback final: tentativa de conexão TCP simples ao host (porta 80/443)
      const tcpStart = Date.now()
      const tcpOk = await new Promise<boolean>((resolve) => {
        const socket = new net.Socket()
        let settled = false
        const done = (ok: boolean) => {
          if (settled) return
          settled = true
          try { socket.destroy() } catch {}
          resolve(ok)
        }
        socket.setTimeout(timeout)
        socket.once('error', () => done(false))
        socket.once('timeout', () => done(false))
        socket.connect({ host: hostname, port }, () => done(true))
      })

      if (tcpOk) {
        const responseTime = Date.now() - tcpStart
        return { status: 'online', responseTime, error: null }
      }

      // Nenhum método respondeu
      return { status: 'offline', responseTime: null, error: 'Host não responde a ICMP/TCP' }
    } catch (error) {
      return { 
        status: 'offline', 
        responseTime: null, 
        // Mantemos a mensagem, mas indicamos que tentativas ICMP/TCP foram realizadas
        error: error instanceof Error ? error.message : 'Erro em ping/TCP' 
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
    // Chamamos a versão compatível para manter o método checkHttp em uso
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