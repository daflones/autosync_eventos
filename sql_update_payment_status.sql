-- SQL para permitir status 'expired' na coluna payment_status da tabela tickets
-- Execute este comando no seu banco de dados Supabase

-- Primeiro, verificar os valores atuais permitidos (opcional)
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'tickets' AND column_name = 'payment_status';

-- Atualizar a constraint da coluna payment_status para incluir 'expired'
ALTER TABLE tickets 
DROP CONSTRAINT IF EXISTS tickets_payment_status_check;

ALTER TABLE tickets 
ADD CONSTRAINT tickets_payment_status_check 
CHECK (payment_status IN ('pending', 'paid', 'failed', 'cancelled', 'expired'));

-- Verificar se a alteração foi aplicada corretamente
-- SELECT conname, consrc 
-- FROM pg_constraint 
-- WHERE conrelid = 'tickets'::regclass AND conname LIKE '%payment_status%';
