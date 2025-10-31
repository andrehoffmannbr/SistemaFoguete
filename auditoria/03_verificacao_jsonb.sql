-- ============================================================
-- AUDITORIA 03: Verificação de Campos JSONB
-- Data: 2025-10-31
-- Objetivo: Identificar JSONB inválidos ANTES de adicionar CHECKs
-- Status: SOMENTE LEITURA - NÃO ALTERA DADOS
-- ============================================================

-- 1. SUBSCRIPTION_PLANS: Verificar included_services
SELECT 
  'Subscription Plans - JSONB' as tabela,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN included_services IS NULL THEN 1 END) as nulos,
  COUNT(CASE WHEN jsonb_typeof(included_services) != 'array' THEN 1 END) as tipo_errado,
  COUNT(CASE WHEN included_services = '[]'::jsonb THEN 1 END) as array_vazio_ok
FROM subscription_plans;

-- 2. Listar plans com JSONB inválido
SELECT 
  id,
  name,
  included_services,
  jsonb_typeof(included_services) as tipo_atual,
  CASE 
    WHEN included_services IS NULL THEN '⚠️ NULL - precisa ser []'
    WHEN jsonb_typeof(included_services) != 'array' THEN '⚠️ Não é array'
    ELSE '✅ OK'
  END as diagnostico
FROM subscription_plans
WHERE included_services IS NULL 
   OR jsonb_typeof(included_services) != 'array'
LIMIT 10;

-- 3. BUSINESS_SETTINGS: Verificar working_hours
SELECT 
  'Business Settings - JSONB' as tabela,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN working_hours IS NULL THEN 1 END) as nulos,
  COUNT(CASE WHEN jsonb_typeof(working_hours) != 'object' THEN 1 END) as tipo_errado,
  COUNT(CASE 
    WHEN working_hours ? 'monday' 
     AND working_hours ? 'tuesday'
     AND working_hours ? 'wednesday' 
    THEN 1 
  END) as estrutura_completa
FROM business_settings;

-- 4. Listar settings com JSONB inválido
SELECT 
  id,
  business_name,
  working_hours,
  jsonb_typeof(working_hours) as tipo_atual,
  CASE 
    WHEN working_hours IS NULL THEN '⚠️ NULL - precisa estrutura completa'
    WHEN jsonb_typeof(working_hours) != 'object' THEN '⚠️ Não é objeto'
    WHEN NOT (working_hours ? 'monday') THEN '⚠️ Falta estrutura de dias'
    ELSE '✅ OK'
  END as diagnostico
FROM business_settings
WHERE working_hours IS NULL 
   OR jsonb_typeof(working_hours) != 'object'
   OR NOT (working_hours ? 'monday')
LIMIT 10;

-- 5. PROPOSALS: Verificar services
SELECT 
  'Proposals - JSONB' as tabela,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN services IS NULL THEN 1 END) as nulos,
  COUNT(CASE WHEN jsonb_typeof(services) != 'array' THEN 1 END) as tipo_errado,
  COUNT(CASE WHEN services = '[]'::jsonb THEN 1 END) as array_vazio
FROM proposals;

-- 6. Listar proposals com JSONB inválido
SELECT 
  id,
  title,
  services,
  jsonb_typeof(services) as tipo_atual,
  CASE 
    WHEN services IS NULL THEN '⚠️ NULL - precisa ser array'
    WHEN jsonb_typeof(services) != 'array' THEN '⚠️ Não é array'
    WHEN services = '[]'::jsonb THEN '⚠️ Array vazio - proposta sem serviços?'
    ELSE '✅ OK'
  END as diagnostico
FROM proposals
WHERE services IS NULL 
   OR jsonb_typeof(services) != 'array'
LIMIT 10;

-- 7. INVENTORY_ITEMS: Verificar kit_items
SELECT 
  'Inventory Items - JSONB' as tabela,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN is_kit = true THEN 1 END) as total_kits,
  COUNT(CASE WHEN is_kit = true AND kit_items IS NULL THEN 1 END) as kits_sem_items,
  COUNT(CASE WHEN is_kit = true AND jsonb_typeof(kit_items) != 'array' THEN 1 END) as kits_tipo_errado
FROM inventory_items;

-- 8. TASKS: Verificar metadata
SELECT 
  'Tasks - JSONB' as tabela,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN metadata IS NULL THEN 1 END) as nulos,
  COUNT(CASE WHEN jsonb_typeof(metadata) != 'object' THEN 1 END) as tipo_errado,
  COUNT(CASE WHEN metadata = '{}'::jsonb THEN 1 END) as objeto_vazio_ok
FROM tasks;

-- 9. PIX_CHARGES: Verificar metadata
SELECT 
  'Pix Charges - JSONB' as tabela,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN metadata IS NULL THEN 1 END) as nulos,
  COUNT(CASE WHEN jsonb_typeof(metadata) != 'object' THEN 1 END) as tipo_errado,
  COUNT(CASE WHEN metadata = '{}'::jsonb THEN 1 END) as objeto_vazio_ok
FROM pix_charges;

-- ============================================================
-- INTERPRETAÇÃO DOS RESULTADOS:
-- 
-- Para campos que DEVEM ser array (included_services, services):
--   - NULL ou tipo_errado > 0: ⚠️ Precisa corrigir antes de CHECK
--   - array_vazio é OK (pode ser proposta/plan sem itens)
-- 
-- Para campos que DEVEM ser object (working_hours, metadata):
--   - NULL ou tipo_errado > 0: ⚠️ Precisa corrigir antes de CHECK
--   - objeto_vazio {} é OK
-- 
-- PRIORIDADE DE CORREÇÃO:
-- 1. subscription_plans.included_services (afeta Edge Function)
-- 2. business_settings.working_hours (afeta UI de horários)
-- 3. proposals.services (afeta cálculo de valores)
-- 4. Demais são menos críticos (metadata)
-- ============================================================
