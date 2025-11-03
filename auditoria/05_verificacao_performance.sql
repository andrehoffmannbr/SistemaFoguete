-- ============================================================
-- AUDITORIA 05: Verificação de Performance e Índices
-- Data: 2025-10-31
-- Objetivo: Identificar gargalos de performance
-- Status: SOMENTE LEITURA - NÃO ALTERA DADOS
-- ============================================================

-- 1. Tamanho das tabelas principais
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS tamanho_total,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS tamanho_dados,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS tamanho_indices
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'appointments', 'customers', 'financial_transactions',
    'subscriptions', 'pix_charges', 'proposals', 'tasks',
    'inventory_items', 'stock_movements'
  )
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 2. Contagem de registros por tabela
SELECT 'appointments' as tabela, COUNT(*) as total FROM appointments
UNION ALL
SELECT 'customers', COUNT(*) FROM customers
UNION ALL
SELECT 'financial_transactions', COUNT(*) FROM financial_transactions
UNION ALL
SELECT 'subscriptions', COUNT(*) FROM subscriptions
UNION ALL
SELECT 'pix_charges', COUNT(*) FROM pix_charges
UNION ALL
SELECT 'proposals', COUNT(*) FROM proposals
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'inventory_items', COUNT(*) FROM inventory_items
UNION ALL
SELECT 'stock_movements', COUNT(*) FROM stock_movements
ORDER BY total DESC;

-- 3. Índices existentes nas tabelas críticas
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'appointments', 'subscriptions', 'pix_charges', 
    'tasks', 'financial_transactions'
  )
ORDER BY tablename, indexname;

-- 4. Verificar índices faltando em appointments
SELECT 
  'Appointments - Índices' as categoria,
  COUNT(*) as total_registros,
  COUNT(DISTINCT user_id) as usuarios_distintos,
  COUNT(DISTINCT customer_id) as clientes_distintos,
  DATE_PART('day', MAX(start_time) - MIN(start_time)) as range_dias
FROM appointments;

-- 5. Verificar índices faltando em tasks
SELECT 
  'Tasks - Índices' as categoria,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pendentes,
  COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as em_progresso,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completadas
FROM tasks;

-- 6. Verificar índices faltando em financial_transactions
SELECT 
  'Financial Transactions - Índices' as categoria,
  COUNT(*) as total_registros,
  COUNT(DISTINCT user_id) as usuarios_distintos,
  DATE_PART('day', MAX(transaction_date) - MIN(transaction_date)) as range_dias
FROM financial_transactions;

-- 7. Verificar índices faltando em pix_charges
SELECT 
  'Pix Charges - Índices' as categoria,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pendentes,
  COUNT(CASE WHEN status = 'paid' THEN 1 END) as pagos,
  COUNT(CASE WHEN expires_at < NOW() AND status = 'pending' THEN 1 END) as expirados_pendentes
FROM pix_charges;

-- 8. Queries lentas potenciais (simulação)
EXPLAIN ANALYZE
SELECT * FROM appointments 
WHERE user_id = (SELECT id FROM auth.users LIMIT 1)
  AND start_time >= NOW() - INTERVAL '30 days'
  AND start_time <= NOW()
ORDER BY start_time;

-- 9. Verificar uso de sequential scans (table scans)
SELECT 
  schemaname,
  tablename,
  seq_scan as total_seq_scans,
  seq_tup_read as linhas_lidas_seq_scan,
  idx_scan as total_index_scans,
  CASE 
    WHEN seq_scan > 0 THEN ROUND((seq_tup_read::NUMERIC / seq_scan), 2)
    ELSE 0
  END as avg_linhas_por_seq_scan,
  CASE 
    WHEN seq_scan > idx_scan THEN '⚠️ Muitos seq scans - considerar índice'
    ELSE '✅ OK'
  END as diagnostico
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'appointments', 'subscriptions', 'pix_charges', 
    'tasks', 'financial_transactions'
  )
ORDER BY seq_scan DESC;

-- ============================================================
-- INTERPRETAÇÃO DOS RESULTADOS:
-- 
-- tamanho_total > 10MB: Considerar particionamento futuro
-- total_registros > 10.000: Índices são críticos
-- seq_scan > idx_scan: Falta índice apropriado
-- 
-- ÍNDICES RECOMENDADOS (se não existirem):
-- 1. appointments(user_id, start_time) - queries de dashboard
-- 2. tasks(user_id, status, due_date) - lista de tarefas
-- 3. financial_transactions(user_id, transaction_date) - relatórios
-- 4. pix_charges(status, expires_at) - cron de expiração
-- 
-- PRÓXIMO PASSO: Criar índices se performance for problema
-- ============================================================
