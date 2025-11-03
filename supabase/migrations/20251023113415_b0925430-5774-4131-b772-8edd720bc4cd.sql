-- Tabela de avaliações/feedbacks
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de cupons de desconto
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  discount_percentage INTEGER,
  discount_amount NUMERIC,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de cartões fidelidade
CREATE TABLE public.loyalty_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  total_visits INTEGER NOT NULL DEFAULT 0,
  current_stamps INTEGER NOT NULL DEFAULT 0,
  stamps_required INTEGER NOT NULL DEFAULT 5,
  rewards_redeemed INTEGER NOT NULL DEFAULT 0,
  last_visit_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, customer_id)
);

-- Tabela de histórico de carimbos
CREATE TABLE public.loyalty_stamps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loyalty_card_id UUID NOT NULL REFERENCES public.loyalty_cards(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  stamps_added INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_stamps ENABLE ROW LEVEL SECURITY;

-- Policies para reviews
CREATE POLICY "Users can view their own reviews"
ON public.reviews FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reviews"
ON public.reviews FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
ON public.reviews FOR UPDATE
USING (auth.uid() = user_id);

-- Policies para coupons
CREATE POLICY "Users can view their own coupons"
ON public.coupons FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own coupons"
ON public.coupons FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own coupons"
ON public.coupons FOR UPDATE
USING (auth.uid() = user_id);

-- Policies para loyalty_cards
CREATE POLICY "Users can view their own loyalty cards"
ON public.loyalty_cards FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own loyalty cards"
ON public.loyalty_cards FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own loyalty cards"
ON public.loyalty_cards FOR UPDATE
USING (auth.uid() = user_id);

-- Policies para loyalty_stamps
CREATE POLICY "Users can view their own loyalty stamps"
ON public.loyalty_stamps FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.loyalty_cards
    WHERE loyalty_cards.id = loyalty_stamps.loyalty_card_id
    AND loyalty_cards.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own loyalty stamps"
ON public.loyalty_stamps FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.loyalty_cards
    WHERE loyalty_cards.id = loyalty_card_id
    AND loyalty_cards.user_id = auth.uid()
  )
);

-- Triggers para updated_at
CREATE TRIGGER update_reviews_updated_at
BEFORE UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coupons_updated_at
BEFORE UPDATE ON public.coupons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loyalty_cards_updated_at
BEFORE UPDATE ON public.loyalty_cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function para adicionar carimbo automaticamente após agendamento
CREATE OR REPLACE FUNCTION public.add_loyalty_stamp_on_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_loyalty_card_id UUID;
BEGIN
  -- Só adiciona carimbo se o status for 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Buscar ou criar cartão fidelidade
    INSERT INTO public.loyalty_cards (user_id, customer_id, total_visits, current_stamps, last_visit_at)
    VALUES (NEW.user_id, NEW.customer_id, 1, 1, NEW.end_time)
    ON CONFLICT (user_id, customer_id) DO UPDATE
    SET 
      total_visits = loyalty_cards.total_visits + 1,
      current_stamps = CASE 
        WHEN loyalty_cards.current_stamps + 1 >= loyalty_cards.stamps_required 
        THEN 0 
        ELSE loyalty_cards.current_stamps + 1 
      END,
      rewards_redeemed = CASE 
        WHEN loyalty_cards.current_stamps + 1 >= loyalty_cards.stamps_required 
        THEN loyalty_cards.rewards_redeemed + 1 
        ELSE loyalty_cards.rewards_redeemed 
      END,
      last_visit_at = NEW.end_time,
      updated_at = now()
    RETURNING id INTO v_loyalty_card_id;
    
    -- Se não retornou ID, buscar o ID do cartão existente
    IF v_loyalty_card_id IS NULL THEN
      SELECT id INTO v_loyalty_card_id
      FROM public.loyalty_cards
      WHERE user_id = NEW.user_id AND customer_id = NEW.customer_id;
    END IF;
    
    -- Adicionar registro de carimbo
    INSERT INTO public.loyalty_stamps (loyalty_card_id, appointment_id, stamps_added)
    VALUES (v_loyalty_card_id, NEW.id, 1);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para adicionar carimbo automaticamente
CREATE TRIGGER add_loyalty_stamp_trigger
AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.add_loyalty_stamp_on_appointment();