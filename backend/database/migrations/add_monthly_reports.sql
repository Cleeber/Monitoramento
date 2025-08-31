-- Migração para adicionar funcionalidade de relatórios mensais por e-mail

-- Tabela para configurações de relatórios mensais por monitor
CREATE TABLE IF NOT EXISTS monthly_report_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    send_day INTEGER NOT NULL CHECK (send_day >= 1 AND send_day <= 28),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(monitor_id)
);

-- Tabela para histórico de envios de relatórios
CREATE TABLE IF NOT EXISTS monthly_report_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES monthly_report_configs(id) ON DELETE CASCADE,
    monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_monthly_report_configs_monitor_id ON monthly_report_configs(monitor_id);
CREATE INDEX IF NOT EXISTS idx_monthly_report_configs_send_day ON monthly_report_configs(send_day);
CREATE INDEX IF NOT EXISTS idx_monthly_report_configs_is_active ON monthly_report_configs(is_active);

CREATE INDEX IF NOT EXISTS idx_monthly_report_history_config_id ON monthly_report_history(config_id);
CREATE INDEX IF NOT EXISTS idx_monthly_report_history_monitor_id ON monthly_report_history(monitor_id);
CREATE INDEX IF NOT EXISTS idx_monthly_report_history_report_date ON monthly_report_history(report_year, report_month);
CREATE INDEX IF NOT EXISTS idx_monthly_report_history_status ON monthly_report_history(status);
CREATE INDEX IF NOT EXISTS idx_monthly_report_history_sent_at ON monthly_report_history(sent_at);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_monthly_report_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_monthly_report_configs_updated_at
    BEFORE UPDATE ON monthly_report_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_monthly_report_configs_updated_at();

-- Políticas RLS (Row Level Security)
ALTER TABLE monthly_report_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_report_history ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas as operações (ajustar conforme necessário)
CREATE POLICY "Allow all operations on monthly_report_configs" ON monthly_report_configs
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on monthly_report_history" ON monthly_report_history
    FOR ALL USING (true) WITH CHECK (true);

-- Comentários para documentação
COMMENT ON TABLE monthly_report_configs IS 'Configurações de relatórios mensais por monitor';
COMMENT ON COLUMN monthly_report_configs.monitor_id IS 'ID do monitor associado';
COMMENT ON COLUMN monthly_report_configs.email IS 'E-mail para envio do relatório';
COMMENT ON COLUMN monthly_report_configs.send_day IS 'Dia do mês para envio (1-28)';
COMMENT ON COLUMN monthly_report_configs.is_active IS 'Se a configuração está ativa';

COMMENT ON TABLE monthly_report_history IS 'Histórico de envios de relatórios mensais';
COMMENT ON COLUMN monthly_report_history.config_id IS 'ID da configuração utilizada';
COMMENT ON COLUMN monthly_report_history.report_month IS 'Mês do relatório (1-12)';
COMMENT ON COLUMN monthly_report_history.report_year IS 'Ano do relatório';
COMMENT ON COLUMN monthly_report_history.status IS 'Status do envio: sent, failed, pending';
COMMENT ON COLUMN monthly_report_history.uptime_percentage IS 'Percentual de uptime do período';
COMMENT ON COLUMN monthly_report_history.total_checks IS 'Total de verificações no período';
COMMENT ON COLUMN monthly_report_history.successful_checks IS 'Verificações bem-sucedidas no período';
COMMENT ON COLUMN monthly_report_history.avg_response_time IS 'Tempo médio de resposta no período (ms)';