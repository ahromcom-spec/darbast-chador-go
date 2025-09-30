-- Add phone_number column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone_number TEXT UNIQUE;

-- Create a table to store OTP codes
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on otp_codes
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Create a function to clean up expired OTP codes
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.otp_codes
  WHERE expires_at < now();
END;
$$;

-- Update the handle_new_user function to work with phone authentication
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone_number)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone_number', '')
  )
  ON CONFLICT (user_id) DO UPDATE
  SET phone_number = COALESCE(NEW.phone, EXCLUDED.phone_number);
  RETURN NEW;
END;
$$;