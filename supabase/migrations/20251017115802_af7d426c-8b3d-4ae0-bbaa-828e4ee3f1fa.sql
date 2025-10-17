-- Add RLS policy for subcategories table so authenticated users can view them
CREATE POLICY "Authenticated users can view subcategories"
ON public.subcategories
FOR SELECT
TO authenticated
USING (is_active = true);

-- Add function to ensure customer record exists
CREATE OR REPLACE FUNCTION public.ensure_customer_exists()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.customers (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Add trigger to auto-create customer record for new users
DROP TRIGGER IF EXISTS ensure_customer_on_new_user ON auth.users;
CREATE TRIGGER ensure_customer_on_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_customer_exists();