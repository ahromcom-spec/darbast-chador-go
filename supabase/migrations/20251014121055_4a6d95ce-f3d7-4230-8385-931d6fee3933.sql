-- ============================================
-- مرحله 1: رفع مسئله امنیتی بحرانی - اضافه کردن RLS به user_roles
-- ============================================

-- فعال کردن RLS برای جدول user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- فقط ادمین‌ها و مدیران کل می‌توانند تمام نقش‌ها را ببینند
CREATE POLICY "Admins and GMs can view all roles"
ON user_roles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role));

-- کاربران می‌توانند نقش خود را ببینند
CREATE POLICY "Users can view own roles"
ON user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- مسدود کردن insert مستقیم - فقط از طریق توابع سیستم
CREATE POLICY "Block direct role inserts"
ON user_roles FOR INSERT
TO authenticated
WITH CHECK (false);

-- فقط ادمین‌ها و مدیران کل می‌توانند نقش‌ها را مدیریت کنند
CREATE POLICY "Only admins and GMs can manage roles"
ON user_roles FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role));

CREATE POLICY "Only admins and GMs can delete roles"
ON user_roles FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role));

-- ============================================
-- مرحله 2: ساختار داده برای سیستم مدیریت پرسنل و پیمانکاران
-- ============================================

-- جدول مناطق (استان‌ها)
CREATE TABLE IF NOT EXISTS public.regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('province', 'city', 'district')),
  parent_id UUID REFERENCES public.regions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- فعال کردن RLS برای regions
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active regions"
ON public.regions FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Only admins can manage regions"
ON public.regions FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role));

-- جدول دسته‌بندی خدمات (صنف)
CREATE TABLE IF NOT EXISTS public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active service categories"
ON public.service_categories FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Only admins can manage service categories"
ON public.service_categories FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role));

-- جدول نوع فعالیت خدمات
CREATE TABLE IF NOT EXISTS public.service_activity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

ALTER TABLE public.service_activity_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active activity types"
ON public.service_activity_types FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Only admins can manage activity types"
ON public.service_activity_types FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role));

-- جدول پست‌های سازمانی
CREATE TABLE IF NOT EXISTS public.organizational_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

ALTER TABLE public.organizational_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active positions"
ON public.organizational_positions FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Only admins can manage positions"
ON public.organizational_positions FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role));

-- جدول پروفایل پیمانکاران (توسعه یافته)
CREATE TABLE IF NOT EXISTS public.contractor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  region_id UUID REFERENCES public.regions(id),
  service_category_id UUID REFERENCES public.service_categories(id),
  activity_type_id UUID REFERENCES public.service_activity_types(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.contractor_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contractor profile"
ON public.contractor_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own contractor profile"
ON public.contractor_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all contractor profiles"
ON public.contractor_profiles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role));

CREATE POLICY "Admins can manage contractor profiles"
ON public.contractor_profiles FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role));

-- جدول پروفایل پرسنل (توسعه یافته)
CREATE TABLE IF NOT EXISTS public.internal_staff_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  region_id UUID REFERENCES public.regions(id),
  position_id UUID REFERENCES public.organizational_positions(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.internal_staff_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own staff profile"
ON public.internal_staff_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own staff profile"
ON public.internal_staff_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all staff profiles"
ON public.internal_staff_profiles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role));

CREATE POLICY "Admins can manage staff profiles"
ON public.internal_staff_profiles FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role));

-- Trigger برای به‌روزرسانی updated_at
CREATE TRIGGER update_contractor_profiles_updated_at
BEFORE UPDATE ON public.contractor_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_staff_profiles_updated_at
BEFORE UPDATE ON public.internal_staff_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- مرحله 3: درج داده‌های اولیه از Excel
-- ============================================

-- درج استان‌ها
INSERT INTO public.regions (name, type, parent_id) VALUES
  ('استان قم', 'province', NULL),
  ('استان تهران', 'province', NULL),
  ('استان البرز', 'province', NULL)
ON CONFLICT (name) DO NOTHING;

-- درج شهرهای قم
INSERT INTO public.regions (name, type, parent_id)
SELECT 'شهر قم', 'city', id FROM public.regions WHERE name = 'استان قم' AND type = 'province'
ON CONFLICT DO NOTHING;

INSERT INTO public.regions (name, type, parent_id)
SELECT name, 'district', (SELECT id FROM public.regions WHERE name = 'شهر قم' AND type = 'city')
FROM (VALUES ('جعفریه'), ('سلفچگان'), ('کهک')) AS districts(name)
ON CONFLICT DO NOTHING;

-- درج شهرهای تهران
INSERT INTO public.regions (name, type, parent_id)
SELECT name, 'city', (SELECT id FROM public.regions WHERE name = 'استان تهران' AND type = 'province')
FROM (VALUES 
  ('تهران'), ('ری'), ('شمیرانات'), ('اسلام‌شهر'), ('بهارستان'), 
  ('قدس'), ('ملارد'), ('رباط‌کریم'), ('شهریار'), ('پردیس'), 
  ('دماوند'), ('فیروزکوه'), ('ورامین'), ('پیشوا'), ('قرچک'), ('پاکدشت')
) AS cities(name)
ON CONFLICT DO NOTHING;

-- درج شهرهای البرز
INSERT INTO public.regions (name, type, parent_id)
SELECT name, 'city', (SELECT id FROM public.regions WHERE name = 'استان البرز' AND type = 'province')
FROM (VALUES 
  ('کرج'), ('فردیس'), ('ساوجبلاغ'), ('نظرآباد'), 
  ('اشتهارد'), ('چهارباغ'), ('طالقان')
) AS cities(name)
ON CONFLICT DO NOTHING;

-- درج پست‌های سازمانی
INSERT INTO public.organizational_positions (name) VALUES
  ('مدیریت'),
  ('فروش'),
  ('اجرایی'),
  ('پشتیبانی'),
  ('حراست'),
  ('انبارداری'),
  ('مالی'),
  ('منابع انسانی'),
  ('ای‌تی'),
  ('سرپرست')
ON CONFLICT (name) DO NOTHING;

-- درج دسته‌بندی خدمات (صنف)
INSERT INTO public.service_categories (name) VALUES
  ('داربست فلزی'),
  ('چادر برزنتی'),
  ('فنس کشی'),
  ('ارماتوربندی'),
  ('ابزارآلات'),
  ('قالی شویی')
ON CONFLICT (name) DO NOTHING;

-- درج نوع فعالیت خدمات
INSERT INTO public.service_activity_types (name) VALUES
  ('اجراء با نیروهای اهرم و با اجناس، ابزارالات و ماشین آلات اهرم'),
  ('اجراء با نیروهای اهرم بدون اجناس، ابزارالات و ماشین آلات اهرم'),
  ('اجراء با نیروهای پیمانکاران و با اجناس، ابزارالات و ماشین آلات اهرم'),
  ('اجراء با نیروهای پیمانکاران و با اجناس، ابزارالات و ماشین آلات کاربر مشتری یا کارفرما'),
  ('خرید کالا و اجناس برای اهرم'),
  ('فروش از کالاها و اجناس اهرم'),
  ('کرایه دادن اهرم از اجناس یا موارد خدمات مشخص'),
  ('کرایه گرفتن اهرم از اجناس یا موارد خدمات مشخص'),
  ('تولید کالای خدمات مشخص'),
  ('تعمیر'),
  ('پورسانت واسطه گری اهرم برای پیمانکاران'),
  ('پورسانت واسطه گری پیمانکاران برای اهرم'),
  ('تأمین نیرو از طرف اهرم برای پیمانکاران'),
  ('تأمین نیرو از طرف پیمانکاران برای اهرم')
ON CONFLICT (name) DO NOTHING;