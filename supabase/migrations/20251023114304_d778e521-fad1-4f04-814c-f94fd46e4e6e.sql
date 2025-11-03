-- Tabela de propostas/orçamentos
CREATE TABLE public.proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  services JSONB NOT NULL DEFAULT '[]',
  total_amount NUMERIC NOT NULL,
  discount_percentage INTEGER DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  final_amount NUMERIC NOT NULL,
  deposit_percentage INTEGER DEFAULT 50,
  deposit_amount NUMERIC,
  before_images TEXT[] DEFAULT ARRAY[]::TEXT[],
  after_images TEXT[] DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'viewed', 'accepted', 'rejected', 'expired')),
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  viewed_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  signature_data TEXT,
  signature_ip TEXT,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  pix_charge_id UUID REFERENCES public.pix_charges(id) ON DELETE SET NULL,
  follow_up_sent_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own proposals"
ON public.proposals FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own proposals"
ON public.proposals FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own proposals"
ON public.proposals FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own proposals"
ON public.proposals FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_proposals_updated_at
BEFORE UPDATE ON public.proposals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function para criar agendamento e cobrança Pix quando proposta for aceita
CREATE OR REPLACE FUNCTION public.handle_proposal_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_customer RECORD;
  v_appointment_id UUID;
  v_pix_charge_id UUID;
BEGIN
  -- Só processa quando status muda para 'accepted'
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    -- Buscar informações do cliente
    SELECT * INTO v_customer
    FROM public.customers
    WHERE id = NEW.customer_id;
    
    IF v_customer IS NOT NULL AND NEW.deposit_amount > 0 THEN
      -- Criar cobrança Pix para o sinal
      INSERT INTO public.pix_charges (
        user_id,
        customer_id,
        customer_name,
        customer_phone,
        amount,
        status,
        expires_at,
        metadata
      ) VALUES (
        NEW.user_id,
        NEW.customer_id,
        v_customer.name,
        v_customer.phone,
        NEW.deposit_amount,
        'pending',
        now() + interval '24 hours',
        jsonb_build_object(
          'proposal_id', NEW.id,
          'type', 'deposit',
          'description', 'Sinal da proposta: ' || NEW.title
        )
      )
      RETURNING id INTO v_pix_charge_id;
      
      -- Atualizar proposta com ID da cobrança Pix
      UPDATE public.proposals
      SET pix_charge_id = v_pix_charge_id
      WHERE id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para processar aceitação de proposta
CREATE TRIGGER handle_proposal_acceptance_trigger
AFTER INSERT OR UPDATE ON public.proposals
FOR EACH ROW
EXECUTE FUNCTION public.handle_proposal_acceptance();