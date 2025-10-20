-- ایجاد جدول برای ردیابی تاییدات سفارشات
CREATE TABLE IF NOT EXISTS public.order_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.projects_v3(id) ON DELETE CASCADE,
  approver_role TEXT NOT NULL, -- 'ceo', 'executive_manager', 'sales_manager'
  approver_user_id UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(order_id, approver_role)
);

-- Enable RLS
ALTER TABLE public.order_approvals ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Managers can view approvals"
ON public.order_approvals FOR SELECT
USING (
  has_role(auth.uid(), 'ceo'::app_role) OR 
  has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR 
  has_role(auth.uid(), 'sales_manager'::app_role)
);

CREATE POLICY "Managers can insert approvals"
ON public.order_approvals FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'ceo'::app_role) OR 
  has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR 
  has_role(auth.uid(), 'sales_manager'::app_role)
);

-- تابع برای ایجاد رکوردهای تایید اولیه
CREATE OR REPLACE FUNCTION public.create_initial_approvals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  subcategory_code TEXT;
BEGIN
  -- دریافت کد زیرمجموعه
  SELECT code INTO subcategory_code FROM subcategories WHERE id = NEW.subcategory_id;
  
  -- فقط برای سفارشات داربست با اجناس (کد 01)
  IF subcategory_code = '01' AND NEW.status = 'pending' THEN
    -- ایجاد رکوردهای تایید برای سه مدیر
    INSERT INTO public.order_approvals (order_id, approver_role)
    VALUES 
      (NEW.id, 'ceo'),
      (NEW.id, 'scaffold_executive_manager'),
      (NEW.id, 'sales_manager')
    ON CONFLICT (order_id, approver_role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger برای ایجاد تاییدات
DROP TRIGGER IF EXISTS create_approvals_on_order ON public.projects_v3;
CREATE TRIGGER create_approvals_on_order
  AFTER INSERT ON public.projects_v3
  FOR EACH ROW
  EXECUTE FUNCTION public.create_initial_approvals();

-- تابع برای بررسی و به‌روزرسانی وضعیت سفارش
CREATE OR REPLACE FUNCTION public.check_all_approvals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_count INTEGER;
  customer_user_id UUID;
  order_code TEXT;
BEGIN
  -- شمارش تاییدات باقی‌مانده
  SELECT COUNT(*) INTO pending_count
  FROM public.order_approvals
  WHERE order_id = NEW.order_id AND approved_at IS NULL;
  
  -- اگر همه تایید کردند
  IF pending_count = 0 THEN
    -- تغییر وضعیت به approved
    UPDATE public.projects_v3
    SET status = 'approved', approved_at = now()
    WHERE id = NEW.order_id AND status = 'pending';
    
    -- ارسال نوتیفیکیشن به مشتری
    SELECT user_id INTO customer_user_id
    FROM customers c
    JOIN projects_v3 p ON p.customer_id = c.id
    WHERE p.id = NEW.order_id;
    
    SELECT code INTO order_code FROM projects_v3 WHERE id = NEW.order_id;
    
    IF customer_user_id IS NOT NULL THEN
      PERFORM send_notification(
        customer_user_id,
        'سفارش تایید شد ✅',
        'سفارش شما با کد ' || order_code || ' توسط تمام مدیران تایید شد و در انتظار اجرا است.',
        '/user/projects',
        'success'
      );
    END IF;
    
    -- ارسال نوتیفیکیشن به مدیر اجرایی
    PERFORM notify_role(
      'scaffold_executive_manager'::app_role,
      'سفارش جدید برای اجرا',
      'سفارش با کد ' || order_code || ' آماده اجراست.',
      '/executive/orders',
      'info'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger برای بررسی تاییدات
DROP TRIGGER IF EXISTS check_approvals_on_update ON public.order_approvals;
CREATE TRIGGER check_approvals_on_update
  AFTER UPDATE ON public.order_approvals
  FOR EACH ROW
  WHEN (OLD.approved_at IS NULL AND NEW.approved_at IS NOT NULL)
  EXECUTE FUNCTION public.check_all_approvals();

-- به‌روزرسانی تابع notify_new_order برای ارسال به سه مدیر
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  customer_name TEXT;
  customer_user_id UUID;
  subcategory_code TEXT;
BEGIN
  -- دریافت کد زیرمجموعه
  SELECT code INTO subcategory_code FROM subcategories WHERE id = NEW.subcategory_id;
  
  -- فقط برای سفارش‌های داربست با اجناس (کد 01) و وضعیت pending
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status != 'pending') AND subcategory_code = '01' THEN
    SELECT user_id INTO customer_user_id
    FROM customers
    WHERE id = NEW.customer_id;
    
    SELECT p.full_name INTO customer_name
    FROM profiles p
    JOIN customers c ON c.user_id = p.user_id
    WHERE c.id = NEW.customer_id;
    
    -- ارسال نوتیفیکیشن به CEO
    PERFORM notify_role(
      'ceo'::app_role,
      'سفارش جدید در انتظار تایید',
      COALESCE(customer_name, 'مشتری') || ' یک سفارش جدید ثبت کرده است. کد سفارش: ' || NEW.code,
      '/ceo/orders',
      'info'
    );
    
    -- ارسال نوتیفیکیشن به مدیر اجرایی
    PERFORM notify_role(
      'scaffold_executive_manager'::app_role,
      'سفارش جدید در انتظار تایید',
      COALESCE(customer_name, 'مشتری') || ' یک سفارش جدید ثبت کرده است. کد سفارش: ' || NEW.code,
      '/executive/orders',
      'info'
    );
    
    -- ارسال نوتیفیکیشن به مدیر فروش
    PERFORM notify_role(
      'sales_manager'::app_role,
      'سفارش جدید در انتظار تایید',
      COALESCE(customer_name, 'مشتری') || ' یک سفارش جدید ثبت کرده است. کد سفارش: ' || NEW.code,
      '/sales/orders',
      'info'
    );
    
    -- Log audit
    IF customer_user_id IS NOT NULL AND TG_OP = 'INSERT' THEN
      PERFORM log_audit(
        customer_user_id,
        'create_order',
        'projects_v3',
        NEW.id,
        jsonb_build_object('code', NEW.code, 'status', NEW.status)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;