-- Create inventory items table
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'unit', -- unit, kg, liter, etc
  current_stock NUMERIC NOT NULL DEFAULT 0,
  minimum_stock NUMERIC NOT NULL DEFAULT 0,
  cost_price NUMERIC,
  sale_price NUMERIC,
  is_kit BOOLEAN NOT NULL DEFAULT false,
  kit_items JSONB DEFAULT '[]'::jsonb, -- [{item_id: uuid, quantity: number}]
  tags TEXT[],
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create stock movements table
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_id UUID NOT NULL,
  type TEXT NOT NULL, -- in, out, adjustment
  quantity NUMERIC NOT NULL,
  reason TEXT,
  reference_type TEXT, -- appointment, manual, kit_assembly
  reference_id UUID,
  previous_stock NUMERIC NOT NULL,
  new_stock NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inventory_items
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

-- RLS Policies for stock_movements
CREATE POLICY "Users can view their own movements"
  ON public.stock_movements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own movements"
  ON public.stock_movements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update stock and create movement
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
  -- Get current stock and user_id
  SELECT current_stock, user_id INTO v_previous_stock, v_user_id
  FROM public.inventory_items
  WHERE id = p_item_id;

  -- Calculate new stock
  IF p_type = 'in' THEN
    v_new_stock := v_previous_stock + p_quantity;
  ELSIF p_type = 'out' THEN
    v_new_stock := v_previous_stock - p_quantity;
  ELSE -- adjustment
    v_new_stock := p_quantity;
  END IF;

  -- Update item stock
  UPDATE public.inventory_items
  SET current_stock = v_new_stock
  WHERE id = p_item_id;

  -- Create movement record
  INSERT INTO public.stock_movements (
    user_id,
    item_id,
    type,
    quantity,
    reason,
    reference_type,
    reference_id,
    previous_stock,
    new_stock
  ) VALUES (
    v_user_id,
    p_item_id,
    p_type,
    p_quantity,
    p_reason,
    p_reference_type,
    p_reference_id,
    v_previous_stock,
    v_new_stock
  );
END;
$$;

-- Function to check low stock and create tasks
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
    -- Check if task already exists
    IF NOT EXISTS (
      SELECT 1 FROM public.tasks
      WHERE user_id = v_item.user_id
        AND type = 'restock'
        AND related_entity_id = v_item.id
        AND status = 'pending'
    ) THEN
      -- Create restock task
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

-- Trigger to check low stock after stock update
CREATE OR REPLACE FUNCTION public.trigger_low_stock_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.current_stock <= NEW.minimum_stock AND NEW.minimum_stock > 0 THEN
    -- Check if task already exists
    IF NOT EXISTS (
      SELECT 1 FROM public.tasks
      WHERE user_id = NEW.user_id
        AND type = 'restock'
        AND related_entity_id = NEW.id
        AND status = 'pending'
    ) THEN
      -- Create restock task
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
        'Repor estoque: ' || NEW.name,
        'Estoque abaixo do mínimo. Atual: ' || NEW.current_stock || ', Mínimo: ' || NEW.minimum_stock,
        'restock',
        'high',
        now() + INTERVAL '1 day',
        'inventory_item',
        NEW.id,
        jsonb_build_object('item_name', NEW.name, 'current_stock', NEW.current_stock, 'minimum_stock', NEW.minimum_stock)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_low_stock_trigger
  AFTER INSERT OR UPDATE ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_low_stock_check();

-- Create indexes
CREATE INDEX idx_inventory_items_user_id ON public.inventory_items(user_id);
CREATE INDEX idx_inventory_items_category ON public.inventory_items(category);
CREATE INDEX idx_stock_movements_item_id ON public.stock_movements(item_id);
CREATE INDEX idx_stock_movements_user_id ON public.stock_movements(user_id);