-- ========================================
-- CRITICAL SECURITY FIX: Audit Log Protection
-- ========================================
-- Remove overly permissive INSERT policy
DROP POLICY IF EXISTS "System insert audit log" ON public.audit_log;

-- Add restrictive policy to block user inserts completely
CREATE POLICY "Block user inserts on audit log"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Only SECURITY DEFINER functions and service role can insert
-- The existing log_audit() function already has SECURITY DEFINER

-- ========================================
-- CRITICAL SECURITY FIX: Notifications Protection  
-- ========================================
-- Remove overly permissive INSERT policy
DROP POLICY IF EXISTS "System insert notifications" ON public.notifications;

-- Add restrictive policy to block user inserts completely
CREATE POLICY "Block user inserts on notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Only SECURITY DEFINER functions can insert
-- The existing send_notification() function already has SECURITY DEFINER

-- ========================================
-- CRITICAL SECURITY FIX: Contractor Directory Protection
-- ========================================
-- The public_contractors_directory is a VIEW based on contractors table
-- It already filters to only show approved and active contractors
-- The RLS policies on the contractors table will protect access
-- No changes needed for the view itself

-- ========================================
-- ADDITIONAL SECURITY: Add audit logging for sensitive operations
-- ========================================
-- Trigger to log when contractors are approved
CREATE OR REPLACE FUNCTION public.log_contractor_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_approved = false AND NEW.is_approved = true THEN
    PERFORM public.log_audit(
      auth.uid(),
      'approve_contractor',
      'contractors',
      NEW.id,
      jsonb_build_object('company_name', NEW.company_name)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contractor_approval_audit ON public.contractors;
CREATE TRIGGER contractor_approval_audit
AFTER UPDATE ON public.contractors
FOR EACH ROW
EXECUTE FUNCTION public.log_contractor_approval();