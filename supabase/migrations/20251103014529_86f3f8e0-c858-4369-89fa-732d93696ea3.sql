-- حذف approvals تکراری و اصلاح automation workflow

-- ابتدا تمام triggers و functions قدیمی را حذف می‌کنیم
DROP TRIGGER IF EXISTS trigger_create_order_approvals ON projects_v3;
DROP TRIGGER IF EXISTS trigger_initialize_order_approvals ON projects_v3;
DROP TRIGGER IF EXISTS trigger_check_order_approvals ON order_approvals;
DROP TRIGGER IF EXISTS trigger_notify_new_order ON projects_v3;

DROP FUNCTION IF EXISTS create_order_approvals() CASCADE;
DROP FUNCTION IF EXISTS create_initial_approvals() CASCADE;
DROP FUNCTION IF EXISTS initialize_order_approvals() CASCADE;
DROP FUNCTION IF EXISTS check_and_update_order_status() CASCADE;
DROP FUNCTION IF EXISTS check_all_approvals_complete() CASCADE;

-- حذف approvals تکراری - فقط نگه داشتن صحیح‌ترین approvals
DELETE FROM order_approvals oa1
WHERE EXISTS (
  SELECT 1 FROM order_approvals oa2
  WHERE oa2.order_id = oa1.order_id
  AND oa2.approver_role = oa1.approver_role
  AND oa2.created_at < oa1.created_at
);

-- حذف approvals اشتباه برای subcategory مشخص
-- برای سفارشات با subcategory_id = '3b44e5ee-8a2c-4e50-8f70-df753df8ef3d'
-- باید فقط این نقش‌ها باشند:
-- 1. general_manager_scaffold_execution_with_materials
-- 2. executive_manager_scaffold_execution_with_materials  
-- 3. sales_manager_scaffold_execution_with_materials
DELETE FROM order_approvals
WHERE order_id IN (
  SELECT id FROM projects_v3 
  WHERE subcategory_id = '3b44e5ee-8a2c-4e50-8f70-df753df8ef3d'
)
AND approver_role NOT IN (
  'general_manager_scaffold_execution_with_materials',
  'executive_manager_scaffold_execution_with_materials',
  'sales_manager_scaffold_execution_with_materials'
);

-- برای سایر subcategories، حذف نقش‌های جدید
DELETE FROM order_approvals
WHERE order_id IN (
  SELECT id FROM projects_v3 
  WHERE subcategory_id != '3b44e5ee-8a2c-4e50-8f70-df753df8ef3d'
  OR subcategory_id IS NULL
)
AND approver_role IN (
  'general_manager_scaffold_execution_with_materials',
  'executive_manager_scaffold_execution_with_materials',
  'sales_manager_scaffold_execution_with_materials'
);

-- اضافه کردن approvals گمشده برای سفارشات موجود
INSERT INTO order_approvals (order_id, approver_role, subcategory_id)
SELECT 
  p.id,
  CASE 
    WHEN p.subcategory_id = '3b44e5ee-8a2c-4e50-8f70-df753df8ef3d' THEN 'general_manager_scaffold_execution_with_materials'
    ELSE 'ceo'
  END,
  p.subcategory_id
FROM projects_v3 p
WHERE p.status = 'pending'
AND NOT EXISTS (
  SELECT 1 FROM order_approvals oa
  WHERE oa.order_id = p.id
  AND oa.approver_role = CASE 
    WHEN p.subcategory_id = '3b44e5ee-8a2c-4e50-8f70-df753df8ef3d' THEN 'general_manager_scaffold_execution_with_materials'
    ELSE 'ceo'
  END
);

INSERT INTO order_approvals (order_id, approver_role, subcategory_id)
SELECT 
  p.id,
  CASE 
    WHEN p.subcategory_id = '3b44e5ee-8a2c-4e50-8f70-df753df8ef3d' THEN 'executive_manager_scaffold_execution_with_materials'
    ELSE 'scaffold_executive_manager'
  END,
  p.subcategory_id
FROM projects_v3 p
WHERE p.status = 'pending'
AND NOT EXISTS (
  SELECT 1 FROM order_approvals oa
  WHERE oa.order_id = p.id
  AND oa.approver_role = CASE 
    WHEN p.subcategory_id = '3b44e5ee-8a2c-4e50-8f70-df753df8ef3d' THEN 'executive_manager_scaffold_execution_with_materials'
    ELSE 'scaffold_executive_manager'
  END
);

INSERT INTO order_approvals (order_id, approver_role, subcategory_id)
SELECT 
  p.id,
  CASE 
    WHEN p.subcategory_id = '3b44e5ee-8a2c-4e50-8f70-df753df8ef3d' THEN 'sales_manager_scaffold_execution_with_materials'
    ELSE 'sales_manager'
  END,
  p.subcategory_id
FROM projects_v3 p
WHERE p.status = 'pending'
AND NOT EXISTS (
  SELECT 1 FROM order_approvals oa
  WHERE oa.order_id = p.id
  AND oa.approver_role = CASE 
    WHEN p.subcategory_id = '3b44e5ee-8a2c-4e50-8f70-df753df8ef3d' THEN 'sales_manager_scaffold_execution_with_materials'
    ELSE 'sales_manager'
  END
);

-- تابع جدید برای ایجاد approvals با لاجیک صحیح
CREATE OR REPLACE FUNCTION initialize_order_approvals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- فقط برای سفارشات pending
  IF NEW.status = 'pending' THEN
    -- بررسی subcategory برای تعیین نوع approvers
    IF NEW.subcategory_id = '3b44e5ee-8a2c-4e50-8f70-df753df8ef3d' THEN
      -- داربست با اجناس: نیاز به تایید General Manager, Executive Manager, Sales Manager
      INSERT INTO order_approvals (order_id, approver_role, subcategory_id)
      VALUES 
        (NEW.id, 'general_manager_scaffold_execution_with_materials', NEW.subcategory_id),
        (NEW.id, 'executive_manager_scaffold_execution_with_materials', NEW.subcategory_id),
        (NEW.id, 'sales_manager_scaffold_execution_with_materials', NEW.subcategory_id)
      ON CONFLICT DO NOTHING;
    ELSE
      -- سایر خدمات: نیاز به تایید CEO, Executive Manager, Sales Manager
      INSERT INTO order_approvals (order_id, approver_role, subcategory_id)
      VALUES 
        (NEW.id, 'ceo', NEW.subcategory_id),
        (NEW.id, 'scaffold_executive_manager', NEW.subcategory_id),
        (NEW.id, 'sales_manager', NEW.subcategory_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- تابع بررسی تکمیل approvals و تغییر وضعیت
CREATE OR REPLACE FUNCTION check_and_update_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending_count integer;
  v_order_status project_status_v3;
  customer_user_id uuid;
  order_code text;
BEGIN
  -- فقط وقتی approval جدیدی انجام شود
  IF NEW.approved_at IS NOT NULL AND (OLD.approved_at IS NULL OR OLD.approved_at != NEW.approved_at) THEN
    
    -- دریافت وضعیت فعلی سفارش
    SELECT status, code INTO v_order_status, order_code
    FROM projects_v3
    WHERE id = NEW.order_id;
    
    -- فقط اگر سفارش هنوز pending است
    IF v_order_status = 'pending' THEN
      -- شمارش approvals باقی‌مانده
      SELECT COUNT(*) INTO v_pending_count
      FROM order_approvals
      WHERE order_id = NEW.order_id
      AND approved_at IS NULL;
      
      -- اگر همه تایید کردند، وضعیت را تغییر بده
      IF v_pending_count = 0 THEN
        UPDATE projects_v3
        SET 
          status = 'in_progress',
          updated_at = NOW()
        WHERE id = NEW.order_id;
        
        -- اطلاع‌رسانی به مشتری
        SELECT c.user_id INTO customer_user_id
        FROM customers c
        JOIN projects_v3 p ON p.customer_id = c.id
        WHERE p.id = NEW.order_id;
        
        IF customer_user_id IS NOT NULL THEN
          PERFORM send_notification(
            customer_user_id,
            'سفارش تایید شد ✅',
            'سفارش شما با کد ' || order_code || ' توسط تمام مدیران تایید شد و وارد مرحله اجرا شده است.',
            '/user/my-orders',
            'success'
          );
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ایجاد triggers
CREATE TRIGGER trigger_initialize_order_approvals
AFTER INSERT ON projects_v3
FOR EACH ROW
EXECUTE FUNCTION initialize_order_approvals();

CREATE TRIGGER trigger_check_order_approvals
AFTER UPDATE ON order_approvals
FOR EACH ROW
WHEN (NEW.approved_at IS NOT NULL AND OLD.approved_at IS NULL)
EXECUTE FUNCTION check_and_update_order_status();