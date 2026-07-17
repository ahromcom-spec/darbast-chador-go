
CREATE OR REPLACE FUNCTION public.current_user_has_password()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND user_password_hash IS NOT NULL
      AND length(user_password_hash) > 0
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_has_password() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_password() TO authenticated;
