/**
 * Tipos do banco de dados Supabase, gerados automaticamente a partir do schema.
 *
 * Para regenerar:
 *   npx supabase gen types typescript --project-id zhywrrzzezexlvtpqacl > src/lib/database.types.ts
 * (ou use o MCP `generate_typescript_types` se disponível)
 *
 * Este arquivo é importado por `src/lib/supabase.ts` (backend) e por
 * `client/lib/supabase.ts` (frontend) para garantir que ambos os lados
 * usem exatamente a mesma tipagem derivada do schema real.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      monitor_checks: {
        Row: {
          checked_at: string | null
          error_message: string | null
          id: string
          monitor_id: string | null
          response_time: number | null
          status: string
          status_code: number | null
        }
        Insert: {
          checked_at?: string | null
          error_message?: string | null
          id?: string
          monitor_id?: string | null
          response_time?: number | null
          status: string
          status_code?: number | null
        }
        Update: {
          checked_at?: string | null
          error_message?: string | null
          id?: string
          monitor_id?: string | null
          response_time?: number | null
          status?: string
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "monitor_checks_monitor_id_fkey"
            columns: ["monitor_id"]
            isOneToOne: false
            referencedRelation: "monitors"
            referencedColumns: ["id"]
          },
        ]
      }
      monitors: {
        Row: {
          content_validation_enabled: boolean | null
          created_at: string | null
          id: string
          ignore_http_403: boolean | null
          interval: number
          is_active: boolean
          last_check: string | null
          logo_url: string | null
          min_content_length: number | null
          min_text_length: number | null
          name: string
          report_email: string | null
          report_send_day: number | null
          report_send_time: string | null
          response_time: number | null
          slug: string | null
          status: string | null
          timeout: number
          type: string
          updated_at: string | null
          uptime_24h: number | null
          uptime_30d: number | null
          uptime_7d: number | null
          url: string
          // Novos campos de validação
          expected_status_codes: number[] | null
          expected_keywords: string[] | null
          forbidden_keywords: string[] | null
          api_health_enabled: boolean | null
          api_health_path: string | null
          api_health_expected_status: number | null
          api_health_expected_body: string | null
          check_ssl: boolean | null
          content_pattern_ok: string | null
          content_pattern_fail: string | null
          require_css: boolean | null
          require_js: boolean | null
          require_html: boolean | null
          response_time_warning_ms: number | null
          response_time_critical_ms: number | null
        }
        Insert: {
          content_validation_enabled?: boolean | null
          created_at?: string | null
          id?: string
          ignore_http_403?: boolean | null
          interval?: number
          is_active?: boolean
          last_check?: string | null
          logo_url?: string | null
          min_content_length?: number | null
          min_text_length?: number | null
          name: string
          report_email?: string | null
          report_send_day?: number | null
          report_send_time?: string | null
          response_time?: number | null
          slug?: string | null
          status?: string | null
          timeout?: number
          type?: string
          updated_at?: string | null
          uptime_24h?: number | null
          uptime_30d?: number | null
          uptime_7d?: number | null
          url: string
          // Novos campos de validação
          expected_status_codes?: number[] | null
          expected_keywords?: string[] | null
          forbidden_keywords?: string[] | null
          api_health_enabled?: boolean | null
          api_health_path?: string | null
          api_health_expected_status?: number | null
          api_health_expected_body?: string | null
          check_ssl?: boolean | null
          content_pattern_ok?: string | null
          content_pattern_fail?: string | null
          require_css?: boolean | null
          require_js?: boolean | null
          require_html?: boolean | null
          response_time_warning_ms?: number | null
          response_time_critical_ms?: number | null
        }
        Update: {
          content_validation_enabled?: boolean | null
          created_at?: string | null
          id?: string
          ignore_http_403?: boolean | null
          interval?: number
          is_active?: boolean
          last_check?: string | null
          logo_url?: string | null
          min_content_length?: number | null
          min_text_length?: number | null
          name?: string
          report_email?: string | null
          report_send_day?: number | null
          report_send_time?: string | null
          response_time?: number | null
          slug?: string | null
          status?: string | null
          timeout?: number
          type?: string
          updated_at?: string | null
          uptime_24h?: number | null
          uptime_30d?: number | null
          uptime_7d?: number | null
          url?: string
          // Novos campos de validação
          expected_status_codes?: number[] | null
          expected_keywords?: string[] | null
          forbidden_keywords?: string[] | null
          api_health_enabled?: boolean | null
          api_health_path?: string | null
          api_health_expected_status?: number | null
          api_health_expected_body?: string | null
          check_ssl?: boolean | null
          content_pattern_ok?: string | null
          content_pattern_fail?: string | null
          require_css?: boolean | null
          require_js?: boolean | null
          require_html?: boolean | null
          response_time_warning_ms?: number | null
          response_time_critical_ms?: number | null
        }
        Relationships: []
      }
      monthly_report_configs: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          monitor_id: string | null
          send_day: number | null
          send_time: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          monitor_id?: string | null
          send_day?: number | null
          send_time?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          monitor_id?: string | null
          send_day?: number | null
          send_time?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_report_configs_monitor_id_fkey"
            columns: ["monitor_id"]
            isOneToOne: false
            referencedRelation: "monitors"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_report_history: {
        Row: {
          avg_response_time: number | null
          config_id: string | null
          created_at: string | null
          email: string
          error_message: string | null
          id: string
          monitor_id: string
          report_month: number
          report_period_end: string | null
          report_period_start: string | null
          report_year: number
          sent_at: string | null
          status: string | null
          successful_checks: number | null
          total_checks: number | null
          uptime_percentage: number | null
        }
        Insert: {
          avg_response_time?: number | null
          config_id?: string | null
          created_at?: string | null
          email: string
          error_message?: string | null
          id?: string
          monitor_id: string
          report_month: number
          report_period_end?: string | null
          report_period_start?: string | null
          report_year: number
          sent_at?: string | null
          status?: string | null
          successful_checks?: number | null
          total_checks?: number | null
          uptime_percentage?: number | null
        }
        Update: {
          avg_response_time?: number | null
          config_id?: string | null
          created_at?: string | null
          email?: string
          error_message?: string | null
          id?: string
          monitor_id?: string
          report_month?: number
          report_period_end?: string | null
          report_period_start?: string | null
          report_year?: number
          sent_at?: string | null
          status?: string | null
          successful_checks?: number | null
          total_checks?: number | null
          uptime_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_report_history_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "monthly_report_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_report_history_monitor_id_fkey"
            columns: ["monitor_id"]
            isOneToOne: false
            referencedRelation: "monitors"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          data: Json
          generated_at: string | null
          id: string
          monitor_id: string | null
          period: string
          type: string
        }
        Insert: {
          data: Json
          generated_at?: string | null
          id?: string
          monitor_id?: string | null
          period: string
          type: string
        }
        Update: {
          data?: Json
          generated_at?: string | null
          id?: string
          monitor_id?: string | null
          period?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_monitor_id_fkey"
            columns: ["monitor_id"]
            isOneToOne: false
            referencedRelation: "monitors"
            referencedColumns: ["id"]
          },
        ]
      }
      smtp_config: {
        Row: {
          created_at: string | null
          from_email: string | null
          from_name: string | null
          host: string
          id: string
          is_configured: boolean | null
          pass: string
          port: number
          secure: boolean | null
          updated_at: string | null
          user: string
        }
        Insert: {
          created_at?: string | null
          from_email?: string | null
          from_name?: string | null
          host: string
          id?: string
          is_configured?: boolean | null
          pass: string
          port: number
          secure?: boolean | null
          updated_at?: string | null
          user: string
        }
        Update: {
          created_at?: string | null
          from_email?: string | null
          from_name?: string | null
          host?: string
          id?: string
          is_configured?: boolean | null
          pass?: string
          port?: number
          secure?: boolean | null
          updated_at?: string | null
          user?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
          password: string
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name: string
          password: string
          role?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          password?: string
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_unique_slug: {
        Args: { base_slug: string; exclude_id?: string; table_name: string }
        Returns: string
      }
      exec_sql: { Args: { sql: string }; Returns: undefined }
      generate_slug: { Args: { input_text: string }; Returns: string }
      get_table_columns: {
        Args: { table_name: string }
        Returns: {
          columns: Json
        }[]
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
