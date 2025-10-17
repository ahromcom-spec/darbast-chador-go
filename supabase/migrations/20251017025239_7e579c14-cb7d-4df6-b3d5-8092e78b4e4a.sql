-- اضافه کردن فیلدهای جدید به projects_v3
ALTER TABLE public.projects_v3
ADD COLUMN IF NOT EXISTS execution_start_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS execution_end_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS executed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS execution_confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_confirmed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS financial_confirmed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS financial_confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS transaction_reference TEXT;

-- تابع برای ارسال نوتیفیکیشن به نقش‌های خاص
CREATE OR REPLACE FUNCTION public.notify_role(_role app_role, _title TEXT, _body TEXT, _link TEXT, _type TEXT DEFAULT 'info')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_user_id UUID;
BEGIN
  FOR role_user_id IN 
    SELECT user_id FROM public.user_roles WHERE role = _role
  LOOP
    PERFORM public.send_notification(role_user_id, _title, _body, _link, _type);
  END LOOP;
END;
$$;

-- تابع برای مدیریت workflow سفارش
CREATE OR REPLACE FUNCTION public.handle_order_approval_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  customer_user_id UUID;
  order_code TEXT;
  subcategory_code TEXT;
BEGIN
  -- دریافت کد زیرمجموعه
  SELECT code INTO subcategory_code FROM subcategories WHERE id = NEW.subcategory_id;
  
  -- فقط برای سفارشات داربست با اجناس (کد 01)
  IF subcategory_code != '01' THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO customer_user_id FROM customers WHERE id = NEW.customer_id;
  order_code := NEW.code;

  -- وقتی سفارش از pending به approved تغییر می‌کند
  IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
    PERFORM send_notification(
      customer_user_id,
      'سفارش تایید شد ✅',
      'سفارش شما با کد ' || order_code || ' تایید شد و در انتظار اجراست.',
      '/user/orders',
      'success'
    );
    
    PERFORM notify_role(
      'scaffold_executive_manager'::app_role,
      'سفارش جدید برای اجرا',
      'سفارش با کد ' || order_code || ' آماده اجراست.',
      '/executive/orders',
      'info'
    );
  END IF;

  -- وقتی زمان اجرا ثبت می‌شود
  IF OLD.execution_start_date IS NULL AND NEW.execution_start_date IS NOT NULL THEN
    NEW.status := 'in_progress';
    
    PERFORM send_notification(
      customer_user_id,
      'زمان اجرا تعیین شد 📅',
      'زمان اجرای سفارش شما از تاریخ ' || TO_CHAR(NEW.execution_start_date, 'YYYY/MM/DD') || ' شروع می‌شود.',
      '/user/orders',
      'info'
    );
  END IF;

  -- وقتی اجرا تایید می‌شود
  IF OLD.status = 'in_progress' AND NEW.status = 'completed' THEN
    PERFORM send_notification(
      customer_user_id,
      'اجرای سفارش تکمیل شد ✅',
      'سفارش شما اجرا شده و در انتظار تسویه مالی است.',
      '/user/orders',
      'success'
    );
    
    PERFORM notify_role(
      'sales_manager'::app_role,
      'سفارش آماده تسویه',
      'سفارش با کد ' || order_code || ' اجرا شده و آماده تسویه مالی است.',
      '/sales/orders',
      'info'
    );
  END IF;

  -- وقتی پرداخت تایید می‌شود
  IF OLD.status = 'completed' AND NEW.status = 'paid' THEN
    PERFORM send_notification(
      customer_user_id,
      'پرداخت ثبت شد 💰',
      'پرداخت سفارش شما ثبت شد و در حال بررسی مالی است.',
      '/user/orders',
      'success'
    );
    
    PERFORM notify_role(
      'finance_manager'::app_role,
      'تراکنش جدید برای بررسی',
      'پرداخت سفارش با کد ' || order_code || ' باید بررسی و ثبت شود.',
      '/finance/transactions',
      'info'
    );
  END IF;

  -- وقتی مالی تایید می‌کند و پروژه بسته می‌شود
  IF OLD.status = 'paid' AND NEW.status = 'closed' THEN
    NEW.closed_at := NOW();
    
    PERFORM send_notification(
      customer_user_id,
      'سفارش به اتمام رسید ✅',
      'سفارش شما با موفقیت به اتمام رسید. از اعتماد شما سپاسگزاریم.',
      '/user/orders',
      'success'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ایجاد trigger برای workflow
DROP TRIGGER IF EXISTS order_workflow_trigger ON public.projects_v3;
CREATE TRIGGER order_workflow_trigger
BEFORE UPDATE ON public.projects_v3
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_approval_workflow();

-- RLS برای مدیران اجرایی
CREATE POLICY "Executive managers can view approved orders"
ON public.projects_v3
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'scaffold_executive_manager'::app_role) 
  AND status IN ('approved', 'in_progress', 'completed')
);

CREATE POLICY "Executive managers can update execution details"
ON public.projects_v3
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'scaffold_executive_manager'::app_role) 
  AND status IN ('approved', 'in_progress')
)
WITH CHECK (
  has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
);

-- RLS برای مدیران فروش
CREATE POLICY "Sales managers can view completed orders"
ON public.projects_v3
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'sales_manager'::app_role) 
  AND status IN ('completed', 'paid', 'closed')
);

CREATE POLICY "Sales managers can update payment details"
ON public.projects_v3
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'sales_manager'::app_role) 
  AND status = 'completed'
)
WITH CHECK (
  has_role(auth.uid(), 'sales_manager'::app_role)
);

-- RLS برای مدیران مالی
CREATE POLICY "Finance managers can view paid orders"
ON public.projects_v3
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'finance_manager'::app_role) 
  AND status IN ('paid', 'closed')
);

CREATE POLICY "Finance managers can close orders"
ON public.projects_v3
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'finance_manager'::app_role) 
  AND status = 'paid'
)
WITH CHECK (
  has_role(auth.uid(), 'finance_manager'::app_role)
);