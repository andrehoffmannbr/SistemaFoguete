-- ============================================================
-- AUDITORIA 04: Verificação de CPFs
-- Data: 2025-10-31
-- Objetivo: Identificar CPFs inválidos ANTES de adicionar validação
-- Status: SOMENTE LEITURA - NÃO ALTERA DADOS
-- ============================================================

-- 1. Estatísticas gerais de CPFs
SELECT 
  'Estatísticas de CPF' as categoria,
  COUNT(*) as total_clientes,
  COUNT(cpf) as clientes_com_cpf,
  COUNT(*) - COUNT(cpf) as clientes_sem_cpf,
  ROUND(COUNT(cpf)::NUMERIC / COUNT(*) * 100, 2) as percentual_com_cpf
FROM customers;

-- 2. CPFs com tamanho incorreto
SELECT 
  'CPFs - Tamanho Incorreto' as problema,
  COUNT(*) as quantidade,
  ARRAY_AGG(DISTINCT length(regexp_replace(cpf, '[^0-9]', '', 'g'))) as tamanhos_encontrados
FROM customers
WHERE cpf IS NOT NULL
  AND length(regexp_replace(cpf, '[^0-9]', '', 'g')) != 11;

-- 3. Listar CPFs com tamanho errado
SELECT 
  id,
  name,
  cpf,
  length(regexp_replace(cpf, '[^0-9]', '', 'g')) as tamanho_numeros,
  'Tamanho incorreto (deve ter 11 dígitos)' as diagnostico
FROM customers
WHERE cpf IS NOT NULL
  AND length(regexp_replace(cpf, '[^0-9]', '', 'g')) != 11
LIMIT 10;

-- 4. CPFs conhecidos como inválidos (sequências iguais)
SELECT 
  'CPFs - Sequências Inválidas' as problema,
  COUNT(*) as quantidade
FROM customers
WHERE cpf IS NOT NULL
  AND regexp_replace(cpf, '[^0-9]', '', 'g') IN (
    '00000000000', '11111111111', '22222222222', '33333333333',
    '44444444444', '55555555555', '66666666666', '77777777777',
    '88888888888', '99999999999'
  );

-- 5. Listar CPFs com sequências inválidas
SELECT 
  id,
  name,
  cpf,
  regexp_replace(cpf, '[^0-9]', '', 'g') as cpf_numeros,
  'Sequência inválida conhecida' as diagnostico
FROM customers
WHERE cpf IS NOT NULL
  AND regexp_replace(cpf, '[^0-9]', '', 'g') IN (
    '00000000000', '11111111111', '22222222222', '33333333333',
    '44444444444', '55555555555', '66666666666', '77777777777',
    '88888888888', '99999999999'
  )
LIMIT 10;

-- 6. CPFs com caracteres inválidos (além de números, pontos e hífen)
SELECT 
  'CPFs - Caracteres Inválidos' as problema,
  COUNT(*) as quantidade
FROM customers
WHERE cpf IS NOT NULL
  AND cpf ~ '[^0-9.-]'; -- Regex: qualquer coisa que não seja número, ponto ou hífen

-- 7. Listar CPFs com caracteres estranhos
SELECT 
  id,
  name,
  cpf,
  'Contém caracteres inválidos' as diagnostico
FROM customers
WHERE cpf IS NOT NULL
  AND cpf ~ '[^0-9.-]'
LIMIT 10;

-- 8. Análise de formatos encontrados
SELECT 
  'Análise de Formatos' as categoria,
  COUNT(CASE WHEN cpf ~ '^\d{3}\.\d{3}\.\d{3}-\d{2}$' THEN 1 END) as formato_padrao,
  COUNT(CASE WHEN cpf ~ '^\d{11}$' THEN 1 END) as apenas_numeros,
  COUNT(CASE 
    WHEN cpf NOT LIKE '%.%' 
     AND cpf NOT LIKE '%-%' 
     AND length(regexp_replace(cpf, '[^0-9]', '', 'g')) = 11 
    THEN 1 
  END) as sem_formatacao,
  COUNT(CASE 
    WHEN cpf !~ '^\d{3}\.\d{3}\.\d{3}-\d{2}$' 
     AND cpf !~ '^\d{11}$' 
     AND length(regexp_replace(cpf, '[^0-9]', '', 'g')) = 11 
    THEN 1 
  END) as formato_misto
FROM customers
WHERE cpf IS NOT NULL;

-- 9. Total de CPFs que precisarão ser limpos
SELECT 
  'Resumo de Limpeza Necessária' as categoria,
  COUNT(*) as total_cpfs_cadastrados,
  COUNT(CASE 
    WHEN cpf IS NOT NULL
     AND (
       length(regexp_replace(cpf, '[^0-9]', '', 'g')) != 11
       OR regexp_replace(cpf, '[^0-9]', '', 'g') IN (
         '00000000000', '11111111111', '22222222222', '33333333333',
         '44444444444', '55555555555', '66666666666', '77777777777',
         '88888888888', '99999999999'
       )
       OR cpf ~ '[^0-9.-]'
     )
    THEN 1 
  END) as cpfs_invalidos_para_limpar,
  COUNT(CASE 
    WHEN cpf IS NOT NULL
     AND length(regexp_replace(cpf, '[^0-9]', '', 'g')) = 11
     AND regexp_replace(cpf, '[^0-9]', '', 'g') NOT IN (
       '00000000000', '11111111111', '22222222222', '33333333333',
       '44444444444', '55555555555', '66666666666', '77777777777',
       '88888888888', '99999999999'
     )
     AND cpf !~ '[^0-9.-]'
    THEN 1 
  END) as cpfs_aparentemente_validos
FROM customers
WHERE cpf IS NOT NULL;

-- ============================================================
-- INTERPRETAÇÃO DOS RESULTADOS:
-- 
-- cpfs_invalidos_para_limpar = 0: ✅ Pode adicionar validação diretamente
-- cpfs_invalidos_para_limpar > 0: ⚠️ Precisa limpar antes
-- 
-- ESTRATÉGIA DE LIMPEZA:
-- 1. Tamanho incorreto → SET NULL (dado inútil)
-- 2. Sequências conhecidas → SET NULL (fake)
-- 3. Caracteres inválidos → SET NULL (corrompido)
-- 4. Aparentemente válidos → Manter (pode ser real)
-- 
-- NOTA: Validação de dígito verificador será feita via função
-- ============================================================
