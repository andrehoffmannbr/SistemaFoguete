-- Atualizar enum de status de proposals para incluir os novos estados
-- Primeiro, adicionar os novos valores ao tipo existente se não existirem
DO $$ 
BEGIN
  -- Verificar se o status 'canceled' já existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'canceled' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'proposal_status_enum')
  ) THEN
    -- Se não existe tipo enum, vamos usar check constraint
    NULL;
  END IF;
END $$;

-- Remover constraint antiga se existir
ALTER TABLE public.proposals DROP CONSTRAINT IF EXISTS proposals_status_check;

-- Adicionar nova constraint com todos os status
ALTER TABLE public.proposals 
ADD CONSTRAINT proposals_status_check 
CHECK (status IN ('pending', 'sent', 'accepted', 'rejected', 'confirmed', 'canceled'));

-- Atualizar status 'accepted' existentes para 'confirmed' se necessário
UPDATE public.proposals 
SET status = 'confirmed' 
WHERE status = 'accepted';

-- Comentário explicativo
COMMENT ON COLUMN public.proposals.status IS 'Status da proposta: pending (novo), sent (enviado), confirmed (confirmado com agendamento), canceled (cancelado), rejected (rejeitado pelo cliente)';
