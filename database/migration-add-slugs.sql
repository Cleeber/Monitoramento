-- Migração: Adicionar colunas de slug para páginas de status
-- Execute este script no Supabase SQL Editor

-- 1. Adicionar coluna slug na tabela groups
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS slug VARCHAR(255);

-- 2. Adicionar coluna slug na tabela monitors
ALTER TABLE public.monitors 
ADD COLUMN IF NOT EXISTS slug VARCHAR(255);

-- 3. Criar índices únicos para os slugs (para garantir unicidade)
CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_slug 
ON public.groups(slug) 
WHERE slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_monitors_slug 
ON public.monitors(slug) 
WHERE slug IS NOT NULL;

-- 4. Adicionar comentários para documentar as colunas
COMMENT ON COLUMN public.groups.slug IS 'Slug único para página de status do grupo (formato: meu-grupo-1)';
COMMENT ON COLUMN public.monitors.slug IS 'Slug único para página de status do monitor (formato: meu-monitor-1)';

-- 5. Criar função para gerar slug automaticamente a partir do nome
CREATE OR REPLACE FUNCTION generate_slug(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Converter para minúsculas, remover acentos e caracteres especiais
    -- Substituir espaços por hífens
    RETURN lower(
        regexp_replace(
            regexp_replace(
                unaccent(input_text), 
                '[^a-zA-Z0-9\s-]', '', 'g'
            ), 
            '\s+', '-', 'g'
        )
    );
END;
$$ LANGUAGE plpgsql;

-- 6. Criar função para garantir slug único
CREATE OR REPLACE FUNCTION ensure_unique_slug(base_slug TEXT, table_name TEXT, exclude_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    final_slug TEXT;
    counter INTEGER := 1;
    exists_count INTEGER;
BEGIN
    final_slug := base_slug;
    
    LOOP
        -- Verificar se o slug já existe
        IF table_name = 'groups' THEN
            SELECT COUNT(*) INTO exists_count 
            FROM public.groups 
            WHERE slug = final_slug 
            AND (exclude_id IS NULL OR id != exclude_id);
        ELSIF table_name = 'monitors' THEN
            SELECT COUNT(*) INTO exists_count 
            FROM public.monitors 
            WHERE slug = final_slug 
            AND (exclude_id IS NULL OR id != exclude_id);
        END IF;
        
        -- Se não existe, retornar o slug
        IF exists_count = 0 THEN
            RETURN final_slug;
        END IF;
        
        -- Se existe, adicionar contador
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 7. Criar triggers para gerar slugs automaticamente quando não fornecidos
CREATE OR REPLACE FUNCTION auto_generate_group_slug()
RETURNS TRIGGER AS $$
BEGIN
    -- Se slug não foi fornecido, gerar automaticamente
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := ensure_unique_slug(generate_slug(NEW.name), 'groups', NEW.id);
    ELSE
        -- Se slug foi fornecido, garantir que seja único
        NEW.slug := ensure_unique_slug(generate_slug(NEW.slug), 'groups', NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_generate_monitor_slug()
RETURNS TRIGGER AS $$
BEGIN
    -- Se slug não foi fornecido, gerar automaticamente
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := ensure_unique_slug(generate_slug(NEW.name), 'monitors', NEW.id);
    ELSE
        -- Se slug foi fornecido, garantir que seja único
        NEW.slug := ensure_unique_slug(generate_slug(NEW.slug), 'monitors', NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Criar os triggers
DROP TRIGGER IF EXISTS trigger_auto_generate_group_slug ON public.groups;
CREATE TRIGGER trigger_auto_generate_group_slug
    BEFORE INSERT OR UPDATE ON public.groups
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_group_slug();

DROP TRIGGER IF EXISTS trigger_auto_generate_monitor_slug ON public.monitors;
CREATE TRIGGER trigger_auto_generate_monitor_slug
    BEFORE INSERT OR UPDATE ON public.monitors
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_monitor_slug();

-- 9. Gerar slugs para registros existentes
UPDATE public.groups 
SET slug = ensure_unique_slug(generate_slug(name), 'groups', id)
WHERE slug IS NULL;

UPDATE public.monitors 
SET slug = ensure_unique_slug(generate_slug(name), 'monitors', id)
WHERE slug IS NULL;

-- 10. Verificar se as alterações foram aplicadas corretamente
SELECT 
    'Migração de slugs concluída com sucesso!' as status,
    (
        SELECT COUNT(*) 
        FROM public.groups 
        WHERE slug IS NOT NULL
    ) as grupos_com_slug,
    (
        SELECT COUNT(*) 
        FROM public.monitors 
        WHERE slug IS NOT NULL
    ) as monitores_com_slug;

-- Mostrar alguns exemplos de slugs gerados
SELECT 'Exemplos de slugs de grupos:' as info;
SELECT name, slug FROM public.groups LIMIT 5;

SELECT 'Exemplos de slugs de monitores:' as info;
SELECT name, slug FROM public.monitors LIMIT 5;