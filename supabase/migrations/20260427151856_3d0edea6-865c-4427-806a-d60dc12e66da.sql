
-- 1. Remove overly broad profiles SELECT policy that exposed password hashes
DROP POLICY IF EXISTS "Executive managers can view profiles" ON public.profiles;

-- 2. Remove anonymous-writable reputation_scores ALL policy
DROP POLICY IF EXISTS "System can manage reputation scores" ON public.reputation_scores;

-- Allow only service_role to write reputation scores
CREATE POLICY "Service role can manage reputation scores"
ON public.reputation_scores
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 3. Restrict profile_photos SELECT to authenticated users
DROP POLICY IF EXISTS "Anyone can view profile photos" ON public.profile_photos;

CREATE POLICY "Authenticated users can view profile photos"
ON public.profile_photos
FOR SELECT
TO authenticated
USING (true);

-- 4. Remove overly broad daily_report_orders SELECT policy
DROP POLICY IF EXISTS "Users can view order reports they have access to" ON public.daily_report_orders;

-- Add a tighter SELECT policy that scopes to the report creator
CREATE POLICY "Creators and managers can view daily report orders"
ON public.daily_report_orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.daily_reports dr
    WHERE dr.id = daily_report_orders.daily_report_id
      AND (
        dr.created_by = auth.uid()
        OR has_role(auth.uid(), 'ceo'::app_role)
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'general_manager'::app_role)
        OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
        OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
      )
  )
);
