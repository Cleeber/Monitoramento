-- Script para adicionar coluna slug na tabela monitors
-- Execute este SQL no Supabase SQL Editor

-- 1. Adicionar coluna slug na tabela monitors
ALTER TABLE public.monitors ADD COLUMN IF NOT EXISTS slug VARCHAR(255);

-- 2. Criar índice único para slugs de monitores
CREATE UNIQUE INDEX IF NOT EXISTS idx_monitors_slug 
ON public.monitors(slug) 
WHERE slug IS NOT NULL;

-- 3. Função para gerar slug (caso não exista)
CREATE OR REPLACE FUNCTION generate_slug(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Converter para minúsculas, remover caracteres especiais e substituir espaços por hífens
    RETURN lower(
        regexp_replace(
            regexp_replace(
                input_text, 
                '[^a-zA-Z0-9\\s-]', '', 'g'
            ), 
            '\\s+', '-', 'g'
        )
    );
END;
$$ LANGUAGE plpgsql;

-- 4. Função para garantir slug único
CREATE OR REPLACE FUNCTION ensure_unique_slug(base_slug TEXT, table_name TEXT, exclude_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    final_slug TEXT;
    counter INTEGER := 1;
    exists_count INTEGER;
BEGIN
    final_slug := base_slug;
    
    LOOP
        -- Verificar se o slug já existe na tabela monitors
        IF table_name = 'monitors' THEN
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

-- 5. Trigger para gerar slugs automaticamente
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

-- 6. Criar o trigger
DROP TRIGGER IF EXISTS trigger_auto_generate_monitor_slug ON public.monitors;
CREATE TRIGGER trigger_auto_generate_monitor_slug
    BEFORE INSERT OR UPDATE ON public.monitors
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_monitor_slug();

-- 7. Gerar slugs para monitores existentes
UPDATE public.monitors 
SET slug = ensure_unique_slug(generate_slug(name), 'monitors', id)
WHERE slug IS NULL;

-- 8. Verificar resultado
SELECT 
    'Coluna slug adicionada com sucesso!' as status,
    COUNT(*) as total_monitores,
    COUNT(slug) as monitores_com_slug
FROM public.monitors;

-- 9. Mostrar exemplos
SELECT 'Exemplos de monitores com slug:' as info;
SELECT name, slug FROM public.monitors WHERE slug IS NOT NULL LIMIT 5;