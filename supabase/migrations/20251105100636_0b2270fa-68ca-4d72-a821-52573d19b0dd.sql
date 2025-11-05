-- رفع کامل مشکل ایجاد approvals برای مدیران
-- این migration تضمین می‌کند که تمام سفارش‌های pending رکوردهای approval لازم را دارند

-- 1) حذف تریگرهای تکراری که ممکن است تداخل ایجاد کنند
DROP TRIGGER IF EXISTS ensure_sales_materials_approvals ON public.projects_v3;
DROP FUNCTION IF EXISTS public.ensure_sales_materials_approvals();

DROP TRIGGER IF EXISTS notify_managers_on_new_order ON public.projects_v3;
DROP FUNCTION IF EXISTS public.notify_managers_on_new_order();

-- 2) اصلاح تابع create_approval_records برای اطمینان از کار درست
CREATE OR REPLACE FUNCTION public.create_approval_records()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- 3) اطمینان از وجود تریگر
DROP TRIGGER IF EXISTS create_approvals_on_order_submit ON public.projects_v3;
CREATE TRIGGER create_approvals_on_order_submit
  AFTER INSERT OR UPDATE ON public.projects_v3
  FOR EACH ROW
  EXECUTE FUNCTION public.create_approval_records();

-- 4) بک‌فیل: ایجاد approvals برای سفارش‌های pending که approval ندارند
INSERT INTO order_approvals (order_id, approver_role, created_at)
SELECT 
  p.id,
  role,
  now()
FROM projects_v3 p
CROSS JOIN (
  VALUES ('ceo'), ('sales_manager'), ('scaffold_executive_manager')
) AS roles(role)
JOIN subcategories s ON s.id = p.subcategory_id
WHERE p.status = 'pending'
  AND s.code = '10'
  AND NOT EXISTS (
    SELECT 1 FROM order_approvals oa
    WHERE oa.order_id = p.id AND oa.approver_role = role
  )
ON CONFLICT (order_id, approver_role) DO NOTHING;

-- 5) بررسی و گزارش نتیجه
DO $$
DECLARE
  v_pending_count INT;
  v_approval_count INT;
BEGIN
  SELECT COUNT(*) INTO v_pending_count
  FROM projects_v3 p
  JOIN subcategories s ON s.id = p.subcategory_id
  WHERE p.status = 'pending' AND s.code = '10';
  
  SELECT COUNT(*) INTO v_approval_count
  FROM order_approvals oa
  JOIN projects_v3 p ON p.id = oa.order_id
  JOIN subcategories s ON s.id = p.subcategory_id
  WHERE p.status = 'pending' AND s.code = '10';
  
  RAISE NOTICE 'تعداد سفارش‌های pending: %', v_pending_count;
  RAISE NOTICE 'تعداد approvals ایجاد شده: %', v_approval_count;
  RAISE NOTICE 'انتظار می‌رود: % approval (3 برای هر سفارش)', v_pending_count * 3;
END $$;