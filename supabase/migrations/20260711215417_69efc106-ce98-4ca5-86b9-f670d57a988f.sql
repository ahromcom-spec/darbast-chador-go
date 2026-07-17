
CREATE TABLE public.scaffolding_no_materials_pricing_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '',
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.scaffolding_no_materials_pricing_config TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.scaffolding_no_materials_pricing_config TO authenticated;
GRANT ALL ON public.scaffolding_no_materials_pricing_config TO service_role;

ALTER TABLE public.scaffolding_no_materials_pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view no-materials pricing config"
  ON public.scaffolding_no_materials_pricing_config
  FOR SELECT USING (true);

CREATE POLICY "CEO can insert no-materials pricing config"
  ON public.scaffolding_no_materials_pricing_config
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "CEO can update no-materials pricing config"
  ON public.scaffolding_no_materials_pricing_config
  FOR UPDATE USING (has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "CEO can delete no-materials pricing config"
  ON public.scaffolding_no_materials_pricing_config
  FOR DELETE USING (has_role(auth.uid(), 'ceo'::app_role));

CREATE TRIGGER update_scaffolding_no_materials_pricing_config_updated_at
  BEFORE UPDATE ON public.scaffolding_no_materials_pricing_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with same defaults as scaffolding_pricing_config (current live values)
INSERT INTO public.scaffolding_no_materials_pricing_config (key, category, label, value, unit, description, sort_order)
SELECT key, category, label, value, unit, description, sort_order
FROM public.scaffolding_pricing_config;
