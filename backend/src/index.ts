import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
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

// Carregar variáveis de ambiente
dotenv.config()

const app = express()
const PORT = process.env.PORT || 8081
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

// Inicializar serviço de monitoramento
const monitoringService = new MonitoringService()

// Middlewares
app.use(helmet())
app.use(compression())
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001', 'http://localhost:3002', 'http://127.0.0.1:3002'],
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
    
    const existingTables = tables?.map(t => t.table_name) || []
    
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
    
    // Carregar monitores existentes do banco de dados
    const monitors = await databaseService.getMonitors()
    monitors.forEach(monitor => {
      monitoringService.addMonitor({
        ...monitor,
        enabled: monitor.is_active,
        status: 'unknown',
        last_check: null,
        response_time: null,
        uptime_24h: 0,
        uptime_7d: 0,
        uptime_30d: 0
      })
    })
    
    // Carregar verificações recentes do banco de dados
    await monitoringService.loadRecentChecks(databaseService)
    
    // Iniciar o serviço de monitoramento
    monitoringService.start()
    
    console.log(`📊 ${monitors.length} monitores carregados do banco de dados`)
  } catch (error) {
    console.error('❌ Erro ao inicializar dados padrão:', error)
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

// Rotas de autenticação
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

    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' })
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    )

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    })
  } catch (error) {
    console.error('Erro no login:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.post('/api/auth/verify', authenticateToken, async (req: any, res) => {
  try {
    const user = await databaseService.getUserById(req.user.id)
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    })
  } catch (error) {
    console.error('Erro na verificação:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Rotas do dashboard
app.get('/api/dashboard/stats', authenticateToken, async (_, res) => {
  try {
    const monitors = monitoringService.getMonitors()
    const groups = await databaseService.getGroups()
    const stats = {
      total_monitors: monitors.length,
      online_monitors: monitors.filter(m => m.status === 'online').length,
      offline_monitors: monitors.filter(m => m.status === 'offline').length,
      warning_monitors: monitors.filter(m => m.status === 'warning').length,
      avg_response_time: monitors.length > 0 ? Math.round(monitors.reduce((acc, m) => acc + (m.response_time || 0), 0) / monitors.length) : 0,
      total_groups: groups.length,
      avg_uptime: monitors.length > 0 ? Math.round(monitors.reduce((acc, m) => acc + m.uptime_24h, 0) / monitors.length * 100) / 100 : 0
    }
    res.json(stats)
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.get('/api/dashboard/monitors', authenticateToken, (_, res) => {
  const monitors = monitoringService.getMonitors()
  res.json(monitors)
})

// Rotas de monitores
app.get('/api/monitors', authenticateToken, async (_, res) => {
  try {
    const monitors = await databaseService.getMonitors()
    
    // Combinar dados do banco com dados em tempo real do MonitoringService
    const monitorsWithRealTimeStatus = await Promise.all(monitors.map(async monitor => {
      const realTimeMonitor = monitoringService.getMonitor(monitor.id)
      const reportConfig = await databaseService.getMonthlyReportConfigByMonitor(monitor.id)
      
      return {
        ...monitor,
        status: realTimeMonitor?.status || monitor.status || 'unknown',
        last_check: realTimeMonitor?.last_check || monitor.last_check,
        response_time: realTimeMonitor?.response_time || monitor.response_time,
        uptime_24h: realTimeMonitor?.uptime_24h || monitor.uptime_24h || 0,
        uptime_7d: realTimeMonitor?.uptime_7d || monitor.uptime_7d || 0,
        uptime_30d: realTimeMonitor?.uptime_30d || monitor.uptime_30d || 0,
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

app.post('/api/monitors', authenticateToken, async (req, res) => {
  try {
    const { name, url, type, interval, timeout, group_id, enabled = true, slug, logo_url, report_email, report_send_day } = req.body
    
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
      interval: interval ? interval * 1000 : 60000, // Converter segundos para milissegundos
      timeout: timeout ? timeout * 1000 : 30000,   // Converter segundos para milissegundos
      group_id,
      is_active: enabled,
      slug,
      logo_url,
      report_email,
      report_send_day
    })
    
    // Criar configuração de relatório mensal se fornecida
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
      enabled: newMonitor.is_active,
      uptime_24h: 0,
      uptime_7d: 0,
      uptime_30d: 0
    })
    
    res.status(201).json(newMonitor)
  } catch (error) {
    console.error('Erro ao criar monitor:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Endpoint para upload de logo
app.post('/api/upload/logo', authenticateToken, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo foi enviado' })
    }

    // Fazer upload do arquivo
    const uploadResult = await storageService.uploadLogo(req.file)
    
    res.status(200).json({
      success: true,
      url: uploadResult.url,
      path: uploadResult.path
    })
  } catch (error) {
    console.error('Erro ao fazer upload da logo:', error)
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Erro interno do servidor' 
    })
  }
})

app.put('/api/monitors/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { name, url, type, interval, timeout, group_id, is_active, slug, report_email, report_send_day } = req.body
    
    if (group_id) {
      const group = await databaseService.getGroupById(group_id)
      if (!group) {
        return res.status(400).json({ error: 'Grupo não encontrado' })
      }
    }
    
    const updatedMonitor = await databaseService.updateMonitor(id, {
      name,
      url,
      type,
      interval: interval ? interval * 1000 : undefined, // Converter segundos para milissegundos
      timeout: timeout ? timeout * 1000 : undefined,   // Converter segundos para milissegundos
      group_id,
      is_active,
      slug
    })
    
    if (!updatedMonitor) {
      return res.status(404).json({ error: 'Monitor não encontrado' })
    }
    
    // Gerenciar configuração de relatório mensal
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
    
    // Atualizar no serviço de monitoramento
    monitoringService.updateMonitor({
      ...updatedMonitor,
      enabled: updatedMonitor.is_active
    })
    
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
    
    res.status(204).send()
  } catch (error) {
    console.error('Erro ao remover monitor:', error)
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
      description: description || '',
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
    
    if (!updatedGroup) {
      return res.status(404).json({ error: 'Grupo não encontrado' })
    }
    
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
    
    res.json({ message: 'Grupo removido com sucesso' })
  } catch (error) {
    console.error('Erro ao remover grupo:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Rotas de configuração de relatórios mensais
app.get('/api/monthly-reports/configs', authenticateToken, async (_, res) => {
  try {
    const configs = await databaseService.getMonthlyReportConfigs()
    res.json(configs)
  } catch (error) {
    console.error('Erro ao buscar configurações de relatórios:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

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
    
    const config = await databaseService.updateMonthlyReportConfig(id, {
      email,
      send_day,
      is_active: enabled
    })
    
    res.json(config)
  } catch (error) {
    console.error('Erro ao atualizar configuração de relatório:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.delete('/api/monthly-reports/configs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    await databaseService.deleteMonthlyReportConfig(id)
    res.json({ message: 'Configuração removida com sucesso' })
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
    const { year, month } = req.query
    
    if (!year || !month) {
      return res.status(400).json({ error: 'Ano e mês são obrigatórios' })
    }
    
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
    
    console.log(`📧 Enviando relatório customizado para: ${email}`)
    
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
      console.log(`✅ Relatório customizado enviado com sucesso em ${duration}ms`)
      res.json({ message: 'Relatório enviado com sucesso' })
    } else {
      console.error(`❌ Falha ao enviar relatório customizado: ${result.message}`)
      res.status(500).json({ error: result.message })
    }
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`❌ Erro ao enviar relatório mensal customizado após ${duration}ms:`, error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Rota para forçar verificação de relatórios mensais (útil para testes)
app.post('/api/scheduler/check-monthly-reports', authenticateToken, async (_, res) => {
  const startTime = Date.now()
  try {
    console.log('🔄 Solicitação de verificação manual de relatórios mensais')
    
    await schedulerService.forceCheckMonthlyReports()
    
    const duration = Date.now() - startTime
    console.log(`✅ Verificação manual concluída com sucesso em ${duration}ms`)
    
    res.json({ success: true, message: 'Verificação de relatórios mensais executada com sucesso' })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`❌ Erro ao executar verificação de relatórios após ${duration}ms:`, error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Rota para listar jobs agendados
app.get('/api/scheduler/jobs', authenticateToken, async (_, res) => {
  try {
    console.log('📋 Solicitação de listagem de jobs agendados')
    
    const jobs = schedulerService.listJobs()
    
    console.log(`📊 Retornando ${jobs.length} jobs agendados`)
    res.json({ jobs, total: jobs.length })
  } catch (error) {
    console.error('❌ Erro ao listar jobs:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Rotas de configuração SMTP
app.get('/api/smtp/config', authenticateToken, async (_, res) => {
  try {
    const config = await databaseService.getSmtpConfig()
    if (!config) {
      // Retornar configuração padrão das variáveis de ambiente
      return res.json({
        host: process.env.SMTP_HOST || '',
        port: parseInt(process.env.SMTP_PORT || '587'),
        username: process.env.SMTP_USER || '',
        password: '',
        from_email: process.env.SMTP_FROM_EMAIL || '',
        from_name: process.env.SMTP_FROM_NAME || 'Uptime Monitor',
        use_tls: process.env.SMTP_SECURE !== 'true',
        use_ssl: process.env.SMTP_SECURE === 'true',
        enabled: false
      })
    }
    
    res.json({
      id: config.id,
      host: config.host,
      port: config.port,
      username: config.user,
      password: config.pass, // Campo correto é 'pass'
      from_email: config.from_email,
      from_name: config.from_name,
      use_tls: !config.secure,
      use_ssl: config.secure,
      enabled: config.is_configured // Campo correto é 'is_configured'
    })
  } catch (error) {
    console.error('Erro ao buscar configuração SMTP:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.put('/api/smtp/config', authenticateToken, async (req, res) => {
  try {
    const { host, port, username, password, from_email, from_name, use_ssl, enabled } = req.body
    
    const config = await databaseService.updateSmtpConfig({
      host,
      port: parseInt(port),
      secure: use_ssl, // SSL tem prioridade sobre TLS
      user: username,
      password,
      from_email,
      from_name,
      is_configured: enabled // Campo correto é 'is_configured'
    })
    
    res.json({
      id: config.id,
      host: config.host,
      port: config.port,
      username: config.user,
      password: config.pass, // Campo correto é 'pass'
      from_email: config.from_email,
      from_name: config.from_name,
      use_tls: !config.secure,
      use_ssl: config.secure,
      enabled: config.is_configured // Campo correto é 'is_configured'
    })
  } catch (error) {
    console.error('Erro ao atualizar configuração SMTP:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.post('/api/smtp/test', authenticateToken, async (req, res) => {
  try {
    const { email } = req.body
    
    if (!email) {
      return res.status(400).json({ error: 'E-mail é obrigatório' })
    }

    // Importar o EmailService
    const { emailService } = await import('./services/EmailService.js')
    
    // Recarregar configuração para garantir que está atualizada
    await emailService.reloadConfig()
    
    // Enviar e-mail de teste
    const result = await emailService.sendTestEmail(email)
    
    if (result.success) {
      res.json({ success: true, message: result.message })
    } else {
      res.status(400).json({ error: result.message })
    }
  } catch (error) {
    console.error('Erro ao testar SMTP:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Rotas de relatórios
app.get('/api/reports/stats', authenticateToken, (_, res) => {
  const monitors = monitoringService.getMonitors()
  const stats = {
    avg_uptime: Math.round(monitors.reduce((acc, m) => acc + m.uptime_30d, 0) / monitors.length * 100) / 100,
    total_checks: monitors.length * 30 * 24, // Simulado
    total_incidents: 5, // Simulado
    avg_response_time: Math.round(monitors.reduce((acc, m) => acc + (m.response_time || 0), 0) / monitors.length)
  }
  res.json(stats)
})

app.get('/api/reports/monitors', authenticateToken, (_, res) => {
  const monitors = monitoringService.getMonitors()
  const detailedMonitors = monitors.map(monitor => ({
    ...monitor,
    incidents_count: Math.floor(Math.random() * 3), // Simulado
    avg_response_time: monitor.response_time,
    total_checks: 30 * 24 // Simulado
  }))
  res.json(detailedMonitors)
})

// Endpoint principal de relatórios
app.get('/api/reports', authenticateToken, async (req, res) => {
  try {
    const { period = '7d', group_id } = req.query
    const monitors = await databaseService.getMonitors()
    
    // Filtrar por grupo se especificado
    const filteredMonitors = group_id && group_id !== 'all' 
      ? monitors.filter(m => m.group_id === group_id)
      : monitors
    
    // Calcular período em dias
    const periodDays = {
      '24h': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90
    }[period as string] || 7
    
    const reports = await Promise.all(filteredMonitors.map(async (monitor) => {
      // Buscar checks do período
      const checks = await databaseService.getMonitorChecks(monitor.id, periodDays * 24 * 2)
      
      // Filtrar checks do período
      const periodStart = new Date()
      periodStart.setDate(periodStart.getDate() - periodDays)
      
      const periodChecks = checks.filter(check => 
        new Date(check.checked_at) >= periodStart
      )
      
      const totalChecks = periodChecks.length
      const successfulChecks = periodChecks.filter(check => check.status === 'online').length
      const failedChecks = totalChecks - successfulChecks
      
      // Calcular uptime
      const uptimePercentage = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0
      
      // Calcular tempos de resposta
      const responseTimes = periodChecks
        .filter(check => check.response_time !== null)
        .map(check => check.response_time)
      
      const avgResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((acc, time) => acc + time, 0) / responseTimes.length
        : 0
      
      const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0
      const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0
      
      // Contar incidentes (sequências de falhas)
      let incidents = 0
      let lastIncident = null
      let inIncident = false
      
      for (const check of periodChecks.reverse()) {
        if (check.status !== 'online' && !inIncident) {
          incidents++
          inIncident = true
          if (!lastIncident) {
            lastIncident = check.checked_at
          }
        } else if (check.status === 'online' && inIncident) {
          inIncident = false
        }
      }
      
      return {
        monitor_id: monitor.id,
        monitor_name: monitor.name,
        monitor_url: monitor.url,
        group_name: monitor.group_name || 'Sem grupo',
        total_checks: totalChecks,
        successful_checks: successfulChecks,
        failed_checks: failedChecks,
        uptime_percentage: Math.round(uptimePercentage * 100) / 100,
        avg_response_time: Math.round(avgResponseTime),
        min_response_time: Math.round(minResponseTime),
        max_response_time: Math.round(maxResponseTime),
        incidents,
        last_incident: lastIncident
      }
    }))
    
    res.json(reports)
  } catch (error) {
    console.error('Erro ao buscar relatórios:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.get('/api/reports/export', authenticateToken, (_, res) => {
  const monitors = monitoringService.getMonitors()
  const csvData = [
    'Monitor,URL,Status,Uptime 24h,Uptime 7d,Uptime 30d,Tempo Resposta',
    ...monitors.map(m => 
      `${m.name},${m.url},${m.status},${m.uptime_24h}%,${m.uptime_7d}%,${m.uptime_30d}%,${m.response_time || 0}ms`
    )
  ].join('\n')
  
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename=relatorio-uptime.csv')
  res.send(csvData)
})

// Rotas públicas (status page)

// Rota pública para listar grupos
app.get('/api/public/groups', async (_, res) => {
  try {
    const groups = await databaseService.getGroups()
    res.json(groups.map(g => ({
      id: g.id,
      name: g.name,
      description: g.description,
      slug: g.slug
    })))
  } catch (error) {
    console.error('Erro ao buscar grupos públicos:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Rota pública para listar monitores
app.get('/api/public/monitors', async (_, res) => {
  try {
    const monitors = await databaseService.getMonitors()
    res.json(monitors.map(m => ({
      id: m.id,
      name: m.name,
      url: m.url,
      slug: m.slug
    })))
  } catch (error) {
    console.error('Erro ao buscar monitores públicos:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Rota pública para status por grupo
app.get('/api/public/status/:groupId?', (req, res) => {
  const { groupId } = req.params
  let monitors = monitoringService.getMonitors()
  
  // Filtrar por grupo se especificado
  if (groupId && groupId !== 'all') {
    monitors = monitors.filter(m => m.group_id === groupId)
  }
  
  const onlineCount = monitors.filter(m => m.status === 'online').length
  const totalCount = monitors.length
  
  let overall_status = 'operational'
  if (onlineCount === 0 && totalCount > 0) {
    overall_status = 'outage'
  } else if (onlineCount < totalCount) {
    overall_status = 'degraded'
  }
  
  res.json({
    monitors: monitors.map(m => ({
      id: m.id,
      name: m.name,
      url: m.url,
      status: m.status,
      last_check: m.last_check,
      response_time: m.response_time,
      uptime_24h: m.uptime_24h,
      uptime_7d: m.uptime_7d,
      uptime_30d: m.uptime_30d,
      group_name: m.group_name
    })),
    overall_status,
    last_updated: new Date().toISOString(),
    group_id: groupId || 'all'
  })
})

// Rotas públicas por slug
// Rota pública para status por slug de grupo
app.get('/api/public/status/group/:slug', async (req, res) => {
  try {
    const { slug } = req.params
    
    // Buscar grupo pelo slug
    const groups = await databaseService.getGroups()
    const group = groups.find(g => g.slug === slug)
    
    if (!group) {
      return res.status(404).json({ error: 'Grupo não encontrado' })
    }
    
    let monitors = monitoringService.getMonitors()
    monitors = monitors.filter(m => m.group_id === group.id)
    
    const onlineCount = monitors.filter(m => m.status === 'online').length
    const totalCount = monitors.length
    
    let overall_status = 'operational'
    if (onlineCount === 0 && totalCount > 0) {
      overall_status = 'outage'
    } else if (onlineCount < totalCount) {
      overall_status = 'degraded'
    }
    
    res.json({
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        slug: group.slug
      },
      monitors: monitors.map(m => ({
        id: m.id,
        name: m.name,
        url: m.url,
        status: m.status,
        last_check: m.last_check,
        response_time: m.response_time,
        uptime_24h: m.uptime_24h,
        uptime_7d: m.uptime_7d,
        uptime_30d: m.uptime_30d
      })),
      overall_status,
      last_updated: new Date().toISOString()
    })
  } catch (error) {
    console.error('Erro ao buscar status por slug do grupo:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Rota pública para status por slug de monitor
app.get('/api/public/status/monitor/:slug', async (req, res) => {
  try {
    const { slug } = req.params
    
    // Buscar monitor pelo slug
    const monitors = await databaseService.getMonitors()
    const monitor = monitors.find(m => m.slug === slug)
    
    if (!monitor) {
      return res.status(404).json({ error: 'Monitor não encontrado' })
    }
    
    const monitorStatus = monitoringService.getMonitor(monitor.id)
    
    res.json({
      monitor: {
        id: monitor.id,
        name: monitor.name,
        url: monitor.url,
        slug: monitor.slug,
        logo_url: monitor.logo_url,
        status: monitorStatus?.status || 'unknown',
        last_check: monitorStatus?.last_check,
        response_time: monitorStatus?.response_time,
        uptime_24h: monitorStatus?.uptime_24h || 0,
        uptime_7d: monitorStatus?.uptime_7d || 0,
        uptime_30d: monitorStatus?.uptime_30d || 0
      },
      overall_status: monitorStatus?.status === 'online' ? 'operational' : 'outage',
      last_updated: new Date().toISOString()
    })
  } catch (error) {
    console.error('Erro ao buscar status por slug do monitor:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Rota pública para obter histórico de checks de um monitor
app.get('/api/public/monitors/:id/checks', async (req, res) => {
  try {
    const { id } = req.params
    const { limit = 100 } = req.query
    
    // Verificar se o monitor existe e está ativo
    const monitor = await databaseService.getMonitorById(id)
    if (!monitor || !monitor.is_active) {
      return res.status(404).json({ error: 'Monitor não encontrado' })
    }
    
    // Buscar checks do banco de dados
    const checks = await databaseService.getMonitorChecks(id, Number(limit))
    
    // Filtrar apenas dados necessários para o público
    const publicChecks = checks.map(check => ({
      status: check.status,
      response_time: check.response_time,
      checked_at: check.checked_at
    }))
    
    res.json(publicChecks)
  } catch (error) {
    console.error('Erro ao buscar checks públicos:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.get('/api/public/incidents', async (req, res) => {
  try {
    const { limit = 10, days = 7 } = req.query
    const monitors = await databaseService.getMonitors()
    const incidents = []
    
    // Analisar cada monitor para identificar incidentes reais
    for (const monitor of monitors) {
      const checks = await databaseService.getMonitorChecks(monitor.id, parseInt(days as string) * 24 * 2)
      
      if (checks.length === 0) continue
      
      // Ordenar checks por data (mais antigos primeiro)
      const sortedChecks = checks.sort((a, b) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime())
      
      let currentIncident = null
      let incidentId = 1
      
      for (let i = 0; i < sortedChecks.length; i++) {
        const check = sortedChecks[i]
        const isDown = check.status !== 'online'
        
        if (isDown && !currentIncident) {
          // Início de um novo incidente
          currentIncident = {
            id: `${monitor.id}-${incidentId++}`,
            monitor_name: monitor.name,
            status: 'investigating',
            title: getIncidentTitle(check.status, monitor.name),
            description: getIncidentDescription(check.status, check.error_message, monitor.name),
            started_at: check.checked_at,
            resolved_at: null as string | null
          }
        } else if (!isDown && currentIncident) {
          // Fim do incidente
          currentIncident.status = 'resolved'
          currentIncident.resolved_at = check.checked_at
          incidents.push(currentIncident)
          currentIncident = null
        }
      }
      
      // Se ainda há um incidente em andamento
      if (currentIncident) {
        // Verificar se o monitor está atualmente online
        const latestCheck = sortedChecks[sortedChecks.length - 1]
        if (latestCheck.status === 'online') {
          currentIncident.status = 'resolved'
          currentIncident.resolved_at = latestCheck.checked_at
        } else {
          // Incidente ainda em andamento
          const monitorStatus = monitoringService.getMonitor(monitor.id)
          if (monitorStatus?.status === 'online') {
            currentIncident.status = 'resolved'
            currentIncident.resolved_at = new Date().toISOString()
          }
        }
        incidents.push(currentIncident)
      }
    }
    
    // Ordenar incidentes por data de início (mais recentes primeiro)
    const sortedIncidents = incidents
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      .slice(0, parseInt(limit as string))
    
    res.json(sortedIncidents)
  } catch (error) {
    console.error('Erro ao buscar incidentes:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Funções auxiliares para gerar títulos e descrições de incidentes
function getIncidentTitle(status: string, monitorName: string): string {
  switch (status) {
    case 'offline':
      return `Interrupção do serviço - ${monitorName}`
    case 'warning':
      return `Degradação do serviço - ${monitorName}`
    default:
      return `Problema detectado - ${monitorName}`
  }
}

function getIncidentDescription(status: string, errorMessage: string | null, monitorName: string): string {
  let baseDescription = ''
  
  switch (status) {
    case 'offline':
      baseDescription = `O serviço ${monitorName} está temporariamente indisponível`
      break
    case 'warning':
      baseDescription = `O serviço ${monitorName} apresenta degradação de performance`
      break
    default:
      baseDescription = `Foi detectado um problema no serviço ${monitorName}`
  }
  
  if (errorMessage) {
    // Sanitizar mensagem de erro para exibição pública
    const sanitizedError = errorMessage
      .replace(/ENOTFOUND|ECONNREFUSED|ETIMEDOUT/g, 'erro de conectividade')
      .replace(/timeout/gi, 'tempo limite excedido')
      .replace(/connection/gi, 'conexão')
    
    baseDescription += `. Detalhes técnicos: ${sanitizedError}`
  }
  
  return baseDescription
}

// Rota de health check
app.get('/api/health', (_, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})


// Middleware de tratamento de erros
app.use((err: any, _: any, res: any, __: any) => {
  console.error('Erro:', err)
  res.status(500).json({ error: 'Erro interno do servidor' })
})

// Rota 404
app.use('*', (_, res) => {
  res.status(404).json({ error: 'Rota não encontrada' })
})

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`)
  console.log(`📊 Dashboard: http://localhost:3000`)
  console.log(`🔗 API: http://localhost:${PORT}/api`)
  console.log(`📈 Status público: http://localhost:3000/status`)
  console.log(`💡 Credenciais de teste: admin@agencia.com / admin123`)
  
  // Iniciar o serviço de monitoramento
  monitoringService.start()
  console.log(`🔍 Serviço de monitoramento iniciado`)
})

export default app