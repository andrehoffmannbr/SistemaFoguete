-- Criar tabela para rastrear notificações vistas
CREATE TABLE IF NOT EXISTS public.notification_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL, -- 'appointment' ou 'task'
  notification_id UUID NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices para melhor performance
CREATE INDEX idx_notification_views_user_id ON public.notification_views(user_id);
CREATE INDEX idx_notification_views_notification ON public.notification_views(notification_type, notification_id);

-- Criar índice único para evitar duplicatas
CREATE UNIQUE INDEX idx_notification_views_unique ON public.notification_views(user_id, notification_type, notification_id);

-- Enable Row Level Security
ALTER TABLE public.notification_views ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own notification views"
  ON public.notification_views
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notification views"
  ON public.notification_views
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notification views"
  ON public.notification_views
  FOR DELETE
  USING (auth.uid() = user_id);