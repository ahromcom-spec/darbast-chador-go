CREATE TABLE public.scaffolding_pricing_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_table text NOT NULL CHECK (config_table IN ('scaffolding_pricing_config','scaffolding_no_materials_pricing_config')),
  category text NOT NULL,
  conditions text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (config_table, category)
);

GRANT SELECT ON public.scaffolding_pricing_conditions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scaffolding_pricing_conditions TO authenticated;
GRANT ALL ON public.scaffolding_pricing_conditions TO service_role;

ALTER TABLE public.scaffolding_pricing_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pricing conditions"
ON public.scaffolding_pricing_conditions FOR SELECT
USING (true);

CREATE POLICY "CEO can insert pricing conditions"
ON public.scaffolding_pricing_conditions FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'ceo'));

CREATE POLICY "CEO can update pricing conditions"
ON public.scaffolding_pricing_conditions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'ceo'))
WITH CHECK (public.has_role(auth.uid(), 'ceo'));

CREATE POLICY "CEO can delete pricing conditions"
ON public.scaffolding_pricing_conditions FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'ceo'));

CREATE TRIGGER update_scaffolding_pricing_conditions_updated_at
BEFORE UPDATE ON public.scaffolding_pricing_conditions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();