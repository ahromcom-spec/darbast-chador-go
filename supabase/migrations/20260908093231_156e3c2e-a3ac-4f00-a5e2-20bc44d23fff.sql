CREATE TABLE public.scaffolding_pricing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_table TEXT NOT NULL CHECK (config_table IN ('scaffolding_pricing_config','scaffolding_no_materials_pricing_config')),
  category TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  action_type TEXT NOT NULL DEFAULT 'increase_percent' CHECK (action_type IN ('increase_percent','decrease_percent','add_amount','min_price','set_price')),
  action_value NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.scaffolding_pricing_rules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scaffolding_pricing_rules TO authenticated;
GRANT ALL ON public.scaffolding_pricing_rules TO service_role;

ALTER TABLE public.scaffolding_pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pricing rules"
ON public.scaffolding_pricing_rules FOR SELECT
USING (true);

CREATE POLICY "CEO can insert pricing rules"
ON public.scaffolding_pricing_rules FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'ceo'));

CREATE POLICY "CEO can update pricing rules"
ON public.scaffolding_pricing_rules FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'ceo'))
WITH CHECK (public.has_role(auth.uid(), 'ceo'));

CREATE POLICY "CEO can delete pricing rules"
ON public.scaffolding_pricing_rules FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'ceo'));

CREATE INDEX idx_scaffolding_pricing_rules_scope
ON public.scaffolding_pricing_rules (config_table, category, sort_order);

CREATE TRIGGER update_scaffolding_pricing_rules_updated_at
BEFORE UPDATE ON public.scaffolding_pricing_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();