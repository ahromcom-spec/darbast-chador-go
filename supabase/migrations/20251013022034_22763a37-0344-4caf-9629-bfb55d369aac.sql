-- ====================================================================
-- رفع مشکل امنیتی: محافظت از اطلاعات تماس پیمانکاران
-- ====================================================================

-- 1. حذف policy که تمام فیلدها (شامل email و phone) را برای همه نمایش می‌دهد
DROP POLICY IF EXISTS "Authenticated users can view non-sensitive contractor data" ON public.contractors;

-- 2. ایجاد تابع برای دسترسی امن به لیست عمومی پیمانکاران (بدون اطلاعات تماس)
CREATE OR REPLACE FUNCTION public.get_public_contractors()
RETURNS TABLE (
  id UUID,
  company_name TEXT,
  description TEXT,
  experience_years INTEGER,
  is_approved BOOLEAN,
  created_at TIMESTAMPTZ,
  general_location TEXT,
  services JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id,
    c.company_name,
    c.description,
    c.experience_years,
    c.is_approved,
    c.created_at,
    CASE
      WHEN c.address IS NOT NULL 
      THEN regexp_replace(c.address, '،.*$', '')
      ELSE NULL
    END AS general_location,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'service_type', cs.service_type, 
          'sub_type', cs.sub_type
        )
      ) FILTER (WHERE cs.id IS NOT NULL),
      '[]'::jsonb
    ) AS services
  FROM contractors c
  LEFT JOIN contractor_services cs ON cs.contractor_id = c.id
  WHERE c.is_approved = true AND c.is_active = true
  GROUP BY c.id, c.company_name, c.description, c.experience_years, 
           c.is_approved, c.created_at, c.address;
$$;

-- 3. اضافه کردن policy برای مسدود کردن دسترسی ناشناس به contractors
DROP POLICY IF EXISTS "Block anonymous access to contractors" ON public.contractors;
CREATE POLICY "Block anonymous access to contractors"
ON public.contractors
FOR SELECT
TO anon
USING (false);

-- 4. ثبت در audit log برای track کردن دسترسی به اطلاعات تماس پیمانکاران
-- این قبلاً در تابع get_contractor_contact_info وجود دارد

-- 5. اضافه کردن comment برای مستندسازی
COMMENT ON FUNCTION public.get_public_contractors() IS 
'Returns public contractor directory without sensitive contact information (email, phone). For contact details, use get_contractor_contact_info() which requires proper authorization.';

COMMENT ON FUNCTION public.get_contractor_contact_info(UUID) IS 
'Securely returns contractor contact information (email, phone, contact person). Only accessible by: 1) Admins, 2) General Managers, 3) The contractor themselves. All access is logged in audit_log.';