-- بررسی و اضافه کردن نقش‌های مورد نیاز به app_role enum (اگر وجود ندارند)
DO $$ 
BEGIN
  -- اضافه کردن نقش مدیر اجرایی داربست
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'scaffold_executive_manager' AND enumtypid = 'app_role'::regtype) THEN
    ALTER TYPE app_role ADD VALUE 'scaffold_executive_manager';
  END IF;
  
  -- اضافه کردن نقش مدیر فروش
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'sales_manager' AND enumtypid = 'app_role'::regtype) THEN
    ALTER TYPE app_role ADD VALUE 'sales_manager';
  END IF;
  
  -- اضافه کردن نقش مدیر مالی
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'finance_manager' AND enumtypid = 'app_role'::regtype) THEN
    ALTER TYPE app_role ADD VALUE 'finance_manager';
  END IF;
END $$;

-- بررسی و اضافه کردن وضعیت‌های جدید به project_status_v3 enum (اگر وجود ندارند)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'in_progress' AND enumtypid = 'project_status_v3'::regtype) THEN
    ALTER TYPE project_status_v3 ADD VALUE 'in_progress';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'completed' AND enumtypid = 'project_status_v3'::regtype) THEN
    ALTER TYPE project_status_v3 ADD VALUE 'completed';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'paid' AND enumtypid = 'project_status_v3'::regtype) THEN
    ALTER TYPE project_status_v3 ADD VALUE 'paid';
  END IF;
END $$;

-- اضافه کردن ستون‌های مورد نیاز برای گردش کاری به جدول projects_v3
ALTER TABLE projects_v3 
  ADD COLUMN IF NOT EXISTS execution_start_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS execution_end_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS executed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS execution_confirmed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS payment_confirmed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS financial_confirmed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS financial_confirmed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS transaction_reference TEXT;

-- تابع برای مدیریت گردش کار تایید سفارش
CREATE OR REPLACE FUNCTION handle_order_approval_workflow()
RETURNS TRIGGER
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

-- حذف trigger قبلی اگر وجود داشته باشد
DROP TRIGGER IF EXISTS order_approval_workflow_trigger ON projects_v3;

-- ایجاد trigger جدید
CREATE TRIGGER order_approval_workflow_trigger
  BEFORE UPDATE ON projects_v3
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_approval_workflow();

-- بروزرسانی RLS policies برای نقش‌های جدید
DROP POLICY IF EXISTS "Executive managers can view approved orders" ON projects_v3;
CREATE POLICY "Executive managers can view approved orders"
  ON projects_v3
  FOR SELECT
  USING (
    has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
    AND status IN ('approved', 'in_progress', 'completed')
  );

DROP POLICY IF EXISTS "Executive managers can update execution details" ON projects_v3;
CREATE POLICY "Executive managers can update execution details"
  ON projects_v3
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
    AND status IN ('approved', 'in_progress')
  )
  WITH CHECK (
    has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  );

DROP POLICY IF EXISTS "Sales managers can view completed orders" ON projects_v3;
CREATE POLICY "Sales managers can view completed orders"
  ON projects_v3
  FOR SELECT
  USING (
    has_role(auth.uid(), 'sales_manager'::app_role)
    AND status IN ('completed', 'paid', 'closed')
  );

DROP POLICY IF EXISTS "Sales managers can update payment details" ON projects_v3;
CREATE POLICY "Sales managers can update payment details"
  ON projects_v3
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'sales_manager'::app_role)
    AND status = 'completed'
  )
  WITH CHECK (
    has_role(auth.uid(), 'sales_manager'::app_role)
  );

DROP POLICY IF EXISTS "Finance managers can view paid orders" ON projects_v3;
CREATE POLICY "Finance managers can view paid orders"
  ON projects_v3
  FOR SELECT
  USING (
    has_role(auth.uid(), 'finance_manager'::app_role)
    AND status IN ('paid', 'closed')
  );

DROP POLICY IF EXISTS "Finance managers can close orders" ON projects_v3;
CREATE POLICY "Finance managers can close orders"
  ON projects_v3
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'finance_manager'::app_role)
    AND status = 'paid'
  )
  WITH CHECK (
    has_role(auth.uid(), 'finance_manager'::app_role)
  );