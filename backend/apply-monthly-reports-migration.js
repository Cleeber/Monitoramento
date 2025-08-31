import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import dotenv from 'dotenv'

// Carregar variáveis de ambiente
dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applyMigration() {
  try {
    console.log('🔧 Aplicando migração de relatórios mensais...')
    
    // Ler o arquivo de migração
    const migrationSQL = readFileSync('d:\\uptime-monitor\\backend\\database\\migrations\\add_monthly_reports.sql', 'utf8')
    
    // Dividir em comandos individuais
    const commands = migrationSQL
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'))
    
    console.log(`📝 Executando ${commands.length} comandos SQL...`)
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i]
      if (command.trim()) {
        console.log(`Executando comando ${i + 1}/${commands.length}...`)
        
        // Executar comando SQL diretamente
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: command + ';'
        })
        
        if (error) {
          // Se exec_sql não existir, tentar executar diretamente
          if (error.code === 'PGRST202') {
            console.log('⚠️ Função exec_sql não encontrada, tentando execução direta...')
            
            // Para comandos CREATE TABLE, usar uma abordagem diferente
            if (command.includes('CREATE TABLE')) {
              const tableName = command.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1]
              if (tableName) {
                console.log(`Criando tabela ${tableName}...`)
                // Executar usando uma query raw
                const { error: directError } = await supabase
                  .from('_temp_migration')
                  .select('*')
                  .limit(0)
                  .then(() => {
                    // Se chegou aqui, podemos tentar criar a tabela
                    return supabase.rpc('exec_sql', { sql: command + ';' })
                  })
                  .catch(async () => {
                    // Fallback: usar SQL direto via REST API
                    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseServiceKey}`,
                        'apikey': supabaseServiceKey
                      },
                      body: JSON.stringify({ sql: command + ';' })
                    })
                    
                    if (!response.ok) {
                      const errorText = await response.text()
                      throw new Error(`HTTP ${response.status}: ${errorText}`)
                    }
                    
                    return { error: null }
                  })
                
                if (directError) {
                  console.error(`❌ Erro ao criar tabela ${tableName}:`, directError)
                } else {
                  console.log(`✅ Tabela ${tableName} criada com sucesso`)
                }
              }
            }
          } else {
            console.error(`❌ Erro no comando ${i + 1}:`, error)
          }
        } else {
          console.log(`✅ Comando ${i + 1} executado com sucesso`)
        }
      }
    }
    
    // Verificar se as tabelas foram criadas
    console.log('\n🔍 Verificando se as tabelas foram criadas...')
    
    const { data: configTable, error: configError } = await supabase
      .from('monthly_report_configs')
      .select('*')
      .limit(1)
    
    const { data: historyTable, error: historyError } = await supabase
      .from('monthly_report_history')
      .select('*')
      .limit(1)
    
    if (!configError && !historyError) {
      console.log('✅ Migração aplicada com sucesso!')
      console.log('✅ Tabelas monthly_report_configs e monthly_report_history criadas')
    } else {
      console.log('⚠️ Algumas tabelas podem não ter sido criadas:')
      if (configError) console.log('- monthly_report_configs:', configError.message)
      if (historyError) console.log('- monthly_report_history:', historyError.message)
    }
    
  } catch (error) {
    console.error('❌ Erro ao aplicar migração:', error)
    process.exit(1)
  }
}

applyMigration()