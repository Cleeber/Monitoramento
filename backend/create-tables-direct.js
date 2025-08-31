import { createClient } from '@supabase/supabase-js'
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

async function createTables() {
  try {
    console.log('🔧 Criando tabelas para relatórios mensais...')
    
    // Primeiro, vamos tentar criar as tabelas usando SQL direto via fetch
    const createConfigTableSQL = `
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
    
    const createHistoryTableSQL = `
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
    
    // Tentar executar via API REST diretamente
    console.log('📝 Criando tabela monthly_report_configs...')
    
    const response1 = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({ sql: createConfigTableSQL })
    })
    
    if (response1.ok) {
      console.log('✅ Tabela monthly_report_configs criada')
    } else {
      const error1 = await response1.text()
      console.log('⚠️ Erro ao criar monthly_report_configs:', error1)
    }
    
    console.log('📝 Criando tabela monthly_report_history...')
    
    const response2 = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({ sql: createHistoryTableSQL })
    })
    
    if (response2.ok) {
      console.log('✅ Tabela monthly_report_history criada')
    } else {
      const error2 = await response2.text()
      console.log('⚠️ Erro ao criar monthly_report_history:', error2)
    }
    
    // Criar índices
    const createIndexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_monthly_report_configs_monitor_id ON monthly_report_configs(monitor_id);
      CREATE INDEX IF NOT EXISTS idx_monthly_report_configs_send_day ON monthly_report_configs(send_day);
      CREATE INDEX IF NOT EXISTS idx_monthly_report_configs_is_active ON monthly_report_configs(is_active);
      CREATE INDEX IF NOT EXISTS idx_monthly_report_history_config_id ON monthly_report_history(config_id);
      CREATE INDEX IF NOT EXISTS idx_monthly_report_history_monitor_id ON monthly_report_history(monitor_id);
      CREATE INDEX IF NOT EXISTS idx_monthly_report_history_report_date ON monthly_report_history(report_year, report_month);
      CREATE INDEX IF NOT EXISTS idx_monthly_report_history_status ON monthly_report_history(status);
      CREATE INDEX IF NOT EXISTS idx_monthly_report_history_sent_at ON monthly_report_history(sent_at);
    `
    
    console.log('📝 Criando índices...')
    
    const response3 = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({ sql: createIndexesSQL })
    })
    
    if (response3.ok) {
      console.log('✅ Índices criados')
    } else {
      const error3 = await response3.text()
      console.log('⚠️ Erro ao criar índices:', error3)
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
      console.log('✅ Todas as tabelas foram criadas com sucesso!')
      console.log('✅ monthly_report_configs: OK')
      console.log('✅ monthly_report_history: OK')
    } else {
      console.log('⚠️ Status das tabelas:')
      console.log('- monthly_report_configs:', configError ? configError.message : 'OK')
      console.log('- monthly_report_history:', historyError ? historyError.message : 'OK')
    }
    
  } catch (error) {
    console.error('❌ Erro ao criar tabelas:', error)
    
    // Fallback: mostrar instruções manuais
    console.log('\n📋 Execute manualmente no Supabase SQL Editor:')
    console.log('\n-- Tabela de configurações')
    console.log(`CREATE TABLE IF NOT EXISTS monthly_report_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  send_day INTEGER NOT NULL CHECK (send_day >= 1 AND send_day <= 28),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(monitor_id)
);`)
    
    console.log('\n-- Tabela de histórico')
    console.log(`CREATE TABLE IF NOT EXISTS monthly_report_history (
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
);`)
  }
}

createTables()