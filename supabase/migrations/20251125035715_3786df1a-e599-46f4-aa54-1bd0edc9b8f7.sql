-- Fix RLS policies on user_roles to allow reading for role verification in edge functions

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

-- Allow authenticated users to read user_roles for authorization checks
-- This is safe because we're only exposing role information, not sensitive data
CREATE POLICY "Authenticated users can read roles for authorization"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);

-- Only admins and general managers can insert/update/delete roles
CREATE POLICY "Only admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'general_manager'::app_role) OR
  public.has_role(auth.uid(), 'ceo'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'general_manager'::app_role) OR
  public.has_role(auth.uid(), 'ceo'::app_role)
);