-- Financial categories table
CREATE TABLE public.financial_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Financial transactions table
CREATE TABLE public.financial_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Pix charges table (CobV)
CREATE TABLE public.pix_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  txid TEXT UNIQUE,
  amount DECIMAL(10, 2) NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  pix_key TEXT,
  qr_code TEXT,
  qr_code_image TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  expires_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  reminders_sent INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pix_charges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for financial_categories
CREATE POLICY "Users can view their own categories" 
ON public.financial_categories FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own categories" 
ON public.financial_categories FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories" 
ON public.financial_categories FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories" 
ON public.financial_categories FOR DELETE 
USING (auth.uid() = user_id);

-- RLS Policies for financial_transactions
CREATE POLICY "Users can view their own transactions" 
ON public.financial_transactions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transactions" 
ON public.financial_transactions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions" 
ON public.financial_transactions FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transactions" 
ON public.financial_transactions FOR DELETE 
USING (auth.uid() = user_id);

-- RLS Policies for pix_charges
CREATE POLICY "Users can view their own pix charges" 
ON public.pix_charges FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own pix charges" 
ON public.pix_charges FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pix charges" 
ON public.pix_charges FOR UPDATE 
USING (auth.uid() = user_id);

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_financial_transactions_updated_at
BEFORE UPDATE ON public.financial_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pix_charges_updated_at
BEFORE UPDATE ON public.pix_charges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to automatically update appointment payment status when Pix is paid
CREATE OR REPLACE FUNCTION public.handle_pix_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- If Pix charge was paid, update the related appointment and transaction
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    -- Update appointment payment status
    IF NEW.appointment_id IS NOT NULL THEN
      UPDATE public.appointments
      SET 
        payment_status = 'paid',
        payment_method = 'pix',
        updated_at = now()
      WHERE id = NEW.appointment_id;
    END IF;
    
    -- Update or create financial transaction
    IF NEW.transaction_id IS NOT NULL THEN
      UPDATE public.financial_transactions
      SET 
        status = 'completed',
        payment_method = 'pix',
        transaction_date = NEW.paid_at,
        updated_at = now()
      WHERE id = NEW.transaction_id;
    ELSE
      -- Create transaction if it doesn't exist
      INSERT INTO public.financial_transactions (
        user_id,
        appointment_id,
        type,
        amount,
        description,
        payment_method,
        status,
        transaction_date
      ) VALUES (
        NEW.user_id,
        NEW.appointment_id,
        'income',
        NEW.amount,
        'Pagamento via Pix - ' || NEW.customer_name,
        'pix',
        'completed',
        NEW.paid_at
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to handle Pix payments automatically
CREATE TRIGGER on_pix_payment
AFTER UPDATE ON public.pix_charges
FOR EACH ROW
EXECUTE FUNCTION public.handle_pix_payment();

-- Insert default financial categories
INSERT INTO public.financial_categories (user_id, name, type, color)
SELECT 
  id,
  category.name,
  category.type,
  category.color
FROM auth.users
CROSS JOIN (
  VALUES 
    ('Serviços', 'income', '#10b981'),
    ('Produtos', 'income', '#3b82f6'),
    ('Outros Recebimentos', 'income', '#8b5cf6'),
    ('Aluguel', 'expense', '#ef4444'),
    ('Salários', 'expense', '#f59e0b'),
    ('Fornecedores', 'expense', '#ec4899'),
    ('Energia/Água', 'expense', '#6366f1'),
    ('Marketing', 'expense', '#14b8a6'),
    ('Outros Gastos', 'expense', '#f43f5e')
) AS category(name, type, color)
ON CONFLICT DO NOTHING;