-- ========================================
-- SECURITY FIX: Protect Contractor Directory from Anonymous Access
-- ========================================

-- The public_contractors_directory is a VIEW that shows approved contractors
-- Views don't have their own RLS - they use the RLS of underlying tables
-- We need to ensure the contractors table properly restricts anonymous access

-- First, let's ensure RLS is enabled on contractors table
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;

-- Add policy to block all anonymous (unauthenticated) access to contractors table
CREATE POLICY "Block anonymous access to contractors"
ON public.contractors
FOR SELECT
TO anon
USING (false);

-- Add policy to allow authenticated users to view approved contractors only
-- This replaces the overly broad access
CREATE POLICY "Authenticated users can view approved contractors"
ON public.contractors
FOR SELECT
TO authenticated
USING (is_approved = true AND is_active = true);

-- Ensure contractor_services also blocks anonymous access
ALTER TABLE public.contractor_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block anonymous access to contractor services"
ON public.contractor_services
FOR SELECT
TO anon
USING (false);

-- Allow authenticated users to view services of approved contractors
CREATE POLICY "Authenticated users can view services of approved contractors"
ON public.contractor_services
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.contractors
    WHERE contractors.id = contractor_services.contractor_id
    AND contractors.is_approved = true
    AND contractors.is_active = true
  )
);

-- Note: The existing admin and contractor-specific policies remain in place
-- They are evaluated with OR logic, so admins and contractors themselves
-- still have their full access rights