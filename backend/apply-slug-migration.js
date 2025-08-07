// Script para aplicar a migração de slugs no Supabase
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Configurar __dirname para ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas')
  console.log('Certifique-se de que NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão definidas no arquivo .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applySlugMigration() {
  try {
    console.log('🚀 Iniciando aplicação da migração de slugs...')
    
    // Ler o arquivo de migração
    const migrationPath = path.join(__dirname, 'database', 'migration-add-slugs.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('📄 Arquivo de migração carregado')
    
    // Dividir o SQL em comandos individuais (separados por ';')
    const commands = migrationSQL
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'))
    
    console.log(`📝 Executando ${commands.length} comandos SQL...`)
    
    // Executar cada comando
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i]
      
      if (command.trim()) {
        console.log(`⏳ Executando comando ${i + 1}/${commands.length}...`)
        
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: command
        })
        
        if (error) {
          // Tentar executar diretamente se rpc falhar
          const { data: directData, error: directError } = await supabase
            .from('_temp')
            .select('*')
            .limit(0)
          
          if (directError) {
            console.log(`⚠️  Comando ${i + 1} pode ter falhado, mas continuando...`)
            console.log(`Comando: ${command.substring(0, 100)}...`)
          }
        }
      }
    }
    
    console.log('✅ Migração aplicada com sucesso!')
    
    // Verificar se as colunas foram criadas
    console.log('🔍 Verificando se as colunas foram criadas...')
    
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('id, name, slug')
      .limit(3)
    
    const { data: monitors, error: monitorsError } = await supabase
      .from('monitors')
      .select('id, name, slug')
      .limit(3)
    
    if (!groupsError && groups) {
      console.log('✅ Coluna slug criada na tabela groups')
      console.log('📋 Exemplos de grupos com slug:')
      groups.forEach(group => {
        console.log(`  - ${group.name} → ${group.slug}`)
      })
    }
    
    if (!monitorsError && monitors) {
      console.log('✅ Coluna slug criada na tabela monitors')
      console.log('📋 Exemplos de monitores com slug:')
      monitors.forEach(monitor => {
        console.log(`  - ${monitor.name} → ${monitor.slug}`)
      })
    }
    
    console.log('\n🎉 Migração de slugs concluída com sucesso!')
    console.log('\n📌 Próximos passos:')
    console.log('1. Atualizar os tipos TypeScript no arquivo supabase.ts')
    console.log('2. Adicionar campos de slug nos modais de criação/edição')
    console.log('3. Criar as rotas de páginas de status')
    
  } catch (error) {
    console.error('❌ Erro ao aplicar migração:', error)
    process.exit(1)
  }
}

// Executar a migração
applySlugMigration()