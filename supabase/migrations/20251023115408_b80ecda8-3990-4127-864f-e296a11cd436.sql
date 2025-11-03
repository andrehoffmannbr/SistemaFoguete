-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- preparation, followup, payment, restock, reactivation, post_sale
  priority TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, urgent
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, cancelled
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  related_entity_type TEXT, -- appointment, proposal, customer, transaction
  related_entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks"
  ON public.tasks FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date) WHERE status = 'pending';
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_type ON public.tasks(type);

-- Function to create post-sale task when appointment is completed
CREATE OR REPLACE FUNCTION public.create_post_sale_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create post-sale task 24 hours after appointment completion
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    INSERT INTO public.tasks (
      user_id,
      title,
      description,
      type,
      priority,
      due_date,
      related_entity_type,
      related_entity_id,
      metadata
    ) VALUES (
      NEW.user_id,
      'Follow-up pós-venda',
      'Entrar em contato com o cliente para avaliar satisfação e solicitar avaliação',
      'post_sale',
      'medium',
      NEW.end_time + INTERVAL '24 hours',
      'appointment',
      NEW.id,
      jsonb_build_object('customer_id', NEW.customer_id)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for post-sale tasks
CREATE TRIGGER create_post_sale_task_trigger
  AFTER INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_post_sale_task();

-- Function to create follow-up task when proposal is sent
CREATE OR REPLACE FUNCTION public.create_proposal_followup_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create follow-up task 48 hours after proposal is sent
  IF NEW.sent_at IS NOT NULL AND (OLD.sent_at IS NULL OR OLD.sent_at != NEW.sent_at) AND NEW.status = 'sent' THEN
    INSERT INTO public.tasks (
      user_id,
      title,
      description,
      type,
      priority,
      due_date,
      related_entity_type,
      related_entity_id,
      metadata
    ) VALUES (
      NEW.user_id,
      'Follow-up de proposta',
      'Entrar em contato com cliente sobre proposta enviada: ' || NEW.title,
      'followup',
      'high',
      NEW.sent_at + INTERVAL '48 hours',
      'proposal',
      NEW.id,
      jsonb_build_object('customer_id', NEW.customer_id, 'proposal_title', NEW.title)
    );
  END IF;
  
  -- Cancel follow-up task if proposal is accepted or rejected
  IF (NEW.status = 'accepted' OR NEW.status = 'rejected') AND OLD.status = 'sent' THEN
    UPDATE public.tasks
    SET status = 'cancelled', updated_at = now()
    WHERE related_entity_type = 'proposal'
      AND related_entity_id = NEW.id
      AND type = 'followup'
      AND status = 'pending';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for proposal follow-up tasks
CREATE TRIGGER create_proposal_followup_task_trigger
  AFTER INSERT OR UPDATE ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.create_proposal_followup_task();

-- Function to create payment reminder task when Pix charge expires
CREATE OR REPLACE FUNCTION public.create_payment_reminder_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create payment reminder task when charge expires
  IF NEW.status = 'expired' AND (OLD.status IS NULL OR OLD.status != 'expired') THEN
    INSERT INTO public.tasks (
      user_id,
      title,
      description,
      type,
      priority,
      due_date,
      related_entity_type,
      related_entity_id,
      metadata
    ) VALUES (
      NEW.user_id,
      'Reenviar cobrança Pix',
      'Reenviar cobrança Pix para ' || NEW.customer_name || ' - R$ ' || NEW.amount::TEXT,
      'payment',
      'urgent',
      now() + INTERVAL '1 hour',
      'pix_charge',
      NEW.id,
      jsonb_build_object('customer_id', NEW.customer_id, 'amount', NEW.amount)
    );
  END IF;
  
  -- Complete payment task when charge is paid
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    UPDATE public.tasks
    SET status = 'completed', completed_at = now(), updated_at = now()
    WHERE related_entity_type = 'pix_charge'
      AND related_entity_id = NEW.id
      AND type = 'payment'
      AND status = 'pending';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for payment reminder tasks
CREATE TRIGGER create_payment_reminder_task_trigger
  AFTER INSERT OR UPDATE ON public.pix_charges
  FOR EACH ROW
  EXECUTE FUNCTION public.create_payment_reminder_task();