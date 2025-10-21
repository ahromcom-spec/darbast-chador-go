-- 1. Function to automatically create approval records when order is submitted
CREATE OR REPLACE FUNCTION create_approval_records()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only create approvals when status changes to 'pending'
  IF NEW.status = 'pending' AND (OLD IS NULL OR OLD.status != 'pending') THEN
    -- Create 3 approval records: CEO, Executive Manager, Sales Manager
    INSERT INTO order_approvals (order_id, approver_role)
    VALUES 
      (NEW.id, 'ceo'),
      (NEW.id, 'scaffold_executive_manager'),
      (NEW.id, 'sales_manager');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic approval record creation
DROP TRIGGER IF EXISTS create_approvals_on_order_submit ON projects_v3;
CREATE TRIGGER create_approvals_on_order_submit
  AFTER INSERT OR UPDATE ON projects_v3
  FOR EACH ROW
  EXECUTE FUNCTION create_approval_records();

-- 2. Function to check if all approvals are complete and update status
CREATE OR REPLACE FUNCTION check_all_approvals_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_approvals INTEGER;
  completed_approvals INTEGER;
  order_status project_status_v3;
BEGIN
  -- Only proceed if this approval was just completed
  IF NEW.approved_at IS NOT NULL AND (OLD.approved_at IS NULL OR OLD.approved_at != NEW.approved_at) THEN
    
    -- Get current order status
    SELECT status INTO order_status
    FROM projects_v3
    WHERE id = NEW.order_id;
    
    -- Only update if order is still pending
    IF order_status = 'pending' THEN
      -- Count total and completed approvals for this order
      SELECT 
        COUNT(*),
        COUNT(approved_at)
      INTO total_approvals, completed_approvals
      FROM order_approvals
      WHERE order_id = NEW.order_id;
      
      -- If all approvals are complete, update order status
      IF completed_approvals = total_approvals THEN
        UPDATE projects_v3
        SET 
          status = 'in_progress',
          updated_at = NOW()
        WHERE id = NEW.order_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-update status when all approvals complete
DROP TRIGGER IF EXISTS auto_approve_order ON order_approvals;
CREATE TRIGGER auto_approve_order
  AFTER UPDATE ON order_approvals
  FOR EACH ROW
  EXECUTE FUNCTION check_all_approvals_complete();

-- 3. Update RLS policies for managers to edit pending orders
DROP POLICY IF EXISTS "Sales managers can edit pending orders" ON projects_v3;
CREATE POLICY "Sales managers can edit pending orders"
  ON projects_v3
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'sales_manager') 
    AND status = 'pending'
  )
  WITH CHECK (
    has_role(auth.uid(), 'sales_manager')
    AND status IN ('pending', 'in_progress')
  );

DROP POLICY IF EXISTS "Executive managers can edit pending orders" ON projects_v3;
CREATE POLICY "Executive managers can edit pending orders"
  ON projects_v3
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'scaffold_executive_manager') 
    AND status = 'pending'
  )
  WITH CHECK (
    has_role(auth.uid(), 'scaffold_executive_manager')
    AND status IN ('pending', 'in_progress')
  );