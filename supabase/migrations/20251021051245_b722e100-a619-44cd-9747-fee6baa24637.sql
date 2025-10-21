-- Drop existing policies first
DROP POLICY IF EXISTS "Managers can view approvals" ON order_approvals;
DROP POLICY IF EXISTS "CEO can manage all approvals" ON order_approvals;
DROP POLICY IF EXISTS "Sales managers can manage own approvals" ON order_approvals;
DROP POLICY IF EXISTS "Executive managers can manage own approvals" ON order_approvals;

-- Create function to automatically create approval records when a new order is created
CREATE OR REPLACE FUNCTION create_order_approvals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert approval records for CEO, sales_manager, and scaffold_executive_manager
  INSERT INTO order_approvals (order_id, approver_role)
  VALUES 
    (NEW.id, 'ceo'),
    (NEW.id, 'sales_manager'),
    (NEW.id, 'scaffold_executive_manager');
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically create approval records for new pending orders
DROP TRIGGER IF EXISTS trigger_create_order_approvals ON projects_v3;
CREATE TRIGGER trigger_create_order_approvals
  AFTER INSERT ON projects_v3
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION create_order_approvals();

-- Create function to check if all approvals are complete and update order status
CREATE OR REPLACE FUNCTION check_all_approvals_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_approvals INT;
  v_completed_approvals INT;
BEGIN
  -- Count total required approvals for this order
  SELECT COUNT(*) INTO v_total_approvals
  FROM order_approvals
  WHERE order_id = NEW.order_id;
  
  -- Count completed approvals
  SELECT COUNT(*) INTO v_completed_approvals
  FROM order_approvals
  WHERE order_id = NEW.order_id
    AND approved_at IS NOT NULL
    AND approver_user_id IS NOT NULL;
  
  -- If all approvals are complete, update project status to 'approved'
  IF v_completed_approvals >= v_total_approvals AND v_total_approvals > 0 THEN
    UPDATE projects_v3
    SET 
      status = 'approved',
      approved_at = NOW(),
      updated_at = NOW()
    WHERE id = NEW.order_id
      AND status = 'pending';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to check approvals after each approval is recorded
DROP TRIGGER IF EXISTS trigger_check_approvals ON order_approvals;
CREATE TRIGGER trigger_check_approvals
  AFTER UPDATE ON order_approvals
  FOR EACH ROW
  WHEN (NEW.approved_at IS NOT NULL AND OLD.approved_at IS NULL)
  EXECUTE FUNCTION check_all_approvals_complete();

-- Add RLS policies for order_approvals table
ALTER TABLE order_approvals ENABLE ROW LEVEL SECURITY;

-- CEO can view and update all approvals
CREATE POLICY "CEO can manage all approvals"
ON order_approvals
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'ceo'))
WITH CHECK (has_role(auth.uid(), 'ceo'));

-- Sales managers can view and update their own approvals
CREATE POLICY "Sales managers can manage own approvals"
ON order_approvals
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'sales_manager') 
  AND approver_role = 'sales_manager'
)
WITH CHECK (
  has_role(auth.uid(), 'sales_manager') 
  AND approver_role = 'sales_manager'
);

-- Executive managers can view and update their own approvals
CREATE POLICY "Executive managers can manage own approvals"
ON order_approvals
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'scaffold_executive_manager') 
  AND approver_role = 'scaffold_executive_manager'
)
WITH CHECK (
  has_role(auth.uid(), 'scaffold_executive_manager') 
  AND approver_role = 'scaffold_executive_manager'
);

-- All managers can view approvals
CREATE POLICY "Managers can view approvals"
ON order_approvals
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'ceo') 
  OR has_role(auth.uid(), 'sales_manager')
  OR has_role(auth.uid(), 'scaffold_executive_manager')
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'general_manager')
);