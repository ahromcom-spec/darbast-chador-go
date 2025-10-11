-- ═══════════════════════════════════════════════════════════════
-- مرحله ۱: ساختار پایگاه داده اصلی برای سیستم داربست-چادر-گو
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- ۱. جدول استان‌ها (Provinces)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.provinces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- داده‌های اولیه: فقط قم در حال حاضر فعال است
INSERT INTO public.provinces (name, code) VALUES
  ('قم', '10'),
  ('تهران', '01'),
  ('اصفهان', '03'),
  ('فارس', '07'),
  ('خوزستان', '06');

-- ─────────────────────────────────────────────────────────────
-- ۲. جدول مناطق (Districts)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  province_id UUID NOT NULL REFERENCES public.provinces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(name, province_id)
);

-- داده‌های اولیه: فقط مناطق قم
INSERT INTO public.districts (name, province_id) 
SELECT 'شهر قم', id FROM public.provinces WHERE code = '10'
UNION ALL
SELECT 'جعفریه', id FROM public.provinces WHERE code = '10'
UNION ALL
SELECT 'کهک', id FROM public.provinces WHERE code = '10'
UNION ALL
SELECT 'سلفچگان', id FROM public.provinces WHERE code = '10';

-- ─────────────────────────────────────────────────────────────
-- ۳. جدول انواع خدمات (Service Types)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_types_v3 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- داده اولیه: داربست فلزی
INSERT INTO public.service_types_v3 (name, code) VALUES
  ('داربست فلزی', '10');

-- ─────────────────────────────────────────────────────────────
-- ۴. جدول زیرشاخه‌های خدمات (Subcategories)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  service_type_id UUID NOT NULL REFERENCES public.service_types_v3(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(code, service_type_id)
);

-- داده‌های اولیه: زیرشاخه‌های داربست
INSERT INTO public.subcategories (name, code, service_type_id)
SELECT 'نصب با مصالح', '10', id FROM public.service_types_v3 WHERE code = '10'
UNION ALL
SELECT 'نصب بدون مصالح', '11', id FROM public.service_types_v3 WHERE code = '10';

-- ─────────────────────────────────────────────────────────────
-- ۵. جدول مشتریان با کد منحصر به فرد (Customers)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_code TEXT NOT NULL UNIQUE CHECK (length(customer_code) = 8 AND customer_code ~ '^[1-9][0-9]{7}$'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- تابع تولید کد مشتری ۸ رقمی
CREATE OR REPLACE FUNCTION public.generate_customer_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- تولید عدد 8 رقمی که رقم اول غیر صفر است
    new_code := LPAD((10000000 + floor(random() * 90000000)::INT)::TEXT, 8, '0');
    
    -- بررسی عدم تکراری بودن
    SELECT EXISTS(SELECT 1 FROM public.customers WHERE customer_code = new_code) INTO code_exists;
    
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$;

-- تابع خودکار برای اختصاص کد به مشتریان جدید
CREATE OR REPLACE FUNCTION public.assign_customer_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_code IS NULL THEN
    NEW.customer_code := public.generate_customer_code();
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger برای اختصاص خودکار کد
CREATE TRIGGER set_customer_code
BEFORE INSERT ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.assign_customer_code();

-- ─────────────────────────────────────────────────────────────
-- ۶. Enum برای نقش‌های کارکنان
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_role_type') THEN
    CREATE TYPE public.staff_role_type AS ENUM (
      'manager',              -- مدیر
      'supervisor',           -- سرپرست
      'operations_manager',   -- مدیر عملیات
      'support',              -- پشتیبانی
      'accounting',           -- حسابداری
      'sales',                -- فروش
      'warehouse',            -- انبار
      'hr'                    -- منابع انسانی
    );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- ۷. جدول نقش‌های کارکنان (Staff Roles)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.staff_role_type NOT NULL,
  service_type_id UUID REFERENCES public.service_types_v3(id) ON DELETE CASCADE,
  subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL,
  province_id UUID REFERENCES public.provinces(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role, service_type_id, province_id)
);

-- محدودیت حداکثر 5 نقش فعال برای هر کاربر
CREATE OR REPLACE FUNCTION public.check_max_staff_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  active_count INT;
BEGIN
  IF NEW.active = true THEN
    SELECT COUNT(*) INTO active_count
    FROM public.staff_roles
    WHERE user_id = NEW.user_id AND active = true AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);
    
    IF active_count >= 5 THEN
      RAISE EXCEPTION 'هر کاربر حداکثر می‌تواند 5 نقش فعال داشته باشد';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_max_staff_roles
BEFORE INSERT OR UPDATE ON public.staff_roles
FOR EACH ROW
EXECUTE FUNCTION public.check_max_staff_roles();

-- ─────────────────────────────────────────────────────────────
-- ۸. Enum برای وضعیت پروژه
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status_v3') THEN
    CREATE TYPE public.project_status_v3 AS ENUM (
      'draft',              -- پیش‌نویس
      'pending_execution',  -- در انتظار اجرا
      'active',             -- فعال
      'completed'           -- تکمیل شده
    );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- ۹. جدول پروژه‌های جدید (Projects V3)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects_v3 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_number TEXT NOT NULL,
  service_code TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  contractor_id UUID REFERENCES public.contractors(id) ON DELETE SET NULL,
  province_id UUID NOT NULL REFERENCES public.provinces(id),
  district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
  subcategory_id UUID NOT NULL REFERENCES public.subcategories(id),
  status public.project_status_v3 DEFAULT 'draft',
  address TEXT NOT NULL,
  detailed_address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id, service_code, project_number)
);

-- تابع تولید کد پروژه
CREATE OR REPLACE FUNCTION public.generate_project_code(
  _customer_id UUID,
  _province_id UUID,
  _subcategory_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- ساخت service_code
  service_code_str := province_code || service_type_code || subcategory_code;
  
  -- پیدا کردن آخرین شماره پروژه
  SELECT COALESCE(MAX(project_number::INT), 0) INTO last_project_num
  FROM public.projects_v3
  WHERE customer_id = _customer_id AND service_code = service_code_str;
  
  -- شماره پروژه جدید
  project_num_str := LPAD((last_project_num + 1)::TEXT, 3, '0');
  
  -- کد نهایی
  final_code := project_num_str || '/' || service_code_str || '/' || customer_code_str;
  
  RETURN final_code;
END;
$$;

-- تابع updated_at
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers برای updated_at
CREATE TRIGGER update_customers_timestamp
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER update_staff_roles_timestamp
BEFORE UPDATE ON public.staff_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER update_projects_v3_timestamp
BEFORE UPDATE ON public.projects_v3
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp();

-- ─────────────────────────────────────────────────────────────
-- ۱۰. Row Level Security (RLS)
-- ─────────────────────────────────────────────────────────────

-- Provinces (عمومی - همه می‌توانند ببینند)
ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active provinces"
ON public.provinces FOR SELECT
USING (is_active = true);

-- Districts (عمومی - همه می‌توانند ببینند)
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view districts"
ON public.districts FOR SELECT
USING (true);

-- Service Types (عمومی - همه می‌توانند ببینند)
ALTER TABLE public.service_types_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active service types"
ON public.service_types_v3 FOR SELECT
USING (is_active = true);

-- Subcategories (عمومی - همه می‌توانند ببینند)
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active subcategories"
ON public.subcategories FOR SELECT
USING (is_active = true);

-- Customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own customer record"
ON public.customers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own customer record"
ON public.customers FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all customers"
ON public.customers FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Staff Roles
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own staff roles"
ON public.staff_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins and managers can view all staff roles"
ON public.staff_roles FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role)
);

CREATE POLICY "Admins and managers can manage staff roles"
ON public.staff_roles FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role)
);

-- Projects V3
ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own projects"
ON public.projects_v3 FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = projects_v3.customer_id
    AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Customers can create own projects"
ON public.projects_v3 FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = projects_v3.customer_id
    AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Customers can update own draft projects"
ON public.projects_v3 FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = projects_v3.customer_id
    AND c.user_id = auth.uid()
  )
  AND status = 'draft'
);

CREATE POLICY "Staff can view all projects"
ON public.projects_v3 FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  EXISTS (
    SELECT 1 FROM public.staff_roles sr
    WHERE sr.user_id = auth.uid() AND sr.active = true
  )
);

CREATE POLICY "Contractors can view assigned projects"
ON public.projects_v3 FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contractors c
    WHERE c.id = projects_v3.contractor_id
    AND c.user_id = auth.uid()
  )
);

-- ─────────────────────────────────────────────────────────────
-- ۱۱. تخصیص کد مشتری به کاربران موجود
-- ─────────────────────────────────────────────────────────────
-- این query را فقط یک بار اجرا کنید تا کاربران فعلی کد بگیرند
INSERT INTO public.customers (user_id)
SELECT DISTINCT u.id
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.customers c WHERE c.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;