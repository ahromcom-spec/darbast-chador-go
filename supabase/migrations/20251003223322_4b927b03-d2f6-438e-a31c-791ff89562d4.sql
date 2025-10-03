-- Fix: Prevent public reading of OTP codes
-- OTP codes should only be accessible by backend edge functions using service role
-- This prevents attackers from reading valid OTP codes to hijack accounts

CREATE POLICY "Deny all public SELECT on otp_codes"
ON public.otp_codes
FOR SELECT
TO authenticated, anon
USING (false);