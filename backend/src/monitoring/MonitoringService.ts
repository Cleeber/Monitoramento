import { CheckHistory } from './CheckHistory.js'
import axios from 'axios'
import * as ping from 'ping'
import * as cron from 'node-cron'
import { EventEmitter } from 'events'
import * as net from 'net'
import * as http from 'http'
import * as https from 'https'
import { exec } from 'child_process'
import { promisify } from 'util'
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
}

interface ContentValidationConfig {
  minContentLength: number
  minTextLength: number
  enabled: boolean
}

class MonitoringService extends EventEmitter {
  private monitors: Map<string, Monitor> = new Map()
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
    this.consecutiveFailures.delete(monitorId)

    // Remover checks antigos
    this.history.remove(monitorId)
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
    return this.history.recent(monitorId, limit)
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
    const asOf = new Date()
    const ids = Array.from(this.monitors.keys())
    for (let offset = 0; offset < ids.length; offset += 32) {
      const rows = await databaseService.getMonitoringBootstrap(ids.slice(offset, offset + 32), asOf)
      for (const row of rows) {
        this.history.seed(row.monitor_id, row.samples, row.latest_checks, asOf.getTime())
        const monitor = this.monitors.get(row.monitor_id)
        if (!monitor) continue
        const latest = this.history.recent(row.monitor_id, 1)[0]
        const fresh = latest && Date.parse(latest.checked_at) >= asOf.getTime() - 86400000
        monitor.status = fresh ? latest.status : 'unknown'
        monitor.last_check = fresh ? latest.checked_at : null
        monitor.response_time = fresh ? latest.response_time : null
        monitor.uptime_24h = this.history.uptime(row.monitor_id, 24, asOf.getTime())
        monitor.uptime_7d = this.history.uptime(row.monitor_id, 168, asOf.getTime())
        monitor.uptime_30d = this.history.uptime(row.monitor_id, 720, asOf.getTime())
      }
    }
    console.log(`📊 Histórico compacto: ${this.history.sampleCount} amostras, ${this.history.fullRecordCount} registros completos`)
  }

  // Calcular estatísticas de uptime
  calculateUptime(monitorId: string, hours: number): number {
    return this.history.uptime(monitorId, hours)
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
        case 'http': {
          const result = await this.checkHttpFromConfig(monitor)
          status = result.status
          responseTime = result.responseTime
          errorMessage = result.error
          statusCode = result.statusCode ?? null
          break
        }

        case 'ping': {
          const pingResult = await this.checkPing(monitor.url, monitor.timeout)
          status = pingResult.status
          responseTime = pingResult.responseTime
          errorMessage = pingResult.error
          break
        }

        case 'tcp': {
          // Implementação básica para TCP (pode ser expandida)
          const tcpResult = await this.checkTcp(monitor.url, monitor.timeout)
          status = tcpResult.status
          responseTime = tcpResult.responseTime
          errorMessage = tcpResult.error
          break
        }
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

    this.history.record(check)

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

    // Atualizar dados do monitor com lógica anti-oscilação:
    // - Falha 1: marca como "warning" (suspeita, não offline ainda)
    // - Falha 2: continua "warning"
    // - Falha 3 (ou mais) consecutivas: marca como "offline"
    // - Sucesso: reset do contador e volta para "online"
    const updatedMonitor = this.monitors.get(monitor.id)
    if (updatedMonitor) {
      const previousFailures = this.consecutiveFailures.get(monitor.id) || 0

      if (status === 'online') {
        // Reset contador e marca online
        this.consecutiveFailures.set(monitor.id, 0)
        updatedMonitor.status = 'online'
      } else {
        // Falha — incrementa contador
        const newFailures = previousFailures + 1
        this.consecutiveFailures.set(monitor.id, newFailures)

        if (newFailures >= this.FAILURE_THRESHOLD) {
          // 3+ falhas consecutivas: realmente offline
          updatedMonitor.status = 'offline'
        } else if (newFailures >= 1) {
          // 1-2 falhas: warning (suspeita, ainda não offline)
          updatedMonitor.status = 'warning'
        }
      }

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

  // Nova versão: usa configuração específica do monitor
  private async checkHttpFromConfig(monitor: Pick<Monitor, 'url' | 'timeout' | 'ignore_http_403' | 'ignore_ssl_errors' | 'content_validation_enabled' | 'min_content_length' | 'min_text_length'>): Promise<{
    status: 'online' | 'offline' | 'warning'
    responseTime: number | null
    error: string | null
    statusCode?: number
  }> {
    const startTime = Date.now()
    // Derivar origem para uso como Referer quando possível
    let refererOrigin: string | undefined
    try {
      const u = new URL(monitor.url)
      refererOrigin = u.origin
    } catch {
      refererOrigin = undefined
    }

    try {
      // 1) Primeiro tenta HEAD com headers mínimos para evitar bloqueios/WAF
      let headStatusCode: number | null = null
      let headResponseTime: number | null = null
      let headOk = false
      try {
        const headStart = Date.now()
        const headResp = await this.requestWithFallback('head', monitor.url, {
          timeout: monitor.timeout,
          validateStatus: (status: number) => status < 500,
          headers: {
            'User-Agent': process.env.MONITOR_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'identity',
            'Connection': 'close',
            ...(refererOrigin ? { 'Origin': refererOrigin } : {}),
            ...(refererOrigin ? { 'Referer': refererOrigin } : {})
          }
        }, monitor)
        headResponseTime = Date.now() - headStart
        headStatusCode = headResp.status
        headOk = true
      } catch (headErr: any) {
        // Se HEAD não é permitido (405/501) ou falhou por reset/timeout, vamos tentar GET
        headOk = false
      }

      // Determinar configuração efetiva de validação
      const validationEnabled = (monitor.content_validation_enabled ?? this.contentValidation.enabled) === true
      const minContentLength = monitor.min_content_length ?? this.contentValidation.minContentLength
      const minTextLength = monitor.min_text_length ?? this.contentValidation.minTextLength

      // Se HEAD funcionou e não precisamos validar conteúdo, decidir pelo HEAD
      if (headOk && !validationEnabled && headStatusCode != null) {
        const statusCode = headStatusCode
        const responseTime = headResponseTime
        if (statusCode >= 200 && statusCode < 400) {
          return { status: 'online', responseTime, error: null, statusCode }
        } else if (statusCode >= 400 && statusCode < 500) {
          // 403 Forbidden no HEAD: Servidor está online e respondendo
          if (statusCode === 403) {
            return { status: 'online', responseTime, error: null, statusCode }
          }
          return { status: 'warning', responseTime, error: `HTTP ${statusCode}`, statusCode }
        } else {
          return { status: 'offline', responseTime, error: `HTTP ${statusCode}`, statusCode }
        }
      }

      // 2) Fallback (ou necessidade de validação): realizar GET completo
      const response = await this.requestWithFallback('get', monitor.url, {
        timeout: monitor.timeout,
        validateStatus: (status: number) => status < 500, // 4xx é warning, 5xx é offline
        headers: {
          // Ajuste de headers para reduzir bloqueios por WAF/CDN e parecer um navegador real
          'User-Agent': process.env.MONITOR_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          // Cabeçalhos hints de navegador modernos (Chrome) para aumentar a compatibilidade
          'sec-ch-ua': '"Chromium";v="122", "Not=A?Brand";v="24", "Google Chrome";v="122"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          ...(refererOrigin ? { 'Origin': refererOrigin } : {}),
          ...(refererOrigin ? { 'Referer': refererOrigin } : {})
        }
      }, monitor)

      const responseTime = Date.now() - startTime
      const statusCode = response.status

      if (statusCode >= 200 && statusCode < 400) {
        // Verificar conteúdo apenas se a validação estiver habilitada
        if (validationEnabled) {
          const content = response.data || ''
          const contentLength = typeof content === 'string' ? content.length : JSON.stringify(content).length

          // Considerar página vazia ou com menos caracteres que o mínimo como warning
          if (contentLength < minContentLength) {
            return {
              status: 'warning',
              responseTime,
              error: `Página com conteúdo insuficiente (${contentLength} caracteres, mínimo: ${minContentLength})`,
              statusCode
            }
          }

          // Verificar se é apenas HTML vazio ou com tags básicas
          if (typeof content === 'string') {
            const cleanContent = content
              .replace(/<[^>]*>/g, '') // Remove tags HTML
              .replace(/\s+/g, ' ')    // Normaliza espaços
              .trim()

            if (cleanContent.length < minTextLength) {
              return {
                status: 'warning',
                responseTime,
                error: `Página com conteúdo textual insuficiente (${cleanContent.length} caracteres de texto, mínimo: ${minTextLength})`,
                statusCode
              }
            }
          }
        }

        return { status: 'online', responseTime, error: null, statusCode }
      } else if (statusCode >= 400 && statusCode < 500) {
        // 403 Forbidden: Servidor está online e respondendo, apenas bloqueando o acesso (WAF, ACL, etc)
        // Consideramos ONLINE para fins de monitoramento de disponibilidade, pois o site existe e responde.
        if (statusCode === 403) {
          return { status: 'online', responseTime, error: null, statusCode }
        }

        return {
          status: 'warning',
          responseTime,
          error: `HTTP ${statusCode}: ${response.statusText}`,
          statusCode
        }
      } else {
        // Para 5xx, validar via ping antes de classificar como offline
        const pingResult = await this.checkPing(monitor.url, monitor.timeout)
        if (pingResult.status === 'online') {
          return {
            status: 'online',
            responseTime: pingResult.responseTime,
            error: `HTTP ${statusCode}: ${response.statusText}`,
            statusCode
          }
        }
        return {
          status: 'offline',
          responseTime,
          error: `HTTP ${statusCode}: ${response.statusText}`,
          statusCode
        }
      }
    } catch (error) {
      // 3) Se GET falhar por ECONNRESET, tentar uma última HEAD para decidir status
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          // Timeout: verificar se o host responde ao ping para classificar como aviso
          const pingResult = await this.checkPing(monitor.url, monitor.timeout)
          if (pingResult.status === 'online') {
            return { status: 'online', responseTime: pingResult.responseTime, error: 'Timeout' }
          }
          return { status: 'offline', responseTime: null, error: 'Timeout' }
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          // Falha de resolução/recusa de conexão: verificar ping
          const pingResult = await this.checkPing(monitor.url, monitor.timeout)
          if (pingResult.status === 'online') {
            return { status: 'online', responseTime: pingResult.responseTime, error: 'Conexão recusada' }
          }
          return { status: 'offline', responseTime: null, error: 'Conexão recusada' }
        } else if (error.code === 'ECONNRESET') {
          try {
            const headStart = Date.now()
            const headResp = await axios.head(monitor.url, {
              timeout: monitor.timeout,
              validateStatus: (status) => status < 500,
              headers: {
                'User-Agent': process.env.MONITOR_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'identity',
                'Connection': 'close',
                ...(refererOrigin ? { 'Origin': refererOrigin } : {}),
                ...(refererOrigin ? { 'Referer': refererOrigin } : {})
              }
            })
            const responseTime = Date.now() - headStart
            const statusCode = headResp.status
            // 403 no fallback HEAD também é considerado Online
            if (statusCode === 403) {
               return { status: 'online', responseTime, error: null, statusCode }
            }

            if (statusCode >= 200 && statusCode < 400) {
              return { status: 'online', responseTime, error: null, statusCode }
            } else if (statusCode >= 400 && statusCode < 500) {
              return { status: 'warning', responseTime, error: `HTTP ${statusCode}`, statusCode }
            }
            // 5xx em fallback HEAD: validar via ping
            const pingResult = await this.checkPing(monitor.url, monitor.timeout)
            if (pingResult.status === 'online') {
              return { status: 'online', responseTime: pingResult.responseTime, error: `HTTP ${statusCode}`, statusCode }
            }
            return { status: 'offline', responseTime, error: `HTTP ${statusCode}`, statusCode }
          } catch (fallbackErr) {
            // Mesmo fallback falhou: verificar ping para distinguir bloqueio de WAF/CDN
            const pingResult = await this.checkPing(monitor.url, monitor.timeout)
            if (pingResult.status === 'online') {
              return { status: 'online', responseTime: pingResult.responseTime, error: 'read ECONNRESET' }
            }
            return { status: 'offline', responseTime: null, error: 'read ECONNRESET' }
          }
        }
        const statusCode = error.response?.status
        if (statusCode) {
          // Erros 5xx lançados: checar ping antes de marcar como offline
          const pingResult = await this.checkPing(monitor.url, monitor.timeout)
          if (pingResult.status === 'online') {
            return { status: 'online', responseTime: pingResult.responseTime, error: `HTTP ${statusCode}: ${error.response?.statusText || 'Erro'}`, statusCode }
          }
          return { status: 'offline', responseTime: null, error: `HTTP ${statusCode}: ${error.response?.statusText || 'Erro'}`, statusCode }
        }
      }

      // Erro não classificado: checar ping para decidir
      const pingResult = await this.checkPing(monitor.url, monitor.timeout)
      if (pingResult.status === 'online') {
        return { status: 'online', responseTime: pingResult.responseTime, error: error instanceof Error ? error.message : 'Erro desconhecido' }
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
    this.history.pruneAll()
  }
private history = new CheckHistory()

}

export default MonitoringService
export type { MonitorCheck, Monitor }
