-- Script para corrigir políticas RLS para funcionar com JWT personalizado
-- Execute este script no Supabase SQL Editor

-- Remover políticas existentes que dependem de auth.role()
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.groups;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.monitors;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.monitor_checks;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.smtp_config;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.reports;

-- Criar políticas que permitem acesso com service role (contorna RLS)
-- Ou simplesmente desabilitar RLS para permitir acesso com JWT personalizado

-- Opção 1: Desabilitar RLS (mais simples para JWT personalizado)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitors DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitor_checks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.smtp_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports DISABLE ROW LEVEL SECURITY;

-- Opção 2: Criar políticas que permitem tudo (comentado, use se preferir manter RLS)
-- CREATE POLICY "Allow all operations" ON public.users FOR ALL USING (true);
-- CREATE POLICY "Allow all operations" ON public.groups FOR ALL USING (true);
-- CREATE POLICY "Allow all operations" ON public.monitors FOR ALL USING (true);
-- CREATE POLICY "Allow all operations" ON public.monitor_checks FOR ALL USING (true);
-- CREATE POLICY "Allow all operations" ON public.smtp_config FOR ALL USING (true);
-- CREATE POLICY "Allow all operations" ON public.reports FOR ALL USING (true);