-- ====================================================================
-- رفع مشکل امنیتی: حذف VIEW غیرایمن و استفاده از تابع امن
-- ====================================================================

-- 1. حذف VIEW قدیمی که RLS نداشت
DROP VIEW IF EXISTS public.public_contractors_directory CASCADE;

-- 2. تابع get_public_contractors قبلاً ایجاد شده و امن است
-- این تابع SECURITY DEFINER است و فقط اطلاعات غیرحساس را برمی‌گرداند

-- 3. اضافه کردن comment برای مستندسازی
COMMENT ON FUNCTION public.get_public_contractors() IS 
'SECURITY: Returns public contractor directory without sensitive contact information (email, phone, contact_person). This function is SECURITY DEFINER and bypasses RLS to provide safe public access. For contact details, use get_contractor_contact_info() which requires proper authorization and logs all access.';