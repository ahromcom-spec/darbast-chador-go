-- ایجاد جدول خدمات برای هر پروژه
CREATE TABLE IF NOT EXISTS public.services_v3 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects_v3(id) ON DELETE CASCADE,
  service_number INTEGER NOT NULL CHECK (service_number >= 1 AND service_number <= 999),
  service_code TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  execution_start_date TIMESTAMP WITH TIME ZONE,
  execution_end_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, service_number)
);

-- تابع تولید کد خدمات (کد_پروژه,001 تا کد_پروژه,999)
CREATE OR REPLACE FUNCTION public.generate_service_code(_project_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- پیدا کردن آخرین شماره خدمات
  SELECT COALESCE(MAX(service_number), 0) INTO last_service_num
  FROM public.services_v3
  WHERE project_id = _project_id;
  
  new_service_num := last_service_num + 1;
  
  -- بررسی محدودیت 999
  IF new_service_num > 999 THEN
    RAISE EXCEPTION 'تعداد خدمات پروژه به حداکثر مجاز (999) رسیده است';
  END IF;
  
  -- ساخت کد خدمات
  new_service_code := project_code_str || ',' || LPAD(new_service_num::TEXT, 3, '0');
  
  RETURN new_service_code;
END;
$$;

-- تریگر به‌روزرسانی updated_at
CREATE TRIGGER update_services_v3_updated_at
  BEFORE UPDATE ON public.services_v3
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- فعال‌سازی RLS
ALTER TABLE public.services_v3 ENABLE ROW LEVEL SECURITY;

-- Policy: مشتریان می‌توانند خدمات پروژه‌های خود را ببینند
CREATE POLICY "Customers can view own project services"
ON public.services_v3
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects_v3 p
    INNER JOIN public.customers c ON c.id = p.customer_id
    WHERE p.id = services_v3.project_id
      AND c.user_id = auth.uid()
  )
);

-- Policy: مشتریان می‌توانند برای پروژه‌های خود خدمات اضافه کنند
CREATE POLICY "Customers can insert services for own projects"
ON public.services_v3
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects_v3 p
    INNER JOIN public.customers c ON c.id = p.customer_id
    WHERE p.id = services_v3.project_id
      AND c.user_id = auth.uid()
  )
);

-- Policy: مشتریان می‌توانند خدمات پروژه‌های خود را ویرایش کنند
CREATE POLICY "Customers can update own project services"
ON public.services_v3
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects_v3 p
    INNER JOIN public.customers c ON c.id = p.customer_id
    WHERE p.id = services_v3.project_id
      AND c.user_id = auth.uid()
  )
);

-- Policy: مدیران می‌توانند همه خدمات را مدیریت کنند
CREATE POLICY "Admins and managers can manage all services"
ON public.services_v3
FOR ALL
USING (
  has_role(auth.uid(), 'ceo'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role)
);

-- ایجاد ایندکس‌ها برای بهبود عملکرد
CREATE INDEX IF NOT EXISTS idx_services_v3_project_id ON public.services_v3(project_id);
CREATE INDEX IF NOT EXISTS idx_services_v3_status ON public.services_v3(status);
CREATE INDEX IF NOT EXISTS idx_services_v3_service_code ON public.services_v3(service_code);