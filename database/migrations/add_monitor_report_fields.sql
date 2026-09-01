-- Migração: Adicionar campos de relatório mensal na tabela monitors
-- Execute este script no Supabase SQL Editor

-- Adicionar colunas para configuração de relatório mensal
ALTER TABLE public.monitors 
ADD COLUMN IF NOT EXISTS report_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS report_send_day INTEGER DEFAULT 1 CHECK (report_send_day >= 1 AND report_send_day <= 28);

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.monitors.report_email IS 'E-mail para envio do relatório mensal (opcional)';
COMMENT ON COLUMN public.monitors.report_send_day IS 'Dia do mês para envio do relatório (1-28, padrão: 1)';

-- Verificar se as colunas foram adicionadas corretamente
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'monitors' 
AND table_schema = 'public'
AND column_name IN ('report_email', 'report_send_day')
ORDER BY column_name;

-- Exemplo de como os dados ficarão
SELECT id, name, report_email, report_send_day 
FROM public.monitors 
LIMIT 3;