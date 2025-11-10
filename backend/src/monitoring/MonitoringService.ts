import axios from 'axios'
import * as ping from 'ping'
import * as cron from 'node-cron'
import { EventEmitter } from 'events'
import * as net from 'net'
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
        const recentChecks = checks.map((check: any) => ({
          id: check.id,
          monitor_id: check.monitor_id,
          status: check.status,
          response_time: check.response_time,
          error_message: check.error_message,
          status_code: check.status_code ?? null,
          checked_at: check.checked_at
        }))
        
        this.checks.push(...recentChecks)
        
        // Ajuste: usar a última verificação dentro de 24h; fallback para 'unknown'
        if (recentChecks.length > 0) {
          const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
          const latestIn24h = recentChecks
            .filter(c => new Date(c.checked_at) >= cutoff24h)
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
          statusCode = (result as any).statusCode ?? null
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
          response_time: responseTime,
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

  // Nova versão: usa configuração específica do monitor
  private async checkHttpFromConfig(monitor: Pick<Monitor, 'url' | 'timeout' | 'ignore_http_403' | 'content_validation_enabled' | 'min_content_length' | 'min_text_length'>): Promise<{
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
      const ignore403 = monitor.ignore_http_403 === true

      // Se HEAD funcionou e não precisamos validar conteúdo, decidir pelo HEAD
      if (headOk && !validationEnabled && headStatusCode != null) {
        const statusCode = headStatusCode
        const responseTime = headResponseTime
        if (statusCode >= 200 && statusCode < 400) {
          return { status: 'online', responseTime, error: null, statusCode }
        } else if (statusCode >= 400 && statusCode < 500) {
          if (statusCode === 403 && ignore403) {
            return { status: 'online', responseTime, error: null, statusCode }
          }
          return { status: 'warning', responseTime, error: `HTTP ${statusCode}`, statusCode }
        } else {
          return { status: 'offline', responseTime, error: `HTTP ${statusCode}`, statusCode }
        }
      }

      // 2) Fallback (ou necessidade de validação): realizar GET completo
      const response = await axios.get(monitor.url, {
        timeout: monitor.timeout,
        validateStatus: (status) => status < 500, // 4xx é warning, 5xx é offline
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
      })
      
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
        // Se for 403 e a flag estiver ativada, considerar como online
        if (statusCode === 403 && ignore403) {
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
            const ignore403 = monitor.ignore_http_403 === true
            if (statusCode >= 200 && statusCode < 400) {
              return { status: 'online', responseTime, error: null, statusCode }
            } else if (statusCode >= 400 && statusCode < 500) {
              if (statusCode === 403 && ignore403) {
                return { status: 'online', responseTime, error: null, statusCode }
              }
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