-- Fix search_path for functions - properly drop and recreate
DROP TRIGGER IF EXISTS trigger_initialize_order_approvals ON projects_v3;
DROP TRIGGER IF EXISTS trigger_check_order_approvals ON order_approvals;

DROP FUNCTION IF EXISTS initialize_order_approvals() CASCADE;
DROP FUNCTION IF EXISTS check_and_update_order_status() CASCADE;

CREATE OR REPLACE FUNCTION initialize_order_approvals()
RETURNS TRIGGER AS $$
DECLARE
  v_subcategory_id uuid;
BEGIN
  SELECT subcategory_id INTO v_subcategory_id
  FROM projects_v3
  WHERE id = NEW.id;

  IF v_subcategory_id = '3b44e5ee-8a2c-4e50-8f70-df753df8ef3d' THEN
    INSERT INTO order_approvals (order_id, approver_role, subcategory_id)
    VALUES 
      (NEW.id, 'general_manager_scaffold_execution_with_materials', v_subcategory_id),
      (NEW.id, 'executive_manager_scaffold_execution_with_materials', v_subcategory_id),
      (NEW.id, 'sales_manager_scaffold_execution_with_materials', v_subcategory_id);
  ELSE
    INSERT INTO order_approvals (order_id, approver_role, subcategory_id)
    VALUES 
      (NEW.id, 'ceo', v_subcategory_id),
      (NEW.id, 'scaffold_executive_manager', v_subcategory_id),
      (NEW.id, 'sales_manager', v_subcategory_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION check_and_update_order_status()
RETURNS TRIGGER AS $$
DECLARE
  v_pending_count integer;
  v_order_id uuid;
  customer_user_id uuid;
  order_code text;
BEGIN
  v_order_id := NEW.order_id;
  
  SELECT COUNT(*) INTO v_pending_count
  FROM order_approvals
  WHERE order_id = v_order_id
  AND approved_at IS NULL;
  
  IF v_pending_count = 0 THEN
    UPDATE projects_v3
    SET 
      status = 'approved',
      approved_at = NOW()
    WHERE id = v_order_id
    RETURNING code INTO order_code;
    
    SELECT c.user_id INTO customer_user_id
    FROM customers c
    JOIN projects_v3 p ON p.customer_id = c.id
    WHERE p.id = v_order_id;
    
    IF customer_user_id IS NOT NULL THEN
      PERFORM send_notification(
        customer_user_id,
        'سفارش تایید شد ✅',
        'سفارش شما با کد ' || order_code || ' توسط تمام مدیران تایید شد و در انتظار اجراست.',
        '/user/projects',
        'success'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_initialize_order_approvals
AFTER INSERT ON projects_v3
FOR EACH ROW
WHEN (NEW.status = 'pending')
EXECUTE FUNCTION initialize_order_approvals();

CREATE TRIGGER trigger_check_order_approvals
AFTER UPDATE ON order_approvals
FOR EACH ROW
WHEN (NEW.approved_at IS NOT NULL AND OLD.approved_at IS NULL)
EXECUTE FUNCTION check_and_update_order_status();