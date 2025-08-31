import { supabase } from './src/lib/supabase.js';

async function createTables() {
  console.log('🚀 Iniciando criação das tabelas...');
  
  try {
    // Criar tabela monthly_report_configs
    console.log('📋 Criando tabela monthly_report_configs...');
    const { data: configTable, error: configError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.monthly_report_configs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          monitor_id UUID NOT NULL REFERENCES public.monitors(id) ON DELETE CASCADE,
          email VARCHAR(255) NOT NULL,
          send_day INTEGER NOT NULL CHECK (send_day >= 1 AND send_day <= 31),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `
    });
    
    if (configError) {
      console.error('❌ Erro ao criar monthly_report_configs:', configError);
    } else {
      console.log('✅ Tabela monthly_report_configs criada com sucesso!');
    }
    
    // Criar tabela monthly_report_history
    console.log('📋 Criando tabela monthly_report_history...');
    const { data: historyTable, error: historyError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.monthly_report_history (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          monitor_id UUID NOT NULL REFERENCES public.monitors(id) ON DELETE CASCADE,
          email VARCHAR(255) NOT NULL,
          sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          report_period_start DATE NOT NULL,
          report_period_end DATE NOT NULL,
          status VARCHAR(50) DEFAULT 'sent',
          error_message TEXT
        );
      `
    });
    
    if (historyError) {
      console.error('❌ Erro ao criar monthly_report_history:', historyError);
    } else {
      console.log('✅ Tabela monthly_report_history criada com sucesso!');
    }
    
    // Criar índices
    console.log('🔍 Criando índices...');
    const { data: indexData, error: indexError } = await supabase.rpc('exec', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_monthly_report_configs_monitor_id ON public.monthly_report_configs(monitor_id);
        CREATE INDEX IF NOT EXISTS idx_monthly_report_configs_active ON public.monthly_report_configs(is_active);
        CREATE INDEX IF NOT EXISTS idx_monthly_report_history_monitor_id ON public.monthly_report_history(monitor_id);
        CREATE INDEX IF NOT EXISTS idx_monthly_report_history_sent_at ON public.monthly_report_history(sent_at);
      `
    });
    
    if (indexError) {
      console.error('❌ Erro ao criar índices:', indexError);
    } else {
      console.log('✅ Índices criados com sucesso!');
    }
    
    // Verificar se as tabelas foram criadas
    console.log('🔍 Verificando se as tabelas foram criadas...');
    const { data: tables, error: checkError } = await supabase.rpc('exec', {
      sql: `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('monthly_report_configs', 'monthly_report_history');
      `
    });
    
    if (checkError) {
      console.error('❌ Erro ao verificar tabelas:', checkError);
    } else {
      console.log('📊 Tabelas encontradas:', tables);
    }
    
    console.log('🎉 Processo concluído!');
    
  } catch (error) {
    console.error('💥 Erro geral:', error);
  }
}

createTables();