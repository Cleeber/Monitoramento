import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

// Carregar variáveis de ambiente PRIMEIRO
const envPath = path.join(process.cwd(), '.env')
console.log('DEBUG - Current working directory:', process.cwd())
console.log('DEBUG - Looking for .env at:', envPath)
console.log('DEBUG - .env file exists:', fs.existsSync(envPath))

dotenv.config({ path: envPath })

// Debug das variáveis de ambiente
console.log('DEBUG - SUPABASE_URL:', process.env.SUPABASE_URL)
console.log('DEBUG - SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET')

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import MonitoringService from './monitoring/MonitoringService.js'
import { databaseService } from './services/DatabaseService.js'
import { supabase } from './lib/supabase.js'
import { storageService } from './services/StorageService.js'
import { pdfService } from './services/PDFService.js'
import { reportService } from './services/ReportService.js'
import { schedulerService } from './services/SchedulerService.js'

// Estender o tipo Request do Express para incluir o usuário
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

const app = express()
const PORT = process.env.PORT || 8081
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

// Inicializar serviço de monitoramento
const monitoringService = new MonitoringService()

// Configurar trust proxy para funcionar corretamente com proxies reversos (nginx, docker, etc)
// Usar configuração mais específica para segurança
app.set('trust proxy', 1)

// Middlewares
app.use(helmet())
app.use(compression())
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001', 'http://localhost:3002', 'http://127.0.0.1:3002', 'http://85.31.62.181:3000', 'http://85.31.62.181:3001', 'http://monitor.pagina1digital.com.br', 'https://monitor.pagina1digital.com.br'],
  credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Rate limiting geral (mais permissivo)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // máximo 1000 requests por IP
  message: 'Muitas tentativas, tente novamente em 15 minutos'
})

// Rate limiting específico para login (mais restritivo)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 50, // máximo 50 tentativas de login por IP
  message: 'Muitas tentativas de login, tente novamente em 15 minutos'
})

// Aplicar rate limiting geral
app.use('/api/', generalLimiter)

// Configurar multer para upload de arquivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
})

// Inicializar serviços
async function initializeServices() {
  try {
    console.log('🔧 Inicializando serviços...')
    
    // Criar tabelas necessárias primeiro
    await createRequiredTables()
    
    // Configurar referência do database service no monitoramento
    monitoringService.setDatabaseService(databaseService)
    
    // Configurar MonitoringService no ReportService
    reportService.setMonitoringService(monitoringService)
    
    // Inicializar agendamento de relatórios
    await schedulerService.initialize()
    
    console.log('✅ Todos os serviços inicializados com sucesso')
  } catch (error) {
    console.error('❌ Erro ao inicializar serviços:', error)
    process.exit(1)
  }
}

// Função para criar tabelas necessárias se não existirem
async function createRequiredTables() {
  try {
    console.log('🔧 Verificando e criando tabelas necessárias...')
    
    // Verificar se as tabelas existem
    const { data: tables, error: checkError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['monthly_report_configs', 'monthly_report_history'])
    
    if (checkError) {
      console.log('⚠️ Não foi possível verificar tabelas, tentando criar...')
    }
    
    const existingTables = tables?.map((t: any) => t.table_name) || []
    
    // Criar monthly_report_configs se não existir
    if (!existingTables.includes('monthly_report_configs')) {
      console.log('📋 Criando tabela monthly_report_configs...')
      const { error: configError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS public.monthly_report_configs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            monitor_id UUID NOT NULL REFERENCES public.monitors(id) ON DELETE CASCADE,
            email VARCHAR(255) NOT NULL,
            send_day INTEGER NOT NULL CHECK (send_day >= 1 AND send_day <= 31),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE INDEX IF NOT EXISTS idx_monthly_report_configs_monitor_id ON public.monthly_report_configs(monitor_id);
          CREATE INDEX IF NOT EXISTS idx_monthly_report_configs_active ON public.monthly_report_configs(is_active);
        `
      })
      
      if (configError) {
        console.log('⚠️ Tabela monthly_report_configs pode já existir ou houve erro:', configError.message)
      } else {
        console.log('✅ Tabela monthly_report_configs criada com sucesso!')
      }
    }
    
    // Criar monthly_report_history se não existir
    if (!existingTables.includes('monthly_report_history')) {
      console.log('📋 Criando tabela monthly_report_history...')
      const { error: historyError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS public.monthly_report_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            monitor_id UUID NOT NULL REFERENCES public.monitors(id) ON DELETE CASCADE,
            email VARCHAR(255) NOT NULL,
            sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            report_period_start DATE NOT NULL,
            report_period_end DATE NOT NULL,
            status VARCHAR(50) DEFAULT 'sent',
            error_message TEXT
          );
          
          CREATE INDEX IF NOT EXISTS idx_monthly_report_history_monitor_id ON public.monthly_report_history(monitor_id);
          CREATE INDEX IF NOT EXISTS idx_monthly_report_history_sent_at ON public.monthly_report_history(sent_at);
        `
      })
      
      if (historyError) {
        console.log('⚠️ Tabela monthly_report_history pode já existir ou houve erro:', historyError.message)
      } else {
        console.log('✅ Tabela monthly_report_history criada com sucesso!')
      }
    }
    
    console.log('✅ Verificação de tabelas concluída')
  } catch (error) {
    console.log('⚠️ Erro ao criar tabelas (podem já existir):', error)
  }
}

// Função para inicializar dados padrão se necessário
async function initializeDefaultData() {
  try {
    // Verificar se já existe um usuário admin
    const adminUser = await databaseService.getUserByEmail('admin@agencia.com')
    
    if (!adminUser) {
      console.log('🔧 Criando usuário administrador padrão...')
      await databaseService.createUser({
        email: 'admin@agencia.com',
        password: 'admin123',
        name: 'Administrador',
        role: 'admin'
      })
      console.log('✅ Usuário administrador criado com sucesso')
    }
    
    // Definir referência ao database service
    monitoringService.setDatabaseService(databaseService)
    
    // Iniciar o monitoramento
    console.log('🚀 Iniciando serviço de monitoramento...')
    await monitoringService.start()
    console.log('✅ Serviço de monitoramento iniciado')
  } catch (error) {
    console.error('Erro ao inicializar dados padrão:', error)
  }
}

// Inicializar serviços e dados padrão
initializeServices()
initializeDefaultData()

// Middleware de autenticação
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso requerido' })
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' })
    }
    req.user = user
    next()
  })
}

// Rota de Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Rotas de Autenticação
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' })
    }

    const user = await databaseService.getUserByEmail(email)

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' })
    }

    // Em produção, use bcrypt.compare
    // Para simplificar neste exemplo, comparamos texto plano se a senha não estiver hashada
    // ou usamos bcrypt se estiver
    let validPassword = false
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      validPassword = await bcrypt.compare(password, user.password)
    } else {
      validPassword = password === user.password
      // Se a senha não estava hashada, vamos hashar para o futuro
      if (validPassword) {
        const hashedPassword = await bcrypt.hash(password, 10)
        await databaseService.updateUser(user.id, { password_hash: hashedPassword })
      }
    }

    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' })
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    )

    // Remover senha do objeto retornado
    const { password: _, ...userWithoutPassword } = user

    res.json({ token, user: userWithoutPassword })
  } catch (error) {
    console.error('Erro no login:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.get('/api/auth/me', authenticateToken, async (req: any, res) => {
  try {
    const user = await databaseService.getUserByEmail(req.user.email)
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }
    const { password: _, ...userWithoutPassword } = user
    res.json(userWithoutPassword)
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Rotas de Dashboard
app.get('/api/dashboard/stats', authenticateToken, async (_req, res) => {
  try {
    const stats = monitoringService.getStats()
    res.json(stats)
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.get('/api/dashboard/monitors', authenticateToken, async (_req, res) => {
  try {
    const monitors = await databaseService.getMonitors()
    
    // Adicionar status em tempo real do serviço de monitoramento
    const monitorsWithStatus = monitors.map((monitor: any) => {
      const realTimeStatus = monitoringService.getMonitor(monitor.id)
      
      // Buscar configuração de relatório mensal
      // Nota: isso pode ser otimizado no futuro com um join no banco
      return {
        ...monitor,
        status: realTimeStatus?.status || monitor.status || 'unknown',
        last_check: realTimeStatus?.last_check || monitor.last_check,
        response_time: realTimeStatus?.response_time || monitor.response_time,
        uptime_24h: realTimeStatus?.uptime_24h || monitor.uptime_24h || 0,
        uptime_7d: realTimeStatus?.uptime_7d || monitor.uptime_7d || 0,
        uptime_30d: realTimeStatus?.uptime_30d || monitor.uptime_30d || 0
      }
    })
    
    // Carregar configurações de relatório para cada monitor
    // Em uma aplicação maior, isso seria feito com JOIN no banco
    const monitorsWithRealTimeStatus = await Promise.all(monitorsWithStatus.map(async (monitor: any) => {
      const reportConfig = await databaseService.getMonthlyReportConfigByMonitor(monitor.id)
      return {
        ...monitor,
        report_email: reportConfig?.email || '',
        report_send_day: reportConfig?.send_day || 1
      }
    }))
    
    res.json(monitorsWithRealTimeStatus)
  } catch (error) {
    console.error('Erro ao buscar monitores:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Alias para /api/monitors (usado pela página de Relatórios)
app.get('/api/monitors', authenticateToken, async (_req, res) => {
  try {
    const monitors = await databaseService.getMonitors()
    res.json(monitors)
  } catch (error) {
    console.error('Erro ao buscar monitores:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Rota para relatórios (usada pela página de Relatórios)
app.get('/api/reports', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, monitor_id } = req.query
    
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Data inicial e final são obrigatórias' })
    }
    
    const start = new Date(start_date as string)
    const end = new Date(end_date as string)
    
    let monitors = []
    if (monitor_id && monitor_id !== 'all') {
      const monitor = await databaseService.getMonitorById(monitor_id as string)
      if (monitor) monitors.push(monitor)
    } else {
      monitors = await databaseService.getMonitors()
    }
    
    const reports = []
    let totalChecks = 0
    let totalIncidents = 0
    let totalUptime = 0
    let totalResponseTime = 0
    
    for (const monitor of monitors) {
      const stats = await reportService.collectMonitorStats(monitor.id, start, end)
      
      reports.push({
        monitor_id: monitor.id,
        monitor_name: monitor.name,
        uptime_percentage: stats.uptime_30d, 
        total_checks: stats.total_checks,
        successful_checks: stats.successful_checks,
        failed_checks: stats.failed_checks,
        avg_response_time: stats.avg_response_time,
        min_response_time: 0, 
        max_response_time: 0,
        incidents: stats.incidents.length,
        last_incident: stats.incidents.length > 0 ? stats.incidents[stats.incidents.length - 1].date : null
      })
      
      totalChecks += stats.total_checks
      totalIncidents += stats.incidents.length
      totalUptime += stats.uptime_30d
      totalResponseTime += stats.avg_response_time
    }
    
    const overall_stats = {
      total_checks: totalChecks,
      total_incidents: totalIncidents,
      avg_uptime: monitors.length > 0 ? totalUptime / monitors.length : 0,
      avg_response_time: monitors.length > 0 ? totalResponseTime / monitors.length : 0
    }
    
    res.json({
      reports,
      overall_stats
    })
  } catch (error) {
    console.error('Erro ao gerar relatórios:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.post('/api/monitors', authenticateToken, async (req, res) => {
  try {
    const { name, url, type, interval, timeout, group_id, enabled = true, slug, logo_url, report_email, report_send_day, report_send_time, ignore_http_403, content_validation_enabled, min_content_length, min_text_length } = req.body
    
    if (!name || !url || !type) {
      return res.status(400).json({ error: 'Campos obrigatórios: name, url, type' })
    }
    
    if (group_id) {
      const group = await databaseService.getGroupById(group_id)
      if (!group) {
        return res.status(400).json({ error: 'Grupo não encontrado' })
      }
    }
    
    const newMonitor = await databaseService.createMonitor({
      name,
      url,
      type,
      interval: interval || 60000, // Valor já em milissegundos do frontend
      timeout: timeout || 30000,   // Valor já em milissegundos do frontend
      group_id,
      is_active: enabled,
      slug,
      logo_url,
      report_email,
      report_send_day,
      report_send_time,
      ignore_http_403,
      content_validation_enabled,
      min_content_length,
      min_text_length
    })
    
    // Se houver configuração de relatório, salvar
    if (report_email && report_send_day) {
      await databaseService.createMonthlyReportConfig({
        monitor_id: newMonitor.id,
        email: report_email,
        send_day: report_send_day,
        is_active: true
      })
    }
    
    // Adicionar ao serviço de monitoramento
    monitoringService.addMonitor({
      ...newMonitor,
      enabled: newMonitor.is_active
    })
    
    // Agendar relatório mensal se configurado
    if (report_email && report_send_day) {
      await schedulerService.scheduleMonitorReport(newMonitor)
    }
    
    res.status(201).json(newMonitor)
  } catch (error) {
    console.error('Erro ao criar monitor:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.get('/api/monitors/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const monitor = await databaseService.getMonitorById(id)
    
    if (!monitor) {
      return res.status(404).json({ error: 'Monitor não encontrado' })
    }
    
    // Buscar configuração de relatório mensal
    const reportConfig = await databaseService.getMonthlyReportConfigByMonitor(id)
    
    const realTimeStatus = monitoringService.getMonitor(id)
    
    res.json({
      ...monitor,
      status: realTimeStatus?.status || monitor.status || 'unknown',
      last_check: realTimeStatus?.last_check || monitor.last_check,
      response_time: realTimeStatus?.response_time || monitor.response_time,
      report_email: reportConfig?.email || '',
      report_send_day: reportConfig?.send_day || 1
    })
  } catch (error) {
    console.error('Erro ao buscar monitor:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.put('/api/monitors/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { name, url, type, interval, timeout, group_id, enabled, slug, logo_url, report_email, report_send_day, report_send_time, ignore_http_403, content_validation_enabled, min_content_length, min_text_length } = req.body
    
    const monitor = await databaseService.getMonitorById(id)
    if (!monitor) {
      return res.status(404).json({ error: 'Monitor não encontrado' })
    }
    
    const updatedMonitor = await databaseService.updateMonitor(id, {
      name,
      url,
      type,
      interval: interval || 60000, // Valor já em milissegundos do frontend
      timeout: timeout || 30000,   // Valor já em milissegundos do frontend
      group_id,
      is_active: enabled,
      slug,
      logo_url,
      report_email,
      report_send_day,
      report_send_time,
      ignore_http_403,
      content_validation_enabled,
      min_content_length,
      min_text_length
    })
    
    // Atualizar configuração de relatório mensal
    const existingConfig = await databaseService.getMonthlyReportConfigByMonitor(id)
    
    if (report_email && report_send_day) {
      if (existingConfig) {
        // Atualizar configuração existente
        await databaseService.updateMonthlyReportConfig(existingConfig.id, {
          email: report_email,
          send_day: report_send_day,
          is_active: true
        })
      } else {
        // Criar nova configuração
        await databaseService.createMonthlyReportConfig({
          monitor_id: id,
          email: report_email,
          send_day: report_send_day,
          is_active: true
        })
      }
    } else if (existingConfig) {
      // Remover configuração se não há mais dados de relatório
      await databaseService.deleteMonthlyReportConfig(existingConfig.id)
    }
    
    // Atualizar no serviço de monitoramento preservando o status em memória
    const currentMonitor = monitoringService.getMonitor(id)
    monitoringService.updateMonitor({
      ...updatedMonitor,
      // Preserva campos de status já calculados em memória para evitar ficar 'unknown' após updates não relacionados
      status: currentMonitor?.status ?? updatedMonitor.status ?? 'unknown',
      last_check: currentMonitor?.last_check ?? updatedMonitor.last_check ?? null,
      response_time: currentMonitor?.response_time ?? updatedMonitor.response_time ?? null,
      uptime_24h: currentMonitor?.uptime_24h ?? updatedMonitor.uptime_24h ?? 0,
      uptime_7d: currentMonitor?.uptime_7d ?? updatedMonitor.uptime_7d ?? 0,
      uptime_30d: currentMonitor?.uptime_30d ?? updatedMonitor.uptime_30d ?? 0,
      enabled: updatedMonitor.is_active
    })
    
    // Reagendar job de relatório mensal após atualização do monitor
    await schedulerService.rescheduleMonitorReport(id)
    
    res.json(updatedMonitor)
  } catch (error) {
    console.error('Erro ao atualizar monitor:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.delete('/api/monitors/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    
    await databaseService.deleteMonitor(id)
    
    // Remover do serviço de monitoramento
    monitoringService.removeMonitor(id)
    
    // Remover job agendado (se existir) para este monitor
    await schedulerService.rescheduleMonitorReport(id)
    
    res.status(204).send()
  } catch (error) {
    console.error('Erro ao remover monitor:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.delete('/api/monitors/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    
    const monitor = await databaseService.getMonitorById(id)
    if (!monitor) {
      return res.status(404).json({ error: 'Monitor não encontrado' })
    }

    await databaseService.clearMonitorHistory(id)
    
    // Atualizar no serviço de monitoramento para resetar estatísticas
    const currentMonitor = monitoringService.getMonitor(id)
    if (currentMonitor) {
      monitoringService.updateMonitor({
        ...currentMonitor,
        uptime_24h: 0,
        uptime_7d: 0,
        uptime_30d: 0,
        last_check: null,
        response_time: null,
        status: 'unknown'
      })
    }
    
    console.log(`Histórico limpo para o monitor ${id} pelo usuário ${req.user.email}`)
    
    res.status(200).json({ message: 'Histórico limpo com sucesso' })
  } catch (error) {
    console.error('Erro ao limpar histórico do monitor:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Rota para obter histórico de checks
app.get('/api/monitors/:id/checks', authenticateToken, (req, res) => {
  const { id } = req.params
  const { limit = 100 } = req.query
  
  const monitor = monitoringService.getMonitor(id)
  if (!monitor) {
    return res.status(404).json({ error: 'Monitor não encontrado' })
  }
  
  const checks = monitoringService.getMonitorChecks(id, Number(limit))
  res.json(checks)
})

// Executar uma verificação manual imediata de um monitor
app.post('/api/monitors/:id/check-now', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params

    const monitor = monitoringService.getMonitor(id)
    if (!monitor) {
      return res.status(404).json({ error: 'Monitor não encontrado' })
    }

    const result = await monitoringService.triggerCheck(id)
    return res.json(result)
  } catch (error) {
    console.error('Erro ao executar verificação manual:', error)
    return res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Nova rota compatível com o frontend para obter checks com filtros de período
app.get('/api/monitor-checks', authenticateToken, async (req, res) => {
  try {
    const { monitor_id, start_date, end_date, period = '7d', limit } = req.query as any

    if (!monitor_id) {
      return res.status(400).json({ error: 'monitor_id é obrigatório' })
    }

    // Validar monitor existente
    const monitor = await databaseService.getMonitorById(String(monitor_id))
    if (!monitor) {
      return res.status(404).json({ error: 'Monitor não encontrado' })
    }

    const now = new Date()
    let start: Date
    let end: Date

    if (start_date && end_date) {
      start = new Date(String(start_date))
      end = new Date(String(end_date))
    } else {
      const periodDays = ({ '24h': 1, '7d': 7, '30d': 30, '90d': 90 } as Record<string, number>)[String(period)] || 7
      end = now
      start = new Date()
      start.setDate(start.getDate() - periodDays)
    }

    // Buscar diretamente do banco dentro do período
    const checks = await databaseService.getMonitorChecksForPeriod(String(monitor_id), start, end)
    const capped = typeof limit === 'string' || typeof limit === 'number' ? checks.slice(0, Number(limit)) : checks

    // Compatibilidade com o frontend: retornar array por padrão
    // Permitir formato completo opcional via query (full=1 ou format=full)
    const formatQuery = String((req.query as any).format || '').toLowerCase()
    const isFull = String((req.query as any).full || '').toLowerCase() === '1' || formatQuery === 'full'

    if (isFull) {
      return res.json({ monitor_id, start_date: start.toISOString(), end_date: end.toISOString(), count: capped.length, data: capped })
    }

    return res.json(capped)
  } catch (error) {
    console.error('Erro em /api/monitor-checks:', error)
    return res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Rotas de grupos
app.get('/api/groups', authenticateToken, async (_, res) => {
  try {
    const groups = await databaseService.getGroups()
    res.json(groups)
  } catch (error) {
    console.error('Erro ao buscar grupos:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.post('/api/groups', authenticateToken, async (req, res) => {
  try {
    const { name, description, slug } = req.body
    
    if (!name) {
      return res.status(400).json({ error: 'Nome é obrigatório' })
    }
    
    const newGroup = await databaseService.createGroup({
      name,
      description,
      slug
    })
    
    res.status(201).json(newGroup)
  } catch (error) {
    console.error('Erro ao criar grupo:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.put('/api/groups/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, slug } = req.body
    
    const updatedGroup = await databaseService.updateGroup(id, {
      name,
      description,
      slug
    })
    
    res.json(updatedGroup)
  } catch (error) {
    console.error('Erro ao atualizar grupo:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.delete('/api/groups/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    
    await databaseService.deleteGroup(id)
    
    res.status(204).send()
  } catch (error) {
    console.error('Erro ao remover grupo:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Rotas de Relatórios Mensais
app.get('/api/monthly-reports/configs/monitor/:monitorId', authenticateToken, async (req, res) => {
  try {
    const { monitorId } = req.params
    const config = await databaseService.getMonthlyReportConfigByMonitor(monitorId)
    res.json(config)
  } catch (error) {
    console.error('Erro ao buscar configuração de relatório:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.post('/api/monthly-reports/configs', authenticateToken, async (req, res) => {
  try {
    const { monitor_id, email, send_day, enabled } = req.body
    
    if (!monitor_id || !email || !send_day) {
      return res.status(400).json({ error: 'Monitor ID, email e dia de envio são obrigatórios' })
    }
    
    if (send_day < 1 || send_day > 28) {
      return res.status(400).json({ error: 'Dia de envio deve estar entre 1 e 28' })
    }
    
    const config = await databaseService.createMonthlyReportConfig({
      monitor_id,
      email,
      send_day,
      is_active: enabled ?? true
    })
    
    res.status(201).json(config)
  } catch (error) {
    console.error('Erro ao criar configuração de relatório:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.put('/api/monthly-reports/configs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { email, send_day, enabled } = req.body
    
    if (send_day && (send_day < 1 || send_day > 28)) {
      return res.status(400).json({ error: 'Dia de envio deve estar entre 1 e 28' })
    }
    
    const updates: any = {}
    if (email) updates.email = email
    if (send_day) updates.send_day = send_day
    if (enabled !== undefined) updates.is_active = enabled
    
    const config = await databaseService.updateMonthlyReportConfig(id, updates)
    
    // Reagendar relatório se necessário
    if (config) {
      await schedulerService.rescheduleMonitorReport(config.monitor_id)
    }
    
    res.json(config)
  } catch (error) {
    console.error('Erro ao atualizar configuração de relatório:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.delete('/api/monthly-reports/configs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    
    // Buscar config antes de deletar para poder reagendar (cancelar) o job
    const config = await databaseService.getMonthlyReportConfigById(id)
    
    await databaseService.deleteMonthlyReportConfig(id)
    
    if (config) {
      await schedulerService.rescheduleMonitorReport(config.monitor_id)
    }
    
    res.status(204).send()
  } catch (error) {
    console.error('Erro ao remover configuração de relatório:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.get('/api/monthly-reports/history', authenticateToken, async (req, res) => {
  try {
    const { monitor_id, year, month, limit } = req.query
    const history = await databaseService.getMonthlyReportHistory({
      monitor_id: monitor_id as string,
      year: year ? parseInt(year as string) : undefined,
      month: month ? parseInt(month as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined
    })
    res.json(history)
  } catch (error) {
    console.error('Erro ao buscar histórico de relatórios:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Rotas de PDF
app.get('/api/pdf/status', authenticateToken, async (req, res) => {
  try {
    const { title } = req.query
    
    const pdfBuffer = await pdfService.generateStatusPDF({
      title: title as string || 'Status dos Monitores'
    })
    
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="status-report.pdf"')
    res.send(pdfBuffer)
  } catch (error) {
    console.error('Erro ao gerar PDF de status:', error)
    res.status(500).json({ error: 'Erro ao gerar PDF' })
  }
})

app.get('/api/pdf/monthly-report/:monitorId', authenticateToken, async (req, res) => {
  try {
    const { monitorId } = req.params
    const { year, month, style } = req.query as { [key: string]: string }

    if (!year || !month) {
      return res.status(400).json({ error: 'Ano e mês são obrigatórios' })
    }

    // Novo: opção de layout baseado na página de status pública
    if (style === 'status') {
      try {
        const monitor = await databaseService.getMonitorById(monitorId)
        if (monitor?.slug) {
          const pdfBuffer = await pdfService.generateOptimizedStatusPDF(
            monitor.slug,
            `${monitor.name} - Relatório Mensal`
          )

          const filename = `relatorio-mensal-status-${monitor.slug}-${month}-${year}.pdf`
          res.setHeader('Content-Type', 'application/pdf')
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
          return res.send(pdfBuffer)
        }
        // Se não houver slug, cai para geração padrão abaixo
        console.warn(`Monitor ${monitorId} sem slug; usando modelo padrão de relatório mensal`)
      } catch (innerErr) {
        console.warn('Falha ao gerar PDF com layout de status; usando modelo padrão.', innerErr)
      }
    }

    // Comportamento padrão existente
    const pdfBuffer = await pdfService.generateMonthlyReportPDF(
      monitorId,
      Number(year),
      Number(month)
    )

    const filename = `relatorio-mensal-${monitorId}-${year}-${month}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(pdfBuffer)
  } catch (error) {
    console.error('Erro ao gerar PDF de relatório mensal:', error)
    res.status(500).json({ error: 'Erro ao gerar PDF do relatório mensal' })
  }
})

// Rota para enviar relatório mensal por e-mail
app.post('/api/reports/send-monthly', authenticateToken, async (req, res) => {
  const startTime = Date.now()
  try {
    const { monitor_id, email, year, month, includePdf = true, includeStatusPdf = false } = req.body
    
    console.log(`📊 Solicitação de envio de relatório mensal - Monitor: ${monitor_id}, Período: ${month}/${year}`)
    
    if (!monitor_id || !email || !year || !month) {
      const error = 'Todos os campos são obrigatórios'
      console.error(`❌ Parâmetros inválidos: ${error}`)
      return res.status(400).json({ error })
    }
    
    console.log(`📧 Enviando para: ${email}`)
    
    let result
    
    if (includeStatusPdf) {
      // Enviar relatório completo com PDF do status geral
      result = await reportService.sendMonthlyReportWithStatusPDF(
        monitor_id,
        email,
        Number(year),
        Number(month)
      )
    } else {
      // Enviar relatório mensal padrão
      result = await reportService.sendMonthlyReport(
        monitor_id,
        email,
        Number(year),
        Number(month),
        includePdf
      )
    }
    
    const duration = Date.now() - startTime
    
    if (result.success) {
      console.log(`✅ Relatório mensal enviado com sucesso em ${duration}ms`)
      res.json({ message: 'Relatório enviado com sucesso' })
    } else {
      console.error(`❌ Falha ao enviar relatório: ${result.message}`)
      res.status(500).json({ error: result.message })
    }
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`❌ Erro ao enviar relatório mensal após ${duration}ms:`, error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Rota para enviar relatório mensal para e-mail específico
app.post('/api/reports/send-monthly-custom', authenticateToken, async (req, res) => {
  const startTime = Date.now()
  try {
    const { monitor_id, email, year, month, includePdf = true, includeStatusPdf = false } = req.body
    
    console.log(`📊 Solicitação de envio customizado - Monitor: ${monitor_id}, Período: ${month}/${year}, E-mail: ${email}`)
    
    if (!monitor_id || !email || !year || !month) {
      const error = 'Todos os campos são obrigatórios'
      console.error(`❌ Parâmetros inválidos: ${error}`)
      return res.status(400).json({ error })
    }
    
    // Validar formato do e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      const error = 'Formato de e-mail inválido'
      console.error(`❌ ${error}: ${email}`)
      return res.status(400).json({ error })
    }
    
    console.log(`📧 Enviando para: ${email}`)
    
    let result
    
    if (includeStatusPdf) {
      // Enviar relatório completo com PDF do status geral
      result = await reportService.sendMonthlyReportWithStatusPDF(
        monitor_id,
        email,
        Number(year),
        Number(month)
      )
    } else {
      // Enviar relatório mensal padrão
      result = await reportService.sendMonthlyReport(
        monitor_id,
        email,
        Number(year),
        Number(month),
        includePdf
      )
    }
    
    const duration = Date.now() - startTime
    
    if (result.success) {
      console.log(`✅ Relatório mensal enviado com sucesso em ${duration}ms`)
      res.json({ message: 'Relatório enviado com sucesso' })
    } else {
      console.error(`❌ Falha ao enviar relatório: ${result.message}`)
      res.status(500).json({ error: result.message })
    }
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`❌ Erro ao enviar relatório mensal após ${duration}ms:`, error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Rotas SMTP
app.get('/api/smtp/config', authenticateToken, async (_req, res) => {
  try {
    const config = await databaseService.getSmtpConfig()
    if (config) {
      // Não retornar a senha
      const { pass, ...safeConfig } = config
      res.json(safeConfig)
    } else {
      res.status(404).json({ error: 'Configuração SMTP não encontrada' })
    }
  } catch (error) {
    console.error('Erro ao buscar configuração SMTP:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.post('/api/smtp/config', authenticateToken, async (req, res) => {
  try {
    const { host, port, secure, user, pass, from_name, from_email } = req.body
    
    if (!host || !port || !user || !pass || !from_email) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' })
    }
    
    await databaseService.saveSmtpConfig({
      host,
      port,
      secure,
      user,
      pass,
      from_name: from_name || 'Uptime Monitor',
      from_email,
      is_configured: true
    })
    
    // Recarregar configurações no serviço de e-mail
    await reportService.reloadSmtpConfig()
    
    res.json({ message: 'Configuração SMTP salva com sucesso' })
  } catch (error) {
    console.error('Erro ao salvar configuração SMTP:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.post('/api/smtp/test', authenticateToken, async (req, res) => {
  try {
    const { email } = req.body
    
    if (!email) {
      return res.status(400).json({ error: 'E-mail de destino é obrigatório' })
    }
    
    const result = await reportService.sendTestEmail(email)
    
    if (result.success) {
      res.json({ message: 'E-mail de teste enviado com sucesso' })
    } else {
      res.status(500).json({ error: `Erro ao enviar e-mail: ${result.message}` })
    }
  } catch (error) {
    console.error('Erro ao testar SMTP:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Rotas de Upload
app.post('/api/upload/logo', authenticateToken, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' })
    }

    const result = await storageService.uploadLogo(req.file)
    res.json(result)
  } catch (error) {
    console.error('Erro no upload da logo:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erro ao fazer upload' })
  }
})

// Rotas públicas de Status Page
app.get('/api/status-page/:slug', async (req, res) => {
  try {
    const { slug } = req.params
    
    // Verificar se é uma página de status de grupo ou de monitor individual
    const group = await databaseService.getGroupBySlug(slug)
    
    if (group) {
      // É uma página de grupo
      const monitors = await databaseService.getMonitorsByGroup(group.id)
      
      // Adicionar status em tempo real
      const monitorsWithStatus = monitors
        .filter((m: any) => m.is_active)
        .map((monitor: any) => {
          const realTimeStatus = monitoringService.getMonitor(monitor.id)
          return {
            id: monitor.id,
            name: monitor.name,
            url: monitor.url,
            type: monitor.type,
            logo_url: monitor.logo_url,
            status: realTimeStatus?.status || monitor.status || 'unknown',
            last_check: realTimeStatus?.last_check || monitor.last_check,
            response_time: realTimeStatus?.response_time || monitor.response_time,
            uptime_24h: realTimeStatus?.uptime_24h || monitor.uptime_24h || 0,
            uptime_7d: realTimeStatus?.uptime_7d || monitor.uptime_7d || 0,
            uptime_30d: realTimeStatus?.uptime_30d || monitor.uptime_30d || 0,
            group_name: group.name
          }
        })
      
      // Calcular status geral do grupo
      const hasDown = monitorsWithStatus.some((m: any) => m.status === 'offline')
      const hasWarning = monitorsWithStatus.some((m: any) => m.status === 'warning')
      
      let overall_status = 'operational'
      if (hasDown) overall_status = 'outage'
      else if (hasWarning) overall_status = 'degraded'
      
      return res.json({
        title: group.name,
        description: group.description,
        monitors: monitorsWithStatus,
        overall_status,
        last_updated: new Date().toISOString(),
        type: 'group'
      })
    }
    
    // Verificar se é um monitor individual
    const monitor = await databaseService.getMonitorBySlug(slug)
    
    if (monitor) {
      if (!monitor.is_active) {
        return res.status(404).json({ error: 'Página de status não encontrada ou inativa' })
      }
      
      const realTimeStatus = monitoringService.getMonitor(monitor.id)
      const monitorData = {
        id: monitor.id,
        name: monitor.name,
        url: monitor.url,
        type: monitor.type,
        logo_url: monitor.logo_url,
        status: realTimeStatus?.status || monitor.status || 'unknown',
        last_check: realTimeStatus?.last_check || monitor.last_check,
        response_time: realTimeStatus?.response_time || monitor.response_time,
        uptime_24h: realTimeStatus?.uptime_24h || monitor.uptime_24h || 0,
        uptime_7d: realTimeStatus?.uptime_7d || monitor.uptime_7d || 0,
        uptime_30d: realTimeStatus?.uptime_30d || monitor.uptime_30d || 0,
        group_name: monitor.group_name || 'Sem grupo'
      }
      
      let overall_status = 'operational'
      if (monitorData.status === 'offline') overall_status = 'outage'
      else if (monitorData.status === 'warning') overall_status = 'degraded'
      
      return res.json({
        title: monitor.name,
        description: `Status do serviço ${monitor.name}`,
        monitors: [monitorData],
        overall_status,
        last_updated: new Date().toISOString(),
        type: 'monitor'
      })
    }
    
    return res.status(404).json({ error: 'Página de status não encontrada' })
  } catch (error) {
    console.error('Erro ao buscar página de status:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Rota pública para obter histórico de incidentes de um monitor
app.get('/api/public/monitors/:id/incidents', async (req, res) => {
  try {
    const { id } = req.params
    const { limit = 10 } = req.query
    
    // Verificar se o monitor existe e está ativo
    const monitor = await databaseService.getMonitorById(id)
    if (!monitor || !monitor.is_active) {
      return res.status(404).json({ error: 'Monitor não encontrado' })
    }
    
    // Buscar histórico de checks com status offline/warning
    // Simplificação: buscando checks recentes com erro
    // Idealmente teríamos uma tabela separada de incidentes
    const checks = await databaseService.getMonitorChecks(id, Number(limit) * 5) // Buscar mais para filtrar
    
    const incidents = []
    let currentIncident = null
    
    // Agrupar falhas consecutivas em incidentes
    // Lógica simplificada para demonstração
    for (const check of checks) {
      if (check.status !== 'online') {
        if (!currentIncident) {
          currentIncident = {
            id: `inc-${check.id}`,
            monitor_name: monitor.name,
            status: 'resolved', // Assumindo resolvido pois estamos olhando histórico
            title: check.status === 'offline' ? 'Serviço indisponível' : 'Latência alta detectada',
            description: check.error_message || 'Falha na verificação',
            started_at: check.checked_at,
            resolved_at: check.checked_at // Placeholder
          }
        }
      } else {
        if (currentIncident) {
          currentIncident.resolved_at = check.checked_at
          incidents.push(currentIncident)
          currentIncident = null
        }
      }
    }
    
    // Limitar quantidade
    res.json(incidents.slice(0, Number(limit)))
  } catch (error) {
    console.error('Erro ao buscar incidentes:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`)
})
