import { supabase } from './src/lib/supabase.ts';

async function createTables() {
  console.log('🔧 Criando tabelas de relatórios mensais...');
  
  try {
    // Criar tabela monthly_report_configs
    console.log('📝 Criando tabela monthly_report_configs...');
    const { error: error1 } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS monthly_report_configs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
          email VARCHAR(255) NOT NULL,
          send_day INTEGER NOT NULL CHECK (send_day >= 1 AND send_day <= 28),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(monitor_id)
        );
      `
    });
    
    if (error1) {
      console.log('⚠️ Erro ao criar monthly_report_configs:', error1.message);
    } else {
      console.log('✅ Tabela monthly_report_configs criada');
    }
    
    // Criar tabela monthly_report_history
    console.log('📝 Criando tabela monthly_report_history...');
    const { error: error2 } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS monthly_report_history (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          config_id UUID NOT NULL REFERENCES monthly_report_configs(id) ON DELETE CASCADE,
          monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
          email VARCHAR(255) NOT NULL,
          report_month INTEGER NOT NULL CHECK (report_month >= 1 AND report_month <= 12),
          report_year INTEGER NOT NULL CHECK (report_year >= 2020),
          sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
          error_message TEXT,
          uptime_percentage DECIMAL(5,2),
          total_checks INTEGER,
          successful_checks INTEGER,
          avg_response_time DECIMAL(10,2),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });
    
    if (error2) {
      console.log('⚠️ Erro ao criar monthly_report_history:', error2.message);
    } else {
      console.log('✅ Tabela monthly_report_history criada');
    }
    
    // Criar índices
    console.log('📝 Criando índices...');
    const { error: error3 } = await supabase.rpc('exec', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_monthly_report_configs_monitor_id ON monthly_report_configs(monitor_id);
        CREATE INDEX IF NOT EXISTS idx_monthly_report_configs_send_day ON monthly_report_configs(send_day);
        CREATE INDEX IF NOT EXISTS idx_monthly_report_configs_is_active ON monthly_report_configs(is_active);
        CREATE INDEX IF NOT EXISTS idx_monthly_report_history_config_id ON monthly_report_history(config_id);
        CREATE INDEX IF NOT EXISTS idx_monthly_report_history_monitor_id ON monthly_report_history(monitor_id);
        CREATE INDEX IF NOT EXISTS idx_monthly_report_history_report_date ON monthly_report_history(report_year, report_month);
        CREATE INDEX IF NOT EXISTS idx_monthly_report_history_status ON monthly_report_history(status);
        CREATE INDEX IF NOT EXISTS idx_monthly_report_history_sent_at ON monthly_report_history(sent_at);
      `
    });
    
    if (error3) {
      console.log('⚠️ Erro ao criar índices:', error3.message);
    } else {
      console.log('✅ Índices criados');
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
    console.error('❌ Erro geral:', error);
  }
}

// Executar a função
createTables();