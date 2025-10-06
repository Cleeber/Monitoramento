import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis de ambiente do Supabase não configuradas')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
          group_id: string | null
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
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          group_id?: string | null
          name: string
          url: string
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
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          group_id?: string | null
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
          password: string
          from_name: string
          from_email: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          host: string
          port: number
          secure?: boolean
          user: string
          password: string
          from_name: string
          from_email: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          host?: string
          port?: number
          secure?: boolean
          user?: string
          password?: string
          from_name?: string
          from_email?: string
          is_active?: boolean
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
          failed_checks: number
          avg_response_time: number
          pdf_path: string | null
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
          failed_checks: number
          avg_response_time: number
          pdf_path?: string | null
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
          failed_checks?: number
          avg_response_time?: number
          pdf_path?: string | null
        }
      }
    }
  }
}