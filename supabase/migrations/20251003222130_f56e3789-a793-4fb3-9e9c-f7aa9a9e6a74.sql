-- Remove the admin access policy to OTP codes
-- OTP codes are sensitive authentication data and should only be accessible by backend functions
-- Admins have no legitimate need to view OTP codes
DROP POLICY IF EXISTS "Admins can view OTP codes" ON public.otp_codes;