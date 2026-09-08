ALTER TABLE public.scaffolding_pricing_rules
  DROP CONSTRAINT IF EXISTS scaffolding_pricing_rules_action_type_check;

ALTER TABLE public.scaffolding_pricing_rules
  ADD CONSTRAINT scaffolding_pricing_rules_action_type_check
  CHECK (action_type = ANY (ARRAY['increase_percent','decrease_percent','add_amount','min_price','set_price','add_formula']));