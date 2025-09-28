// Script para testar o schema no Supabase
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Carregar variáveis de ambiente
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') })

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkColumn(table, column) {
  try {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .limit(1)

    if (error) {
      if (
        (error.message && (error.message.includes('does not exist') || error.message.includes('unknown') || error.message.includes('column'))) ||
        error.code === 'PGRST204'
      ) {
        console.log(`❌ Coluna ${column} não existe na tabela ${table}`)
        return false
      }
      console.log(`⚠️ Erro ao verificar coluna ${column} em ${table}:`, error.message)
      return false
    }

    console.log(`✅ Coluna ${column} existe na tabela ${table}`)
    return true
  } catch (err) {
    console.log(`⚠️ Erro ao verificar coluna ${column} em ${table}:`, err.message)
    return false
  }
}

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
    
    const tables = ['users', 'groups', 'monitors', 'monitor_checks', 'smtp_config', 'reports', 'monthly_report_configs', 'monthly_report_history']
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

    console.log('🔎 Validando colunas específicas...')
    const results = []
    results.push(await checkColumn('groups', 'slug'))
    results.push(await checkColumn('monitors', 'slug'))
    results.push(await checkColumn('monitors', 'logo_url'))
    const allColumnsExist = results.every(Boolean)

    return allTablesExist && allColumnsExist
    
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