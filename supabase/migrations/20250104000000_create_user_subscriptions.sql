-- Tabela de assinaturas de usuários (SaaS)
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'expired', 'cancelled')),
  plan VARCHAR(20) NOT NULL CHECK (plan IN ('monthly', 'semiannual', 'annual')),
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  auto_renew BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Garantir apenas uma assinatura ativa por usuário
  CONSTRAINT unique_active_subscription UNIQUE (user_id)
);

-- Tabela de pagamentos de assinatura
CREATE TABLE subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_subscription_id UUID NOT NULL REFERENCES user_subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan VARCHAR(20) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('pix', 'credit_card')),
  mercado_pago_preference_id VARCHAR(255),
  mercado_pago_payment_id VARCHAR(255),
  mercado_pago_payment_link TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'refunded')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_period_end ON user_subscriptions(current_period_end);
CREATE INDEX idx_subscription_payments_user_id ON subscription_payments(user_id);
CREATE INDEX idx_subscription_payments_status ON subscription_payments(status);
CREATE INDEX idx_subscription_payments_mp_payment_id ON subscription_payments(mercado_pago_payment_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_payments_updated_at
  BEFORE UPDATE ON subscription_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para criar trial automático quando usuário se cadastra
CREATE OR REPLACE FUNCTION create_trial_subscription()
RETURNS TRIGGER AS $$
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

-- Trigger para criar trial quando novo usuário se cadastra
CREATE TRIGGER on_user_created_create_trial
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_trial_subscription();

-- RLS (Row Level Security) Policies
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

-- Políticas para user_subscriptions
CREATE POLICY "Usuários podem ver apenas sua própria assinatura"
  ON user_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar apenas sua própria assinatura"
  ON user_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Políticas para subscription_payments
CREATE POLICY "Usuários podem ver apenas seus próprios pagamentos"
  ON subscription_payments
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios pagamentos"
  ON subscription_payments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Comentários para documentação
COMMENT ON TABLE user_subscriptions IS 'Gerencia assinaturas SaaS dos usuários do sistema';
COMMENT ON TABLE subscription_payments IS 'Registra pagamentos de assinaturas via Mercado Pago';
COMMENT ON COLUMN user_subscriptions.status IS 'Status: trial (7 dias grátis), active (pago), expired (vencido), cancelled (cancelado)';
COMMENT ON COLUMN user_subscriptions.plan IS 'Plano: monthly (R$97), semiannual (R$582), annual (R$1164)';
COMMENT ON COLUMN subscription_payments.payment_method IS 'Método: pix ou credit_card';
