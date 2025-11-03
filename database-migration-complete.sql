-- =====================================================
-- FOGUETE GESTÃO EMPRESARIAL - DATABASE MIGRATION
-- Complete Database Schema for Supabase
-- Generated: 2025-11-03
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Business settings table
CREATE TABLE public.business_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  business_type TEXT,
  phone TEXT,
  address TEXT,
  profile_image_url TEXT,
  working_hours JSONB DEFAULT '{"monday": {"start": "09:00", "end": "18:00", "enabled": true}, "tuesday": {"start": "09:00", "end": "18:00", "enabled": true}, "wednesday": {"start": "09:00", "end": "18:00", "enabled": true}, "thursday": {"start": "09:00", "end": "18:00", "enabled": true}, "friday": {"start": "09:00", "end": "18:00", "enabled": true}, "saturday": {"start": "09:00", "end": "13:00", "enabled": false}, "sunday": {"start": "09:00", "end": "18:00", "enabled": false}}'::jsonb,
  slot_duration INTEGER DEFAULT 60,
  buffer_time INTEGER DEFAULT 0,
  allow_overbooking BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  cpf TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  payment_method TEXT,
  price DECIMAL(10, 2),
  notes TEXT,
  proposal_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Time slots blocked table
CREATE TABLE public.blocked_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- FINANCIAL TABLES
-- =====================================================

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

-- Pix charges table
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

-- =====================================================
-- CUSTOMER ENGAGEMENT TABLES
-- =====================================================

-- Reviews table
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Coupons table
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Loyalty cards table
CREATE TABLE public.loyalty_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Loyalty stamps table
CREATE TABLE public.loyalty_stamps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loyalty_card_id UUID NOT NULL REFERENCES public.loyalty_cards(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  stamps_added INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- PROPOSALS TABLE
-- =====================================================

CREATE TABLE public.proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- =====================================================
-- SUBSCRIPTION TABLES
-- =====================================================

CREATE TABLE public.subscription_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  billing_frequency TEXT NOT NULL DEFAULT 'monthly',
  included_services JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled', 'payment_failed')),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  next_billing_date TIMESTAMP WITH TIME ZONE NOT NULL,
  last_billing_date TIMESTAMP WITH TIME ZONE,
  payment_method TEXT NOT NULL DEFAULT 'pix',
  failed_payments_count INTEGER NOT NULL DEFAULT 0,
  last_payment_attempt TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.subscription_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  service_type TEXT NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- TASKS TABLE
-- =====================================================

CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  related_entity_type TEXT,
  related_entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- INVENTORY TABLES
-- =====================================================

CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'unit',
  current_stock NUMERIC NOT NULL DEFAULT 0,
  minimum_stock NUMERIC NOT NULL DEFAULT 0,
  cost_price NUMERIC,
  sale_price NUMERIC,
  is_kit BOOLEAN NOT NULL DEFAULT false,
  kit_items JSONB DEFAULT '[]'::jsonb,
  tags TEXT[],
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjustment')),
  quantity NUMERIC NOT NULL,
  reason TEXT,
  reference_type TEXT,
  reference_id UUID,
  previous_stock NUMERIC NOT NULL,
  new_stock NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- NOTIFICATION TRACKING
-- =====================================================

CREATE TABLE public.notification_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pix_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_stamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_views ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - business_settings
-- =====================================================

CREATE POLICY "Users can view their own business settings" 
ON public.business_settings FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own business settings" 
ON public.business_settings FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own business settings" 
ON public.business_settings FOR UPDATE 
USING (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES - customers
-- =====================================================

CREATE POLICY "Users can view their own customers" 
ON public.customers FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own customers" 
ON public.customers FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own customers" 
ON public.customers FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own customers" 
ON public.customers FOR DELETE 
USING (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES - appointments
-- =====================================================

CREATE POLICY "Users can view their own appointments" 
ON public.appointments FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own appointments" 
ON public.appointments FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own appointments" 
ON public.appointments FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own appointments" 
ON public.appointments FOR DELETE 
USING (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES - blocked_slots
-- =====================================================

CREATE POLICY "Users can view their own blocked slots" 
ON public.blocked_slots FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own blocked slots" 
ON public.blocked_slots FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own blocked slots" 
ON public.blocked_slots FOR DELETE 
USING (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES - financial_categories
-- =====================================================

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

-- =====================================================
-- RLS POLICIES - financial_transactions
-- =====================================================

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

-- =====================================================
-- RLS POLICIES - pix_charges
-- =====================================================

CREATE POLICY "Users can view their own pix charges" 
ON public.pix_charges FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own pix charges" 
ON public.pix_charges FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pix charges" 
ON public.pix_charges FOR UPDATE 
USING (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES - reviews
-- =====================================================

CREATE POLICY "Users can view their own reviews"
ON public.reviews FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reviews"
ON public.reviews FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
ON public.reviews FOR UPDATE
USING (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES - coupons
-- =====================================================

CREATE POLICY "Users can view their own coupons"
ON public.coupons FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own coupons"
ON public.coupons FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own coupons"
ON public.coupons FOR UPDATE
USING (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES - loyalty_cards
-- =====================================================

CREATE POLICY "Users can view their own loyalty cards"
ON public.loyalty_cards FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own loyalty cards"
ON public.loyalty_cards FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own loyalty cards"
ON public.loyalty_cards FOR UPDATE
USING (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES - loyalty_stamps
-- =====================================================

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

-- =====================================================
-- RLS POLICIES - proposals
-- =====================================================

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

-- =====================================================
-- RLS POLICIES - subscription_plans
-- =====================================================

CREATE POLICY "Users can view their own plans"
ON public.subscription_plans FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own plans"
ON public.subscription_plans FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own plans"
ON public.subscription_plans FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own plans"
ON public.subscription_plans FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES - subscriptions
-- =====================================================

CREATE POLICY "Users can view their own subscriptions"
ON public.subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subscriptions"
ON public.subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
ON public.subscriptions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
ON public.subscriptions FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES - subscription_usage
-- =====================================================

CREATE POLICY "Users can view their own subscription usage"
ON public.subscription_usage FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE subscriptions.id = subscription_usage.subscription_id
    AND subscriptions.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own subscription usage"
ON public.subscription_usage FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE subscriptions.id = subscription_usage.subscription_id
    AND subscriptions.user_id = auth.uid()
  )
);

-- =====================================================
-- RLS POLICIES - tasks
-- =====================================================

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

-- =====================================================
-- RLS POLICIES - inventory_items
-- =====================================================

CREATE POLICY "Users can view their own items"
ON public.inventory_items FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own items"
ON public.inventory_items FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own items"
ON public.inventory_items FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own items"
ON public.inventory_items FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES - stock_movements
-- =====================================================

CREATE POLICY "Users can view their own movements"
ON public.stock_movements FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own movements"
ON public.stock_movements FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES - notification_views
-- =====================================================

CREATE POLICY "Users can view their own notification views"
ON public.notification_views FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notification views"
ON public.notification_views FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_business_settings_updated_at
BEFORE UPDATE ON public.business_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financial_transactions_updated_at
BEFORE UPDATE ON public.financial_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pix_charges_updated_at
BEFORE UPDATE ON public.pix_charges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

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

CREATE TRIGGER update_proposals_updated_at
BEFORE UPDATE ON public.proposals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_items_updated_at
BEFORE UPDATE ON public.inventory_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- INVENTORY MANAGEMENT FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_inventory_stock(
  p_item_id UUID,
  p_quantity NUMERIC,
  p_type TEXT,
  p_reason TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_previous_stock NUMERIC;
  v_new_stock NUMERIC;
BEGIN
  SELECT current_stock, user_id INTO v_previous_stock, v_user_id
  FROM public.inventory_items
  WHERE id = p_item_id;

  IF p_type = 'in' THEN
    v_new_stock := v_previous_stock + p_quantity;
  ELSIF p_type = 'out' THEN
    v_new_stock := v_previous_stock - p_quantity;
  ELSE
    v_new_stock := p_quantity;
  END IF;

  UPDATE public.inventory_items
  SET current_stock = v_new_stock
  WHERE id = p_item_id;

  INSERT INTO public.stock_movements (
    user_id, item_id, type, quantity, reason,
    reference_type, reference_id,
    previous_stock, new_stock
  ) VALUES (
    v_user_id, p_item_id, p_type, p_quantity, p_reason,
    p_reference_type, p_reference_id,
    v_previous_stock, v_new_stock
  );
END;
$$;

-- =====================================================
-- LOW STOCK CHECK FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.check_low_stock_and_create_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
BEGIN
  FOR v_item IN 
    SELECT id, user_id, name, current_stock, minimum_stock
    FROM public.inventory_items
    WHERE current_stock <= minimum_stock
      AND minimum_stock > 0
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.tasks
      WHERE user_id = v_item.user_id
        AND type = 'restock'
        AND related_entity_id = v_item.id
        AND status = 'pending'
    ) THEN
      INSERT INTO public.tasks (
        user_id, title, description, type, priority, due_date,
        related_entity_type, related_entity_id, metadata
      ) VALUES (
        v_item.user_id,
        'Repor estoque: ' || v_item.name,
        'Estoque abaixo do mínimo. Atual: ' || v_item.current_stock || ', Mínimo: ' || v_item.minimum_stock,
        'restock',
        'high',
        now() + INTERVAL '1 day',
        'inventory_item',
        v_item.id,
        jsonb_build_object('item_name', v_item.name, 'current_stock', v_item.current_stock, 'minimum_stock', v_item.minimum_stock)
      );
    END IF;
  END LOOP;
END;
$$;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_customers_user_id ON public.customers(user_id);
CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE INDEX idx_appointments_user_id ON public.appointments(user_id);
CREATE INDEX idx_appointments_customer_id ON public.appointments(customer_id);
CREATE INDEX idx_appointments_start_time ON public.appointments(start_time);
CREATE INDEX idx_appointments_status ON public.appointments(status);
CREATE INDEX idx_financial_transactions_user_id ON public.financial_transactions(user_id);
CREATE INDEX idx_financial_transactions_date ON public.financial_transactions(transaction_date);
CREATE INDEX idx_pix_charges_user_id ON public.pix_charges(user_id);
CREATE INDEX idx_pix_charges_status ON public.pix_charges(status);
CREATE INDEX idx_proposals_user_id ON public.proposals(user_id);
CREATE INDEX idx_proposals_customer_id ON public.proposals(customer_id);
CREATE INDEX idx_proposals_status ON public.proposals(status);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_customer_id ON public.subscriptions(customer_id);
CREATE INDEX idx_subscriptions_next_billing ON public.subscriptions(next_billing_date) WHERE status = 'active';
CREATE INDEX idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date) WHERE status = 'pending';
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_inventory_items_user_id ON public.inventory_items(user_id);
CREATE INDEX idx_stock_movements_item_id ON public.stock_movements(item_id);

-- =====================================================
-- END OF MIGRATION
-- =====================================================
