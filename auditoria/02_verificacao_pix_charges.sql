-- ============================================================
-- AUDITORIA 02: Verificação de PIX Charges
-- Data: 2025-10-31
-- Objetivo: Verificar customer_id antes de tornar obrigatório
-- Status: SOMENTE LEITURA - NÃO ALTERA DADOS
-- ============================================================

-- 1. Total de PIX charges no sistema
SELECT 
  'Total de Cobranças PIX' as metrica,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pendentes,
  COUNT(CASE WHEN status = 'paid' THEN 1 END) as pagas,
  COUNT(CASE WHEN status = 'expired' THEN 1 END) as expiradas,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as canceladas
FROM pix_charges;

-- 2. PIX charges SEM customer_id (problema!)
SELECT 
  'PIX sem Customer ID' as problema,
  COUNT(*) as quantidade,
  ROUND(COUNT(*)::NUMERIC / (SELECT COUNT(*) FROM pix_charges) * 100, 2) as percentual
FROM pix_charges
WHERE customer_id IS NULL;

-- 3. Listar detalhes dos PIX sem customer_id
SELECT 
  id,
  appointment_id,
  customer_name,
  amount,
  status,
  created_at,
  CASE 
    WHEN appointment_id IS NOT NULL THEN 'Pode recuperar via appointment'
    WHEN metadata->>'subscription_id' IS NOT NULL THEN 'Pode recuperar via subscription'
    ELSE '⚠️ SEM VÍNCULO - Difícil recuperar'
  END as estrategia_recuperacao
FROM pix_charges
WHERE customer_id IS NULL
ORDER BY created_at DESC
LIMIT 20;

-- 4. PIX charges com customer_id MAS customer foi deletado (órfãos)
SELECT 
  'PIX com Customer Deletado' as problema,
  COUNT(*) as quantidade
FROM pix_charges pc
WHERE pc.customer_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM customers c WHERE c.id = pc.customer_id
  );

-- 5. Listar órfãos (customer deletado)
SELECT 
  pc.id,
  pc.customer_id as customer_id_invalido,
  pc.customer_name,
  pc.amount,
  pc.status,
  pc.created_at,
  'ORPHAN: Customer foi deletado' as diagnostico
FROM pix_charges pc
WHERE pc.customer_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM customers c WHERE c.id = pc.customer_id
  )
LIMIT 10;

-- 6. Análise de vínculos (quantos podem ser recuperados)
SELECT 
  'Análise de Vínculos' as categoria,
  COUNT(*) as total_sem_customer_id,
  COUNT(CASE WHEN appointment_id IS NOT NULL THEN 1 END) as vinculados_appointment,
  COUNT(CASE WHEN metadata->>'subscription_id' IS NOT NULL THEN 1 END) as vinculados_subscription,
  COUNT(CASE 
    WHEN appointment_id IS NULL 
     AND metadata->>'subscription_id' IS NULL 
    THEN 1 
  END) as sem_vinculo_algum
FROM pix_charges
WHERE customer_id IS NULL;

-- 7. Verificar PIX vinculados a appointments órfãos
SELECT 
  'PIX com Appointment Órfão' as problema,
  COUNT(*) as quantidade
FROM pix_charges pc
WHERE pc.appointment_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM appointments a WHERE a.id = pc.appointment_id
  );

-- ============================================================
-- INTERPRETAÇÃO DOS RESULTADOS:
-- 
-- customer_id NULL = 0: ✅ Pode tornar NOT NULL diretamente
-- customer_id NULL > 0: ⚠️ Precisa popular antes
-- customer_id deletado > 0: ⚠️ Precisa limpar antes
-- 
-- ESTRATÉGIA DE RECUPERAÇÃO:
-- 1. Via appointment_id (mais confiável)
-- 2. Via metadata->subscription_id (confiável)
-- 3. Via user_id como fallback (menos ideal)
-- ============================================================
