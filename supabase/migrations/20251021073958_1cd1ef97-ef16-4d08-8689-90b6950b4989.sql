-- Fix duplicate approval inserts causing unique constraint violation
-- Ensure only a single trigger creates approval records and make inserts idempotent

-- 1) Drop the older trigger/function pair that duplicates inserts
DROP TRIGGER IF EXISTS trigger_create_order_approvals ON public.projects_v3;
DROP FUNCTION IF EXISTS public.create_order_approvals();

-- 2) Ensure the main approval creation function is idempotent and secure
CREATE OR REPLACE FUNCTION public.create_approval_records()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create approvals when status becomes 'pending' (on insert or status change)
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR (OLD IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status)) THEN
    -- Insert required approvals; ignore if already exist
    INSERT INTO order_approvals (order_id, approver_role)
    VALUES 
      (NEW.id, 'ceo'),
      (NEW.id, 'scaffold_executive_manager'),
      (NEW.id, 'sales_manager')
    ON CONFLICT (order_id, approver_role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Make sure only one trigger is wired up to use the function
DROP TRIGGER IF EXISTS create_approvals_on_order_submit ON public.projects_v3;
CREATE TRIGGER create_approvals_on_order_submit
  AFTER INSERT OR UPDATE ON public.projects_v3
  FOR EACH ROW
  EXECUTE FUNCTION public.create_approval_records();
