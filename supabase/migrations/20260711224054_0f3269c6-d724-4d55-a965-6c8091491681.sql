
-- 1) Add is_service_active flag to subcategories
ALTER TABLE public.subcategories
  ADD COLUMN IF NOT EXISTS is_service_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Allow CEO to update subcategories (activation toggle)
DROP POLICY IF EXISTS "CEO can update subcategories active flag" ON public.subcategories;
CREATE POLICY "CEO can update subcategories active flag"
  ON public.subcategories
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'ceo'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ceo'::app_role));

-- 2) Per-subcategory pricing items
CREATE TABLE IF NOT EXISTS public.subcategory_pricing_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subcategory_id UUID NOT NULL REFERENCES public.subcategories(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  label TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'تومان',
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (subcategory_id, key)
);

CREATE INDEX IF NOT EXISTS subcategory_pricing_items_subcategory_idx
  ON public.subcategory_pricing_items(subcategory_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subcategory_pricing_items TO authenticated;
GRANT ALL ON public.subcategory_pricing_items TO service_role;
GRANT SELECT ON public.subcategory_pricing_items TO anon;

ALTER TABLE public.subcategory_pricing_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read subcategory pricing items" ON public.subcategory_pricing_items;
CREATE POLICY "Anyone can read subcategory pricing items"
  ON public.subcategory_pricing_items FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "CEO can insert subcategory pricing items" ON public.subcategory_pricing_items;
CREATE POLICY "CEO can insert subcategory pricing items"
  ON public.subcategory_pricing_items FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ceo'::app_role));

DROP POLICY IF EXISTS "CEO can update subcategory pricing items" ON public.subcategory_pricing_items;
CREATE POLICY "CEO can update subcategory pricing items"
  ON public.subcategory_pricing_items FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'ceo'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ceo'::app_role));

DROP POLICY IF EXISTS "CEO can delete subcategory pricing items" ON public.subcategory_pricing_items;
CREATE POLICY "CEO can delete subcategory pricing items"
  ON public.subcategory_pricing_items FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'ceo'::app_role));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_subcategory_pricing_items_updated_at ON public.subcategory_pricing_items;
CREATE TRIGGER update_subcategory_pricing_items_updated_at
  BEFORE UPDATE ON public.subcategory_pricing_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER TABLE public.subcategory_pricing_items REPLICA IDENTITY FULL;
ALTER TABLE public.subcategories REPLICA IDENTITY FULL;
