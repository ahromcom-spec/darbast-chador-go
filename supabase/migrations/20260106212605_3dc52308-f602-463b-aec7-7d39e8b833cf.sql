-- Fix approved_media management policy: use app roles (user_roles/has_role) instead of phone_whitelist

DROP POLICY IF EXISTS "CEOs can manage all approved_media" ON public.approved_media;

CREATE POLICY "CEOs can manage all approved_media"
ON public.approved_media
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);
