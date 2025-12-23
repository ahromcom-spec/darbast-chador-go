-- جدول نیروهای انسانی شرکت
CREATE TABLE public.hr_employees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number text NOT NULL UNIQUE,
  full_name text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  position text,
  department text,
  hire_date date,
  status text NOT NULL DEFAULT 'pending_registration' CHECK (status IN ('active', 'pending_registration', 'inactive')),
  notes text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;

-- فقط مدیرعامل و مدیرکل می‌توانند مدیریت کنند
CREATE POLICY "CEO and GM can manage HR employees"
ON public.hr_employees
FOR ALL
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role));

-- کاربران می‌توانند رکورد خودشان را ببینند
CREATE POLICY "Users can view their own HR record"
ON public.hr_employees
FOR SELECT
USING (auth.uid() = user_id);

-- تریگر برای بروزرسانی updated_at
CREATE TRIGGER update_hr_employees_updated_at
BEFORE UPDATE ON public.hr_employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ایندکس برای جستجوی سریع‌تر
CREATE INDEX idx_hr_employees_phone ON public.hr_employees(phone_number);
CREATE INDEX idx_hr_employees_user_id ON public.hr_employees(user_id);
CREATE INDEX idx_hr_employees_status ON public.hr_employees(status);

-- تابع برای اتصال خودکار user_id وقتی کاربر ثبت‌نام می‌کند
CREATE OR REPLACE FUNCTION public.link_hr_employee_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_phone text;
BEGIN
  -- دریافت شماره موبایل از metadata یا پروفایل
  user_phone := NEW.raw_user_meta_data->>'phone_number';
  
  IF user_phone IS NULL THEN
    -- بررسی در جدول profiles
    SELECT phone_number INTO user_phone 
    FROM public.profiles 
    WHERE user_id = NEW.id;
  END IF;
  
  IF user_phone IS NOT NULL THEN
    -- بروزرسانی رکورد HR اگر وجود داشته باشد
    UPDATE public.hr_employees
    SET 
      user_id = NEW.id,
      status = 'active',
      updated_at = now()
    WHERE phone_number = user_phone AND user_id IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- تریگر بعد از ایجاد کاربر جدید
CREATE TRIGGER on_user_created_link_hr
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.link_hr_employee_on_signup();