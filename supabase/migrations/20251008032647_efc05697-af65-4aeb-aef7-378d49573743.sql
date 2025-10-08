-- ========================================
-- CRITICAL SECURITY FIX: Block Anonymous Access to User Phone Numbers
-- ========================================

-- Ensure RLS is enabled on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Add explicit policy to block all anonymous (unauthenticated) access to profiles
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- Also block anonymous INSERT and UPDATE attempts for completeness
CREATE POLICY "Block anonymous inserts on profiles"
ON public.profiles
FOR INSERT
TO anon
WITH CHECK (false);

CREATE POLICY "Block anonymous updates on profiles"
ON public.profiles
FOR UPDATE
TO anon
USING (false);

-- Note: The existing authenticated user policies remain in place:
-- - Users can view their own profile (auth.uid() = user_id)
-- - Users can insert their own profile (auth.uid() = user_id)
-- - Users can update their own profile (auth.uid() = user_id)