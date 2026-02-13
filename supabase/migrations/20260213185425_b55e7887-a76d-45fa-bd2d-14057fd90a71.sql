
-- Helper function to check if user is assigned to a module
CREATE OR REPLACE FUNCTION public.is_assigned_to_module(_user_id uuid, _module_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.module_assignments
    WHERE assigned_user_id = _user_id
      AND module_key = _module_key
      AND is_active = true
  )
$$;

-- daily_reports: Allow assigned users to SELECT
CREATE POLICY "Module assigned users can view daily reports"
ON public.daily_reports FOR SELECT
TO authenticated
USING (
  module_key IS NOT NULL AND is_assigned_to_module(auth.uid(), module_key)
);

-- daily_reports: Allow assigned users to INSERT
CREATE POLICY "Module assigned users can create daily reports"
ON public.daily_reports FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by 
  AND module_key IS NOT NULL 
  AND is_assigned_to_module(auth.uid(), module_key)
);

-- daily_reports: Allow assigned users to UPDATE
CREATE POLICY "Module assigned users can update daily reports"
ON public.daily_reports FOR UPDATE
TO authenticated
USING (
  module_key IS NOT NULL AND is_assigned_to_module(auth.uid(), module_key)
);

-- daily_reports: Allow assigned users to DELETE
CREATE POLICY "Module assigned users can delete daily reports"
ON public.daily_reports FOR DELETE
TO authenticated
USING (
  module_key IS NOT NULL AND is_assigned_to_module(auth.uid(), module_key)
);

-- daily_report_orders: Allow access if user has access to the parent daily_report
CREATE POLICY "Module assigned users can view daily report orders"
ON public.daily_report_orders FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM daily_reports dr
    WHERE dr.id = daily_report_orders.daily_report_id
      AND dr.module_key IS NOT NULL
      AND is_assigned_to_module(auth.uid(), dr.module_key)
  )
);

CREATE POLICY "Module assigned users can insert daily report orders"
ON public.daily_report_orders FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM daily_reports dr
    WHERE dr.id = daily_report_orders.daily_report_id
      AND dr.module_key IS NOT NULL
      AND is_assigned_to_module(auth.uid(), dr.module_key)
  )
);

CREATE POLICY "Module assigned users can update daily report orders"
ON public.daily_report_orders FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM daily_reports dr
    WHERE dr.id = daily_report_orders.daily_report_id
      AND dr.module_key IS NOT NULL
      AND is_assigned_to_module(auth.uid(), dr.module_key)
  )
);

CREATE POLICY "Module assigned users can delete daily report orders"
ON public.daily_report_orders FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM daily_reports dr
    WHERE dr.id = daily_report_orders.daily_report_id
      AND dr.module_key IS NOT NULL
      AND is_assigned_to_module(auth.uid(), dr.module_key)
  )
);

-- daily_report_staff: Allow access if user has access to the parent daily_report
CREATE POLICY "Module assigned users can view daily report staff"
ON public.daily_report_staff FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM daily_reports dr
    WHERE dr.id = daily_report_staff.daily_report_id
      AND dr.module_key IS NOT NULL
      AND is_assigned_to_module(auth.uid(), dr.module_key)
  )
);

CREATE POLICY "Module assigned users can insert daily report staff"
ON public.daily_report_staff FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM daily_reports dr
    WHERE dr.id = daily_report_staff.daily_report_id
      AND dr.module_key IS NOT NULL
      AND is_assigned_to_module(auth.uid(), dr.module_key)
  )
);

CREATE POLICY "Module assigned users can update daily report staff"
ON public.daily_report_staff FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM daily_reports dr
    WHERE dr.id = daily_report_staff.daily_report_id
      AND dr.module_key IS NOT NULL
      AND is_assigned_to_module(auth.uid(), dr.module_key)
  )
);

CREATE POLICY "Module assigned users can delete daily report staff"
ON public.daily_report_staff FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM daily_reports dr
    WHERE dr.id = daily_report_staff.daily_report_id
      AND dr.module_key IS NOT NULL
      AND is_assigned_to_module(auth.uid(), dr.module_key)
  )
);
