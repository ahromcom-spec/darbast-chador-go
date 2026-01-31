-- Add user_password and recovery_email columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS user_password_hash TEXT,
ADD COLUMN IF NOT EXISTS recovery_email TEXT,
ADD COLUMN IF NOT EXISTS recovery_email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMP WITH TIME ZONE;

-- Create index for email recovery lookups
CREATE INDEX IF NOT EXISTS idx_profiles_recovery_email ON public.profiles(recovery_email) WHERE recovery_email IS NOT NULL;

-- Create table for email verification codes
CREATE TABLE IF NOT EXISTS public.email_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'password_reset', -- 'email_verify' | 'password_reset'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '10 minutes'),
  used BOOLEAN DEFAULT FALSE
);

-- Enable RLS on email_verification_codes
ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;

-- Only allow service role to manage email codes (via edge functions)
CREATE POLICY "Service role manages email codes" 
ON public.email_verification_codes 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Create function to cleanup expired email codes
CREATE OR REPLACE FUNCTION public.cleanup_expired_email_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.email_verification_codes 
  WHERE expires_at < now() OR used = true;
END;
$$;

-- Create function to verify email code
CREATE OR REPLACE FUNCTION public.verify_email_code(_email TEXT, _code TEXT, _purpose TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  valid_code RECORD;
BEGIN
  SELECT * INTO valid_code
  FROM public.email_verification_codes
  WHERE email = _email
    AND code = _code
    AND purpose = _purpose
    AND expires_at > now()
    AND used = false
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF FOUND THEN
    -- Mark as used
    UPDATE public.email_verification_codes SET used = true WHERE id = valid_code.id;
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;