-- Fix 1: Update transfer_order_ownership to add authorization check
CREATE OR REPLACE FUNCTION public.transfer_order_ownership(
  p_order_id UUID,
  p_new_customer_id UUID,
  p_new_hierarchy_id UUID,
  p_transferred_from_user_id UUID,
  p_transferred_from_phone TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer_request_exists BOOLEAN;
  v_current_user_phone TEXT;
BEGIN
  -- Verify that a valid transfer request exists where the caller is the recipient
  SELECT EXISTS(
    SELECT 1
    FROM order_transfer_requests otr
    WHERE otr.order_id = p_order_id
      AND otr.status = 'pending_recipient'
      AND (
        otr.to_user_id = auth.uid()
        OR otr.to_phone_number = (
          SELECT phone_number FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
      )
  ) INTO v_transfer_request_exists;
  
  IF NOT v_transfer_request_exists THEN
    RAISE EXCEPTION 'Unauthorized: No valid transfer request found for this user';
  END IF;
  
  -- Proceed with transfer only if authorized
  UPDATE projects_v3
  SET 
    customer_id = p_new_customer_id,
    hierarchy_project_id = p_new_hierarchy_id,
    transferred_from_user_id = p_transferred_from_user_id,
    transferred_from_phone = p_transferred_from_phone
  WHERE id = p_order_id;
  
  -- Mark transfer request as completed
  UPDATE order_transfer_requests
  SET status = 'completed', responded_at = NOW()
  WHERE order_id = p_order_id 
    AND status = 'pending_recipient'
    AND (
      to_user_id = auth.uid()
      OR to_phone_number = (
        SELECT phone_number FROM profiles WHERE user_id = auth.uid() LIMIT 1
      )
    );
END;
$$;

-- Fix 2: Fix profiles RLS policy - remove overly permissive policy and add proper restrictions
DROP POLICY IF EXISTS "Service role can view all profiles for OTP verification" ON profiles;

-- Create policy restricted to service role only (for edge functions)
DROP POLICY IF EXISTS "Service role OTP verification" ON profiles;
CREATE POLICY "Service role OTP verification"
ON public.profiles
FOR SELECT
TO service_role
USING (true);

-- Ensure anon role is explicitly blocked
DROP POLICY IF EXISTS "Block anonymous profile access" ON profiles;
CREATE POLICY "Block anonymous profile access"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- Ensure authenticated users can only see their own profile (update existing if needed)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);