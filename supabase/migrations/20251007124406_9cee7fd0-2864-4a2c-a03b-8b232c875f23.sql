-- Fix security definer issue by using security_invoker instead
DROP VIEW IF EXISTS public.public_verified_contractors;

CREATE OR REPLACE VIEW public.public_verified_contractors 
WITH (security_invoker=on) AS
SELECT
  id,
  company_name,
  contact_person,
  address,
  experience_years,
  description,
  is_approved,
  created_at
FROM public.contractors
WHERE is_approved = true AND is_active = true;

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.public_verified_contractors TO authenticated;
GRANT SELECT ON public.public_verified_contractors TO anon;