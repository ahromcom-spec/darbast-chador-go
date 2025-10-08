-- ============================================================================
-- PHASE 1: CRITICAL DATA EXPOSURE FIXES
-- ============================================================================

-- 1.1 Secure Public Contractors Directory
-- Drop the insecure view
DROP VIEW IF EXISTS public.public_contractors_directory;

-- Create secure view with only non-sensitive information
CREATE VIEW public.public_contractors_directory AS
SELECT 
  c.id,
  c.company_name,
  c.description,
  c.experience_years,
  c.is_approved,
  c.created_at,
  -- Only show city/region, not full address
  CASE 
    WHEN c.address IS NOT NULL 
    THEN regexp_replace(c.address, '،.*$', '') -- Keep only city part before first comma
    ELSE NULL 
  END as general_location,
  -- Aggregate services without sensitive details
  json_agg(
    json_build_object(
      'service_type', cs.service_type,
      'sub_type', cs.sub_type
    )
  ) as services
FROM contractors c
LEFT JOIN contractor_services cs ON cs.contractor_id = c.id
WHERE c.is_approved = true AND c.is_active = true
GROUP BY c.id, c.company_name, c.description, c.experience_years, c.is_approved, c.created_at, c.address;

-- Enable RLS on the view
ALTER VIEW public.public_contractors_directory SET (security_invoker = true);

-- 1.2 Fix Contractor Table Policies - Remove Public Contact Info Access
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view basic contractor info" ON public.contractors;

-- Add new restricted policy: authenticated users can see non-sensitive data only
CREATE POLICY "Authenticated users can view non-sensitive contractor data"
ON public.contractors
FOR SELECT
TO authenticated
USING (
  is_approved = true 
  AND is_active = true
);
-- Note: This policy allows SELECT on the table, but sensitive columns (email, phone_number, contact_person)
-- should be accessed only through get_contractor_contact_info() function by admins/GMs/contractor owner

-- 1.3 Fix Inventory Reservations - Add Missing RLS Policies
-- Add policy for warehouse managers
CREATE POLICY "Warehouse managers have full access to reservations"
ON public.inventory_reservations
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'warehouse_manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'warehouse_manager'::app_role));

-- Add policy for operations managers (read access)
CREATE POLICY "Operations managers can view all reservations"
ON public.inventory_reservations
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'operations_manager'::app_role));

-- Add policy for contractors (view their service reservations)
CREATE POLICY "Contractors can view reservations for their services"
ON public.inventory_reservations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM services s
    JOIN contractors c ON c.id = s.contractor_id
    WHERE s.id = inventory_reservations.service_id
      AND c.user_id = auth.uid()
  )
);

-- ============================================================================
-- PHASE 2: WORKFLOW TABLE REFINEMENTS
-- ============================================================================

-- 2.1 Workflow Tasks - Add Contractor and Role-Based Access
CREATE POLICY "Contractors can view tasks for their assigned services"
ON public.workflow_tasks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM services s
    JOIN contractors c ON c.id = s.contractor_id
    WHERE s.id = workflow_tasks.service_id
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Warehouse managers can view and manage warehouse tasks"
ON public.workflow_tasks
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'warehouse_manager'::app_role)
  AND type = 'warehouse_pick'
)
WITH CHECK (
  has_role(auth.uid(), 'warehouse_manager'::app_role)
  AND type = 'warehouse_pick'
);

CREATE POLICY "Finance managers can view and manage finance tasks"
ON public.workflow_tasks
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'finance_manager'::app_role)
  AND type = 'finance'
)
WITH CHECK (
  has_role(auth.uid(), 'finance_manager'::app_role)
  AND type = 'finance'
);

-- 2.2 Service Line Items - Add Contractor Read Access
CREATE POLICY "Contractors can view line items for their services"
ON public.service_line_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM services s
    JOIN contractors c ON c.id = s.contractor_id
    WHERE s.id = service_line_items.service_id
      AND c.user_id = auth.uid()
  )
);

-- 2.3 Service Media - Enhanced Contractor Access
CREATE POLICY "Contractors can view media for their services"
ON public.service_media
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM services s
    JOIN contractors c ON c.id = s.contractor_id
    WHERE s.id = service_media.service_id
      AND c.user_id = auth.uid()
  )
);

-- ============================================================================
-- PHASE 3: RATE LIMITING ENHANCEMENTS
-- ============================================================================

-- Add rate limiting function for contractor directory queries
CREATE OR REPLACE FUNCTION public.check_directory_rate_limit(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  query_count INTEGER;
BEGIN
  -- Count directory queries in last 1 minute
  SELECT COUNT(*)
  INTO query_count
  FROM audit_log
  WHERE actor_user_id = _user_id
    AND action = 'view_contractor_directory'
    AND created_at > now() - interval '1 minute';
  
  -- Allow maximum 10 queries per minute (prevent scraping)
  RETURN query_count < 10;
END;
$$;

-- Add rate limiting for service request creation
CREATE OR REPLACE FUNCTION public.check_service_request_rate_limit(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_count INTEGER;
BEGIN
  -- Count service requests in last 10 minutes
  SELECT COUNT(*)
  INTO request_count
  FROM service_requests_v2
  WHERE customer_id = _user_id
    AND created_at > now() - interval '10 minutes';
  
  -- Allow maximum 5 requests per 10 minutes
  RETURN request_count < 5;
END;
$$;

-- ============================================================================
-- PHASE 4: ADDITIONAL HARDENING
-- ============================================================================

-- Add index on normalized_hash for duplicate detection performance
CREATE INDEX IF NOT EXISTS idx_addresses_normalized_hash 
ON public.addresses(normalized_hash) 
WHERE normalized_hash IS NOT NULL;