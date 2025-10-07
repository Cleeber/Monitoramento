import { supabase, Updates } from '../lib/supabase.js'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

export class DatabaseService {
  // ===== USERS =====
  async getUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  }

  async getUserByEmail(email: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()
    
    if (error && error.code !== 'PGRST116') throw error
    return data
  }

  async getUserById(id: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error && error.code !== 'PGRST116') throw error
    return data
  }

  async createUser(userData: { email: string; password: string; name: string; role?: 'admin' | 'user' }) {
    const passwordHash = await bcrypt.hash(userData.password, 10)
    
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: uuidv4(),
        email: userData.email,
        password_hash: passwordHash,
        name: userData.name,
        role: userData.role || 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  async updateUser(id: string, updates: Updates<'users'>) {
    const { data, error } = await (supabase as any)
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  async deleteUser(id: string) {
    const { error } = await (supabase as any)
      .from('users')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }

  // ===== GROUPS =====
  async getGroups() {
    const { data, error } = await (supabase as any)
      .from('groups')
      .select(`
        *,
        monitors:monitors(count)
      `)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    // Adicionar contagem de monitores
    return (data || []).map((group: any) => ({
      ...group,
      monitor_count: group.monitors?.[0]?.count || 0
    }))
  }

  async getGroupById(id: string) {
    const { data, error } = await (supabase as any)
      .from('groups')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  }

  async createGroup(groupData: { name: string; description?: string; slug?: string }) {
    const { data, error } = await (supabase as any)
      .from('groups')
      .insert({
        id: uuidv4(),
        name: groupData.name,
        description: groupData.description || null,
        slug: groupData.slug,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  async updateGroup(id: string, updates: { name?: string; description?: string; slug?: string }) {
    const { data, error } = await (supabase as any)
      .from('groups')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  async deleteGroup(id: string) {
    // Verificar se há monitores usando este grupo
    const { data: monitors } = await (supabase as any)
      .from('monitors')
      .select('id')
      .eq('group_id', id)
    
    if (monitors && monitors.length > 0) {
      throw new Error('Não é possível excluir grupo com monitores associados')
    }

    const { error } = await (supabase as any)
      .from('groups')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }

  // ===== MONITORS =====
  async getMonitors() {
    const { data, error } = await (supabase as any)
      .from('monitors')
      .select(`
        *,
        groups:group_id(name)
      `)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    // Adicionar nome do grupo
    return (data || []).map((monitor: any) => ({
      ...monitor,
      group_name: monitor.groups?.name || 'Sem grupo',
      enabled: monitor.is_active
    }))
  }

  async getMonitorById(id: string) {
    const { data, error } = await (supabase as any)
      .from('monitors')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  }

  async createMonitor(monitorData: {
    name: string
    url: string
    type: 'http' | 'ping' | 'tcp'
    interval?: number
    timeout?: number
    group_id?: string | null
    slug?: string
    is_active?: boolean
    logo_url?: string | null
    report_email?: string
    report_send_day?: number
    report_send_time?: string
  }) {
    const { data, error } = await (supabase as any)
      .from('monitors')
      .insert({
        id: uuidv4(),
        name: monitorData.name,
        url: monitorData.url,
        type: monitorData.type,
        interval: monitorData.interval || 60000,
        timeout: monitorData.timeout || 30000,
        group_id: monitorData.group_id,
        slug: monitorData.slug,
        logo_url: monitorData.logo_url,
        report_email: monitorData.report_email || null,
        report_send_day: monitorData.report_send_day || 1,
        report_send_time: monitorData.report_send_time || '09:00',
        status: 'unknown',
        uptime_24h: 0,
        uptime_7d: 0,
        uptime_30d: 0,
        is_active: monitorData.is_active !== false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  async updateMonitor(id: string, updates: Updates<'monitors'>) {
    const { data, error } = await (supabase as any)
      .from('monitors')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  async deleteMonitor(id: string) {
    // Deletar checks relacionados primeiro
    await (supabase as any)
      .from('monitor_checks')
      .delete()
      .eq('monitor_id', id)

    const { error } = await (supabase as any)
      .from('monitors')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }

  // ===== MONITOR CHECKS =====
  async getMonitorChecks(monitorId: string, limit: number = 50) {
    const { data, error } = await (supabase as any)
      .from('monitor_checks')
      .select('*')
      .eq('monitor_id', monitorId)
      .order('checked_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    return data || []
  }

  async getMonitorChecksForPeriod(monitorId: string, startDate: Date, endDate: Date) {
    // Remover limitação padrão de 1000 linhas do Supabase
    // Definir um limite maior para obter todos os registros do período
    const { data, error } = await (supabase as any)
      .from('monitor_checks')
      .select('*')
      .eq('monitor_id', monitorId)
      .gte('checked_at', startDate.toISOString())
      .lte('checked_at', endDate.toISOString())
      .order('checked_at', { ascending: true })
      .limit(100000) // Limite alto para garantir que todos os registros sejam retornados
    
    if (error) throw error
    return data || []
  }

  async createMonitorCheck(checkData: {
    monitor_id: string
    status: 'online' | 'offline' | 'warning'
    response_time?: number
    error_message?: string
  }) {
    const { data, error } = await (supabase as any)
      .from('monitor_checks')
      .insert({
        id: uuidv4(),
        monitor_id: checkData.monitor_id,
        status: checkData.status,
        response_time: checkData.response_time || null,
        error_message: checkData.error_message || null,
        checked_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // ===== MONTHLY REPORT CONFIGS =====
  async getMonthlyReportConfigs() {
    const { data, error } = await (supabase as any)
      .from('monthly_report_configs')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  }

  // Adicionado: buscar configuração de relatório mensal por ID (necessário para reagendamento após delete/update)
  async getMonthlyReportConfigById(id: string) {
    const { data, error } = await (supabase as any)
      .from('monthly_report_configs')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error && error.code !== 'PGRST116') throw error
    return data
  }

  async getMonthlyReportConfigByMonitor(monitorId: string) {
    const { data, error } = await (supabase as any)
      .from('monthly_report_configs')
      .select('*')
      .eq('monitor_id', monitorId)
      .single()
    
    if (error && error.code !== 'PGRST116') throw error
    return data
  }

  async createMonthlyReportConfig(configData: {
    monitor_id: string
    email: string
    send_day: number
    is_active?: boolean
  }) {
    const { data, error } = await (supabase as any)
      .from('monthly_report_configs')
      .insert({
        id: uuidv4(),
        monitor_id: configData.monitor_id,
        email: configData.email,
        send_day: configData.send_day,
        is_active: configData.is_active ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  async updateMonthlyReportConfig(id: string, updates: {
    email?: string
    send_day?: number
    is_active?: boolean
  }) {
    const { data, error } = await (supabase as any)
      .from('monthly_report_configs')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  async deleteMonthlyReportConfig(id: string) {
    const { error } = await (supabase as any)
      .from('monthly_report_configs')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    return true
  }

  async getMonthlyReportHistory(filters?: {
    monitor_id?: string
    year?: number
    month?: number
    limit?: number
  }) {
    let query = (supabase as any)
      .from('monthly_report_history')
      .select('*')
      .order('sent_at', { ascending: false })
    
    if (filters?.monitor_id) {
      query = query.eq('monitor_id', filters.monitor_id)
    }
    if (filters?.year && filters?.month) {
      // Filtrar por período específico
      const startDate = new Date(filters.year, filters.month - 1, 1)
      const endDate = new Date(filters.year, filters.month, 0)
      query = query
        .gte('report_period_start', startDate.toISOString().split('T')[0])
        .lte('report_period_end', endDate.toISOString().split('T')[0])
    } else if (filters?.year) {
      // Filtrar apenas por ano
      const startDate = new Date(filters.year, 0, 1)
      const endDate = new Date(filters.year, 11, 31)
      query = query
        .gte('report_period_start', startDate.toISOString().split('T')[0])
        .lte('report_period_end', endDate.toISOString().split('T')[0])
    }
    if (filters?.limit) {
      query = query.limit(filters.limit)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    return data || []
  }

  async createMonthlyReportHistory(historyData: {
    monitor_id: string
    email: string
    year: number
    month: number
    report_data: any
    sent_at: string
    status: 'sent' | 'failed'
    error_message?: string
  }) {
    // Calcular período do relatório
    const startDate = new Date(historyData.year, historyData.month - 1, 1)
    const endDate = new Date(historyData.year, historyData.month, 0)
    
    const { data, error } = await (supabase as any)
      .from('monthly_report_history')
      .insert({
        id: uuidv4(),
        monitor_id: historyData.monitor_id,
        email: historyData.email,
        report_period_start: startDate.toISOString().split('T')[0],
        report_period_end: endDate.toISOString().split('T')[0],
        sent_at: historyData.sent_at,
        status: historyData.status,
        error_message: historyData.error_message
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // ===== SMTP CONFIG =====
  async getSmtpConfig() {
    const { data, error } = await (supabase as any)
      .from('smtp_config')
      .select('*')
      .single()
    
    if (error && error.code !== 'PGRST116') throw error
    return data
  }

  async updateSmtpConfig(config: {
    host?: string
    port?: number
    secure?: boolean
    user?: string
    password?: string
    from_name?: string
    from_email?: string
    is_configured?: boolean
  }) {
    // Verificar se já existe uma configuração
    const existing = await this.getSmtpConfig()
    
    if (existing) {
      const { data, error } = await (supabase as any)
        .from('smtp_config')
        .update({
          host: config.host,
          port: config.port,
          secure: config.secure,
          user: config.user,
          pass: config.password, // Note: coluna é 'pass', não 'password'
          from_name: config.from_name,
          from_email: config.from_email,
          is_configured: config.is_configured,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single()
      
      if (error) throw error
      return data
    } else {
      const { data, error } = await (supabase as any)
        .from('smtp_config')
        .insert({
          id: uuidv4(),
          host: config.host || '',
          port: config.port || 587,
          secure: config.secure || false,
          user: config.user || '',
          pass: config.password || '', // Note: coluna é 'pass', não 'password'
          from_name: config.from_name || 'Uptime Monitor',
          from_email: config.from_email || '',
          is_configured: config.is_configured || false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (error) throw error
      return data
    }
  }

  // ===== REPORTS =====
  async getReports(filters?: { group_id?: string; period?: string }) {
    let query = (supabase as any)
      .from('reports')
      .select(`
        *,
        groups:group_id(name)
      `)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
    
    if (filters?.group_id && filters.group_id !== 'all') {
      query = query.eq('group_id', filters.group_id)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    return data || []
  }

  async createReport(reportData: {
    group_id: string
    month: string
    year: number
    uptime_percentage: number
    total_checks: number
    successful_checks: number
    avg_response_time: number
  }) {
    const { data, error } = await (supabase as any)
      .from('reports')
      .insert({
        id: uuidv4(),
        ...reportData,
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // ===== MONITORING LOGS =====
  async countMonitoringLogs(): Promise<number> {
    const { count, error } = await (supabase as any)
      .from('monitor_checks')
      .select('*', { count: 'exact', head: true })
    
    if (error) throw error
    return count || 0
  }

  async deleteOldMonitoringLogs(beforeDate: Date): Promise<number> {
    const { data, error } = await supabase
      .from('monitor_checks')
      .delete()
      .lt('checked_at', beforeDate.toISOString())
      .select('id')
    
    if (error) throw error
    return data?.length || 0
  }
}

export const databaseService = new DatabaseService()