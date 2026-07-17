CREATE TABLE IF NOT EXISTS public.assistant_draft_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_type_id uuid REFERENCES public.service_types_v3(id) ON DELETE SET NULL,
  subcategory_id uuid REFERENCES public.subcategories(id) ON DELETE SET NULL,
  service_label text,
  dimensions jsonb,
  defaults jsonb,
  address text,
  province_id uuid REFERENCES public.provinces(id) ON DELETE SET NULL,
  district_id uuid REFERENCES public.districts(id) ON DELETE SET NULL,
  lat double precision,
  lng double precision,
  media_paths jsonb DEFAULT '[]'::jsonb,
  calculated_price numeric,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','finalized','cancelled')),
  project_id uuid REFERENCES public.projects_v3(id) ON DELETE SET NULL,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_draft_orders TO authenticated;
GRANT ALL ON public.assistant_draft_orders TO service_role;

ALTER TABLE public.assistant_draft_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage their own draft orders"
  ON public.assistant_draft_orders
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_assistant_draft_orders_user ON public.assistant_draft_orders(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_assistant_draft_orders_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_assistant_draft_orders_updated_at ON public.assistant_draft_orders;
CREATE TRIGGER trg_assistant_draft_orders_updated_at
  BEFORE UPDATE ON public.assistant_draft_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_assistant_draft_orders_updated_at();