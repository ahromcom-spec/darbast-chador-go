-- ایجاد enum برای نقش‌ها
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- ایجاد جدول نقش‌های کاربری
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- فعال‌سازی RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- تابع بررسی نقش (Security Definer برای جلوگیری از recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Policy برای مشاهده نقش‌ها (فقط خودشان)
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy برای ادمین‌ها جهت مشاهده همه نقش‌ها
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- اضافه کردن ستون location به جدول service_requests
ALTER TABLE public.service_requests
ADD COLUMN location_address TEXT,
ADD COLUMN location_coordinates POINT,
ADD COLUMN location_distance NUMERIC;

-- Policy برای ادمین‌ها جهت مشاهده تمام سفارشات
CREATE POLICY "Admins can view all requests"
ON public.service_requests
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));