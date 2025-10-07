import { createClient } from '@supabase/supabase-js'

let _supabase: any = null

// Função para obter o cliente Supabase (lazy loading)
function getSupabaseClient() {
  if (_supabase) {
    return _supabase
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('SUPABASE_URL:', supabaseUrl)
    console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'SET' : 'NOT SET')
    throw new Error('Variáveis de ambiente do Supabase não configuradas no backend')
  }

  _supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  return _supabase
}

// Cliente Supabase com service role para operações administrativas
export const supabase = new Proxy({} as any, {
  get(_, prop) {
    return getSupabaseClient()[prop]
  }
})

// Tipos para o banco de dados
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          password_hash: string
          name: string
          role: 'admin' | 'user'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          password_hash: string
          name: string
          role?: 'admin' | 'user'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          password_hash?: string
          name?: string
          role?: 'admin' | 'user'
          updated_at?: string
        }
      }
      groups: {
        Row: {
          id: string
          name: string
          description: string | null
          slug: string | null
          notification_emails: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          slug?: string | null
          notification_emails?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          slug?: string | null
          notification_emails?: string[]
          updated_at?: string
        }
      }
      monitors: {
        Row: {
          id: string
          group_id: string
          name: string
          url: string
          slug: string | null
          type: 'http' | 'ping' | 'tcp'
          interval: number
          timeout: number
          status: 'online' | 'offline' | 'warning' | 'unknown'
          last_check: string | null
          response_time: number | null
          uptime_24h: number
          uptime_7d: number
          uptime_30d: number
          error_message: string | null
          created_at: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          group_id: string
          name: string
          url: string
          slug?: string | null
          type: 'http' | 'ping' | 'tcp'
          interval?: number
          timeout?: number
          status?: 'online' | 'offline' | 'warning' | 'unknown'
          last_check?: string | null
          response_time?: number | null
          uptime_24h?: number
          uptime_7d?: number
          uptime_30d?: number
          error_message?: string | null
          created_at?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          name?: string
          url?: string
          slug?: string | null
          type?: 'http' | 'ping' | 'tcp'
          interval?: number
          timeout?: number
          status?: 'online' | 'offline' | 'warning' | 'unknown'
          last_check?: string | null
          response_time?: number | null
          uptime_24h?: number
          uptime_7d?: number
          uptime_30d?: number
          error_message?: string | null
          is_active?: boolean
          updated_at?: string
        }
      }
      monitor_checks: {
        Row: {
          id: string
          monitor_id: string
          status: 'online' | 'offline' | 'warning'
          response_time: number | null
          error_message: string | null
          checked_at: string
        }
        Insert: {
          id?: string
          monitor_id: string
          status: 'online' | 'offline' | 'warning'
          response_time?: number | null
          error_message?: string | null
          checked_at?: string
        }
        Update: {
          id?: string
          monitor_id?: string
          status?: 'online' | 'offline' | 'warning'
          response_time?: number | null
          error_message?: string | null
          checked_at?: string
        }
      }
      smtp_config: {
        Row: {
          id: string
          host: string
          port: number
          secure: boolean
          user: string
          pass: string
          from_name: string
          from_email: string
          is_configured: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          host?: string
          port?: number
          secure?: boolean
          user?: string
          pass?: string
          from_name?: string
          from_email?: string
          is_configured?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          host?: string
          port?: number
          secure?: boolean
          user?: string
          pass?: string
          from_name?: string
          from_email?: string
          is_configured?: boolean
          updated_at?: string
        }
      }
      reports: {
        Row: {
          id: string
          group_id: string
          month: string
          year: number
          uptime_percentage: number
          total_checks: number
          successful_checks: number
          avg_response_time: number
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          month: string
          year: number
          uptime_percentage: number
          total_checks: number
          successful_checks: number
          avg_response_time: number
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          month?: string
          year?: number
          uptime_percentage?: number
          total_checks?: number
          successful_checks?: number
          avg_response_time?: number
        }
      }
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']