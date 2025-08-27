-- Script para testar a funcionalidade de expiração de ingressos
-- Execute estes comandos no Supabase para testar se está funcionando

-- 1. PRIMEIRO: Ver tickets atuais que podem ser expirados
SELECT 
  t.id,
  t.payment_status,
  t.delivery_status,
  t.created_at,
  t.total_amount,
  e.nome as event_name,
  e.data as event_date,
  CASE 
    WHEN e.data < (NOW() - INTERVAL '24 hours') THEN 'Evento passou há +24h'
    WHEN t.created_at < (NOW() - INTERVAL '24 hours') AND t.delivery_status != 'delivered' THEN 'Ticket criado há +24h'
    ELSE 'Não deve expirar'
  END as should_expire
FROM tickets t
JOIN events e ON t.event_id = e.id
WHERE t.payment_status IN ('pending', 'failed', 'cancelled')
  AND t.delivery_status != 'delivered'
ORDER BY t.created_at DESC;

-- 2. SEGUNDO: Executar a função de expiração
SELECT public.expire_tickets_api();

-- 3. TERCEIRO: Ver o resultado - tickets que foram expirados
SELECT 
  t.id,
  t.payment_status,
  t.delivery_status,
  t.created_at,
  t.updated_at,
  t.total_amount,
  e.nome as event_name,
  e.data as event_date
FROM tickets t
JOIN events e ON t.event_id = e.id
WHERE t.payment_status = 'expired'
ORDER BY t.updated_at DESC;

-- 4. OPCIONAL: Criar um ticket de teste para verificar
-- (Descomente as linhas abaixo se quiser criar dados de teste)

/*
-- Inserir um evento passado para teste
INSERT INTO events (nome, data, horario, local)
VALUES ('Evento Teste Expirado', NOW() - INTERVAL '2 days', '20:00:00', 'Local Teste');

-- Pegar o ID do evento criado
-- SELECT id FROM events WHERE nome = 'Evento Teste Expirado';

-- Inserir um ticket antigo para teste (substitua EVENT_ID pelo ID real)
INSERT INTO tickets (event_id, customer_name, customer_email, customer_cpf, payment_status, delivery_status, total_amount, created_at)
VALUES (EVENT_ID, 'Cliente Teste', 'teste@email.com', '12345678901', 'pending', 'pending', 50.00, NOW() - INTERVAL '2 days');
*/

-- 5. VERIFICAÇÃO FINAL: Contar tickets por status
SELECT 
  payment_status,
  COUNT(*) as quantidade
FROM tickets
GROUP BY payment_status
ORDER BY payment_status;
