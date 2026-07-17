-- ============================================
-- 10-FUNCTIONS.SQL - All Database Functions
-- Generated from live database
-- ============================================

CREATE OR REPLACE FUNCTION public.acquire_module_lock(p_module_key text, p_module_date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_current_lock RECORD;
    v_user_id UUID := auth.uid();
    v_user_name TEXT;
    v_result JSONB;
BEGIN
    -- Get current user name
    SELECT full_name INTO v_user_name 
    FROM public.profiles 
    WHERE id = v_user_id;

    -- Check for existing lock
    SELECT * INTO v_current_lock
    FROM public.module_edit_locks
    WHERE module_key = p_module_key AND module_date = p_module_date
    FOR UPDATE;

    IF NOT FOUND THEN
        -- No lock exists, create new one
        INSERT INTO public.module_edit_locks (module_key, module_date, locked_by, locked_at, last_activity_at, expires_at)
        VALUES (p_module_key, p_module_date, v_user_id, now(), now(), now() + interval '30 minutes');
        
        v_result := jsonb_build_object(
            'success', true,
            'action', 'acquired',
            'locked_by', v_user_id,
            'locked_by_name', v_user_name
        );
    ELSIF v_current_lock.locked_by = v_user_id THEN
        -- Already have the lock, refresh it
        UPDATE public.module_edit_locks
        SET last_activity_at = now(), 
            expires_at = now() + interval '30 minutes',
            updated_at = now()
        WHERE id = v_current_lock.id;
        
        v_result := jsonb_build_object(
            'success', true,
            'action', 'refreshed',
            'locked_by', v_user_id,
            'locked_by_name', v_user_name
        );
    ELSIF v_current_lock.expires_at < now() THEN
        -- Lock is expired, take over
        UPDATE public.module_edit_locks
        SET locked_by = v_user_id,
            locked_at = now(),
            last_activity_at = now(),
            expires_at = now() + interval '30 minutes',
            updated_at = now()
        WHERE id = v_current_lock.id;
        
        v_result := jsonb_build_object(
            'success', true,
            'action', 'took_over_expired',
            'locked_by', v_user_id,
            'locked_by_name', v_user_name,
            'previous_owner', v_current_lock.locked_by
        );
    ELSE
        -- Someone else has active lock, take over (with auto-save trigger)
        v_result := jsonb_build_object(
            'success', true,
            'action', 'force_takeover',
            'previous_owner', v_current_lock.locked_by,
            'locked_by', v_user_id,
            'locked_by_name', v_user_name
        );
        
        -- Take over the lock
        UPDATE public.module_edit_locks
        SET locked_by = v_user_id,
            locked_at = now(),
            last_activity_at = now(),
            expires_at = now() + interval '30 minutes',
            updated_at = now()
        WHERE id = v_current_lock.id;
    END IF;

    RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.add_wallet_transaction(_user_id uuid, _transaction_type text, _amount numeric, _title text, _description text DEFAULT NULL::text, _reference_type text DEFAULT NULL::text, _reference_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _transaction_id UUID;
  _current_balance NUMERIC;
BEGIN
  -- Calculate current balance
  SELECT COALESCE(SUM(amount), 0) INTO _current_balance
  FROM public.wallet_transactions
  WHERE user_id = _user_id;

  -- Insert transaction
  INSERT INTO public.wallet_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    title,
    description,
    reference_type,
    reference_id
  ) VALUES (
    _user_id,
    _transaction_type,
    _amount,
    _current_balance + _amount,
    _title,
    _description,
    _reference_type,
    _reference_id
  ) RETURNING id INTO _transaction_id;

  RETURN _transaction_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.approve_order_as_sales_manager(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
BEGIN
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_role(_user_id, 'sales_manager'::app_role) THEN
    RAISE EXCEPTION 'Only sales managers can approve orders';
  END IF;

  -- تغییر status به pending_execution به جای approved
  UPDATE public.projects_v3
  SET status = 'pending_execution'::project_status_v3,
      approved_by = _user_id,
      approved_at = now()
  WHERE id = _order_id;

  PERFORM public.log_audit(
    'approve_order',
    'projects_v3',
    _order_id::text,
    jsonb_build_object('approved_by', _user_id)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.archive_daily_report(p_report_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Update the report to archived
  UPDATE public.daily_reports
  SET 
    is_archived = true,
    archived_at = now(),
    archived_by = v_user_id
  WHERE id = p_report_id;
  
  -- Delete wallet transactions for all staff in this report
  DELETE FROM public.wallet_transactions wt
  WHERE wt.reference_type = 'daily_report_staff'
    AND wt.reference_id IN (
      SELECT drs.id 
      FROM public.daily_report_staff drs 
      WHERE drs.daily_report_id = p_report_id
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.assign_customer_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.customer_code IS NULL THEN
    NEW.customer_code := public.generate_customer_code();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.assign_role_to_user(_user_id uuid, _role app_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- بررسی اینکه فقط admin یا general_manager می‌توانند این تابع را فراخوانی کنند
  IF NOT (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'general_manager'::app_role)
  ) THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز: فقط مدیران می‌توانند نقش اختصاص دهند';
  END IF;

  -- افزودن نقش (با ignore duplicate)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- ثبت در audit log
  PERFORM public.log_audit(
    auth.uid(),
    'assign_role',
    'user_roles',
    _user_id,
    jsonb_build_object('role', _role)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.assign_role_to_user(_user_id uuid, _role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _actor_id uuid;
BEGIN
  _actor_id := auth.uid();
  
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if actor has permission
  IF NOT (
    public.has_role(_actor_id, 'admin'::app_role) OR
    public.has_role(_actor_id, 'general_manager'::app_role) OR
    public.has_role(_actor_id, 'ceo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to assign roles';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  PERFORM public.log_audit(
    'assign_role',
    'user_roles',
    _user_id::text,
    jsonb_build_object('role', _role, 'assigned_by', _actor_id)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.assign_service_request_to_project()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_project_id UUID;
  new_project_name TEXT;
BEGIN
  -- Check if a project exists for this user, service type, and location
  SELECT id INTO existing_project_id
  FROM public.projects
  WHERE user_id = NEW.user_id
    AND service_type = NEW.service_type
    AND location_address = COALESCE(NEW.location_address, '')
  LIMIT 1;

  -- If project exists, assign to it
  IF existing_project_id IS NOT NULL THEN
    NEW.project_id := existing_project_id;
  ELSE
    -- Create new project
    new_project_name := CASE 
      WHEN NEW.service_type = 'scaffolding' THEN 'پروژه داربست - '
      WHEN NEW.service_type = 'tarpaulin' THEN 'پروژه چادر برزنتی - '
      ELSE 'پروژه - '
    END || COALESCE(NEW.location_address, 'بدون آدرس');

    INSERT INTO public.projects (
      user_id,
      service_type,
      location_address,
      project_name
    ) VALUES (
      NEW.user_id,
      NEW.service_type,
      COALESCE(NEW.location_address, ''),
      new_project_name
    )
    RETURNING id INTO existing_project_id;

    NEW.project_id := existing_project_id;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_approve_contractor_if_whitelisted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_whitelisted BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.phone_whitelist 
    WHERE phone_number = NEW.phone_number 
    AND 'contractor' = ANY(allowed_roles)
  ) INTO v_whitelisted;
  
  IF v_whitelisted THEN
    NEW.status := 'approved';
    NEW.verified_at := now();
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'contractor'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_approve_staff_if_whitelisted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_whitelisted BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.phone_whitelist 
    WHERE phone_number = NEW.phone_number 
    AND NEW.requested_role::TEXT = ANY(allowed_roles)
  ) INTO v_whitelisted;
  
  IF v_whitelisted THEN
    NEW.status := 'approved';
    NEW.verified_at := now();
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, NEW.requested_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_assign_pending_transfers()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  transfer_record RECORD;
BEGIN
  -- بررسی آیا این شماره موبایل درخواست انتقال در انتظار دارد
  FOR transfer_record IN 
    SELECT * FROM public.order_transfer_requests 
    WHERE to_phone_number = NEW.phone_number 
    AND status = 'pending_registration'
  LOOP
    -- بروزرسانی درخواست انتقال با user_id کاربر جدید
    UPDATE public.order_transfer_requests
    SET 
      to_user_id = NEW.user_id,
      status = 'pending_recipient',
      updated_at = now()
    WHERE id = transfer_record.id;
    
    -- ارسال نوتیفیکیشن به کاربر مقصد
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (
      NEW.user_id,
      'درخواست انتقال سفارش',
      'یک سفارش از طرف کاربر دیگری برای شما ثبت شده است. لطفاً آن را بررسی و تایید کنید.',
      'transfer_request',
      '/user/orders'
    );
    
    -- ارسال نوتیفیکیشن به کاربر مبدا که کاربر مقصد ثبت‌نام کرده
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (
      transfer_record.from_user_id,
      'کاربر مقصد ثبت‌نام کرد',
      'کاربر مقصد سفارشی که برای او ثبت کرده بودید اکنون ثبت‌نام کرده است. سفارش در انتظار تایید ایشان است.',
      'transfer_update',
      '/user/orders/' || transfer_record.order_id
    );
  END LOOP;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_complete_order_transfer(p_order_id uuid, p_recipient_user_id uuid, p_recipient_phone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_subcategory RECORD;
  v_customer_id uuid;
  v_location_id uuid;
  v_hierarchy_id uuid;
  v_from_user_id uuid;
  v_from_phone text;
BEGIN
  v_from_user_id := auth.uid();
  IF v_from_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get order details
  SELECT * INTO v_order FROM projects_v3 WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Get subcategory info
  SELECT id, name, service_type_id INTO v_subcategory 
  FROM subcategories WHERE id = v_order.subcategory_id;

  -- Get or create customer for recipient
  SELECT id INTO v_customer_id FROM customers WHERE user_id = p_recipient_user_id;
  IF v_customer_id IS NULL THEN
    INSERT INTO customers (user_id) VALUES (p_recipient_user_id) RETURNING id INTO v_customer_id;
  END IF;

  -- Create location for recipient
  INSERT INTO locations (
    user_id, address_line, title, lat, lng, province_id, district_id
  ) VALUES (
    p_recipient_user_id,
    COALESCE(v_order.address, 'آدرس انتقالی'),
    COALESCE(v_order.detailed_address, 'آدرس انتقالی'),
    COALESCE(v_order.location_lat, 34.6401),
    COALESCE(v_order.location_lng, 50.8764),
    v_order.province_id,
    v_order.district_id
  ) RETURNING id INTO v_location_id;

  -- Create hierarchy project for recipient
  INSERT INTO projects_hierarchy (
    user_id, location_id, service_type_id, subcategory_id, title, status
  ) VALUES (
    p_recipient_user_id,
    v_location_id,
    v_subcategory.service_type_id,
    v_order.subcategory_id,
    'پروژه انتقالی - ' || v_order.code,
    'active'
  ) RETURNING id INTO v_hierarchy_id;

  -- Get sender phone
  SELECT phone_number INTO v_from_phone FROM profiles WHERE user_id = v_from_user_id LIMIT 1;

  -- Transfer order ownership
  UPDATE projects_v3
  SET 
    customer_id = v_customer_id,
    hierarchy_project_id = v_hierarchy_id,
    transferred_from_user_id = v_from_user_id,
    transferred_from_phone = v_from_phone
  WHERE id = p_order_id;

  -- Update transfer request to completed (fixed column name)
  UPDATE order_transfer_requests
  SET status = 'completed', recipient_responded_at = NOW()
  WHERE order_id = p_order_id 
    AND from_user_id = v_from_user_id
    AND status IN ('pending_recipient', 'pending_registration');

  RETURN jsonb_build_object(
    'success', true,
    'customer_id', v_customer_id,
    'location_id', v_location_id,
    'hierarchy_id', v_hierarchy_id
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_reputation_score(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_overall NUMERIC;
  v_total INTEGER;
  v_customer NUMERIC;
  v_contractor NUMERIC;
  v_staff NUMERIC;
  v_verified INTEGER;
  v_trust TEXT;
BEGIN
  -- محاسبه میانگین کلی
  SELECT 
    COALESCE(AVG(overall_score), 0),
    COUNT(*)
  INTO v_overall, v_total
  FROM ratings
  WHERE rated_id = _user_id AND is_verified = true;

  -- امتیاز به عنوان مشتری
  SELECT AVG(overall_score) INTO v_customer
  FROM ratings
  WHERE rated_id = _user_id 
    AND rating_type IN ('contractor_to_customer', 'staff_to_customer')
    AND is_verified = true;

  -- امتیاز به عنوان پیمانکار
  SELECT AVG(overall_score) INTO v_contractor
  FROM ratings
  WHERE rated_id = _user_id 
    AND rating_type IN ('customer_to_contractor', 'staff_to_contractor')
    AND is_verified = true;

  -- امتیاز به عنوان پرسنل
  SELECT AVG(overall_score) INTO v_staff
  FROM ratings
  WHERE rated_id = _user_id 
    AND rating_type IN ('customer_to_staff', 'contractor_to_staff')
    AND is_verified = true;

  -- تعداد پروژه‌های تایید شده
  SELECT COUNT(DISTINCT project_id) INTO v_verified
  FROM ratings
  WHERE rated_id = _user_id AND is_verified = true;

  -- تعیین سطح اعتماد
  v_trust := CASE
    WHEN v_total >= 50 AND v_overall >= 4.5 THEN 'platinum'
    WHEN v_total >= 25 AND v_overall >= 4.0 THEN 'gold'
    WHEN v_total >= 10 AND v_overall >= 3.5 THEN 'silver'
    WHEN v_total >= 3 AND v_overall >= 3.0 THEN 'bronze'
    ELSE 'new'
  END;

  -- ثبت یا به‌روزرسانی
  INSERT INTO reputation_scores (
    user_id, overall_score, total_ratings, 
    customer_score, contractor_score, staff_score,
    trust_level, verified_projects, last_calculated_at
  ) VALUES (
    _user_id, v_overall, v_total,
    v_customer, v_contractor, v_staff,
    v_trust, v_verified, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    overall_score = EXCLUDED.overall_score,
    total_ratings = EXCLUDED.total_ratings,
    customer_score = EXCLUDED.customer_score,
    contractor_score = EXCLUDED.contractor_score,
    staff_score = EXCLUDED.staff_score,
    trust_level = EXCLUDED.trust_level,
    verified_projects = EXCLUDED.verified_projects,
    last_calculated_at = now(),
    updated_at = now();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_all_approvals()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pending_count INTEGER;
  customer_user_id UUID;
  order_code TEXT;
BEGIN
  -- شمارش تاییدات باقی‌مانده
  SELECT COUNT(*) INTO pending_count
  FROM public.order_approvals AS oa
  WHERE oa.order_id = NEW.order_id AND oa.approved_at IS NULL;
  
  -- اگر همه تایید کردند
  IF pending_count = 0 THEN
    -- تغییر وضعیت به pending_execution (در انتظار اجرا) و پاک کردن execution_stage
    UPDATE public.projects_v3 AS p
    SET 
      status = 'pending_execution', 
      approved_at = now(),
      execution_stage = NULL,
      execution_stage_updated_at = now(),
      updated_at = now()
    WHERE p.id = NEW.order_id AND p.status = 'pending';
    
    -- ارسال نوتیفیکیشن به مشتری
    SELECT c.user_id INTO customer_user_id
    FROM public.customers AS c
    JOIN public.projects_v3 AS p ON p.customer_id = c.id
    WHERE p.id = NEW.order_id;
    
    SELECT p2.code INTO order_code FROM public.projects_v3 AS p2 WHERE p2.id = NEW.order_id;
    
    IF customer_user_id IS NOT NULL THEN
      PERFORM public.send_notification(
        customer_user_id,
        'سفارش شما در انتظار اجرا است ✅',
        'سفارش شما با کد ' || order_code || ' توسط تمام مدیران تایید شد و اکنون در انتظار اجرای خدمات می‌باشد.',
        '/user/my-orders',
        'success'
      );
    END IF;
    
    -- ارسال نوتیفیکیشن به مدیر اجرایی
    PERFORM public.notify_role(
      'scaffold_executive_manager'::app_role,
      'سفارش جدید برای اجرا',
      'سفارش با کد ' || order_code || ' تایید شد و آماده برنامه‌ریزی اجراست.',
      '/executive/orders',
      'info'
    );
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_and_update_order_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
          execution_stage = NULL,
          execution_stage_updated_at = now(),
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
$function$
;

CREATE OR REPLACE FUNCTION public.check_directory_rate_limit(_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  query_count INTEGER;
  v_phone TEXT;
  v_is_whitelisted BOOLEAN;
BEGIN
  -- Fetch user's phone
  SELECT phone_number INTO v_phone
  FROM public.profiles
  WHERE user_id = _user_id;

  -- Bypass for whitelisted numbers
  SELECT EXISTS(
    SELECT 1 FROM public.phone_whitelist
    WHERE phone_number = v_phone
  ) INTO v_is_whitelisted;

  IF v_is_whitelisted THEN
    RETURN true;
  END IF;

  -- Count directory queries in last 1 minute
  SELECT COUNT(*)
  INTO query_count
  FROM public.audit_log
  WHERE actor_user_id = _user_id
    AND action = 'view_contractor_directory'
    AND created_at > now() - interval '1 minute';
  
  -- Allow maximum 20 queries per minute (doubled from 10)
  RETURN query_count < 20;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_max_staff_roles()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  active_count INT;
BEGIN
  IF NEW.active = true THEN
    SELECT COUNT(*) INTO active_count
    FROM public.staff_roles
    WHERE user_id = NEW.user_id AND active = true AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);
    
    IF active_count >= 5 THEN
      RAISE EXCEPTION 'هر کاربر حداکثر می‌تواند 5 نقش فعال داشته باشد';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_order_ownership(_order_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    -- Check if user is the customer
    SELECT 1 
    FROM projects_v3 p
    JOIN customers c ON c.id = p.customer_id
    WHERE p.id = _order_id AND c.user_id = _user_id
  )
  OR EXISTS (
    -- Check if user is an accepted collaborator
    SELECT 1
    FROM order_collaborators oc
    WHERE oc.order_id = _order_id 
      AND oc.invitee_user_id = _user_id 
      AND oc.status = 'accepted'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.check_otp_rate_limit(_phone_number text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  recent_count integer;
  v_is_whitelisted boolean;
BEGIN
  -- Bypass for whitelisted phone numbers
  SELECT EXISTS(
    SELECT 1 FROM public.phone_whitelist
    WHERE phone_number = _phone_number
  ) INTO v_is_whitelisted;
  
  IF v_is_whitelisted THEN
    RETURN true;
  END IF;

  -- Count OTP requests from this phone in last 5 minutes
  SELECT COUNT(*)
  INTO recent_count
  FROM public.otp_codes
  WHERE phone_number = _phone_number
    AND created_at > now() - interval '5 minutes';
  
  -- Allow maximum 6 requests per 5 minutes (doubled from 3)
  RETURN recent_count < 6;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_phone_whitelist(_phone text)
 RETURNS TABLE(is_whitelisted boolean, allowed_roles text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    EXISTS(SELECT 1 FROM public.phone_whitelist WHERE phone_number = _phone)::BOOLEAN,
    COALESCE((SELECT allowed_roles FROM public.phone_whitelist WHERE phone_number = _phone LIMIT 1), '{}');
$function$
;

CREATE OR REPLACE FUNCTION public.check_rate_limit(_user_id uuid, _action text, _limit integer, _window interval)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  action_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO action_count
  FROM audit_log
  WHERE actor_user_id = _user_id
    AND action = _action
    AND created_at > now() - _window;
  
  RETURN action_count < _limit;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_service_request_rate_limit(_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  request_count INTEGER;
  v_phone TEXT;
  v_is_whitelisted BOOLEAN;
BEGIN
  -- Fetch user's phone number from profile
  SELECT phone_number INTO v_phone
  FROM public.profiles
  WHERE user_id = _user_id;

  -- Bypass for whitelisted phone numbers
  SELECT EXISTS(
    SELECT 1 FROM public.phone_whitelist
    WHERE phone_number = v_phone
  ) INTO v_is_whitelisted;

  IF v_is_whitelisted THEN
    RETURN true;
  END IF;
  
  -- Count service requests in last 10 minutes
  SELECT COUNT(*)
  INTO request_count
  FROM public.service_requests_v2
  WHERE customer_id = _user_id
    AND created_at > now() - interval '10 minutes';
  
  -- Allow maximum 10 requests per 10 minutes (doubled from 5)
  RETURN request_count < 10;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_staff_whitelist(_phone text)
 RETURNS TABLE(is_whitelisted boolean, allowed_role app_role)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    EXISTS(SELECT 1 FROM public.staff_whitelist WHERE phone = _phone)::BOOLEAN,
    (SELECT staff_whitelist.allowed_role FROM public.staff_whitelist WHERE phone = _phone LIMIT 1);
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_expired_email_codes()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.email_verification_codes 
  WHERE expires_at < now() OR used = true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.otp_codes
  WHERE expires_at < now();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_approval_records()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_subcategory_code TEXT;
BEGIN
  -- فقط برای سفارش‌های pending و subcategory با code = '10'
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR (OLD IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status)) THEN
    
    -- بررسی subcategory
    SELECT s.code INTO v_subcategory_code
    FROM subcategories s
    WHERE s.id = NEW.subcategory_id;
    
    -- فقط برای داربست با اجناس (code 10)
    IF v_subcategory_code = '10' THEN
      -- ایجاد approval برای سه مدیر (با ON CONFLICT برای جلوگیری از خطا)
      INSERT INTO order_approvals (order_id, approver_role, created_at)
      VALUES 
        (NEW.id, 'ceo', now()),
        (NEW.id, 'sales_manager', now()),
        (NEW.id, 'scaffold_executive_manager', now())
      ON CONFLICT (order_id, approver_role) DO NOTHING;
      
      RAISE NOTICE 'Created approvals for order %', NEW.code;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_default_project_stages()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- ایجاد مراحل پیش‌فرض برای پروژه‌های داربست
  IF NEW.service_type = 'scaffolding' THEN
    INSERT INTO public.project_progress_stages (project_id, stage_key, stage_title, order_index)
    VALUES
      (NEW.id, 'survey', 'بازدید اولیه', 1),
      (NEW.id, 'design', 'طراحی و برنامه‌ریزی', 2),
      (NEW.id, 'materials', 'تأمین مصالح', 3),
      (NEW.id, 'erection', 'نصب داربست', 4),
      (NEW.id, 'inspection', 'بازرسی ایمنی', 5),
      (NEW.id, 'handover', 'تحویل پروژه', 6);
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_order_approvals()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- اگر سفارش جدید با وضعیت pending ایجاد شد
  IF NEW.status = 'pending' THEN
    -- ایجاد رکوردهای approval برای نقش‌های مورد نیاز
    INSERT INTO public.order_approvals (order_id, approver_role, subcategory_id)
    VALUES 
      (NEW.id, 'ceo', NEW.subcategory_id),
      (NEW.id, 'sales_manager', NEW.subcategory_id),
      (NEW.id, 'scaffold_executive_manager', NEW.subcategory_id),
      (NEW.id, 'executive_manager_scaffold_execution_with_materials', NEW.subcategory_id)
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_project_v3(_customer_id uuid, _province_id uuid, _district_id uuid, _subcategory_id uuid, _hierarchy_project_id uuid, _address text, _detailed_address text DEFAULT NULL::text, _notes jsonb DEFAULT NULL::jsonb)
 RETURNS SETOF projects_v3
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _code TEXT;
  _customer_user_id UUID;
  _customer_name TEXT;
  _customer_phone TEXT;
  _location_lat DOUBLE PRECISION;
  _location_lng DOUBLE PRECISION;
  _location_id UUID;
BEGIN
  -- Validate hierarchy project exists
  IF _hierarchy_project_id IS NULL THEN
    RAISE EXCEPTION 'hierarchy_project_id is required for creating an order';
  END IF;

  -- Get customer's user_id
  SELECT user_id INTO _customer_user_id 
  FROM customers 
  WHERE id = _customer_id;

  -- Get customer profile data
  IF _customer_user_id IS NOT NULL THEN
    SELECT full_name, phone_number 
    INTO _customer_name, _customer_phone
    FROM profiles 
    WHERE user_id = _customer_user_id;
  END IF;

  -- Get location coordinates from hierarchy project and ensure location is active
  SELECT l.id, l.lat, l.lng
  INTO _location_id, _location_lat, _location_lng
  FROM projects_hierarchy ph
  JOIN locations l ON l.id = ph.location_id
  WHERE ph.id = _hierarchy_project_id;

  -- Ensure the location is active so it appears on the globe
  IF _location_id IS NOT NULL THEN
    UPDATE locations SET is_active = true WHERE id = _location_id AND is_active = false;
  END IF;

  -- Generate unique 7-digit sequential code starting from 1000100
  _code := LPAD(nextval('project_code_seq')::text, 7, '0');

  -- Insert and return
  RETURN QUERY
  INSERT INTO projects_v3 (
    customer_id,
    province_id,
    district_id,
    subcategory_id,
    hierarchy_project_id,
    address,
    detailed_address,
    notes,
    code,
    status,
    customer_name,
    customer_phone,
    location_lat,
    location_lng
  )
  VALUES (
    _customer_id,
    _province_id,
    _district_id,
    _subcategory_id,
    _hierarchy_project_id,
    _address,
    _detailed_address,
    _notes,
    _code,
    'pending',
    _customer_name,
    _customer_phone,
    _location_lat,
    _location_lng
  )
  RETURNING *;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.daily_report_contains_staff(p_report_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.daily_report_staff drs
    WHERE drs.daily_report_id = p_report_id
      AND drs.staff_user_id = p_user_id
  );
$function$
;

CREATE OR REPLACE FUNCTION public.delete_daily_report_staff_wallet_transactions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.wallet_transactions
  WHERE reference_type = 'daily_report_staff'
    AND reference_id = OLD.id;

  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_customer_exists()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.customers (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_customer_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- تولید عدد 8 رقمی که رقم اول غیر صفر است
    new_code := LPAD((10000000 + floor(random() * 90000000)::INT)::TEXT, 8, '0');
    
    -- بررسی عدم تکراری بودن
    SELECT EXISTS(SELECT 1 FROM public.customers WHERE customer_code = new_code) INTO code_exists;
    
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_project_code(_customer_id uuid, _province_id uuid, _subcategory_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_code text;
BEGIN
  -- Generate 7-digit sequential code starting from 1000100
  new_code := LPAD(nextval('project_code_seq')::text, 7, '0');
  RETURN new_code;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_service_code(_project_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  project_code_str TEXT;
  last_service_num INTEGER;
  new_service_num INTEGER;
  new_service_code TEXT;
BEGIN
  -- دریافت کد پروژه
  SELECT code INTO project_code_str
  FROM public.projects_v3
  WHERE id = _project_id;
  
  IF project_code_str IS NULL THEN
    RAISE EXCEPTION 'پروژه با شناسه % یافت نشد', _project_id;
  END IF;
  
  -- پیدا کردن آخرین شماره خدمات در این پروژه
  SELECT COALESCE(MAX(service_number), 0) INTO last_service_num
  FROM public.services_v3
  WHERE project_id = _project_id;
  
  new_service_num := last_service_num + 1;
  
  -- بررسی محدودیت 999
  IF new_service_num > 999 THEN
    RAISE EXCEPTION 'تعداد خدمات پروژه به حداکثر مجاز (999) رسیده است';
  END IF;
  
  -- ساخت کد خدمات: کد پروژه/شماره خدمات (3 رقمی)
  new_service_code := project_code_str || '/' || LPAD(new_service_num::TEXT, 3, '0');
  
  RETURN new_service_code;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_unique_order_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 6-digit number (100000 to 999999)
    new_code := LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0');
    
    -- Check if this code already exists
    SELECT EXISTS(
      SELECT 1 FROM projects_v3 WHERE code = new_code
    ) INTO code_exists;
    
    -- If code doesn't exist, use it
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_contractor_contact_info(_contractor_id uuid)
 RETURNS TABLE(email text, phone_number text, contact_person text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
BEGIN
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (
    public.has_role(_user_id, 'admin'::app_role) OR
    public.has_role(_user_id, 'general_manager'::app_role) OR
    EXISTS (
      SELECT 1 FROM public.contractors c
      WHERE c.id = _contractor_id AND c.user_id = _user_id
    )
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  PERFORM public.log_audit(
    'view_contractor_contact',
    'contractors',
    _contractor_id::text,
    jsonb_build_object('viewer_user_id', _user_id)
  );

  RETURN QUERY
  SELECT c.email, c.phone_number, c.contact_person
  FROM public.contractors c
  WHERE c.id = _contractor_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_incoming_transfer_request_media(p_request_id uuid)
 RETURNS TABLE(id uuid, file_path text, file_type text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_phone text;
  v_order_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT p.phone_number INTO v_phone
  FROM public.profiles p WHERE p.user_id = v_user_id LIMIT 1;

  SELECT r.order_id INTO v_order_id
  FROM public.order_transfer_requests r
  WHERE r.id = p_request_id
    AND r.status IN ('pending_recipient', 'pending_registration')
    AND (
      r.to_user_id = v_user_id
      OR (v_phone IS NOT NULL AND r.to_phone_number = v_phone)
    )
  LIMIT 1;

  IF v_order_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT m.id, m.file_path, m.file_type, m.created_at
  FROM public.project_media m
  WHERE m.project_id = v_order_id
  ORDER BY m.created_at ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_incoming_transfer_requests()
 RETURNS TABLE(id uuid, order_id uuid, from_user_id uuid, to_user_id uuid, to_phone_number text, status text, created_at timestamp with time zone, from_full_name text, from_phone_number text, order_code text, order_status text, order_address text, order_detailed_address text, order_notes text, order_subcategory_id uuid, subcategory_name text, service_type_name text, province_id uuid, district_id uuid, location_lat double precision, location_lng double precision, payment_amount numeric, execution_stage text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_phone text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT p.phone_number
    INTO v_phone
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  RETURN QUERY
  SELECT
    r.id,
    r.order_id,
    r.from_user_id,
    r.to_user_id,
    r.to_phone_number,
    r.status,
    r.created_at,
    fp.full_name AS from_full_name,
    fp.phone_number AS from_phone_number,
    o.code AS order_code,
    o.status::text AS order_status,
    o.address AS order_address,
    o.detailed_address AS order_detailed_address,
    o.notes::text AS order_notes,
    o.subcategory_id AS order_subcategory_id,
    sc.name AS subcategory_name,
    st.name AS service_type_name,
    o.province_id,
    o.district_id,
    o.location_lat,
    o.location_lng,
    o.payment_amount,
    o.execution_stage::text AS execution_stage
  FROM public.order_transfer_requests r
  LEFT JOIN public.projects_v3 o ON o.id = r.order_id
  LEFT JOIN public.subcategories sc ON sc.id = o.subcategory_id
  LEFT JOIN public.service_types_v3 st ON st.id = sc.service_type_id
  LEFT JOIN public.profiles fp ON fp.user_id = r.from_user_id
  WHERE r.status IN ('pending_recipient', 'pending_registration')
    AND (
      r.to_user_id = v_user_id
      OR (v_phone IS NOT NULL AND r.to_phone_number = v_phone)
    )
  ORDER BY r.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_module_lock_status(p_module_key text, p_module_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_lock RECORD;
    v_user_id UUID := auth.uid();
BEGIN
    SELECT 
        l.*,
        p.full_name as locked_by_name
    INTO v_lock
    FROM public.module_edit_locks l
    LEFT JOIN public.profiles p ON p.user_id = l.locked_by
    WHERE l.module_key = p_module_key AND l.module_date = p_module_date;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'is_locked', false,
            'can_edit', true,
            'locked_by', null,
            'locked_by_name', null
        );
    END IF;

    RETURN jsonb_build_object(
        'is_locked', true,
        'locked_by', v_lock.locked_by,
        'locked_by_name', v_lock.locked_by_name,
        'locked_at', v_lock.locked_at,
        'expires_at', v_lock.expires_at,
        'is_expired', v_lock.expires_at < now(),
        'is_mine', v_lock.locked_by = v_user_id,
        'can_edit', v_lock.locked_by = v_user_id OR v_lock.expires_at < now()
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_projects_v3()
 RETURNS SETOF projects_v3
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.*
  FROM projects_v3 p
  JOIN customers c ON c.id = p.customer_id
  WHERE c.user_id = auth.uid()
    AND (p.is_archived IS NULL OR p.is_archived = false)
    AND (p.is_deep_archived IS NULL OR p.is_deep_archived = false)
  
  UNION
  
  SELECT p.*
  FROM projects_v3 p
  JOIN order_transfer_requests otr ON otr.order_id = p.id
  WHERE otr.status IN ('pending_recipient', 'pending_registration', 'accepted', 'completed')
    AND (
      otr.to_user_id = auth.uid()
      OR otr.to_phone_number = (SELECT phone_number FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    AND (p.is_archived IS NULL OR p.is_archived = false)
    AND (p.is_deep_archived IS NULL OR p.is_deep_archived = false);
$function$
;

CREATE OR REPLACE FUNCTION public.get_or_create_project(_user_id uuid, _location_id uuid, _service_type_id uuid, _subcategory_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  project_id UUID;
  project_title TEXT;
  service_name TEXT;
  subcategory_name TEXT;
BEGIN
  -- Check if project exists
  SELECT id INTO project_id
  FROM public.projects_hierarchy
  WHERE location_id = _location_id
    AND service_type_id = _service_type_id
    AND subcategory_id = _subcategory_id
    AND user_id = _user_id;
  
  IF project_id IS NOT NULL THEN
    RETURN project_id;
  END IF;
  
  -- Get service and subcategory names for title
  SELECT st.name, sc.name INTO service_name, subcategory_name
  FROM service_types_v3 st
  JOIN subcategories sc ON sc.id = _subcategory_id
  WHERE st.id = _service_type_id;
  
  project_title := service_name || ' - ' || subcategory_name;
  
  -- Create new project
  INSERT INTO public.projects_hierarchy (
    user_id, location_id, service_type_id, subcategory_id, title
  ) VALUES (
    _user_id, _location_id, _service_type_id, _subcategory_id, project_title
  ) RETURNING id INTO project_id;
  
  RETURN project_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_orders_with_customer_info()
 RETURNS TABLE(id uuid, customer_id uuid, contractor_id uuid, province_id uuid, district_id uuid, subcategory_id uuid, status project_status_v3, created_at timestamp with time zone, updated_at timestamp with time zone, approved_by uuid, approved_at timestamp with time zone, address text, detailed_address text, notes text, rejection_reason text, project_number text, service_code text, code text, customer_name text, customer_phone text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    p.id,
    p.customer_id,
    p.contractor_id,
    p.province_id,
    p.district_id,
    p.subcategory_id,
    p.status,
    p.created_at,
    p.updated_at,
    p.approved_by,
    p.approved_at,
    p.address,
    p.detailed_address,
    p.notes,
    p.rejection_reason,
    p.project_number,
    p.service_code,
    p.code,
    prof.full_name as customer_name,
    prof.phone_number as customer_phone
  FROM projects_v3 p
  INNER JOIN customers c ON c.id = p.customer_id
  INNER JOIN profiles prof ON prof.user_id = c.user_id
  WHERE has_role(auth.uid(), 'ceo'::app_role)
$function$
;

CREATE OR REPLACE FUNCTION public.get_public_contractors()
 RETURNS TABLE(id uuid, company_name text, description text, experience_years integer, is_approved boolean, created_at timestamp with time zone, general_location text, services jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    c.id,
    c.company_name,
    c.description,
    c.experience_years,
    c.is_approved,
    c.created_at,
    CASE
      WHEN c.address IS NOT NULL 
      THEN regexp_replace(c.address, '،.*$', '')
      ELSE NULL
    END AS general_location,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'service_type', cs.service_type, 
          'sub_type', cs.sub_type
        )
      ) FILTER (WHERE cs.id IS NOT NULL),
      '[]'::jsonb
    ) AS services
  FROM contractors c
  LEFT JOIN contractor_services cs ON cs.contractor_id = c.id
  WHERE c.is_approved = true AND c.is_active = true
  GROUP BY c.id, c.company_name, c.description, c.experience_years, 
           c.is_approved, c.created_at, c.address;
$function$
;

CREATE OR REPLACE FUNCTION public.get_sales_pending_orders()
 RETURNS TABLE(id uuid, code text, address text, detailed_address text, created_at timestamp with time zone, notes jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only sales_manager (the specialized role doesn't exist in enum)
  IF NOT has_role(auth.uid(), 'sales_manager'::app_role) THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز: فقط مدیر فروش';
  END IF;

  RETURN QUERY
  SELECT p.id, p.code, p.address, p.detailed_address, p.created_at, p.notes
  FROM projects_v3 p
  WHERE p.status = 'pending'
    AND EXISTS (
      SELECT 1 FROM order_approvals oa
      WHERE oa.order_id = p.id
        AND oa.approver_role = 'sales_manager'
        AND oa.approved_at IS NULL
    )
  ORDER BY p.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_id_by_phone(_phone text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT user_id FROM public.profiles WHERE phone_number = _phone LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.get_wallet_balance(_user_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(amount), 0)
  FROM public.wallet_transactions
  WHERE user_id = _user_id;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_contractor_verification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'contractor'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    PERFORM public.send_notification(
      NEW.user_id,
      'درخواست تأیید شد',
      'درخواست پیمانکاری شما تأیید شد.',
      '/profile',
      'success'
    );
  ELSIF OLD.status = 'pending' AND NEW.status = 'rejected' THEN
    PERFORM public.send_notification(
      NEW.user_id,
      'درخواست رد شد',
      'درخواست پیمانکاری شما رد شد. دلیل: ' || COALESCE(NEW.rejection_reason, 'ذکر نشده'),
      '/profile',
      'error'
    );
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_service_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id UUID;
  v_service_id UUID;
  v_address_id UUID;
BEGIN
  -- Use existing address or create placeholder
  v_address_id := NEW.address_id;
  
  -- Find or create project
  SELECT id INTO v_project_id
  FROM projects_v2
  WHERE customer_id = NEW.customer_id
    AND address_id = v_address_id
    AND service_type_id = NEW.service_type_id
    AND status = 'ACTIVE';
  
  IF v_project_id IS NULL THEN
    -- Create new project
    INSERT INTO projects_v2 (customer_id, address_id, service_type_id, title)
    SELECT NEW.customer_id, v_address_id, NEW.service_type_id, 
           st.name || ' • ' || COALESCE(a.line1, 'بدون آدرس')
    FROM service_types st
    LEFT JOIN addresses a ON a.id = v_address_id
    WHERE st.id = NEW.service_type_id
    RETURNING id INTO v_project_id;
  END IF;
  
  -- Create service (work order)
  INSERT INTO services (project_id, status, notes)
  VALUES (v_project_id, 'NEW', NEW.details::TEXT)
  RETURNING id INTO v_service_id;
  
  -- Update service request with merged service
  NEW.merged_into_service_id := v_service_id;
  
  -- Create initial tasks
  INSERT INTO workflow_tasks (service_id, type, status, assignee_role)
  VALUES 
    (v_service_id, 'execution_schedule', 'OPEN', 'operations_manager'),
    (v_service_id, 'contractor_assignment', 'OPEN', 'operations_manager'),
    (v_service_id, 'warehouse_pick', 'OPEN', 'warehouse_manager');
  
  -- Log audit
  PERFORM log_audit(NEW.customer_id, 'service_requested', 'services', v_service_id, 
    jsonb_build_object('project_id', v_project_id));
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone_number)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone_number', '')
  )
  ON CONFLICT (user_id) DO UPDATE
  SET phone_number = COALESCE(NEW.phone, EXCLUDED.phone_number);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_order_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  customer_user_id UUID;
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    SELECT user_id INTO customer_user_id
    FROM customers
    WHERE id = NEW.customer_id;
    
    IF customer_user_id IS NOT NULL THEN
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
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_order_approval_workflow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.handle_payment_received()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status != 'PAID' AND NEW.status = 'PAID' THEN
    -- Update invoice status
    UPDATE invoices
    SET status = 'PAID', updated_at = now()
    WHERE id = NEW.invoice_id;
    
    -- Update service payment status
    UPDATE services s
    SET payment_status = 'SETTLED', updated_at = now()
    FROM invoices i
    WHERE i.id = NEW.invoice_id AND s.id = i.service_id;
    
    -- Log audit
    PERFORM log_audit(auth.uid(), 'payment_received', 'payments', NEW.id,
      jsonb_build_object('invoice_id', NEW.invoice_id, 'amount', NEW.amount));
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_service_closure()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id UUID;
  v_has_active_services BOOLEAN;
BEGIN
  IF OLD.status != 'CLOSED' AND NEW.status = 'CLOSED' THEN
    v_project_id := NEW.project_id;
    
    -- Check if project has other active services
    SELECT EXISTS(
      SELECT 1 FROM services
      WHERE project_id = v_project_id
        AND status NOT IN ('CLOSED', 'CANCELLED')
        AND id != NEW.id
    ) INTO v_has_active_services;
    
    IF NOT v_has_active_services THEN
      -- Archive project
      UPDATE projects_v2
      SET status = 'ARCHIVED', archived_at = now(), updated_at = now()
      WHERE id = v_project_id;
      
      -- Log audit
      PERFORM log_audit(auth.uid(), 'project_archived', 'projects_v2', v_project_id,
        jsonb_build_object('reason', 'all_services_closed'));
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_service_done()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice_number TEXT;
  v_invoice_id UUID;
  v_total NUMERIC;
BEGIN
  IF OLD.status != 'DONE' AND NEW.status = 'DONE' AND NEW.payment_status = 'UNBILLED' THEN
    -- Calculate total
    SELECT COALESCE(SUM(qty * unit_price * (1 + tax_rate/100)), 0)
    INTO v_total
    FROM service_line_items
    WHERE service_id = NEW.id;
    
    -- Generate invoice number
    v_invoice_number := 'INV-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || substring(NEW.id::TEXT, 1, 8);
    
    -- Create invoice
    INSERT INTO invoices (service_id, number, total, status, issued_at, due_at)
    VALUES (NEW.id, v_invoice_number, v_total, 'DRAFT', now(), now() + INTERVAL '30 days')
    RETURNING id INTO v_invoice_id;
    
    -- Update payment status
    NEW.payment_status := 'INVOICED';
    
    -- Create finance task
    INSERT INTO workflow_tasks (service_id, type, status, assignee_role, payload)
    VALUES (NEW.id, 'finance', 'OPEN', 'finance_manager',
      jsonb_build_object('invoice_id', v_invoice_id, 'amount', v_total));
    
    -- Log audit
    PERFORM log_audit(auth.uid(), 'invoice_created', 'invoices', v_invoice_id,
      jsonb_build_object('service_id', NEW.id, 'amount', v_total));
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_service_scheduled()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.install_start_at IS NULL AND NEW.install_start_at IS NOT NULL 
     AND NEW.status = 'NEW' THEN
    NEW.status := 'SCHEDULED';
    
    -- Mark execution_schedule task as done
    UPDATE workflow_tasks
    SET status = 'DONE', updated_at = now()
    WHERE service_id = NEW.id AND type = 'execution_schedule';
    
    -- Log audit
    PERFORM log_audit(auth.uid(), 'service_scheduled', 'services', NEW.id,
      jsonb_build_object('install_start_at', NEW.install_start_at));
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_staff_verification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, NEW.requested_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    PERFORM public.send_notification(
      NEW.user_id,
      'درخواست تأیید شد',
      'درخواست نقش ' || NEW.requested_role || ' شما تأیید شد.',
      '/profile',
      'success'
    );
  ELSIF OLD.status = 'pending' AND NEW.status = 'rejected' THEN
    PERFORM public.send_notification(
      NEW.user_id,
      'درخواست رد شد',
      'درخواست نقش شما رد شد. دلیل: ' || COALESCE(NEW.rejection_reason, 'ذکر نشده'),
      '/profile',
      'error'
    );
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
  );
$function$
;

CREATE OR REPLACE FUNCTION public.increment_photo_sort_orders(photo_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE profile_photos
  SET sort_order = sort_order + 1
  WHERE id = ANY(photo_ids);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_assigned_to_module(_user_id uuid, _module_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.module_assignments
    WHERE assigned_user_id = _user_id
      AND module_key = _module_key
      AND is_active = true
  )
$function$
;

CREATE OR REPLACE FUNCTION public.link_hr_employee_on_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_phone text;
BEGIN
  -- دریافت شماره موبایل از metadata یا پروفایل
  user_phone := NEW.raw_user_meta_data->>'phone_number';
  
  IF user_phone IS NULL THEN
    -- بررسی در جدول profiles
    SELECT phone_number INTO user_phone 
    FROM public.profiles 
    WHERE user_id = NEW.id;
  END IF;
  
  IF user_phone IS NOT NULL THEN
    -- بروزرسانی رکورد HR اگر وجود داشته باشد
    UPDATE public.hr_employees
    SET 
      user_id = NEW.id,
      status = 'active',
      updated_at = now()
    WHERE phone_number = user_phone AND user_id IS NULL;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_audit(_action text, _entity text, _entity_id text DEFAULT NULL::text, _meta jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _audit_id uuid;
BEGIN
  INSERT INTO public.audit_log (action, entity, entity_id, meta, actor_user_id)
  VALUES (_action, _entity, _entity_id, _meta, auth.uid())
  RETURNING id INTO _audit_id;
  
  RETURN _audit_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_audit(_actor_user_id uuid, _action text, _entity text, _entity_id uuid, _meta jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.audit_log (actor_user_id, action, entity, entity_id, meta)
  VALUES (_actor_user_id, _action, _entity, _entity_id, _meta)
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_contractor_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.is_approved = false AND NEW.is_approved = true THEN
    PERFORM public.log_audit(
      auth.uid(),
      'approve_contractor',
      'contractors',
      NEW.id,
      jsonb_build_object('company_name', NEW.company_name)
    );
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.next_project_code()
 RETURNS text
 LANGUAGE sql
AS $function$
  SELECT lpad(nextval('public.project_code_seq')::text, 7, '0');
$function$
;

CREATE OR REPLACE FUNCTION public.notify_managers_on_new_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_manager_id uuid;
  v_province_name text;
  v_district_name text;
  v_address text;
  v_detailed_address text;
  v_code text;
  v_subcategory_name text;
BEGIN
  -- فقط برای سفارش‌های جدید با وضعیت pending
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- دریافت اطلاعات آدرس و لوکیشن
  SELECT 
    COALESCE(p.name, ''),
    COALESCE(d.name, ''),
    COALESCE(NEW.address, ''),
    COALESCE(NEW.detailed_address, ''),
    NEW.code,
    COALESCE(s.name, '')
  INTO 
    v_province_name,
    v_district_name,
    v_address,
    v_detailed_address,
    v_code,
    v_subcategory_name
  FROM provinces p
  LEFT JOIN districts d ON d.id = NEW.district_id
  LEFT JOIN subcategories s ON s.id = NEW.subcategory_id
  WHERE p.id = NEW.province_id;

  -- ارسال نوتیفیکیشن به مدیران (general_manager, sales_manager, scaffold_executive_manager)
  FOR v_manager_id IN 
    SELECT DISTINCT user_id 
    FROM user_roles 
    WHERE role IN ('general_manager', 'sales_manager', 'scaffold_executive_manager')
  LOOP
    INSERT INTO notifications (
      user_id,
      title,
      body,
      link,
      type
    ) VALUES (
      v_manager_id,
      'سفارش جدید ثبت شد - کد: ' || v_code,
      'سفارش جدید ' || v_subcategory_name || ' در ' || v_province_name || 
      CASE WHEN v_district_name != '' THEN '، ' || v_district_name ELSE '' END ||
      CASE WHEN v_address != '' THEN ' - آدرس: ' || v_address ELSE '' END,
      '/orders/' || NEW.id::text,
      'info'
    );
  END LOOP;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_new_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  assigner_name TEXT;
  project_name TEXT;
BEGIN
  -- دریافت نام ارجاع‌دهنده
  SELECT p.full_name INTO assigner_name
  FROM public.profiles p
  WHERE p.user_id = NEW.assigned_by_user_id;
  
  -- دریافت نام پروژه
  SELECT pr.project_name INTO project_name
  FROM public.projects pr
  WHERE pr.id = NEW.project_id;
  
  -- ارسال اعلان به فرد منتسب‌شده
  PERFORM public.send_notification(
    NEW.assignee_user_id,
    'وظیفه جدید',
    assigner_name || ' یک وظیفه به شما در پروژه "' || project_name || '" ارجاع داد: ' || NEW.title,
    '/projects/' || NEW.project_id::TEXT,
    'info'
  );
  
  -- ثبت در audit log
  PERFORM public.log_audit(
    NEW.assigned_by_user_id,
    'create_assignment',
    'assignments',
    NEW.id,
    jsonb_build_object(
      'assignee_user_id', NEW.assignee_user_id,
      'project_id', NEW.project_id,
      'title', NEW.title
    )
  );
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_new_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  customer_name TEXT;
  customer_user_id UUID;
  subcategory_code TEXT;
  subcategory_name TEXT;
BEGIN
  -- Fetch subcategory code and name
  SELECT s.code, s.name INTO subcategory_code, subcategory_name
  FROM public.subcategories AS s
  WHERE s.id = NEW.subcategory_id;

  -- Only for scaffolding with materials (code '10') when order is pending
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status != 'pending') AND subcategory_code = '10' THEN
    -- Get customer user id and name
    SELECT c.user_id INTO customer_user_id
    FROM public.customers AS c
    WHERE c.id = NEW.customer_id;

    SELECT p.full_name INTO customer_name
    FROM public.profiles AS p
    JOIN public.customers AS c ON c.user_id = p.user_id
    WHERE c.id = NEW.customer_id;

    -- NOTE: Customer notification is handled by trigger_order_automation to avoid duplicates
    -- We only notify managers here

    -- Notify CEO
    PERFORM public.notify_role(
      'ceo'::app_role,
      'سفارش جدید ' || NEW.code,
      'سفارش جدید از ' || COALESCE(customer_name, 'مشتری') || ' ثبت شد و منتظر تأیید است.',
      '/ceo/orders',
      'info'
    );

    -- Notify executive manager
    PERFORM public.notify_role(
      'scaffold_executive_manager'::app_role,
      'سفارش جدید در انتظار تایید',
      COALESCE(customer_name, 'مشتری') || ' یک سفارش داربست با اجناس ثبت کرده است. کد سفارش: ' || NEW.code,
      '/executive/pending-orders',
      'info'
    );

    -- Notify sales manager
    PERFORM public.notify_role(
      'sales_manager'::app_role,
      'سفارش جدید در انتظار تایید فروش',
      'سفارش با کد ' || NEW.code || ' برای تایید فروش منتظر شماست.',
      '/sales/pending-orders',
      'info'
    );

    -- Audit (only on INSERT)
    IF customer_user_id IS NOT NULL AND TG_OP = 'INSERT' THEN
      PERFORM public.log_audit(
        customer_user_id,
        'create_order',
        'projects_v3',
        NEW.id,
        jsonb_build_object('code', NEW.code, 'status', NEW.status)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_new_staff_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  gm_user_id UUID;
  requester_name TEXT;
BEGIN
  SELECT ur.user_id INTO gm_user_id
  FROM public.user_roles ur
  WHERE ur.role = 'general_manager'
  LIMIT 1;
  
  SELECT p.full_name INTO requester_name
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;
  
  IF gm_user_id IS NOT NULL THEN
    PERFORM public.send_notification(
      gm_user_id,
      'درخواست نقش جدید',
      requester_name || ' درخواست نقش ' || NEW.requested_role || ' داده است.',
      '/admin/staff-requests',
      'info'
    );
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  notification_title TEXT;
  notification_body TEXT;
  customer_user_id UUID;
BEGIN
  -- Get customer's user_id
  SELECT c.user_id INTO customer_user_id
  FROM customers c
  WHERE c.id = NEW.customer_id;

  -- Only notify if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Set notification message based on new status
    CASE NEW.status
      WHEN 'approved' THEN
        notification_title := 'سفارش تایید شد';
        notification_body := 'سفارش شما با کد ' || NEW.code || ' توسط مدیریت تایید شد';
      WHEN 'rejected' THEN
        notification_title := 'سفارش رد شد';
        notification_body := 'متاسفانه سفارش شما با کد ' || NEW.code || ' رد شد';
      WHEN 'in_progress' THEN
        notification_title := 'سفارش در حال اجرا';
        notification_body := 'سفارش شما با کد ' || NEW.code || ' در حال اجرا است';
      WHEN 'completed' THEN
        notification_title := 'سفارش تکمیل شد';
        notification_body := 'سفارش شما با کد ' || NEW.code || ' با موفقیت تکمیل شد';
      ELSE
        notification_title := 'به‌روزرسانی سفارش';
        notification_body := 'وضعیت سفارش شما با کد ' || NEW.code || ' تغییر کرد';
    END CASE;

    -- Insert notification into notifications table
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (
      customer_user_id,
      notification_title,
      notification_body,
      CASE 
        WHEN NEW.status = 'approved' THEN 'success'
        WHEN NEW.status = 'rejected' THEN 'error'
        ELSE 'info'
      END,
      '/order/' || NEW.id
    );
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_role(_role app_role, _title text, _body text, _link text, _type text DEFAULT 'info'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  role_user_id UUID;
BEGIN
  FOR role_user_id IN 
    SELECT user_id FROM public.user_roles WHERE role = _role
  LOOP
    PERFORM public.send_notification(role_user_id, _title, _body, _link, _type);
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_staff_request_decision()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    IF NEW.status = 'approved' THEN
      -- تأیید شد
      PERFORM public.send_notification(
        NEW.user_id,
        'درخواست تأیید شد',
        'درخواست نقش ' || NEW.requested_role || ' شما تأیید شد.',
        '/profile',
        'success'
      );
      
      -- افزودن نقش به user_roles
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.user_id, NEW.requested_role)
      ON CONFLICT (user_id, role) DO NOTHING;
      
      -- ثبت در audit log
      PERFORM public.log_audit(
        NEW.approved_by,
        'approve_staff_request',
        'staff_profiles',
        NEW.id,
        jsonb_build_object('role', NEW.requested_role, 'user_id', NEW.user_id)
      );
      
    ELSE
      -- رد شد
      PERFORM public.send_notification(
        NEW.user_id,
        'درخواست رد شد',
        'درخواست نقش شما رد شد. دلیل: ' || COALESCE(NEW.rejection_reason, 'ذکر نشده'),
        '/profile',
        'error'
      );
      
      -- ثبت در audit log
      PERFORM public.log_audit(
        NEW.approved_by,
        'reject_staff_request',
        'staff_profiles',
        NEW.id,
        jsonb_build_object('role', NEW.requested_role, 'user_id', NEW.user_id, 'reason', NEW.rejection_reason)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_staff_request_decision_v2()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    IF NEW.status = 'approved' THEN
      -- استفاده از تابع امن assign_role_to_user
      PERFORM public.assign_role_to_user(NEW.user_id, NEW.requested_role);
      
      PERFORM public.send_notification(
        NEW.user_id,
        'درخواست تأیید شد',
        'درخواست نقش ' || NEW.requested_role || ' شما تأیید شد.',
        '/profile',
        'success'
      );
    ELSE
      PERFORM public.send_notification(
        NEW.user_id,
        'درخواست رد شد',
        'درخواست نقش شما رد شد. دلیل: ' || COALESCE(NEW.rejection_reason, 'ذکر نشده'),
        '/profile',
        'error'
      );
      
      PERFORM public.log_audit(
        NEW.approved_by,
        'reject_staff_request',
        'staff_profiles',
        NEW.id,
        jsonb_build_object('role', NEW.requested_role, 'user_id', NEW.user_id, 'reason', NEW.rejection_reason)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.recalculate_all_bank_card_balances()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.bank_cards LOOP
    PERFORM public.recalculate_bank_card_balance(r.id);
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.recalculate_bank_card_balance(p_card_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_initial_balance numeric;
  v_tx_total numeric;
  v_new_balance numeric;
BEGIN
  -- Get initial balance
  SELECT initial_balance INTO v_initial_balance FROM public.bank_cards WHERE id = p_card_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Sum ONLY from bank_card_transactions (all sources including daily_report_staff are recorded here)
  SELECT COALESCE(
    SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE -amount END), 0
  ) INTO v_tx_total
  FROM public.bank_card_transactions WHERE bank_card_id = p_card_id;

  v_new_balance := v_initial_balance + v_tx_total;

  UPDATE public.bank_cards SET current_balance = v_new_balance, updated_at = now() WHERE id = p_card_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_module_lock(p_module_key text, p_module_date date DEFAULT CURRENT_DATE)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    UPDATE public.module_edit_locks
    SET last_activity_at = now(),
        expires_at = now() + interval '30 minutes',
        updated_at = now()
    WHERE module_key = p_module_key 
        AND module_date = p_module_date 
        AND locked_by = v_user_id;
    
    RETURN FOUND;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reject_order_as_sales_manager(_order_id uuid, _rejection_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
BEGIN
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_role(_user_id, 'sales_manager'::app_role) THEN
    RAISE EXCEPTION 'Only sales managers can reject orders';
  END IF;

  UPDATE public.projects_v3
  SET status = 'rejected'::project_status_v3,
      rejection_reason = _rejection_reason
  WHERE id = _order_id;

  PERFORM public.log_audit(
    'reject_order',
    'projects_v3',
    _order_id::text,
    jsonb_build_object('rejected_by', _user_id, 'reason', _rejection_reason)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.release_module_lock(p_module_key text, p_module_date date DEFAULT CURRENT_DATE)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    DELETE FROM public.module_edit_locks
    WHERE module_key = p_module_key 
        AND module_date = p_module_date 
        AND locked_by = v_user_id;
    
    RETURN FOUND;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.remove_role_from_user(_user_id uuid, _role app_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- بررسی دسترسی
  IF NOT (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'general_manager'::app_role)
  ) THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز: فقط مدیران می‌توانند نقش حذف کنند';
  END IF;

  -- حذف نقش
  DELETE FROM public.user_roles
  WHERE user_id = _user_id AND role = _role;
  
  -- ثبت در audit log
  PERFORM public.log_audit(
    auth.uid(),
    'remove_role',
    'user_roles',
    _user_id,
    jsonb_build_object('role', _role)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.save_module_version(p_module_key text, p_module_date date, p_data_snapshot jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_next_version INT;
BEGIN
    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
    FROM public.module_version_history
    WHERE module_key = p_module_key AND module_date = p_module_date;

    -- Insert new version
    INSERT INTO public.module_version_history (module_key, module_date, saved_by, version_number, data_snapshot)
    VALUES (p_module_key, p_module_date, v_user_id, v_next_version, p_data_snapshot);

    -- Cleanup: Keep only last 10 versions
    DELETE FROM public.module_version_history
    WHERE module_key = p_module_key 
        AND module_date = p_module_date
        AND version_number <= (v_next_version - 10);

    RETURN v_next_version;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.send_notification(_user_id uuid, _title text, _body text, _link text DEFAULT NULL::text, _type text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _notification_id uuid;
BEGIN
  INSERT INTO public.notifications (user_id, title, body, link, type)
  VALUES (_user_id, _title, _body, _link, _type)
  RETURNING id INTO _notification_id;
  
  RETURN _notification_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_order_schedule(_order_id uuid, _execution_start_date timestamp with time zone, _execution_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.set_order_schedule(_order_id uuid, _execution_start_date timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
BEGIN
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.has_role(_user_id, 'executive_manager'::app_role) OR
    public.has_role(_user_id, 'general_manager'::app_role)
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to set schedule';
  END IF;

  UPDATE public.projects_v3
  SET execution_start_date = _execution_start_date,
      executed_by = _user_id
  WHERE id = _order_id;

  PERFORM public.log_audit(
    'set_schedule',
    'projects_v3',
    _order_id::text,
    jsonb_build_object('scheduled_by', _user_id, 'start_date', _execution_start_date)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_payment_amount_on_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_notes_json jsonb;
  v_payment numeric;
BEGIN
  -- اگر سفارش approved شد و payment_amount خالی است
  IF NEW.approved_at IS NOT NULL AND (OLD IS NULL OR OLD.approved_at IS NULL) AND NEW.payment_amount IS NULL THEN
    -- سعی کن قیمت را از notes استخراج کنی
    IF NEW.notes IS NOT NULL AND NEW.notes != '' THEN
      BEGIN
        -- تبدیل notes به jsonb (خواه text باشد خواه jsonb)
        IF jsonb_typeof(NEW.notes::jsonb) = 'object' THEN
          v_notes_json := NEW.notes::jsonb;
          
          -- استخراج قیمت با اولویت‌های مختلف
          v_payment := COALESCE(
            (v_notes_json->>'estimated_price')::numeric,
            (v_notes_json->>'price')::numeric,
            (v_notes_json->>'totalPrice')::numeric,
            (v_notes_json->>'total_price')::numeric
          );
          
          IF v_payment IS NOT NULL AND v_payment > 0 THEN
            NEW.payment_amount := v_payment;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- اگر خطایی رخ داد، payment_amount را NULL بگذار و ادامه بده
        NEW.payment_amount := NULL;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_unique_order_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If code is not provided or is empty, generate a new one
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := generate_unique_order_code();
  ELSE
    -- If code is provided, check if it's unique
    IF EXISTS(SELECT 1 FROM projects_v3 WHERE code = NEW.code AND id != NEW.id) THEN
      RAISE EXCEPTION 'کد سفارش % قبلاً استفاده شده است', NEW.code;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_daily_report_to_wallet()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_report_date date;
  v_daily_report_id uuid;
  v_report_date_str text;
  v_is_archived boolean;
BEGIN
  -- Only proceed if staff_user_id is set
  IF NEW.staff_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  v_user_id := NEW.staff_user_id;
  v_daily_report_id := NEW.daily_report_id;
  
  -- Get the report date and archived status
  SELECT report_date, COALESCE(is_archived, false) INTO v_report_date, v_is_archived
  FROM daily_reports
  WHERE id = v_daily_report_id;
  
  -- If report is archived, don't create wallet transactions
  IF v_is_archived = true THEN
    -- Delete any existing transactions for this staff record
    DELETE FROM wallet_transactions
    WHERE reference_type = 'daily_report_staff'
      AND reference_id = NEW.id;
    RETURN NEW;
  END IF;
  
  -- Format the report date for display
  v_report_date_str := COALESCE(v_report_date::text, '');
  
  -- Delete existing transactions for this SPECIFIC staff record to avoid duplicates
  DELETE FROM wallet_transactions
  WHERE reference_type = 'daily_report_staff'
    AND reference_id = NEW.id;
  
  -- Insert income transaction if amount_received > 0
  IF NEW.amount_received IS NOT NULL AND NEW.amount_received > 0 THEN
    INSERT INTO wallet_transactions (
      user_id,
      transaction_type,
      amount,
      title,
      description,
      reference_type,
      reference_id,
      created_at
    ) VALUES (
      v_user_id,
      'income',
      NEW.amount_received,
      'دریافتی از گزارش روزانه',
      CASE 
        WHEN NEW.receiving_notes IS NOT NULL AND NEW.receiving_notes != '' 
        THEN NEW.receiving_notes || ' | تاریخ گزارش: ' || v_report_date_str
        ELSE 'تاریخ گزارش: ' || v_report_date_str
      END,
      'daily_report_staff',
      NEW.id,
      COALESCE(v_report_date::timestamp with time zone, now())
    );
  END IF;
  
  -- Insert expense transaction if amount_spent > 0
  IF NEW.amount_spent IS NOT NULL AND NEW.amount_spent > 0 THEN
    INSERT INTO wallet_transactions (
      user_id,
      transaction_type,
      amount,
      title,
      description,
      reference_type,
      reference_id,
      created_at
    ) VALUES (
      v_user_id,
      'expense',
      -1 * NEW.amount_spent,
      'پرداختی در گزارش روزانه',
      CASE 
        WHEN NEW.spending_notes IS NOT NULL AND NEW.spending_notes != '' 
        THEN NEW.spending_notes || ' | تاریخ گزارش: ' || v_report_date_str
        ELSE 'تاریخ گزارش: ' || v_report_date_str
      END,
      'daily_report_staff',
      NEW.id,
      COALESCE(v_report_date::timestamp with time zone, now())
    );
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_order_approval_to_wallet()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_user_id uuid;
  v_order_code text;
  v_price numeric;
BEGIN
  -- Priority: total_price (includes renewals/repairs) then payment_amount
  v_price := COALESCE(NULLIF(NEW.total_price, 0), NEW.payment_amount, 0);
  
  -- Case 1: Order is newly approved - create wallet transaction
  IF NEW.status = 'approved' 
     AND (OLD.status IS NULL OR OLD.status != 'approved')
     AND v_price > 0 THEN
    
    SELECT user_id INTO v_customer_user_id
    FROM public.customers
    WHERE id = NEW.customer_id;
    
    IF v_customer_user_id IS NOT NULL THEN
      v_order_code := NEW.code;
      
      IF NOT EXISTS (
        SELECT 1 FROM public.wallet_transactions 
        WHERE reference_type = 'order_approved' 
        AND reference_id = NEW.id
      ) THEN
        INSERT INTO public.wallet_transactions (
          user_id, transaction_type, amount, title, description, reference_type, reference_id
        ) VALUES (
          v_customer_user_id, 'debit', -v_price,
          'هزینه سفارش ' || COALESCE(v_order_code, NEW.id::text),
          'بدهی سفارش تایید شده به شماره ' || COALESCE(v_order_code, NEW.id::text),
          'order_approved', NEW.id
        );
      END IF;
    END IF;
  
  -- Case 2: Price changed (payment_amount OR total_price) on active order
  ELSIF (NEW.status IN ('approved', 'completed', 'in_progress', 'scheduled', 'active', 'paid', 'closed'))
     AND v_price > 0
     AND (
       (OLD.payment_amount IS DISTINCT FROM NEW.payment_amount)
       OR (OLD.total_price IS DISTINCT FROM NEW.total_price)
     ) THEN
    
    SELECT user_id INTO v_customer_user_id
    FROM public.customers
    WHERE id = NEW.customer_id;
    
    IF v_customer_user_id IS NOT NULL THEN
      v_order_code := NEW.code;
      
      IF EXISTS (
        SELECT 1 FROM public.wallet_transactions 
        WHERE reference_type = 'order_approved' 
        AND reference_id = NEW.id
      ) THEN
        UPDATE public.wallet_transactions
        SET 
          amount = -v_price,
          description = 'بدهی سفارش به شماره ' || COALESCE(v_order_code, NEW.id::text) || ' (بروزرسانی شده)',
          updated_at = now()
        WHERE reference_type = 'order_approved' 
        AND reference_id = NEW.id;
      ELSE
        INSERT INTO public.wallet_transactions (
          user_id, transaction_type, amount, title, description, reference_type, reference_id
        ) VALUES (
          v_customer_user_id, 'debit', -v_price,
          'هزینه سفارش ' || COALESCE(v_order_code, NEW.id::text),
          'بدهی سفارش به شماره ' || COALESCE(v_order_code, NEW.id::text),
          'order_approved', NEW.id
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_order_payment_to_wallet()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_user_id uuid;
  v_order_code text;
  v_order_id uuid;
BEGIN
  -- Get order info
  SELECT p.customer_id, p.code, p.id, c.user_id 
  INTO v_order_id, v_order_code, v_order_id, v_customer_user_id
  FROM public.projects_v3 p
  JOIN public.customers c ON c.id = p.customer_id
  WHERE p.id = NEW.order_id;
  
  IF v_customer_user_id IS NOT NULL THEN
    -- Check if this payment already has a wallet transaction
    IF NOT EXISTS (
      SELECT 1 FROM public.wallet_transactions 
      WHERE reference_type = 'order_payment' 
      AND reference_id = NEW.id
    ) THEN
      -- Insert as credit (positive amount = reduces debt)
      INSERT INTO public.wallet_transactions (
        user_id,
        transaction_type,
        amount,
        title,
        description,
        reference_type,
        reference_id
      ) VALUES (
        v_customer_user_id,
        'credit',
        NEW.amount,  -- Positive because it's a payment
        'پرداخت سفارش ' || COALESCE(v_order_code, NEW.order_id::text),
        'پرداخت برای سفارش شماره ' || COALESCE(v_order_code, NEW.order_id::text),
        'order_payment',
        NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.transfer_between_bank_cards(p_from_card_id uuid, p_to_card_id uuid, p_amount numeric, p_description text DEFAULT NULL::text, p_created_at timestamp with time zone DEFAULT now(), p_created_by uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_from_card public.bank_cards%ROWTYPE;
  v_to_card public.bank_cards%ROWTYPE;
  v_withdrawal_id uuid;
  v_deposit_id uuid;
  v_from_desc text;
  v_to_desc text;
  v_from_new_balance numeric;
  v_to_new_balance numeric;
BEGIN
  -- Validate input
  IF p_from_card_id = p_to_card_id THEN
    RAISE EXCEPTION 'Source and destination cards cannot be the same';
  END IF;
  
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be positive';
  END IF;

  -- Lock both cards to prevent concurrent updates (order by id to avoid deadlock)
  IF p_from_card_id < p_to_card_id THEN
    SELECT * INTO v_from_card FROM public.bank_cards WHERE id = p_from_card_id FOR UPDATE;
    SELECT * INTO v_to_card FROM public.bank_cards WHERE id = p_to_card_id FOR UPDATE;
  ELSE
    SELECT * INTO v_to_card FROM public.bank_cards WHERE id = p_to_card_id FOR UPDATE;
    SELECT * INTO v_from_card FROM public.bank_cards WHERE id = p_from_card_id FOR UPDATE;
  END IF;

  IF v_from_card.id IS NULL OR v_to_card.id IS NULL THEN
    RAISE EXCEPTION 'One or both cards not found';
  END IF;

  IF v_from_card.is_active = false OR v_to_card.is_active = false THEN
    RAISE EXCEPTION 'One or both cards are inactive';
  END IF;

  -- Build descriptions
  v_from_desc := 'انتقال به ' || v_to_card.card_name || COALESCE(' - ' || p_description, '');
  v_to_desc := 'انتقال از ' || v_from_card.card_name || COALESCE(' - ' || p_description, '');

  -- Insert withdrawal from source card (balance_after = 0 placeholder, will be recalculated)
  INSERT INTO public.bank_card_transactions (
    bank_card_id,
    transaction_type,
    amount,
    balance_after,
    description,
    reference_type,
    reference_id,
    created_by,
    created_at
  ) VALUES (
    p_from_card_id,
    'withdrawal',
    p_amount,
    0,
    v_from_desc,
    'card_transfer',
    p_to_card_id,
    p_created_by,
    p_created_at
  ) RETURNING id INTO v_withdrawal_id;

  -- Insert deposit to destination card (balance_after = 0 placeholder, will be recalculated)
  INSERT INTO public.bank_card_transactions (
    bank_card_id,
    transaction_type,
    amount,
    balance_after,
    description,
    reference_type,
    reference_id,
    created_by,
    created_at
  ) VALUES (
    p_to_card_id,
    'deposit',
    p_amount,
    0,
    v_to_desc,
    'card_transfer',
    p_from_card_id,
    p_created_by,
    p_created_at
  ) RETURNING id INTO v_deposit_id;

  -- Recalculate both card balances using the authoritative formula
  -- Source card
  SELECT v_from_card.initial_balance + COALESCE(
    SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE -amount END), 0
  ) INTO v_from_new_balance
  FROM public.bank_card_transactions WHERE bank_card_id = p_from_card_id;
  
  UPDATE public.bank_cards 
  SET current_balance = v_from_new_balance, updated_at = now() 
  WHERE id = p_from_card_id;

  -- Destination card
  SELECT v_to_card.initial_balance + COALESCE(
    SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE -amount END), 0
  ) INTO v_to_new_balance
  FROM public.bank_card_transactions WHERE bank_card_id = p_to_card_id;
  
  UPDATE public.bank_cards 
  SET current_balance = v_to_new_balance, updated_at = now() 
  WHERE id = p_to_card_id;

  RETURN jsonb_build_object(
    'success', true,
    'withdrawal_id', v_withdrawal_id,
    'deposit_id', v_deposit_id,
    'from_card_name', v_from_card.card_name,
    'to_card_name', v_to_card.card_name,
    'from_new_balance', v_from_new_balance,
    'to_new_balance', v_to_new_balance
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.transfer_order_ownership(p_order_id uuid, p_new_customer_id uuid, p_new_hierarchy_id uuid, p_transferred_from_user_id uuid, p_transferred_from_phone text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_transfer_request_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM order_transfer_requests otr
    WHERE otr.order_id = p_order_id
      AND otr.status IN ('pending_recipient', 'pending_registration')
      AND (
        otr.to_user_id = auth.uid()
        OR otr.to_phone_number = (
          SELECT phone_number FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
      )
  ) INTO v_transfer_request_exists;
  
  IF NOT v_transfer_request_exists THEN
    RAISE EXCEPTION 'Unauthorized: No valid transfer request found for this user';
  END IF;
  
  UPDATE projects_v3
  SET 
    customer_id = p_new_customer_id,
    hierarchy_project_id = p_new_hierarchy_id,
    transferred_from_user_id = p_transferred_from_user_id,
    transferred_from_phone = p_transferred_from_phone
  WHERE id = p_order_id;
  
  UPDATE order_transfer_requests
  SET status = 'completed', responded_at = NOW()
  WHERE order_id = p_order_id 
    AND status IN ('pending_recipient', 'pending_registration')
    AND (
      to_user_id = auth.uid()
      OR to_phone_number = (
        SELECT phone_number FROM profiles WHERE user_id = auth.uid() LIMIT 1
      )
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_cleanup_expired_otps()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Clean up expired OTPs before inserting new one
  DELETE FROM public.otp_codes WHERE expires_at < now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_order_automation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  customer_user_id UUID;
  customer_name TEXT;
  customer_phone TEXT;
  province_name TEXT;
  subcategory_name TEXT;
  subcategory_code TEXT;
  manager_record RECORD;
  v_notes JSONB;
  detail_text TEXT := '';
  basic_text TEXT := '';
BEGIN
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status != 'pending') THEN
    SELECT s.code, s.name INTO subcategory_code, subcategory_name
    FROM subcategories s
    WHERE s.id = NEW.subcategory_id;

    SELECT c.user_id INTO customer_user_id
    FROM customers c
    WHERE c.id = NEW.customer_id;

    IF customer_user_id IS NOT NULL THEN
      SELECT p.full_name, p.phone_number INTO customer_name, customer_phone
      FROM profiles p
      WHERE p.user_id = customer_user_id;

      SELECT pr.name INTO province_name
      FROM provinces pr
      WHERE pr.id = NEW.province_id;

      IF NEW.notes IS NOT NULL THEN
        BEGIN
          v_notes := NEW.notes::jsonb;
        EXCEPTION WHEN others THEN
          v_notes := NULL;
        END;
      END IF;

      IF v_notes IS NOT NULL THEN
        IF v_notes ? 'service_type' THEN
          detail_text := detail_text || E'\nنوع خدمت: ' || COALESCE(v_notes->>'service_type', '');
        END IF;
        IF v_notes ? 'scaffold_type' THEN
          detail_text := detail_text || E'\nنوع داربست: ' || COALESCE(v_notes->>'scaffold_type', '');
        END IF;
        IF v_notes ? 'dimensions' THEN
          detail_text := detail_text || E'\nابعاد: ' || (
            SELECT string_agg(
              TRIM(BOTH ' ' FROM COALESCE(d->>'length','?')) || 'x' ||
              TRIM(BOTH ' ' FROM COALESCE(d->>'width','?')) || 'x' ||
              TRIM(BOTH ' ' FROM COALESCE(d->>'height','?'))
            , ' | ')
            FROM jsonb_array_elements(v_notes->'dimensions') AS d
          );
        ELSIF (v_notes ? 'length' OR v_notes ? 'width' OR v_notes ? 'height') THEN
          detail_text := detail_text || E'\nابعاد: ' ||
            COALESCE(v_notes->>'length','?') || 'x' || COALESCE(v_notes->>'width','?') || 'x' || COALESCE(v_notes->>'height','?');
        END IF;
        IF v_notes ? 'additional_notes' THEN
          detail_text := detail_text || E'\nتوضیحات: ' || COALESCE(v_notes->>'additional_notes','');
        ELSIF v_notes ? 'description' THEN
          detail_text := detail_text || E'\nتوضیحات: ' || COALESCE(v_notes->>'description','');
        END IF;
      END IF;

      basic_text :=
        'سفارش جدید از ' || COALESCE(customer_name, 'مشتری') ||
        CASE WHEN customer_phone IS NOT NULL AND customer_phone <> '' THEN ' (' || customer_phone || ')' ELSE '' END ||
        E'\nکد: ' || NEW.code ||
        E'\nخدمت: ' || COALESCE(subcategory_name, '—') ||
        E'\nاستان/آدرس: ' || COALESCE(province_name, '') || ' - ' || COALESCE(NEW.address, '') ||
        CASE WHEN NEW.detailed_address IS NOT NULL AND NEW.detailed_address <> '' THEN E'\nجزئیات آدرس: ' || NEW.detailed_address ELSE '' END ||
        detail_text;

      -- Always notify CEO
      FOR manager_record IN 
        SELECT DISTINCT ur.user_id FROM user_roles ur WHERE ur.role = 'ceo'
      LOOP
        PERFORM send_notification(manager_record.user_id, 'سفارش جدید ' || NEW.code, basic_text, '/ceo/orders', 'info');
      END LOOP;

      -- Route based on subcategory code
      IF subcategory_code = '10' THEN
        FOR manager_record IN 
          SELECT DISTINCT ur.user_id FROM user_roles ur WHERE ur.role = 'executive_manager_scaffold_execution_with_materials'
        LOOP
          PERFORM send_notification(manager_record.user_id, 'سفارش جدید داربست با اجناس ' || NEW.code, basic_text, '/executive/orders', 'info');
        END LOOP;
        
      ELSIF subcategory_code = '20' THEN
        FOR manager_record IN 
          SELECT DISTINCT ur.user_id FROM user_roles ur WHERE ur.role = 'scaffold_executive_manager'
        LOOP
          PERFORM send_notification(manager_record.user_id, 'سفارش جدید داربست ' || NEW.code, basic_text, '/executive/orders', 'info');
        END LOOP;
        
      ELSIF subcategory_code = '30' THEN
        FOR manager_record IN 
          SELECT DISTINCT ur.user_id FROM user_roles ur WHERE ur.role = 'rental_executive_manager'
        LOOP
          PERFORM send_notification(manager_record.user_id, 'سفارش جدید کرایه داربست ' || NEW.code, basic_text, '/executive/orders', 'info');
        END LOOP;
        
      ELSE
        PERFORM notify_role('sales_manager'::app_role, 'سفارش جدید ' || NEW.code, basic_text, '/sales/pending-orders', 'info');
        PERFORM notify_role('general_manager'::app_role, 'سفارش جدید ' || NEW.code, basic_text, '/admin/orders', 'info');
      END IF;

      PERFORM send_notification(customer_user_id, 'سفارش ' || NEW.code || ' ثبت شد',
        'سفارش شما برای ' || COALESCE(subcategory_name, 'خدمات') || ' ثبت شد و در حال بررسی توسط مدیریت است.',
        '/user/my-orders', 'success');

      PERFORM log_audit(customer_user_id, 'automation_started', 'projects_v3', NEW.id,
        jsonb_build_object('order_code', NEW.code, 'subcategory_code', subcategory_code, 'automation_type', 'order_workflow', 'timestamp', now()));
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_recalc_bank_card_on_staff()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.bank_card_id IS NOT NULL AND OLD.is_cash_box = true THEN
      PERFORM public.recalculate_bank_card_balance(OLD.bank_card_id);
    END IF;
  ELSE
    IF NEW.bank_card_id IS NOT NULL AND NEW.is_cash_box = true THEN
      PERFORM public.recalculate_bank_card_balance(NEW.bank_card_id);
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.bank_card_id IS DISTINCT FROM NEW.bank_card_id AND OLD.bank_card_id IS NOT NULL THEN
      PERFORM public.recalculate_bank_card_balance(OLD.bank_card_id);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_recalc_bank_card_on_tx()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_bank_card_balance(OLD.bank_card_id);
  ELSE
    PERFORM public.recalculate_bank_card_balance(NEW.bank_card_id);
    IF TG_OP = 'UPDATE' AND OLD.bank_card_id IS DISTINCT FROM NEW.bank_card_id THEN
      PERFORM public.recalculate_bank_card_balance(OLD.bank_card_id);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_recalc_bank_card_on_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only recalculate if initial_balance changed (not current_balance to avoid recursion)
  IF OLD.initial_balance IS DISTINCT FROM NEW.initial_balance THEN
    -- Calculate inline to avoid recursive trigger - ONLY from bank_card_transactions
    NEW.current_balance := NEW.initial_balance + 
      COALESCE((SELECT SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE -amount END) 
                FROM public.bank_card_transactions WHERE bank_card_id = NEW.id), 0);
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_recalculate_bank_card_balance_on_staff()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.bank_card_id IS NOT NULL AND OLD.is_cash_box = true THEN
      PERFORM public.recalculate_bank_card_balance(OLD.bank_card_id);
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.bank_card_id IS NOT NULL AND NEW.is_cash_box = true THEN
      PERFORM public.recalculate_bank_card_balance(NEW.bank_card_id);
    END IF;
    IF OLD.bank_card_id IS NOT NULL AND OLD.is_cash_box = true AND OLD.bank_card_id IS DISTINCT FROM NEW.bank_card_id THEN
      PERFORM public.recalculate_bank_card_balance(OLD.bank_card_id);
    END IF;
    RETURN NEW;
  ELSE
    IF NEW.bank_card_id IS NOT NULL AND NEW.is_cash_box = true THEN
      PERFORM public.recalculate_bank_card_balance(NEW.bank_card_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_recalculate_bank_card_balance_on_tx()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_bank_card_balance(OLD.bank_card_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.recalculate_bank_card_balance(NEW.bank_card_id);
    IF OLD.bank_card_id IS DISTINCT FROM NEW.bank_card_id THEN
      PERFORM public.recalculate_bank_card_balance(OLD.bank_card_id);
    END IF;
    RETURN NEW;
  ELSE
    PERFORM public.recalculate_bank_card_balance(NEW.bank_card_id);
    RETURN NEW;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_recalculate_on_initial_balance_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.initial_balance IS DISTINCT FROM NEW.initial_balance THEN
    PERFORM public.recalculate_bank_card_balance(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.unarchive_daily_report(p_report_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  staff_row RECORD;
  v_report_date date;
  v_report_date_str text;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Get report date
  SELECT report_date INTO v_report_date
  FROM public.daily_reports
  WHERE id = p_report_id;
  
  v_report_date_str := COALESCE(v_report_date::text, '');
  
  -- Update the report to not archived
  UPDATE public.daily_reports
  SET 
    is_archived = false,
    archived_at = NULL,
    archived_by = NULL
  WHERE id = p_report_id;
  
  -- Re-create wallet transactions for all staff in this report
  FOR staff_row IN 
    SELECT * FROM public.daily_report_staff 
    WHERE daily_report_id = p_report_id 
      AND staff_user_id IS NOT NULL
  LOOP
    -- Insert income transaction if amount_received > 0
    IF staff_row.amount_received IS NOT NULL AND staff_row.amount_received > 0 THEN
      INSERT INTO wallet_transactions (
        user_id,
        transaction_type,
        amount,
        title,
        description,
        reference_type,
        reference_id,
        created_at
      ) VALUES (
        staff_row.staff_user_id,
        'income',
        staff_row.amount_received,
        'دریافتی از گزارش روزانه',
        CASE 
          WHEN staff_row.receiving_notes IS NOT NULL AND staff_row.receiving_notes != '' 
          THEN staff_row.receiving_notes || ' | تاریخ گزارش: ' || v_report_date_str
          ELSE 'تاریخ گزارش: ' || v_report_date_str
        END,
        'daily_report_staff',
        staff_row.id,
        COALESCE(v_report_date::timestamp with time zone, now())
      );
    END IF;
    
    -- Insert expense transaction if amount_spent > 0
    IF staff_row.amount_spent IS NOT NULL AND staff_row.amount_spent > 0 THEN
      INSERT INTO wallet_transactions (
        user_id,
        transaction_type,
        amount,
        title,
        description,
        reference_type,
        reference_id,
        created_at
      ) VALUES (
        staff_row.staff_user_id,
        'expense',
        -1 * staff_row.amount_spent,
        'پرداختی در گزارش روزانه',
        CASE 
          WHEN staff_row.spending_notes IS NOT NULL AND staff_row.spending_notes != '' 
          THEN staff_row.spending_notes || ' | تاریخ گزارش: ' || v_report_date_str
          ELSE 'تاریخ گزارش: ' || v_report_date_str
        END,
        'daily_report_staff',
        staff_row.id,
        COALESCE(v_report_date::timestamp with time zone, now())
      );
    END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_order_messages_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_project_media_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_rating_helpful_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE ratings
  SET helpful_count = (
    SELECT COUNT(*) 
    FROM rating_helpful_votes 
    WHERE rating_id = NEW.rating_id AND is_helpful = true
  )
  WHERE id = NEW.rating_id;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_reputation_on_rating()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- به‌روزرسانی امتیاز امتیاز‌گیرنده
  PERFORM calculate_reputation_score(NEW.rated_id);
  
  -- تایید خودکار امتیازات از پروژه‌های بسته شده
  IF EXISTS (
    SELECT 1 FROM projects_v3 
    WHERE id = NEW.project_id AND status = 'closed'
  ) THEN
    NEW.is_verified := true;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_contractor_phone(_phone_number text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.phone_whitelist
    WHERE phone_number = _phone_number
      AND 'contractor' = ANY(allowed_roles)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_contractor_phone()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.validate_phone_number(NEW.phone_number) THEN
    RAISE EXCEPTION 'شماره تلفن نامعتبر است. باید 11 رقم و با 09 شروع شود';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_phone_number(_phone text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  -- بررسی فرمت شماره موبایل ایران (11 رقم، شروع با 09)
  RETURN _phone ~ '^09[0-9]{9}$';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_profile_phone(_phone_number text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.phone_whitelist
    WHERE phone_number = _phone_number
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_profile_phone()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.phone_number IS NOT NULL AND NOT public.validate_phone_number(NEW.phone_number) THEN
    RAISE EXCEPTION 'شماره تلفن نامعتبر است. باید 11 رقم و با 09 شروع شود';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_email_code(_email text, _code text, _purpose text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  valid_code RECORD;
BEGIN
  SELECT * INTO valid_code
  FROM public.email_verification_codes
  WHERE email = _email
    AND code = _code
    AND purpose = _purpose
    AND expires_at > now()
    AND used = false
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF FOUND THEN
    -- Mark as used
    UPDATE public.email_verification_codes SET used = true WHERE id = valid_code.id;
    RETURN true;
  END IF;
  
  RETURN false;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_otp_code(_phone_number text, _code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  otp_valid boolean;
BEGIN
  -- Check if OTP exists, is not expired, and matches
  SELECT EXISTS (
    SELECT 1
    FROM public.otp_codes
    WHERE phone_number = _phone_number
      AND code = _code
      AND expires_at > now()
      AND verified = false
  ) INTO otp_valid;
  
  RETURN otp_valid;
END;
$function$
;
