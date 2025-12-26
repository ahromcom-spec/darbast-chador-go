-- Fix infinite recursion in daily_reports RLS by removing direct dependency on daily_report_staff policies

-- 1) Security definer helper (bypasses RLS, avoids policy recursion)
CREATE OR REPLACE FUNCTION public.daily_report_contains_staff(p_report_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.daily_report_staff drs
    WHERE drs.daily_report_id = p_report_id
      AND drs.staff_user_id = p_user_id
  );
$$;

-- 2) Replace the recursive policy on daily_reports
DROP POLICY IF EXISTS "Staff can view reports containing their records" ON public.daily_reports;

CREATE POLICY "Staff can view reports containing their records"
ON public.daily_reports
FOR SELECT
TO authenticated
USING (
  public.daily_report_contains_staff(id, auth.uid())
);
