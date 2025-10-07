-- Create public view for verified contractors (customers should only see approved contractors)
CREATE OR REPLACE VIEW public.public_verified_contractors AS
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

-- Enable security barrier to enforce RLS policies
ALTER VIEW public.public_verified_contractors SET (security_barrier = on);

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.public_verified_contractors TO authenticated;

-- Update RLS policy for customers to view approved contractors through direct table access
-- (Note: It's better to use the view, but this allows flexibility)
DROP POLICY IF EXISTS "Customers can view approved contractors" ON public.contractors;
CREATE POLICY "Customers can view approved contractors"
ON public.contractors
FOR SELECT
USING (is_approved = true AND is_active = true);

-- Ensure contractors can delete their own profile (optional, based on requirements)
DROP POLICY IF EXISTS "Contractors can delete their own profile" ON public.contractors;
CREATE POLICY "Contractors can delete their own profile"
ON public.contractors
FOR DELETE
USING (auth.uid() = user_id);