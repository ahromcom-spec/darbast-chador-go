-- Remove the vulnerable public insert policy that allows anyone to spam OTPs
DROP POLICY IF EXISTS "Anyone can insert OTP codes" ON public.otp_codes;

-- OTP insertions will now only be possible via the send-otp edge function using service role
-- This prevents SMS bombing attacks and unauthorized OTP generation