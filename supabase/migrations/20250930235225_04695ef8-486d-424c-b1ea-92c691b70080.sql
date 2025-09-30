-- Add restrictive SELECT policy to satisfy scanner and keep data secure
DROP POLICY IF EXISTS "Admins can view OTP codes" ON public.otp_codes;
CREATE POLICY "Admins can view OTP codes"
ON public.otp_codes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));