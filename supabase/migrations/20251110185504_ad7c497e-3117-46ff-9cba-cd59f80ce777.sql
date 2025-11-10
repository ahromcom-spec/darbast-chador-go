-- حذف رفرنس‌های نقش نامعتبر sales_manager_scaffold_execution_with_materials
-- و جایگزینی با sales_manager

-- 1. پاک‌سازی رکوردهای موجود در order_approvals
DELETE FROM public.order_approvals
WHERE approver_role = 'sales_manager_scaffold_execution_with_materials';

-- 2. بازنویسی تابع create_approval_records برای استفاده از sales_manager
CREATE OR REPLACE FUNCTION public.create_approval_records()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_subcategory_code TEXT;
BEGIN
  -- فقط برای سفارش‌های pending و subcategory با code = '10'
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR (OLD IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status)) THEN
    
    -- بررسی subcategory
    SELECT s.code INTO v_subcategory_code
    FROM subcategories s
    WHERE s.id = NEW.subcategory_id;
    
    -- فقط برای داربست با اجناس (code 10)
    IF v_subcategory_code = '10' THEN
      -- ایجاد approval برای سه مدیر (با ON CONFLICT برای جلوگیری از خطا)
      INSERT INTO order_approvals (order_id, approver_role, created_at)
      VALUES 
        (NEW.id, 'ceo', now()),
        (NEW.id, 'sales_manager', now()),
        (NEW.id, 'scaffold_executive_manager', now())
      ON CONFLICT (order_id, approver_role) DO NOTHING;
      
      RAISE NOTICE 'Created approvals for order %', NEW.code;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;