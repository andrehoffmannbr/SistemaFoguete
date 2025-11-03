-- ============================================================
-- AUDITORIA 01: Verificação de Subscriptions
-- Data: 2025-10-31
-- Objetivo: Identificar dados órfãos ANTES de adicionar FKs
-- Status: SOMENTE LEITURA - NÃO ALTERA DADOS
-- ============================================================

-- 1. Total de subscriptions no sistema
SELECT 
  'Total de Assinaturas' as metrica,
  COUNT(*) as quantidade,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as ativas,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as canceladas,
  COUNT(CASE WHEN status = 'payment_failed' THEN 1 END) as falhas_pagamento
FROM subscriptions;

-- 2. Verificar subscriptions com customer_id inválido (órfãs)
SELECT 
  'Subscriptions Órfãs (Customer)' as problema,
  COUNT(*) as quantidade,
  ARRAY_AGG(s.id) as ids_orfaos
FROM subscriptions s
LEFT JOIN customers c ON s.customer_id = c.id
WHERE c.id IS NULL;

-- 3. Listar detalhes das subscriptions órfãs (se existirem)
SELECT 
  s.id,
  s.customer_id as customer_id_invalido,
  s.plan_id,
  s.status,
  s.created_at,
  'ORPHAN: Customer não existe mais' as diagnostico
FROM subscriptions s
LEFT JOIN customers c ON s.customer_id = c.id
WHERE c.id IS NULL
LIMIT 10;

-- 4. Verificar subscriptions com plan_id inválido
SELECT 
  'Subscriptions Órfãs (Plan)' as problema,
  COUNT(*) as quantidade,
  ARRAY_AGG(s.id) as ids_orfaos
FROM subscriptions s
LEFT JOIN subscription_plans p ON s.plan_id = p.id
WHERE p.id IS NULL;

-- 5. Listar detalhes das subscriptions com plan órfão
SELECT 
  s.id,
  s.customer_id,
  s.plan_id as plan_id_invalido,
  s.status,
  s.created_at,
  'ORPHAN: Plan não existe mais' as diagnostico
FROM subscriptions s
LEFT JOIN subscription_plans p ON s.plan_id = p.id
WHERE p.id IS NULL
LIMIT 10;

-- 6. Verificar subscriptions ativas sem next_billing_date
SELECT 
  'Subscriptions sem Data de Cobrança' as problema,
  COUNT(*) as quantidade
FROM subscriptions
WHERE status = 'active'
  AND (next_billing_date IS NULL OR next_billing_date < NOW());

-- 7. Estatísticas gerais de relacionamentos
SELECT 
  'Estatísticas Gerais' as secao,
  COUNT(DISTINCT s.customer_id) as clientes_unicos,
  COUNT(DISTINCT s.plan_id) as planos_unicos,
  COUNT(DISTINCT s.user_id) as usuarios_sistema
FROM subscriptions s;

-- ============================================================
-- INTERPRETAÇÃO DOS RESULTADOS:
-- 
-- Se "quantidade" em Órfãs = 0: ✅ SEGURO para adicionar FK
-- Se "quantidade" em Órfãs > 0: ⚠️ PRECISA LIMPAR antes de FK
-- 
-- PRÓXIMO PASSO: Copiar resultado e analisar
-- ============================================================
