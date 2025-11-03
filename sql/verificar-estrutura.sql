-- Script SQL para verificar estrutura do banco Supabase
-- Execute este script conectado ao Supabase via SQLTools

-- 1. Listar todas as tabelas no schema public
SELECT 
    table_name,
    table_type
FROM 
    information_schema.tables
WHERE 
    table_schema = 'public'
ORDER BY 
    table_name;

-- 2. Verificar todas as colunas de cada tabela
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public'
ORDER BY 
    table_name, ordinal_position;

-- 3. Verificar indices
SELECT 
    tablename,
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    schemaname = 'public'
ORDER BY 
    tablename, indexname;

-- 4. Verificar constraints (chaves primárias, estrangeiras, etc)
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM 
    information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
WHERE 
    tc.table_schema = 'public'
ORDER BY 
    tc.table_name, tc.constraint_name;
