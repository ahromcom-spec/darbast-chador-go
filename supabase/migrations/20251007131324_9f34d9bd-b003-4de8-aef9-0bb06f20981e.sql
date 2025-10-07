-- Drop the policy that exposes all contractor data including contact info
DROP POLICY IF EXISTS "Customers can view approved contractors" ON public.contractors;

-- Drop the old public_verified_contractors if it exists
DROP VIEW IF EXISTS public.public_verified_contractors CASCADE;

-- Create a secure view that only exposes public information about contractors
CREATE OR REPLACE VIEW public.public_contractors_directory AS
SELECT 
  c.id,
  c.company_name,
  c.description,
  c.address,
  c.experience_years,
  c.is_approved,
  c.created_at,
  -- Aggregate services without exposing contractor_services details
  COALESCE(
    json_agg(
      json_build_object(
        'service_type', cs.service_type,
        'sub_type', cs.sub_type
      ) ORDER BY cs.service_type
    ) FILTER (WHERE cs.id IS NOT NULL),
    '[]'::json
  ) as services
FROM public.contractors c
LEFT JOIN public.contractor_services cs ON cs.contractor_id = c.id
WHERE c.is_approved = true AND c.is_active = true
GROUP BY c.id, c.company_name, c.description, c.address, c.experience_years, c.is_approved, c.created_at;

-- Enable RLS on the view
ALTER VIEW public.public_contractors_directory SET (security_barrier = on, security_invoker = on);

-- Grant SELECT to authenticated and anonymous users
GRANT SELECT ON public.public_contractors_directory TO authenticated;
GRANT SELECT ON public.public_contractors_directory TO anon;

-- Add comment to document the security purpose
COMMENT ON VIEW public.public_contractors_directory IS 
  'Public directory of approved contractors. Only exposes non-sensitive information. Contact details (email, phone) are restricted and require admin access to the contractors table.';