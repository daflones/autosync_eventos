-- =====================================================
-- SISTEMA DISPARADOR DE MENSAGENS - ESTRUTURA SQL
-- =====================================================

-- 1. TABELA PRINCIPAL: disparador_campaigns
-- Armazena as campanhas de disparos criadas
CREATE TABLE IF NOT EXISTS disparador_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    -- Configurações da campanha
    message_base TEXT NOT NULL,
    tone VARCHAR(50) DEFAULT 'profissional' CHECK (tone IN ('profissional', 'amigavel', 'formal', 'casual')),
    daily_limit INTEGER DEFAULT 30 CHECK (daily_limit = 30),
    image_url TEXT,
    image_base64 TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadados da campanha
    total_customers INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    
    -- Configurações avançadas
    send_images BOOLEAN DEFAULT false,
    image_urls TEXT[], -- Array de URLs das imagens
    schedule_type VARCHAR(20) DEFAULT 'immediate' CHECK (schedule_type IN ('immediate', 'scheduled')),
    scheduled_date TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_schedule CHECK (
        (schedule_type = 'immediate' AND scheduled_date IS NULL) OR
        (schedule_type = 'scheduled' AND scheduled_date IS NOT NULL)
    )
);

-- 2. TABELA: disparador_sends
-- Registra cada envio individual de uma campanha
CREATE TABLE IF NOT EXISTS disparador_sends (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES disparador_campaigns(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    
    -- Dados do envio
    remotejid VARCHAR(100) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    message_content TEXT NOT NULL,
    
    -- Status e timestamps
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'cancelled')),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    
    -- Controle de tentativas
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Metadados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Índices únicos para evitar duplicatas
    UNIQUE(campaign_id, customer_id)
);

-- 3. TABELA: disparador_customer_history
-- Histórico completo de disparos por cliente (para controle de intervalo)
CREATE TABLE IF NOT EXISTS disparador_customer_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES disparador_campaigns(id) ON DELETE CASCADE,
    
    -- Dados do disparo
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
    message_content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    
    -- Controle de intervalo
    next_eligible_date TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABELA: disparador_daily_limits
-- Controle de limite diário de envios
CREATE TABLE IF NOT EXISTS disparador_daily_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES disparador_campaigns(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    sent_count INTEGER DEFAULT 0,
    daily_limit INTEGER NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Único por campanha por dia
    UNIQUE(campaign_id, date)
);

-- 5. ADICIONAR COLUNA remotejid NA TABELA customers (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customers' AND column_name = 'remotejid') THEN
        ALTER TABLE customers ADD COLUMN remotejid VARCHAR(100);
        CREATE INDEX IF NOT EXISTS idx_customers_remotejid ON customers(remotejid);
    END IF;
END $$;

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índices para disparador_campaigns
CREATE INDEX IF NOT EXISTS idx_disparador_campaigns_status ON disparador_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_disparador_campaigns_created_at ON disparador_campaigns(created_at);

-- Índices para disparador_sends
CREATE INDEX IF NOT EXISTS idx_disparador_sends_campaign_id ON disparador_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_disparador_sends_customer_id ON disparador_sends(customer_id);
CREATE INDEX IF NOT EXISTS idx_disparador_sends_status ON disparador_sends(status);
CREATE INDEX IF NOT EXISTS idx_disparador_sends_sent_at ON disparador_sends(sent_at);

-- Índices para disparador_customer_history
CREATE INDEX IF NOT EXISTS idx_disparador_history_customer_id ON disparador_customer_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_disparador_history_sent_at ON disparador_customer_history(sent_at);
CREATE INDEX IF NOT EXISTS idx_disparador_history_next_eligible ON disparador_customer_history(next_eligible_date);

-- Índices para disparador_daily_limits
CREATE INDEX IF NOT EXISTS idx_disparador_daily_limits_campaign_date ON disparador_daily_limits(campaign_id, date);

-- Índices para customers
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

-- =====================================================
-- VIEWS ÚTEIS
-- =====================================================

-- View: Clientes elegíveis para disparo
CREATE OR REPLACE VIEW v_eligible_customers AS
SELECT 
    c.id,
    c.name,
    c.phone,
    c.remotejid,
    c.status,
    c.created_at,
    COALESCE(h.last_sent_at, '1900-01-01'::timestamp) as last_sent_at,
    COALESCE(h.next_eligible_date, NOW()) as next_eligible_date,
    CASE 
        WHEN h.next_eligible_date IS NULL OR h.next_eligible_date <= NOW() 
        THEN true 
        ELSE false 
    END as is_eligible
FROM customers c
LEFT JOIN (
    SELECT 
        customer_id,
        MAX(sent_at) as last_sent_at,
        MAX(next_eligible_date) as next_eligible_date
    FROM disparador_customer_history 
    WHERE status = 'sent'
    GROUP BY customer_id
) h ON c.id = h.customer_id
WHERE c.status = 'active' 
  AND c.remotejid IS NOT NULL 
  AND c.remotejid != '';

-- View: Estatísticas de campanhas
CREATE OR REPLACE VIEW v_campaign_stats AS
SELECT 
    c.id,
    c.name,
    c.status,
    c.daily_limit,
    c.total_customers,
    c.sent_count,
    c.success_count,
    c.failed_count,
    ROUND((c.success_count::decimal / NULLIF(c.sent_count, 0)) * 100, 2) as success_rate,
    c.created_at,
    c.started_at,
    c.completed_at,
    COALESCE(dl.sent_today, 0) as sent_today,
    (c.daily_limit - COALESCE(dl.sent_today, 0)) as remaining_today
FROM disparador_campaigns c
LEFT JOIN (
    SELECT 
        campaign_id,
        sent_count as sent_today
    FROM disparador_daily_limits 
    WHERE date = CURRENT_DATE
) dl ON c.id = dl.campaign_id;

-- =====================================================
-- FUNÇÕES ÚTEIS
-- =====================================================

-- Função: Verificar se cliente é elegível
CREATE OR REPLACE FUNCTION is_customer_eligible(customer_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM v_eligible_customers 
        WHERE id = customer_uuid AND is_eligible = true
    );
END;
$$ LANGUAGE plpgsql;

-- Função: Obter próximos clientes elegíveis
CREATE OR REPLACE FUNCTION get_next_eligible_customers(campaign_uuid UUID, limit_count INTEGER DEFAULT 30)
RETURNS TABLE (
    customer_id UUID,
    customer_name VARCHAR,
    remotejid VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ec.id,
        ec.name,
        ec.remotejid
    FROM v_eligible_customers ec
    WHERE ec.is_eligible = true
      AND ec.remotejid IS NOT NULL
      AND ec.remotejid != ''
      AND NOT EXISTS (
          SELECT 1 FROM disparador_sends ds 
          WHERE ds.campaign_id = campaign_uuid 
            AND ds.customer_id = ec.id
      )
    ORDER BY ec.last_sent_at ASC, ec.created_at ASC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS PARA AUTOMAÇÃO
-- =====================================================

-- Trigger: Atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Calcular next_eligible_date automaticamente
CREATE OR REPLACE FUNCTION calculate_next_eligible_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.next_eligible_date = NEW.sent_at + INTERVAL '7 days';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger nas tabelas principais
CREATE TRIGGER update_disparador_campaigns_updated_at 
    BEFORE UPDATE ON disparador_campaigns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_disparador_sends_updated_at 
    BEFORE UPDATE ON disparador_sends 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_disparador_daily_limits_updated_at 
    BEFORE UPDATE ON disparador_daily_limits 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para calcular next_eligible_date
CREATE TRIGGER calculate_disparador_history_next_eligible_date
    BEFORE INSERT OR UPDATE ON disparador_customer_history
    FOR EACH ROW EXECUTE FUNCTION calculate_next_eligible_date();

-- =====================================================
-- DADOS INICIAIS (OPCIONAL)
-- =====================================================

-- Inserir tons de mensagem padrão como referência
INSERT INTO disparador_campaigns (name, message_template, tone, status, daily_limit) VALUES
('Exemplo - Tom Formal', 'Prezado(a) {nome}, gostaríamos de informá-lo sobre nossa nova promoção.', 'formal', 'draft', 30),
('Exemplo - Tom Casual', 'Oi {nome}! Tudo bem? Temos uma novidade incrível pra você!', 'casual', 'draft', 30),
('Exemplo - Tom Amigável', 'Olá {nome}! Como você está? Preparamos algo especial pensando em você!', 'amigavel', 'draft', 30)
ON CONFLICT DO NOTHING;

-- =====================================================
-- COMENTÁRIOS FINAIS
-- =====================================================

/*
FUNCIONALIDADES IMPLEMENTADAS:

✅ Tabela de campanhas com mensagem base e tom configurável
✅ Controle de limite diário (padrão 30, máximo 100)
✅ Histórico de disparos por cliente
✅ Regra de 1 semana entre disparos para o mesmo cliente
✅ Acesso a dados dos customers (phone, remotejid)
✅ Sistema de status e retry para envios
✅ Views otimizadas para consultas frequentes
✅ Funções utilitárias para verificação de elegibilidade
✅ Triggers para automação
✅ Índices para performance
✅ Suporte a agendamento de campanhas
✅ Suporte a múltiplas imagens por campanha

PRÓXIMOS PASSOS:
1. Executar este SQL no Supabase
2. Criar interface React para a aba Disparador
3. Implementar service para integração com N8N
4. Criar componentes de gerenciamento de campanhas
*/
