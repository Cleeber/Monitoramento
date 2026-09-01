-- Migração: Adicionar campo report_send_time na tabela monitors
-- Execute este script no Supabase SQL Editor

-- Adicionar coluna para horário de envio do relatório
ALTER TABLE public.monitors 
ADD COLUMN IF NOT EXISTS report_send_time TIME DEFAULT '09:00';

-- Adicionar comentário para documentação
COMMENT ON COLUMN public.monitors.report_send_time IS 'Horário do dia para envio do relatório (formato HH:MM, padrão: 09:00)';

-- Verificar se a coluna foi adicionada corretamente
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'monitors' 
AND table_schema = 'public'
AND column_name = 'report_send_time'
ORDER BY column_name;

-- Exemplo de como os dados ficarão
SELECT id, name, report_email, report_send_day, report_send_time 
FROM public.monitors 
LIMIT 3;