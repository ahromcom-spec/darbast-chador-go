-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Explicitly deny inserts for anon/authenticated to satisfy scanner while keeping backend (service role) working
DROP POLICY IF EXISTS "Deny public inserts on otp_codes" ON public.otp_codes;
CREATE POLICY "Deny public inserts on otp_codes"
ON public.otp_codes
FOR INSERT
TO anon, authenticated
WITH CHECK (false);
