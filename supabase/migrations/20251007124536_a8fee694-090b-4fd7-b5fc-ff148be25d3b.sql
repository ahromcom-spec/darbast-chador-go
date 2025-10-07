-- Drop and recreate the view with SECURITY INVOKER to fix the security definer warning
DROP VIEW IF EXISTS public.public_verified_contractors;

-- Create the view with SECURITY INVOKER (uses the permissions of the querying user)
CREATE VIEW public.public_verified_contractors
WITH (security_invoker = true)
AS
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

-- Enable security barrier to prevent query optimization from bypassing WHERE clause
ALTER VIEW public.public_verified_contractors SET (security_barrier = on);

-- Ensure RLS is enabled on the base table
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.public_verified_contractors TO authenticated;
GRANT SELECT ON public.public_verified_contractors TO anon;