-- ساده‌سازی سیستم کدگذاری به کد 6 رقمی منحصر به فرد

-- 1. حذف ستون‌های اضافی project_number و service_code از projects_v3
ALTER TABLE public.projects_v3 DROP COLUMN IF EXISTS project_number;
ALTER TABLE public.projects_v3 DROP COLUMN IF EXISTS service_code;

-- 2. تبدیل ستون code به کد 6 رقمی ساده
-- ابتدا constraint یونیک را حذف کنیم
ALTER TABLE public.projects_v3 DROP CONSTRAINT IF EXISTS projects_v3_customer_id_service_code_project_number_key;
ALTER TABLE public.projects_v3 DROP CONSTRAINT IF EXISTS unique_project_code;

-- 3. ایجاد sequence برای تولید کد 6 رقمی منحصر به فرد
CREATE SEQUENCE IF NOT EXISTS project_code_seq START 100000 MAXVALUE 999999 CYCLE;

-- 4. بازنویسی تابع generate_project_code برای تولید کد 6 رقمی ساده
CREATE OR REPLACE FUNCTION public.generate_project_code(
  _customer_id uuid,
  _province_id uuid,
  _subcategory_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code text;
BEGIN
  -- تولید کد 6 رقمی از sequence
  new_code := LPAD(nextval('project_code_seq')::text, 6, '0');
  RETURN new_code;
END;
$$;

-- 5. بازنویسی تابع create_project_v3 برای استفاده از کد ساده
CREATE OR REPLACE FUNCTION public.create_project_v3(
  _customer_id uuid,
  _province_id uuid,
  _district_id uuid,
  _subcategory_id uuid,
  _hierarchy_project_id uuid,
  _address text,
  _detailed_address text,
  _notes jsonb DEFAULT NULL
)
RETURNS TABLE(id uuid, code text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_project_id uuid;
  attempts int := 0;
BEGIN
  LOOP
    attempts := attempts + 1;
    -- تولید کد 6 رقمی
    v_code := public.generate_project_code(_customer_id, _province_id, _subcategory_id);
    
    BEGIN
      -- درج پروژه با کد ساده
      INSERT INTO public.projects_v3 (
        customer_id, province_id, district_id, subcategory_id, hierarchy_project_id,
        code, address, detailed_address, notes, status
      ) VALUES (
        _customer_id, _province_id, _district_id, _subcategory_id, _hierarchy_project_id,
        v_code, _address, _detailed_address, _notes, 'pending'
      ) RETURNING projects_v3.id INTO v_project_id;

      -- موفقیت
      id := v_project_id;
      code := v_code;
      RETURN NEXT;
      RETURN;
      
    EXCEPTION WHEN unique_violation THEN
      -- اگر کد تکراری شد، تلاش مجدد
      IF attempts >= 10 THEN
        RAISE EXCEPTION 'خطا در تولید کد منحصر به فرد پس از 10 تلاش';
      END IF;
      -- ادامه حلقه برای دریافت کد جدید
    END;
  END LOOP;
END;
$$;