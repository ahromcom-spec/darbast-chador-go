-- Fix manager stage transitions + approval workflow consistency

-- 1) Allow admins & general managers to update orders (needed for stage dropdown changes)
DROP POLICY IF EXISTS "Admins and GMs can update all projects" ON public.projects_v3;
CREATE POLICY "Admins and GMs can update all projects"
ON public.projects_v3
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
);

-- 2) When all approvals are done, move order to pending_execution (NOT in_progress)
CREATE OR REPLACE FUNCTION public.check_and_update_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pending_count integer;
  v_order_status project_status_v3;
  customer_user_id uuid;
  order_code text;
BEGIN
  IF NEW.approved_at IS NOT NULL AND (OLD.approved_at IS NULL OR OLD.approved_at != NEW.approved_at) THEN
    SELECT status, code INTO v_order_status, order_code
    FROM projects_v3
    WHERE id = NEW.order_id;

    IF v_order_status = 'pending' THEN
      SELECT COUNT(*) INTO v_pending_count
      FROM order_approvals
      WHERE order_id = NEW.order_id
        AND approved_at IS NULL;

      IF v_pending_count = 0 THEN
        UPDATE projects_v3
        SET
          status = 'pending_execution'::project_status_v3,
          approved_at = now(),
          updated_at = now()
        WHERE id = NEW.order_id;

        SELECT c.user_id INTO customer_user_id
        FROM customers c
        JOIN projects_v3 p ON p.customer_id = c.id
        WHERE p.id = NEW.order_id;

        IF customer_user_id IS NOT NULL THEN
          PERFORM send_notification(
            customer_user_id,
            'سفارش شما در انتظار اجرا است ✅',
            'سفارش شما با کد ' || order_code || ' توسط تمام مدیران تایید شد و اکنون در انتظار اجرای خدمات می‌باشد.',
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

-- 3) For subcategory code=10 workflow: pending -> pending_execution, and scheduling -> scheduled (not in_progress)
CREATE OR REPLACE FUNCTION public.handle_order_approval_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  customer_user_id UUID;
  order_code TEXT;
  subcategory_code TEXT;
BEGIN
  SELECT code INTO subcategory_code FROM subcategories WHERE id = NEW.subcategory_id;

  -- Only for "داربست با اجناس" (code=10)
  IF subcategory_code != '10' THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO customer_user_id FROM customers WHERE id = NEW.customer_id;
  order_code := NEW.code;

  IF customer_user_id IS NOT NULL THEN
    -- When order moves from pending to pending_execution
    IF OLD.status = 'pending' AND NEW.status = 'pending_execution' THEN
      PERFORM send_notification(
        customer_user_id,
        'سفارش تایید شد ✅',
        'سفارش شما با کد ' || order_code || ' تایید شد و در انتظار اجراست.',
        '/user/my-orders',
        'success'
      );

      PERFORM notify_role(
        'scaffold_executive_manager'::app_role,
        'سفارش جدید برای اجرا',
        'سفارش با کد ' || order_code || ' آماده اجراست.',
        '/executive/orders',
        'info'
      );
    END IF;

    -- When schedule date is set (execution_start_date becomes non-null)
    IF OLD.execution_start_date IS NULL AND NEW.execution_start_date IS NOT NULL THEN
      -- Scheduling should move order to "scheduled"
      NEW.status := 'scheduled'::project_status_v3;

      PERFORM send_notification(
        customer_user_id,
        'زمان اجرا تعیین شد 📅',
        'زمان اجرای سفارش شما از تاریخ ' || TO_CHAR(NEW.execution_start_date, 'YYYY/MM/DD') || ' شروع می‌شود.',
        '/user/my-orders',
        'info'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4) Allow scheduling RPC to work when order is pending_execution too
CREATE OR REPLACE FUNCTION public.set_order_schedule(
  _order_id uuid,
  _execution_start_date timestamp with time zone,
  _execution_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'scaffold_executive_manager'::app_role) THEN
    RAISE EXCEPTION 'فقط مدیر اجرایی می‌تواند زمان‌بندی کند';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM projects_v3
    WHERE id = _order_id AND status IN ('approved'::project_status_v3, 'pending_execution'::project_status_v3)
  ) THEN
    RAISE EXCEPTION 'فقط سفارشات تایید شده قابل زمان‌بندی هستند';
  END IF;

  UPDATE projects_v3
  SET
    execution_start_date = _execution_start_date,
    execution_end_date = _execution_end_date,
    executed_by = auth.uid(),
    status = 'scheduled'::project_status_v3,
    updated_at = now()
  WHERE id = _order_id;

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
        'سفارش ' || order_code || ' برای تاریخ ' || TO_CHAR(_execution_start_date, 'YYYY/MM/DD HH24:MI') || ' زمان‌بندی شد.',
        '/user/my-orders',
        'success'
      );
    END IF;
  END;
END;
$$;