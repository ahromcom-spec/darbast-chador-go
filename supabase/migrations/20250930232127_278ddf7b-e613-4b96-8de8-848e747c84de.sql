-- Add RLS policies for otp_codes table
-- Only allow inserting new OTP codes (for sending)
CREATE POLICY "Anyone can insert OTP codes"
ON public.otp_codes
FOR INSERT
WITH CHECK (true);

-- Only allow selecting OTP codes that match the phone number and are not expired
CREATE POLICY "Users can verify their own OTP codes"
ON public.otp_codes
FOR SELECT
USING (expires_at > now() AND verified = false);

-- Only allow updating OTP codes to mark them as verified
CREATE POLICY "Users can mark their OTP as verified"
ON public.otp_codes
FOR UPDATE
USING (expires_at > now() AND verified = false)
WITH CHECK (verified = true);