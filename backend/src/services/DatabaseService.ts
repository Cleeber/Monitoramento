import { supabase, Tables, Inserts, Updates } from '../lib/supabase.js'
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
    const { data, error } = await supabase
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
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }

  // ===== GROUPS =====
  async getGroups() {
    const { data, error } = await supabase
      .from('groups')
      .select(`
        *,
        monitors:monitors(count)
      `)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    // Adicionar contagem de monitores
    return (data || []).map(group => ({
      ...group,
      monitor_count: group.monitors?.[0]?.count || 0
    }))
  }

  async getGroupById(id: string) {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  }

  async createGroup(groupData: { name: string; description?: string; slug?: string }) {
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data: monitors } = await supabase
      .from('monitors')
      .select('id')
      .eq('group_id', id)
    
    if (monitors && monitors.length > 0) {
      throw new Error('Não é possível excluir grupo com monitores associados')
    }

    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }

  // ===== MONITORS =====
  async getMonitors() {
    const { data, error } = await supabase
      .from('monitors')
      .select(`
        *,
        groups:group_id(name)
      `)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    // Adicionar nome do grupo
    return (data || []).map(monitor => ({
      ...monitor,
      group_name: monitor.groups?.name || 'Sem grupo',
      enabled: monitor.is_active
    }))
  }

  async getMonitorById(id: string) {
    const { data, error } = await supabase
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
  }) {
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    await supabase
      .from('monitor_checks')
      .delete()
      .eq('monitor_id', id)

    const { error } = await supabase
      .from('monitors')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }

  // ===== MONITOR CHECKS =====
  async getMonitorChecks(monitorId: string, limit: number = 50) {
    const { data, error } = await supabase
      .from('monitor_checks')
      .select('*')
      .eq('monitor_id', monitorId)
      .order('checked_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    return data || []
  }

  async createMonitorCheck(checkData: {
    monitor_id: string
    status: 'online' | 'offline' | 'warning'
    response_time?: number
    error_message?: string
  }) {
    const { data, error } = await supabase
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

  // ===== SMTP CONFIG =====
  async getSmtpConfig() {
    const { data, error } = await supabase
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
    is_active?: boolean
  }) {
    // Verificar se já existe uma configuração
    const existing = await this.getSmtpConfig()
    
    if (existing) {
      const { data, error } = await supabase
        .from('smtp_config')
        .update({
          ...config,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single()
      
      if (error) throw error
      return data
    } else {
      const { data, error } = await supabase
        .from('smtp_config')
        .insert({
          id: uuidv4(),
          host: config.host || '',
          port: config.port || 587,
          secure: config.secure || false,
          user: config.user || '',
          password: config.password || '',
          from_name: config.from_name || 'Uptime Monitor',
          from_email: config.from_email || '',
          is_active: config.is_active || false,
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
    let query = supabase
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
    const { data, error } = await supabase
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
}

export const databaseService = new DatabaseService()