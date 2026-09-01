-- Schema para o banco de dados Uptime Monitor
-- Execute este script no Supabase SQL Editor

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de grupos
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de monitores
CREATE TABLE IF NOT EXISTS public.monitors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'http' NOT NULL,
    interval INTEGER DEFAULT 60000 NOT NULL,
    timeout INTEGER DEFAULT 30000 NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    status VARCHAR(50) DEFAULT 'unknown',
    last_check TIMESTAMP WITH TIME ZONE,
    response_time INTEGER,
    uptime_24h DECIMAL(5,2) DEFAULT 0,
    uptime_7d DECIMAL(5,2) DEFAULT 0,
    uptime_30d DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de verificações de monitor
CREATE TABLE IF NOT EXISTS public.monitor_checks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    monitor_id UUID REFERENCES public.monitors(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    response_time INTEGER,
    status_code INTEGER,
    error_message TEXT,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de configuração SMTP
CREATE TABLE IF NOT EXISTS public.smtp_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    secure BOOLEAN DEFAULT false,
    "user" VARCHAR(255) NOT NULL,
    pass VARCHAR(255) NOT NULL,
    from_email VARCHAR(255),
    from_name VARCHAR(255) DEFAULT 'Uptime Monitor',
    is_configured BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de relatórios
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    monitor_id UUID REFERENCES public.monitors(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    period VARCHAR(50) NOT NULL,
    data JSONB NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_monitors_group_id ON public.monitors(group_id);
CREATE INDEX IF NOT EXISTS idx_monitors_status ON public.monitors(status);
CREATE INDEX IF NOT EXISTS idx_monitor_checks_monitor_id ON public.monitor_checks(monitor_id);
CREATE INDEX IF NOT EXISTS idx_monitor_checks_checked_at ON public.monitor_checks(checked_at);
CREATE INDEX IF NOT EXISTS idx_reports_monitor_id ON public.reports(monitor_id);

-- Triggers para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monitors_updated_at BEFORE UPDATE ON public.monitors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_smtp_config_updated_at BEFORE UPDATE ON public.smtp_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS (Row Level Security) se necessário
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitor_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smtp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Políticas básicas de RLS (ajuste conforme necessário)
CREATE POLICY "Enable all operations for authenticated users" ON public.users
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON public.groups
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON public.monitors
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON public.monitor_checks
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON public.smtp_config
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON public.reports
    FOR ALL USING (auth.role() = 'authenticated');

-- Inserir usuário administrador padrão (senha: admin123)
INSERT INTO public.users (email, password, name, role)
VALUES (
    'admin@agencia.com',
    '$2a$10$.YgNGvh7ZQ7FqSHlyv.Ra.kgPwCz1vXWXAPySIhrzcaAKz59askIe',
    'Administrador',
    'admin'
)
ON CONFLICT (email) DO NOTHING;

-- Inserir grupo de exemplo
INSERT INTO public.groups (name, description)
VALUES (
    'Grupo Exemplo',
    'Grupo de exemplo para demonstração do sistema'
)
ON CONFLICT DO NOTHING;