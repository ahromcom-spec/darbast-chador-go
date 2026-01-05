-- Drop and recreate the CEO policy with proper WITH CHECK clause
DROP POLICY IF EXISTS "CEOs can manage all approved_media" ON public.approved_media;

CREATE POLICY "CEOs can manage all approved_media" ON public.approved_media
FOR ALL
USING (EXISTS (
  SELECT 1 FROM phone_whitelist
  WHERE phone_whitelist.phone_number = (
    SELECT profiles.phone_number FROM profiles WHERE profiles.user_id = auth.uid()
  ) AND 'ceo' = ANY (phone_whitelist.allowed_roles)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM phone_whitelist
  WHERE phone_whitelist.phone_number = (
    SELECT profiles.phone_number FROM profiles WHERE profiles.user_id = auth.uid()
  ) AND 'ceo' = ANY (phone_whitelist.allowed_roles)
));