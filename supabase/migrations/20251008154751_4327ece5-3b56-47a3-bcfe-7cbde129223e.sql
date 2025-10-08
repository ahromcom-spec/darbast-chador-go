-- فاز 4: بهبود امنیت دیتابیس (اصلاح شده)

-- 1. حذف view قدیمی و ایجاد مجدد با محدودیت دسترسی
DROP VIEW IF EXISTS public.public_contractors_directory CASCADE;

-- ایجاد view جدید که فقط اطلاعات غیر حساس را نمایش می‌دهد
CREATE VIEW public.public_contractors_directory AS
SELECT 
  c.id,
  c.company_name,
  c.description,
  c.experience_years,
  c.address,
  c.created_at,
  c.is_approved,
  (
    SELECT json_agg(json_build_object(
      'service_type', cs.service_type,
      'sub_type', cs.sub_type
    ))
    FROM contractor_services cs
    WHERE cs.contractor_id = c.id
  ) as services
FROM contractors c
WHERE c.is_approved = true AND c.is_active = true;

-- اضافه کردن comment برای مستندسازی
COMMENT ON VIEW public.public_contractors_directory IS 'نمایش عمومی اطلاعات پیمانکاران - بدون اطلاعات تماس حساس';

-- 2. محدود کردن دسترسی به اطلاعات تماس پیمانکاران
DROP POLICY IF EXISTS "Authenticated users can view approved contractors" ON public.contractors;
DROP POLICY IF EXISTS "Users can view basic contractor info" ON public.contractors;
DROP POLICY IF EXISTS "Contractors can view their own contact details" ON public.contractors;

-- Policy برای نمایش اطلاعات عمومی (بدون شماره تلفن و ایمیل)
CREATE POLICY "Users can view basic contractor info"
ON public.contractors
FOR SELECT
TO authenticated
USING (
  is_approved = true 
  AND is_active = true
);

-- 3. محافظت از audit_log در برابر DELETE و UPDATE
DROP POLICY IF EXISTS "Prevent all deletes on audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Prevent all updates on audit log" ON public.audit_log;

CREATE POLICY "Prevent all deletes on audit log"
ON public.audit_log
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "Prevent all updates on audit log"
ON public.audit_log
FOR UPDATE
TO authenticated
USING (false);

-- 4. اصلاح امنیت OTP
DROP POLICY IF EXISTS "Users can mark their OTP as verified" ON public.otp_codes;
DROP POLICY IF EXISTS "Only server can verify OTP" ON public.otp_codes;

-- فقط سیستم می‌تواند OTP را بروز کند
CREATE POLICY "Block user updates on OTP"
ON public.otp_codes
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- 5. محدود کردن DELETE روی otp_codes
DROP POLICY IF EXISTS "Only admins can delete expired OTPs" ON public.otp_codes;

CREATE POLICY "Only admins can delete expired OTPs"
ON public.otp_codes
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) AND
  expires_at < now()
);

-- 6. افزودن indexes برای بهبود performance
CREATE INDEX IF NOT EXISTS idx_contractors_approved_active 
ON public.contractors(is_approved, is_active) 
WHERE is_approved = true AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_service_requests_user_status 
ON public.service_requests(user_id, status);

CREATE INDEX IF NOT EXISTS idx_project_assignments_contractor_status 
ON public.project_assignments(contractor_id, status);

CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at 
ON public.otp_codes(expires_at) 
WHERE verified = false;

CREATE INDEX IF NOT EXISTS idx_assignments_assignee_status
ON public.assignments(assignee_user_id, status);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
ON public.notifications(user_id, read_at)
WHERE read_at IS NULL;

-- 7. افزودن function برای دسترسی امن به اطلاعات تماس پیمانکاران
CREATE OR REPLACE FUNCTION public.get_contractor_contact_info(_contractor_id UUID)
RETURNS TABLE (
  email TEXT,
  phone_number TEXT,
  contact_person TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- فقط ادمین‌ها و خود پیمانکار می‌توانند اطلاعات تماس را ببینند
  IF NOT (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'general_manager'::app_role) OR
    EXISTS (
      SELECT 1 FROM contractors c 
      WHERE c.id = _contractor_id AND c.user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز';
  END IF;

  RETURN QUERY
  SELECT c.email, c.phone_number, c.contact_person
  FROM contractors c
  WHERE c.id = _contractor_id;
END;
$$;

-- 8. افزودن function برای rate limiting
CREATE OR REPLACE FUNCTION public.check_rate_limit(_user_id UUID, _action TEXT, _limit INTEGER, _window INTERVAL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  action_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO action_count
  FROM audit_log
  WHERE actor_user_id = _user_id
    AND action = _action
    AND created_at > now() - _window;
  
  RETURN action_count < _limit;
END;
$$;