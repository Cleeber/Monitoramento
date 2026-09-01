import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types.js'

let _supabase: SupabaseClient<Database> | null = null

// Função para obter o cliente Supabase (lazy loading)
function getSupabaseClient(): SupabaseClient<Database> {
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

  _supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  return _supabase
}

// Cliente Supabase com service role para operações administrativas
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop) {
    return getSupabaseClient()[prop as keyof SupabaseClient<Database>]
  }
})

// Re-exporta os tipos gerados do schema para uso no resto do backend.
// Estes são os mesmos tipos usados pelo frontend (em `client/lib/supabase.ts`),
// garantindo que ambos os lados enxergam a mesma forma do banco.
export type { Database, TablesInsert, TablesUpdate, Enums } from './database.types.js'

// Aliases de conveniência para o estilo antigo `Tables<'monitors'>` etc.
// (continuam funcionando, mas agora vêm do tipo gerado)
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type Inserts<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type Updates<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
