import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function recreateMonthlyHistoryTable() {
  try {
    console.log('🗑️ Removendo tabela monthly_report_history existente...')
    
    // Remover tabela existente
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: 'DROP TABLE IF EXISTS public.monthly_report_history CASCADE;'
    })
    
    if (dropError) {
      console.error('❌ Erro ao remover tabela:', dropError)
      return
    }
    
    console.log('✅ Tabela removida com sucesso')
    
    console.log('📋 Criando nova tabela monthly_report_history...')
    
    // Criar nova tabela com estrutura correta
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE public.monthly_report_history (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          config_id UUID REFERENCES public.monthly_report_configs(id) ON DELETE CASCADE,
          monitor_id UUID NOT NULL REFERENCES public.monitors(id) ON DELETE CASCADE,
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
        
        -- Índices para melhor performance
        CREATE INDEX idx_monthly_report_history_config_id ON public.monthly_report_history(config_id);
        CREATE INDEX idx_monthly_report_history_monitor_id ON public.monthly_report_history(monitor_id);
        CREATE INDEX idx_monthly_report_history_report_date ON public.monthly_report_history(report_year, report_month);
        CREATE INDEX idx_monthly_report_history_status ON public.monthly_report_history(status);
        CREATE INDEX idx_monthly_report_history_sent_at ON public.monthly_report_history(sent_at);
        
        -- Habilitar RLS
        ALTER TABLE public.monthly_report_history ENABLE ROW LEVEL SECURITY;
        
        -- Política de acesso
        CREATE POLICY "Allow all operations on monthly_report_history" ON public.monthly_report_history
        FOR ALL USING (true) WITH CHECK (true);
      `
    })
    
    if (createError) {
      console.error('❌ Erro ao criar tabela:', createError)
      return
    }
    
    console.log('✅ Tabela monthly_report_history criada com sucesso!')
    
    // Verificar se a tabela foi criada corretamente
    const { data, error: testError } = await supabase
      .from('monthly_report_history')
      .select('*')
      .limit(1)
    
    if (testError) {
      console.error('❌ Erro ao testar tabela:', testError)
    } else {
      console.log('✅ Tabela testada com sucesso!')
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error)
  }
}

recreateMonthlyHistoryTable()