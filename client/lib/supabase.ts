import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias no build do frontend')
}

// Cliente Supabase para o frontend, usando a anon key (sujeita a RLS).
// Em produção unificada, o frontend prefere chamar a API do próprio backend em
// `/api/...` (mesma origem). O cliente aqui fica disponível para usos
// específicos que precisem de acesso direto (ex.: realtime de status pages).
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Re-exporta os tipos gerados a partir do schema real do Supabase.
// Estes são os mesmos tipos usados pelo backend, garantindo paridade.
// O arquivo vive em `src/lib/database.types.ts` (lado do servidor); como é
// puramente tipos TypeScript, pode ser importado pelo Vite sem custo no bundle.
export type { Database, Tables, TablesInsert, TablesUpdate, Enums } from '../../src/lib/database.types'

// Aliases de conveniência
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type Inserts<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type Updates<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
