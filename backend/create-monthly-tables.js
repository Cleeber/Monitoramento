import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://ixqjqjqjqjqjqjqjqjqj.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cWpxanFqcWpxanFqcWpxanFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5MjU4NzQsImV4cCI6MjA3MTUwMTg3NH0.example';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTables() {
  try {
    console.log('🔧 Criando tabelas de relatórios mensais...');
    
    // Ler o arquivo SQL
    const sqlPath = path.join(__dirname, 'database', 'migrations', 'add_monthly_reports.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Dividir em comandos individuais
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
    
    console.log(`📝 Executando ${commands.length} comandos SQL...`);
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      if (command.trim()) {
        console.log(`Executando comando ${i + 1}/${commands.length}...`);
        
        try {
          const { data, error } = await supabase.rpc('exec_sql', { sql: command });
          if (error) {
            console.log(`⚠️ Aviso no comando ${i + 1}:`, error.message);
          } else {
            console.log(`✅ Comando ${i + 1} executado com sucesso`);
          }
        } catch (err) {
          console.log(`⚠️ Erro no comando ${i + 1}:`, err.message);
        }
      }
    }
    
    // Verificar se as tabelas foram criadas
    console.log('\n🔍 Verificando se as tabelas foram criadas...');
    
    const { data: configTable, error: configError } = await supabase
      .from('monthly_report_configs')
      .select('*')
      .limit(1);
      
    const { data: historyTable, error: historyError } = await supabase
      .from('monthly_report_history')
      .select('*')
      .limit(1);
    
    if (!configError && !historyError) {
      console.log('✅ Tabelas criadas com sucesso!');
      console.log('- monthly_report_configs: OK');
      console.log('- monthly_report_history: OK');
    } else {
      console.log('⚠️ Status das tabelas:');
      console.log('- monthly_report_configs:', configError ? configError.message : 'OK');
      console.log('- monthly_report_history:', historyError ? historyError.message : 'OK');
    }
    
  } catch (error) {
    console.error('❌ Erro ao criar tabelas:', error);
  }
}

// Executar a função
createTables();