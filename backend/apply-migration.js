import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Variáveis de ambiente do Supabase não encontradas')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigration() {
  try {
    console.log('Lendo arquivo de migração...')
    const sql = fs.readFileSync('./database/migration-grupos.sql', 'utf8')
    
    console.log('Aplicando migração...')
    
    // Executar cada comando SQL separadamente
    const commands = sql.split(';').filter(cmd => cmd.trim().length > 0)
    
    for (const command of commands) {
      if (command.trim()) {
        console.log('Executando:', command.trim().substring(0, 50) + '...')
        const { error } = await supabase.rpc('exec_sql', { sql: command.trim() })
        if (error) {
          console.error('Erro ao executar comando:', error)
        } else {
          console.log('✓ Comando executado com sucesso')
        }
      }
    }
    
    console.log('🎉 Migração aplicada com sucesso!')
  } catch (error) {
    console.error('Erro na migração:', error)
    process.exit(1)
  }
}

applyMigration()