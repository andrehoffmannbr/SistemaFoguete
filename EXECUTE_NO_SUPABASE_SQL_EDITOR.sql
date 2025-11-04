-- ========================================
-- COPIE E COLE ESTE SQL NO SUPABASE DASHBOARD
-- SQL Editor -> New Query
-- ========================================

-- PASSO 1: Recriar a função com SECURITY DEFINER
CREATE OR REPLACE FUNCTION create_trial_subscription()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_subscriptions (
    user_id,
    status,
    plan,
    trial_ends_at,
    current_period_start,
    current_period_end
  ) VALUES (
    NEW.id,
    'trial',
    'monthly',
    NOW() + INTERVAL '7 days',
    NOW(),
    NOW() + INTERVAL '7 days'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- PASSO 2: Adicionar policy de INSERT (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_subscriptions' 
    AND policyname = 'Usuários podem criar sua própria assinatura'
  ) THEN
    CREATE POLICY "Usuários podem criar sua própria assinatura"
      ON user_subscriptions
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Comentário de documentação
COMMENT ON FUNCTION create_trial_subscription IS 'Cria automaticamente assinatura trial de 7 dias quando usuário se registra. Usa SECURITY DEFINER para bypassing RLS.';

-- ========================================
-- VERIFICAÇÃO: Execute após o script acima
-- ========================================
-- Verificar se a função foi atualizada corretamente
SELECT 
  proname as function_name,
  prosecdef as is_security_definer,
  proconfig as settings
FROM pg_proc 
WHERE proname = 'create_trial_subscription';

-- Verificar se a policy foi criada
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  cmd
FROM pg_policies 
WHERE tablename = 'user_subscriptions';
