-- Migração: Renomear Clientes para Grupos e tornar group_id opcional
-- Execute este script no Supabase SQL Editor

-- 1. Alterar a constraint da tabela monitors para tornar group_id opcional
-- (Remover a constraint NOT NULL se existir)
ALTER TABLE public.monitors 
ALTER COLUMN group_id DROP NOT NULL;

-- 2. Alterar a constraint de foreign key para SET NULL ao invés de CASCADE
-- Primeiro, remover a constraint existente
ALTER TABLE public.monitors 
DROP CONSTRAINT IF EXISTS monitors_group_id_fkey;

-- Recriar a constraint com ON DELETE SET NULL
ALTER TABLE public.monitors 
ADD CONSTRAINT monitors_group_id_fkey 
FOREIGN KEY (group_id) 
REFERENCES public.groups(id) 
ON DELETE SET NULL;

-- 3. Atualizar comentários das tabelas para refletir a nova nomenclatura
COMMENT ON TABLE public.groups IS 'Tabela de grupos para organização de monitores';
COMMENT ON COLUMN public.groups.name IS 'Nome do grupo';
COMMENT ON COLUMN public.groups.description IS 'Descrição do grupo';

-- 4. Atualizar comentário da coluna group_id na tabela monitors
COMMENT ON COLUMN public.monitors.group_id IS 'ID do grupo (opcional) - monitores podem existir sem grupo';

-- 5. Atualizar o grupo de exemplo para refletir a nova nomenclatura
UPDATE public.groups 
SET name = 'Grupo Exemplo', 
    description = 'Grupo de exemplo para demonstração do sistema'
WHERE name = 'Cliente Exemplo';

-- Verificar se as alterações foram aplicadas corretamente
SELECT 
    'Migração concluída com sucesso!' as status,
    COUNT(*) as total_grupos
FROM public.groups;

-- Verificar monitores sem grupo
SELECT 
    COUNT(*) as monitores_sem_grupo
FROM public.monitors 
WHERE group_id IS NULL;

SELECT 
    COUNT(*) as monitores_com_grupo
FROM public.monitors 
WHERE group_id IS NOT NULL;