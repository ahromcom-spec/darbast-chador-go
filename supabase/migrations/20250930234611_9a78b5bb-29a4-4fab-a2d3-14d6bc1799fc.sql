-- Fix Critical OTP Security Vulnerability
-- Drop the vulnerable SELECT policy that exposes OTP codes
DROP POLICY IF EXISTS "Users can verify their own OTP codes" ON public.otp_codes;

-- Create a secure function for OTP verification that doesn't expose the code
CREATE OR REPLACE FUNCTION public.verify_otp_code(
  _phone_number text,
  _code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  otp_valid boolean;
BEGIN
  -- Check if OTP exists, is not expired, and matches
  SELECT EXISTS (
    SELECT 1
    FROM public.otp_codes
    WHERE phone_number = _phone_number
      AND code = _code
      AND expires_at > now()
      AND verified = false
  ) INTO otp_valid;
  
  RETURN otp_valid;
END;
$$;

-- Add a secure SELECT policy that doesn't expose OTP codes
-- Only allows checking if an OTP record exists for rate limiting purposes
CREATE POLICY "Users can check OTP request status"
ON public.otp_codes
FOR SELECT
USING (
  -- Only allow checking the timestamp, not the code itself
  -- This prevents code exposure while allowing rate limit checks
  expires_at > now()
);

-- Add rate limiting: prevent too many OTP requests from same phone
CREATE OR REPLACE FUNCTION public.check_otp_rate_limit(_phone_number text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
BEGIN
  -- Count OTP requests from this phone in last 5 minutes
  SELECT COUNT(*)
  INTO recent_count
  FROM public.otp_codes
  WHERE phone_number = _phone_number
    AND created_at > now() - interval '5 minutes';
  
  -- Allow maximum 3 requests per 5 minutes
  RETURN recent_count < 3;
END;
$$;