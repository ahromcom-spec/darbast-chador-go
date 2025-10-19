-- Add automatic cleanup trigger for expired OTP codes
-- This trigger runs before each INSERT to prevent table bloat
CREATE OR REPLACE FUNCTION public.trigger_cleanup_expired_otps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clean up expired OTPs before inserting new one
  DELETE FROM public.otp_codes WHERE expires_at < now();
  RETURN NEW;
END;
$$;

-- Create trigger that fires before INSERT
DROP TRIGGER IF EXISTS auto_cleanup_expired_otps ON public.otp_codes;
CREATE TRIGGER auto_cleanup_expired_otps
  BEFORE INSERT ON public.otp_codes
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trigger_cleanup_expired_otps();