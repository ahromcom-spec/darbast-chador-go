
-- ایجاد RPC برای رد کردن سفارش توسط مدیر فروش
CREATE OR REPLACE FUNCTION public.reject_order_as_sales_manager(_order_id uuid, _rejection_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_order_code TEXT;
  v_customer_id UUID;
  v_customer_user_id UUID;
BEGIN
  -- بررسی دسترسی
  IF NOT has_role(auth.uid(), 'sales_manager'::app_role) THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز: فقط مدیر فروش';
  END IF;

  -- دریافت اطلاعات سفارش
  SELECT code, customer_id INTO v_order_code, v_customer_id
  FROM projects_v3
  WHERE id = _order_id AND status = 'pending';

  IF v_order_code IS NULL THEN
    RAISE EXCEPTION 'سفارش یافت نشد یا قبلاً پردازش شده است';
  END IF;

  -- به‌روزرسانی وضعیت سفارش به rejected
  UPDATE projects_v3
  SET 
    status = 'rejected',
    rejection_reason = _rejection_reason,
    updated_at = now()
  WHERE id = _order_id;

  -- ثبت رد کردن در order_approvals
  UPDATE order_approvals
  SET 
    approver_user_id = auth.uid(),
    approved_at = now()
  WHERE order_id = _order_id
    AND approver_role = 'sales_manager'
    AND approved_at IS NULL;

  -- اطلاع رسانی به مشتری
  SELECT c.user_id INTO v_customer_user_id
  FROM customers c
  WHERE c.id = v_customer_id;

  IF v_customer_user_id IS NOT NULL THEN
    PERFORM send_notification(
      v_customer_user_id,
      'سفارش ' || v_order_code || ' رد شد',
      'متأسفانه سفارش شما توسط مدیر فروش رد شد. دلیل: ' || _rejection_reason,
      '/user/my-orders',
      'error'
    );
  END IF;

  -- ثبت در audit log
  PERFORM log_audit(
    auth.uid(),
    'reject_order',
    'projects_v3',
    _order_id,
    jsonb_build_object('role', 'sales_manager', 'reason', _rejection_reason)
  );
END;
$function$;
