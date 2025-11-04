-- Migration: Corrigir trigger e RLS para permitir criação automática de trial subscription
-- Data: 2025-11-04
-- Descrição: Adiciona SECURITY DEFINER ao trigger e policy de INSERT para resolver erro de cadastro

-- PASSO 1: Recriar a função com SECURITY DEFINER
-- Isso permite que o trigger execute com permissões do dono (postgres), não do usuário sendo criado
CREATE OR REPLACE FUNCTION create_trial_subscription()
RETURNS TRIGGER 
SECURITY DEFINER  -- Executa com permissões do owner, bypassa RLS
SET search_path = public  -- Segurança: define schema explicitamente
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

-- PASSO 2: Adicionar policy de INSERT para user_subscriptions
-- Permite que usuários (e Edge Functions) possam inserir sua própria assinatura
CREATE POLICY "Usuários podem criar sua própria assinatura"
  ON user_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Comentário de documentação
COMMENT ON FUNCTION create_trial_subscription IS 'Cria automaticamente assinatura trial de 7 dias quando usuário se registra. Usa SECURITY DEFINER para bypassing RLS durante insert trigger.';
