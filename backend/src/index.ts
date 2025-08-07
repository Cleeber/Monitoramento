import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import MonitoringService from './monitoring/MonitoringService.js'
import { databaseService } from './services/DatabaseService.js'

// Carregar variáveis de ambiente
dotenv.config()

const app = express()
const PORT = process.env.PORT || 8080
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

// Inicializar dados padrão
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
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
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

app.get('/api/dashboard/monitors', authenticateToken, (req, res) => {
  const monitors = monitoringService.getMonitors()
  res.json(monitors)
})

// Rotas de monitores
app.get('/api/monitors', authenticateToken, async (req, res) => {
  try {
    const monitors = await databaseService.getMonitors()
    res.json(monitors)
  } catch (error) {
    console.error('Erro ao buscar monitores:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.post('/api/monitors', authenticateToken, async (req, res) => {
  try {
    const { name, url, type, interval, timeout, group_id, enabled = true } = req.body
    
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
      is_active: enabled
    })
    
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

app.put('/api/monitors/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { name, url, type, interval, timeout, group_id, is_active } = req.body
    
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
      is_active
    })
    
    if (!updatedMonitor) {
      return res.status(404).json({ error: 'Monitor não encontrado' })
    }
    
    // Atualizar no serviço de monitoramento
    monitoringService.updateMonitor(id, {
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
    
    const success = await databaseService.deleteMonitor(id)
    if (!success) {
      return res.status(404).json({ error: 'Monitor não encontrado' })
    }
    
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
app.get('/api/groups', authenticateToken, async (req, res) => {
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
    const { name, description } = req.body
    
    if (!name) {
      return res.status(400).json({ error: 'Nome é obrigatório' })
    }
    
    const newGroup = await databaseService.createGroup({
      name,
      description: description || ''
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
    const { name, description } = req.body
    
    const updatedGroup = await databaseService.updateGroup(id, {
      name,
      description
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
    
    const success = await databaseService.deleteGroup(id)
    if (!success) {
      return res.status(404).json({ error: 'Grupo não encontrado' })
    }
    
    res.json({ message: 'Grupo removido com sucesso' })
  } catch (error) {
    console.error('Erro ao remover grupo:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Rotas de configuração SMTP
app.get('/api/smtp-config', authenticateToken, async (req, res) => {
  try {
    const config = await databaseService.getSmtpConfig()
    if (!config) {
      // Retornar configuração padrão das variáveis de ambiente
      return res.json({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || ''
      })
    }
    
    res.json({
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user
    })
  } catch (error) {
    console.error('Erro ao buscar configuração SMTP:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.put('/api/smtp-config', authenticateToken, async (req, res) => {
  try {
    const { host, port, secure, user, pass } = req.body
    
    const config = await databaseService.updateSmtpConfig({
      host,
      port: parseInt(port),
      secure,
      user,
      pass
    })
    
    res.json({
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user
    })
  } catch (error) {
    console.error('Erro ao atualizar configuração SMTP:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

app.post('/api/smtp-config/test', authenticateToken, (req, res) => {
  // Simular teste de SMTP
  setTimeout(() => {
    res.json({ success: true, message: 'E-mail de teste enviado com sucesso!' })
  }, 1000)
})

// Rotas de relatórios
app.get('/api/reports/stats', authenticateToken, (req, res) => {
  const monitors = monitoringService.getMonitors()
  const stats = {
    avg_uptime: Math.round(monitors.reduce((acc, m) => acc + m.uptime_30d, 0) / monitors.length * 100) / 100,
    total_checks: monitors.length * 30 * 24, // Simulado
    total_incidents: 5, // Simulado
    avg_response_time: Math.round(monitors.reduce((acc, m) => acc + (m.response_time || 0), 0) / monitors.length)
  }
  res.json(stats)
})

app.get('/api/reports/monitors', authenticateToken, (req, res) => {
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

app.get('/api/reports/export', authenticateToken, (req, res) => {
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
app.get('/api/public/groups', async (req, res) => {
  try {
    const groups = await databaseService.getGroups()
    res.json(groups.map(g => ({
      id: g.id,
      name: g.name,
      description: g.description
    })))
  } catch (error) {
    console.error('Erro ao buscar grupos públicos:', error)
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

app.get('/api/public/incidents', (req, res) => {
  // Dados simulados de incidentes
  const incidents = [
    {
      id: '1',
      monitor_name: 'Site Principal',
      status: 'resolved',
      title: 'Lentidão no carregamento',
      description: 'Site apresentou lentidão temporária devido a alta demanda',
      started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      resolved_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
    }
  ]
  res.json(incidents)
})

// Rota de health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// Middleware de tratamento de erros
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Erro:', err)
  res.status(500).json({ error: 'Erro interno do servidor' })
})

// Rota 404
app.use('*', (req, res) => {
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