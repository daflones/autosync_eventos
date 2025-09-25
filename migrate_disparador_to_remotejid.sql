-- =====================================================
-- SCRIPT COMPLETO: DISPARADOR COM REMOTEJID
-- =====================================================

-- 1. CRIAR VIEW v_eligible_customers SIMPLIFICADA
-- Mostrar todos os clientes com remotejid preenchido
CREATE OR REPLACE VIEW v_eligible_customers AS
SELECT 
    c.id,
    c.name,
    c.phone,
    c.remotejid,
    c.status,
    c.created_at,
    COALESCE(h.last_sent_at, '1900-01-01'::timestamp) as last_sent_at,
    COALESCE(h.next_eligible_date, '1900-01-01'::timestamp) as next_eligible_date,
    CASE 
        WHEN h.last_sent_at IS NULL THEN true
        WHEN h.last_sent_at < (NOW() - INTERVAL '7 days') THEN true
        ELSE false 
    END as is_eligible
FROM customers c
LEFT JOIN (
    SELECT 
        customer_id,
        MAX(sent_at) as last_sent_at,
        MAX(sent_at) + INTERVAL '7 days' as next_eligible_date
    FROM disparador_customer_history 
    WHERE status = 'sent'
    GROUP BY customer_id
) h ON c.id = h.customer_id
WHERE c.remotejid IS NOT NULL 
  AND c.remotejid != '';

-- 2. ATUALIZAR FUNÇÃO get_next_eligible_customers
-- Buscar clientes elegíveis e gerar remotejid dinamicamente se necessário
DROP FUNCTION IF EXISTS get_next_eligible_customers(uuid,integer);
CREATE OR REPLACE FUNCTION get_next_eligible_customers(campaign_uuid UUID, limit_count INTEGER DEFAULT 30)
RETURNS TABLE (
    customer_id UUID,
    customer_name TEXT,
    remotejid TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name::TEXT,
        CASE 
            -- Se já tem remotejid válido, usar ele
            WHEN c.remotejid IS NOT NULL AND c.remotejid != '' AND c.remotejid != 'null' THEN c.remotejid::TEXT
            -- Se não tem remotejid mas tem phone, gerar baseado no phone
            WHEN c.phone IS NOT NULL AND c.phone != '' THEN
                CASE 
                    WHEN LENGTH(REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g')) = 11 THEN 
                        REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g') || '@s.whatsapp.net'
                    WHEN LENGTH(REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g')) = 15 THEN 
                        REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g') || '@lid'
                    ELSE c.remotejid::TEXT
                END
            ELSE c.remotejid::TEXT
        END as remotejid
    FROM customers c
    LEFT JOIN disparador_customer_history h ON c.id = h.customer_id AND h.status = 'sent'
    WHERE (
        -- Tem remotejid válido
        (c.remotejid IS NOT NULL AND c.remotejid != '' AND c.remotejid != 'null')
        OR 
        -- Ou tem phone válido para gerar remotejid
        (c.phone IS NOT NULL AND c.phone != '' AND LENGTH(REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g')) IN (11, 15))
    )
    AND (h.sent_at IS NULL OR h.sent_at < (NOW() - INTERVAL '7 days'))
    AND NOT EXISTS (
        SELECT 1 FROM disparador_sends ds 
        WHERE ds.campaign_id = campaign_uuid 
          AND ds.customer_id = c.id
    )
    GROUP BY c.id, c.name, c.remotejid, c.phone, c.created_at
    ORDER BY c.created_at ASC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- 3. CRIAR VIEW PARA ESTATÍSTICAS DAS CAMPANHAS
DROP VIEW IF EXISTS v_campaign_stats;
CREATE VIEW v_campaign_stats AS
SELECT 
    c.id,
    c.name,
    COALESCE(COUNT(ds.id), 0) as sent_count,
    COALESCE(COUNT(CASE WHEN DATE(ds.sent_at) = CURRENT_DATE THEN 1 END), 0) as sent_today,
    COALESCE(COUNT(CASE WHEN ds.status = 'sent' THEN 1 END), 0) as success_count,
    CASE 
        WHEN COUNT(ds.id) > 0 THEN 
            ROUND((COUNT(CASE WHEN ds.status = 'sent' THEN 1 END)::DECIMAL / COUNT(ds.id)) * 100, 1)
        ELSE 0 
    END as success_rate
FROM disparador_campaigns c
LEFT JOIN disparador_sends ds ON c.id = ds.campaign_id
GROUP BY c.id, c.name;

-- 4. CRIAR ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_disparador_sends_campaign_customer ON disparador_sends(campaign_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_disparador_customer_history_customer_status ON disparador_customer_history(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_customers_remotejid ON customers(remotejid) WHERE remotejid IS NOT NULL;

-- 4. VERIFICAR ESTRUTURA ATUAL
SELECT 'Tabela disparador_sends estrutura:' as info;
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default 
FROM information_schema.columns 
WHERE table_name = 'disparador_sends' 
ORDER BY ordinal_position;

-- 5. ANÁLISE DOS TELEFONES E PREENCHIMENTO DE REMOTEJID
SELECT 'ANÁLISE DOS TELEFONES NA COLUNA PHONE:' as info;

-- Analisar distribuição por tamanho de telefone
SELECT 
    LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) as tamanho_numerico,
    COUNT(*) as quantidade
FROM customers 
WHERE phone IS NOT NULL AND phone != ''
GROUP BY LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'))
ORDER BY tamanho_numerico;

-- Mostrar exemplos de telefones por tamanho
SELECT 'EXEMPLOS DE TELEFONES POR TAMANHO:' as info;
SELECT 
    LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) as tamanho,
    phone as exemplo
FROM customers 
WHERE phone IS NOT NULL AND phone != ''
ORDER BY LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')), phone
LIMIT 20;

-- 6. PREENCHER REMOTEJID BASEADO NO PHONE
SELECT 'PREENCHENDO REMOTEJID BASEADO NO PHONE...' as info;

-- Atualizar clientes com telefones de 11 dígitos (WhatsApp normal)
UPDATE customers 
SET remotejid = REGEXP_REPLACE(phone, '[^0-9]', '', 'g') || '@s.whatsapp.net'
WHERE (remotejid IS NULL OR remotejid = '' OR remotejid = 'null')
  AND phone IS NOT NULL 
  AND phone != ''
  AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) = 11;

-- Atualizar clientes com telefones de 15 dígitos (WhatsApp Business/Internacional)
UPDATE customers 
SET remotejid = REGEXP_REPLACE(phone, '[^0-9]', '', 'g') || '@lid'
WHERE (remotejid IS NULL OR remotejid = '' OR remotejid = 'null')
  AND phone IS NOT NULL 
  AND phone != ''
  AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) = 15;

-- 7. VERIFICAR RESULTADOS APÓS ATUALIZAÇÃO
SELECT 'RESULTADOS APÓS ATUALIZAÇÃO:' as info;

SELECT 'Total de clientes:' as categoria, COUNT(*) as quantidade
FROM customers
UNION ALL
SELECT 'Com remotejid preenchido:', COUNT(*)
FROM customers 
WHERE remotejid IS NOT NULL AND remotejid != '' AND remotejid != 'null'
UNION ALL
SELECT 'Com @s.whatsapp.net:', COUNT(*)
FROM customers 
WHERE remotejid LIKE '%@s.whatsapp.net'
UNION ALL
SELECT 'Com @lid:', COUNT(*)
FROM customers 
WHERE remotejid LIKE '%@lid';

-- Mostrar exemplos dos remotejid criados
SELECT 'EXEMPLOS DE REMOTEJID CRIADOS:' as info;
SELECT 
    phone,
    remotejid,
    CASE 
        WHEN remotejid LIKE '%@s.whatsapp.net' THEN '11 dígitos'
        WHEN remotejid LIKE '%@lid' THEN '15 dígitos'
        ELSE 'Outro'
    END as tipo
FROM customers 
WHERE remotejid IS NOT NULL AND remotejid != '' AND remotejid != 'null'
ORDER BY created_at DESC
LIMIT 20;

-- 8. ADICIONAR CAMPOS PARA SISTEMA DE AGENDAMENTO
ALTER TABLE disparador_campaigns 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS estimated_end_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

ALTER TABLE disparador_sends 
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP;

-- Atualizar constraint de status para incluir novos valores
ALTER TABLE disparador_campaigns DROP CONSTRAINT IF EXISTS disparador_campaigns_status_check;
ALTER TABLE disparador_campaigns ADD CONSTRAINT disparador_campaigns_status_check 
CHECK (status IN ('draft', 'dispatching', 'paused', 'completed', 'cancelled'));

-- Atualizar constraint de status dos envios
ALTER TABLE disparador_sends DROP CONSTRAINT IF EXISTS disparador_sends_status_check;
ALTER TABLE disparador_sends ADD CONSTRAINT disparador_sends_status_check 
CHECK (status IN ('scheduled', 'sent', 'failed', 'cancelled'));

-- 9. CRIAR FUNÇÃO PARA INCREMENTAR CONTADOR DE ENVIOS
CREATE OR REPLACE FUNCTION increment_campaign_sent_count(campaign_uuid UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE disparador_campaigns 
    SET sent_count = sent_count + 1
    WHERE id = campaign_uuid;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMENTÁRIOS FINAIS
-- =====================================================

/*
SISTEMA DISPARADOR ATUALIZADO:

**Novo Fluxo:**
1. Usuário cria campanha (status: 'draft')
2. Usuário inicia disparo → status: 'dispatching'
3. Sistema agenda envios individuais com intervalo de 10 minutos
4. Cada envio é processado individualmente via webhook
5. Usuário pode pausar (status: 'paused') ou aguardar conclusão (status: 'completed')

**Campos Adicionados:**
- disparador_campaigns: started_at, estimated_end_at, paused_at, completed_at
- disparador_sends: scheduled_at

**Status Atualizados:**
- Campanhas: draft, dispatching, paused, completed, cancelled
- Envios: scheduled, sent, failed, cancelled

**Funcionalidades:**
- ✅ Webhooks individuais com intervalo de 10 minutos
- ✅ Bloqueio de outras campanhas durante execução
- ✅ Pausar/retomar campanhas
- ✅ Clientes não enviados continuam elegíveis
- ✅ Apenas visualizar e deletar campanhas (sem edição)

PRÓXIMOS PASSOS:
1. Execute este SQL no Supabase
2. Configure cron job para processar envios agendados
3. Teste o novo sistema de disparos
*/