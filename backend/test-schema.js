// Script para testar o schema no Supabase
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Carregar variáveis de ambiente
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testSchema() {
  try {
    console.log('🔧 Testando conectividade com Supabase...')
    
    // Testar conectividade básica
    const { data: authData, error: authError } = await supabase.auth.getSession()
    
    if (authError) {
      console.log('⚠️  Aviso de autenticação (normal para service key):', authError.message)
    }
    
    console.log('✅ Conectividade com Supabase OK')
    
    // Testar se as tabelas existem
    console.log('🔍 Verificando se as tabelas existem...')
    
    const tables = ['users', 'groups', 'monitors', 'monitor_checks', 'smtp_config', 'reports']
    let allTablesExist = true
    
    for (const table of tables) {
      try {
        const { data: tableData, error: tableError } = await supabase
          .from(table)
          .select('id')
          .limit(1)
        
        if (tableError) {
          if (tableError.code === 'PGRST116' || tableError.message.includes('does not exist')) {
            console.log(`❌ Tabela ${table} não existe - execute o schema.sql no Supabase SQL Editor`)
            allTablesExist = false
          } else {
            console.error(`⚠️  Erro ao acessar tabela ${table}:`, tableError.message)
          }
        } else {
          console.log(`✅ Tabela ${table} existe e está acessível`)
        }
      } catch (err) {
        console.error(`❌ Erro ao verificar tabela ${table}:`, err.message)
        allTablesExist = false
      }
    }
    
    if (!allTablesExist) {
      console.log('\n📋 Para criar as tabelas:')
      console.log('1. Acesse o Supabase Dashboard')
      console.log('2. Vá para SQL Editor')
      console.log('3. Execute o conteúdo do arquivo database/schema.sql')
      console.log('\n📄 O schema foi corrigido e está pronto para execução!')
    }
    
    return allTablesExist
    
  } catch (error) {
    console.error('❌ Erro geral:', error)
    return false
  }
}

// Executar teste
testSchema().then(success => {
  if (success) {
    console.log('🎉 Teste do schema concluído com sucesso!')
  } else {
    console.log('💥 Teste do schema falhou')
  }
  process.exit(success ? 0 : 1)
})