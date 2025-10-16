-- سیستم تایید سفارشات - Triggers و Policies

-- تغییر default status به pending
ALTER TABLE projects_v3 
  ALTER COLUMN status SET DEFAULT 'pending'::project_status_v3;

-- تابع برای ارسال اعلان سفارش جدید به CEO
CREATE OR REPLACE FUNCTION notify_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  ceo_user_id UUID;
  customer_name TEXT;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT ur.user_id INTO ceo_user_id
    FROM user_roles ur
    WHERE ur.role = 'ceo'
    LIMIT 1;
    
    SELECT p.full_name INTO customer_name
    FROM profiles p
    JOIN customers c ON c.user_id = p.user_id
    WHERE c.id = NEW.customer_id;
    
    IF ceo_user_id IS NOT NULL THEN
      PERFORM send_notification(
        ceo_user_id,
        'سفارش جدید در انتظار تایید',
        COALESCE(customer_name, 'مشتری') || ' یک سفارش جدید ثبت کرده است. کد سفارش: ' || NEW.code,
        '/ceo/orders',
        'info'
      );
    END IF;
    
    PERFORM log_audit(
      NEW.customer_id,
      'create_order',
      'projects_v3',
      NEW.id,
      jsonb_build_object('code', NEW.code, 'status', NEW.status)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- تابع برای مدیریت تایید/رد سفارش
CREATE OR REPLACE FUNCTION handle_order_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  customer_user_id UUID;
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    SELECT user_id INTO customer_user_id
    FROM customers
    WHERE id = NEW.customer_id;
    
    IF NEW.status = 'approved' THEN
      PERFORM send_notification(
        customer_user_id,
        'سفارش تایید شد ✅',
        'سفارش شما با کد ' || NEW.code || ' توسط مدیر تایید شد و به زودی اقدامات لازم انجام خواهد شد.',
        '/projects',
        'success'
      );
      
      PERFORM log_audit(
        NEW.approved_by,
        'approve_order',
        'projects_v3',
        NEW.id,
        jsonb_build_object('code', NEW.code, 'customer_id', NEW.customer_id)
      );
    ELSE
      PERFORM send_notification(
        customer_user_id,
        'سفارش رد شد ❌',
        'سفارش شما با کد ' || NEW.code || ' رد شد. دلیل: ' || COALESCE(NEW.rejection_reason, 'ذکر نشده'),
        '/projects',
        'error'
      );
      
      PERFORM log_audit(
        NEW.approved_by,
        'reject_order',
        'projects_v3',
        NEW.id,
        jsonb_build_object('code', NEW.code, 'customer_id', NEW.customer_id, 'reason', NEW.rejection_reason)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ایجاد triggers
DROP TRIGGER IF EXISTS on_new_order ON projects_v3;
CREATE TRIGGER on_new_order
  AFTER INSERT ON projects_v3
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_order();

DROP TRIGGER IF EXISTS on_order_approval ON projects_v3;
CREATE TRIGGER on_order_approval
  AFTER UPDATE ON projects_v3
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_approval();

-- بروزرسانی RLS policies برای CEO
CREATE POLICY "CEO can view all orders"
ON projects_v3
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "CEO can approve/reject orders"
ON projects_v3
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'ceo'::app_role) AND
  status = 'pending'::project_status_v3
)
WITH CHECK (
  has_role(auth.uid(), 'ceo'::app_role) AND
  status IN ('approved'::project_status_v3, 'rejected'::project_status_v3)
);