-- Add policy to allow service role to check if phone numbers exist during login/registration
-- This is needed for the send-otp edge function to verify user existence

CREATE POLICY "Service role can view all profiles for OTP verification"
ON public.profiles
FOR SELECT
USING (true);