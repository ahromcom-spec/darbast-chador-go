
-- Add scheduled status to enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'project_status_v3' AND e.enumlabel = 'scheduled'
  ) THEN
    ALTER TYPE project_status_v3 ADD VALUE 'scheduled';
  END IF;
END $$;

-- Function to set schedule for approved orders
CREATE OR REPLACE FUNCTION public.set_order_schedule(
  _order_id UUID,
  _execution_start_date TIMESTAMP WITH TIME ZONE,
  _execution_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only executive manager can schedule
  IF NOT has_role(auth.uid(), 'scaffold_executive_manager'::app_role) THEN
    RAISE EXCEPTION 'فقط مدیر اجرایی می‌تواند زمان‌بندی کند';
  END IF;

  -- Order must be approved
  IF NOT EXISTS (
    SELECT 1 FROM projects_v3 
    WHERE id = _order_id AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'فقط سفارشات تایید شده قابل زمان‌بندی هستند';
  END IF;

  -- Update order with schedule
  UPDATE projects_v3
  SET 
    execution_start_date = _execution_start_date,
    execution_end_date = _execution_end_date,
    executed_by = auth.uid(),
    status = 'scheduled'::project_status_v3,
    updated_at = now()
  WHERE id = _order_id;

  -- Log audit
  PERFORM log_audit(
    auth.uid(),
    'schedule_order',
    'projects_v3',
    _order_id,
    jsonb_build_object(
      'execution_start_date', _execution_start_date,
      'execution_end_date', _execution_end_date
    )
  );

  -- Notify customer
  DECLARE
    customer_user_id UUID;
    order_code TEXT;
  BEGIN
    SELECT c.user_id, p.code INTO customer_user_id, order_code
    FROM projects_v3 p
    JOIN customers c ON c.id = p.customer_id
    WHERE p.id = _order_id;

    IF customer_user_id IS NOT NULL THEN
      PERFORM send_notification(
        customer_user_id,
        'سفارش شما زمان‌بندی شد',
        'سفارش ' || order_code || ' برای تاریخ ' || 
        TO_CHAR(_execution_start_date, 'YYYY/MM/DD HH24:MI') || ' زمان‌بندی شد.',
        '/user/my-orders',
        'success'
      );
    END IF;
  END;
END;
$function$;

COMMENT ON FUNCTION public.set_order_schedule IS 'Set execution schedule for approved orders - Executive Manager only';
