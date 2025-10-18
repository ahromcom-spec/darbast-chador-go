-- به روز رسانی کدهای استان‌ها (از 10 شروع، به ترتیب)
UPDATE public.provinces SET code = '10' WHERE name = 'قم';
UPDATE public.provinces SET code = '11' WHERE name = 'تهران';
UPDATE public.provinces SET code = '12' WHERE name = 'اصفهان';
UPDATE public.provinces SET code = '13' WHERE name = 'خوزستان';
UPDATE public.provinces SET code = '14' WHERE name = 'فارس';
UPDATE public.provinces SET code = '15' WHERE name = 'البرز';

-- به روز رسانی کدهای نوع خدمات (از 10 شروع، به ترتیب)
UPDATE public.service_types_v3 SET code = '10' WHERE name = 'داربست فلزی';
UPDATE public.service_types_v3 SET code = '11' WHERE name = 'چادر برزنتی';
UPDATE public.service_types_v3 SET code = '12' WHERE name = 'فنس کشی';
UPDATE public.service_types_v3 SET code = '13' WHERE name = 'ارماتوربندی';
UPDATE public.service_types_v3 SET code = '14' WHERE name = 'ابزارآلات';
UPDATE public.service_types_v3 SET code = '15' WHERE name = 'قالی شویی';
UPDATE public.service_types_v3 SET code = '16' WHERE name = 'سیمانکاری ساختمان';

-- اصلاح تابع تولید کد پروژه
-- فرمت: [customer_code]/[project_number]/[service_code]
-- مثال: 12345678/001/101010
CREATE OR REPLACE FUNCTION public.generate_project_code(_customer_id uuid, _province_id uuid, _subcategory_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  province_code TEXT;
  service_type_code TEXT;
  subcategory_code TEXT;
  service_code_str TEXT;
  customer_code_str TEXT;
  last_project_num INT;
  project_num_str TEXT;
  final_code TEXT;
BEGIN
  -- دریافت کدها
  SELECT code INTO province_code FROM public.provinces WHERE id = _province_id;
  
  SELECT st.code INTO service_type_code
  FROM public.service_types_v3 st
  JOIN public.subcategories sc ON sc.service_type_id = st.id
  WHERE sc.id = _subcategory_id;
  
  SELECT code INTO subcategory_code FROM public.subcategories WHERE id = _subcategory_id;
  
  SELECT customer_code INTO customer_code_str FROM public.customers WHERE id = _customer_id;
  
  -- ساخت service_code (6 رقمی: استان + نوع خدمات + زیرشاخه)
  service_code_str := province_code || service_type_code || subcategory_code;
  
  -- پیدا کردن آخرین شماره پروژه برای این مشتری و این کد خدمات
  SELECT COALESCE(MAX(project_number::INT), 0) INTO last_project_num
  FROM public.projects_v3
  WHERE customer_id = _customer_id AND service_code = service_code_str;
  
  -- شماره پروژه جدید (3 رقمی: 001 تا 999)
  project_num_str := LPAD((last_project_num + 1)::TEXT, 3, '0');
  
  -- کد نهایی: کد مشتری / شماره پروژه / کد خدمات
  final_code := customer_code_str || '/' || project_num_str || '/' || service_code_str;
  
  RETURN final_code;
END;
$function$;

-- اصلاح تابع تولید کد خدمات
-- فرمت: [project_code],[service_number]
-- مثال: 12345678/001/101010,001
CREATE OR REPLACE FUNCTION public.generate_service_code(_project_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  project_code_str TEXT;
  last_service_num INTEGER;
  new_service_num INTEGER;
  new_service_code TEXT;
BEGIN
  -- دریافت کد پروژه
  SELECT code INTO project_code_str
  FROM public.projects_v3
  WHERE id = _project_id;
  
  IF project_code_str IS NULL THEN
    RAISE EXCEPTION 'پروژه با شناسه % یافت نشد', _project_id;
  END IF;
  
  -- پیدا کردن آخرین شماره خدمات در این پروژه
  SELECT COALESCE(MAX(service_number), 0) INTO last_service_num
  FROM public.services_v3
  WHERE project_id = _project_id;
  
  new_service_num := last_service_num + 1;
  
  -- بررسی محدودیت 999
  IF new_service_num > 999 THEN
    RAISE EXCEPTION 'تعداد خدمات پروژه به حداکثر مجاز (999) رسیده است';
  END IF;
  
  -- ساخت کد خدمات: کد پروژه, شماره خدمات (3 رقمی)
  new_service_code := project_code_str || ',' || LPAD(new_service_num::TEXT, 3, '0');
  
  RETURN new_service_code;
END;
$function$;