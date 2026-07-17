
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cooperation_rank smallint NOT NULL DEFAULT 1
  CHECK (cooperation_rank BETWEEN 1 AND 10);

CREATE POLICY "CEO can update cooperation rank on any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'ceo'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'ceo'::app_role));
