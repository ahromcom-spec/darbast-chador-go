-- Add subcategory_id to order_approvals to support different approval workflows
ALTER TABLE order_approvals 
ADD COLUMN IF NOT EXISTS subcategory_id uuid REFERENCES subcategories(id);

-- Create function to initialize approvals based on subcategory
CREATE OR REPLACE FUNCTION initialize_order_approvals()
RETURNS TRIGGER AS $$
DECLARE
  v_subcategory_id uuid;
BEGIN
  -- Get the subcategory_id from the project
  SELECT subcategory_id INTO v_subcategory_id
  FROM projects_v3
  WHERE id = NEW.id;

  -- For "خدمات اجراء داربست به همراه اجناس" (code 10)
  -- Only require 3 specific approvals
  IF v_subcategory_id = '3b44e5ee-8a2c-4e50-8f70-df753df8ef3d' THEN
    -- Insert the 3 required approvals
    INSERT INTO order_approvals (order_id, approver_role, subcategory_id)
    VALUES 
      (NEW.id, 'general_manager_scaffold_execution_with_materials', v_subcategory_id),
      (NEW.id, 'executive_manager_scaffold_execution_with_materials', v_subcategory_id),
      (NEW.id, 'sales_manager_scaffold_execution_with_materials', v_subcategory_id);
  ELSE
    -- Default workflow: CEO, Executive, Sales
    INSERT INTO order_approvals (order_id, approver_role, subcategory_id)
    VALUES 
      (NEW.id, 'ceo', v_subcategory_id),
      (NEW.id, 'scaffold_executive_manager', v_subcategory_id),
      (NEW.id, 'sales_manager', v_subcategory_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_initialize_order_approvals ON projects_v3;

-- Create trigger to initialize approvals when order is created with pending status
CREATE TRIGGER trigger_initialize_order_approvals
AFTER INSERT ON projects_v3
FOR EACH ROW
WHEN (NEW.status = 'pending')
EXECUTE FUNCTION initialize_order_approvals();

-- Function to check if all approvals are completed and update order status
CREATE OR REPLACE FUNCTION check_and_update_order_status()
RETURNS TRIGGER AS $$
DECLARE
  v_pending_count integer;
  v_order_id uuid;
BEGIN
  v_order_id := NEW.order_id;
  
  -- Count pending approvals for this order
  SELECT COUNT(*) INTO v_pending_count
  FROM order_approvals
  WHERE order_id = v_order_id
  AND approved_at IS NULL;
  
  -- If all approvals are done, update order to approved
  IF v_pending_count = 0 THEN
    UPDATE projects_v3
    SET 
      status = 'approved',
      approved_at = NOW()
    WHERE id = v_order_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_check_order_approvals ON order_approvals;

-- Create trigger to auto-approve order when all approvals are done
CREATE TRIGGER trigger_check_order_approvals
AFTER UPDATE ON order_approvals
FOR EACH ROW
WHEN (NEW.approved_at IS NOT NULL AND OLD.approved_at IS NULL)
EXECUTE FUNCTION check_and_update_order_status();