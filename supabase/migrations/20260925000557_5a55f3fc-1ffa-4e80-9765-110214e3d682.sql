ALTER TABLE public.subcategories ADD COLUMN IF NOT EXISTS form_schema jsonb;

CREATE TABLE public.service_pricing_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcategory_id uuid NOT NULL REFERENCES public.subcategories(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  option_value text NOT NULL DEFAULT '',
  unit_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subcategory_id, field_key, option_value)
);
GRANT SELECT ON public.service_pricing_rates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_pricing_rates TO authenticated;
GRANT ALL ON public.service_pricing_rates TO service_role;
ALTER TABLE public.service_pricing_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view service rates" ON public.service_pricing_rates FOR SELECT USING (true);
CREATE POLICY "Managers manage service rates" ON public.service_pricing_rates FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'ceo') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'general_manager') OR public.has_role(auth.uid(),'sales_manager'))
WITH CHECK (public.has_role(auth.uid(),'ceo') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'general_manager') OR public.has_role(auth.uid(),'sales_manager'));
CREATE TRIGGER trg_service_pricing_rates_updated BEFORE UPDATE ON public.service_pricing_rates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();