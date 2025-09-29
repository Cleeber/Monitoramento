const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkAndFixMonthlyReportHistory() {
  try {
    console.log('🔍 Verificando se a tabela monthly_report_history existe...');
    
    // Tentar fazer uma consulta simples na tabela para verificar se existe
    const { data: testQuery, error: testError } = await supabase
      .from('monthly_report_history')
      .select('*')
      .limit(1);
    
    if (testError) {
      console.log('⚠️ Tabela monthly_report_history não existe ou tem problemas:', testError.message);
      console.log('🔧 Tentando criar a tabela...');
      
      // Criar a tabela com a estrutura correta
      const createTableSQL = `
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
        
        CREATE INDEX IF NOT EXISTS idx_monthly_report_history_monitor_id ON public.monthly_report_history(monitor_id);
        CREATE INDEX IF NOT EXISTS idx_monthly_report_history_sent_at ON public.monthly_report_history(sent_at);
      `;
      
      console.log('📝 SQL para criar tabela:', createTableSQL);
      console.log('⚠️ Execute este SQL manualmente no Supabase SQL Editor');
      return;
    }
    
    console.log('✅ Tabela monthly_report_history existe e está acessível');
    
    // Tentar inserir um registro de teste para verificar se todas as colunas necessárias existem
    console.log('🧪 Testando inserção de dados para verificar estrutura...');
    
    const testData = {
      monitor_id: '00000000-0000-0000-0000-000000000000', // UUID fictício
      email: 'test@example.com',
      report_period_start: '2025-01-01',
      report_period_end: '2025-01-31',
      status: 'sent'
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('monthly_report_history')
      .insert(testData)
      .select();
    
    if (insertError) {
      console.log('⚠️ Erro ao inserir dados de teste:', insertError.message);
      
      if (insertError.message.includes('column') && insertError.message.includes('does not exist')) {
        console.log('🔧 Parece que algumas colunas estão faltando na tabela.');
        console.log('📝 Execute este SQL no Supabase SQL Editor para corrigir:');
        console.log(`
-- Recriar a tabela monthly_report_history com a estrutura correta
DROP TABLE IF EXISTS public.monthly_report_history CASCADE;

CREATE TABLE public.monthly_report_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id UUID NOT NULL REFERENCES public.monitors(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  report_period_start DATE NOT NULL,
  report_period_end DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'sent',
  error_message TEXT
);

CREATE INDEX idx_monthly_report_history_monitor_id ON public.monthly_report_history(monitor_id);
CREATE INDEX idx_monthly_report_history_sent_at ON public.monthly_report_history(sent_at);

-- Habilitar RLS
ALTER TABLE public.monthly_report_history ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas as operações
CREATE POLICY "Allow all operations on monthly_report_history" ON public.monthly_report_history
  FOR ALL USING (true) WITH CHECK (true);
        `);
      }
    } else {
      console.log('✅ Estrutura da tabela está correta!');
      
      // Remover o registro de teste
      if (insertData && insertData[0]) {
        await supabase
          .from('monthly_report_history')
          .delete()
          .eq('id', insertData[0].id);
        console.log('🧹 Registro de teste removido');
      }
    }
    
    console.log('🎉 Verificação concluída!');
    
  } catch (error) {
    console.error('💥 Erro geral:', error);
  }
}

checkAndFixMonthlyReportHistory();