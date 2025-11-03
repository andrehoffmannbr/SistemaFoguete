-- Adicionar coluna CPF na tabela customers
ALTER TABLE public.customers 
ADD COLUMN cpf TEXT;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.customers.cpf IS 'CPF do cliente (opcional)';