-- Create a helper function to safely fetch current user's projects_v3
-- This bypasses RLS on projects_v3 but still فقط سفارش‌های همان کاربر را برمی‌گرداند

CREATE OR REPLACE FUNCTION public.get_my_projects_v3()
RETURNS SETOF public.projects_v3
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM projects_v3 p
  JOIN customers c ON c.id = p.customer_id
  WHERE c.user_id = auth.uid();
$$;