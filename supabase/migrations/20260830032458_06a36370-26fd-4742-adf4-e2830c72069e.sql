REVOKE SELECT ON public.scaffolding_pricing_conditions FROM anon;
DROP POLICY IF EXISTS "Anyone can view pricing conditions" ON public.scaffolding_pricing_conditions;
CREATE POLICY "Signed-in users can view pricing conditions"
ON public.scaffolding_pricing_conditions FOR SELECT TO authenticated
USING (true);