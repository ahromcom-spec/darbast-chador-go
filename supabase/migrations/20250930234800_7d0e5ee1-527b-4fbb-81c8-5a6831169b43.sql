-- Remove the vulnerable SELECT policy completely
-- OTP verification is now done through secure functions only
DROP POLICY IF EXISTS "Users can check OTP request status" ON public.otp_codes;

-- No SELECT policy needed - all verification happens through:
-- 1. verify_otp_code() function for validation
-- 2. check_otp_rate_limit() function for rate limiting
-- Both are SECURITY DEFINER and don't expose sensitive data