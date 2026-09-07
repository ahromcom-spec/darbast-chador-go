CREATE TABLE IF NOT EXISTS public.messenger_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'bale',
  enabled boolean NOT NULL DEFAULT false,
  send_media boolean NOT NULL DEFAULT true,
  notify_ceo boolean NOT NULL DEFAULT true,
  bot_username text DEFAULT '@ahrom_ir_bot',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT messenger_settings_provider_unique UNIQUE (provider)
);

GRANT SELECT ON public.messenger_settings TO authenticated;
GRANT INSERT, UPDATE ON public.messenger_settings TO authenticated;
GRANT ALL ON public.messenger_settings TO service_role;
ALTER TABLE public.messenger_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messenger_settings_select_auth" ON public.messenger_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "messenger_settings_insert_admin" ON public.messenger_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ceo') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'general_manager'));
CREATE POLICY "messenger_settings_update_admin" ON public.messenger_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'ceo') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'general_manager'));

INSERT INTO public.messenger_settings (provider, enabled) VALUES ('bale', false)
ON CONFLICT (provider) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.messenger_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'bale',
  phone text,
  chat_id text NOT NULL,
  username text,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messenger_chats_provider_chat_unique UNIQUE (provider, chat_id)
);
CREATE INDEX IF NOT EXISTS idx_messenger_chats_phone ON public.messenger_chats (phone);

GRANT SELECT ON public.messenger_chats TO authenticated;
GRANT ALL ON public.messenger_chats TO service_role;
ALTER TABLE public.messenger_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messenger_chats_select_admin" ON public.messenger_chats
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ceo') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'general_manager'));

CREATE TABLE IF NOT EXISTS public.messenger_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'bale',
  phone text,
  chat_id text,
  kind text NOT NULL DEFAULT 'text',
  text text,
  media_url text,
  status text NOT NULL DEFAULT 'sent',
  provider_response text,
  order_code text,
  order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messenger_logs_created_at ON public.messenger_logs (created_at DESC);

GRANT SELECT ON public.messenger_logs TO authenticated;
GRANT ALL ON public.messenger_logs TO service_role;
ALTER TABLE public.messenger_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messenger_logs_select_admin" ON public.messenger_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ceo') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'general_manager'));