-- Fix SECURITY DEFINER functions by adding SET search_path = public
-- This prevents search_path injection attacks

-- Critical security functions that handle sensitive data
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.assign_role_to_user(_user_id uuid, _role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.get_contractor_contact_info(_contractor_id uuid)
RETURNS TABLE (
  email text,
  phone_number text,
  contact_person text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Notification and audit functions
CREATE OR REPLACE FUNCTION public.send_notification(
  _user_id uuid,
  _title text,
  _body text,
  _link text DEFAULT NULL,
  _type text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _notification_id uuid;
BEGIN
  INSERT INTO public.notifications (user_id, title, body, link, type)
  VALUES (_user_id, _title, _body, _link, _type)
  RETURNING id INTO _notification_id;
  
  RETURN _notification_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_audit(
  _action text,
  _entity text,
  _entity_id text DEFAULT NULL,
  _meta jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _audit_id uuid;
BEGIN
  INSERT INTO public.audit_log (action, entity, entity_id, meta, actor_user_id)
  VALUES (_action, _entity, _entity_id, _meta, auth.uid())
  RETURNING id INTO _audit_id;
  
  RETURN _audit_id;
END;
$$;

-- Phone validation functions
CREATE OR REPLACE FUNCTION public.validate_contractor_phone(_phone_number text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.phone_whitelist
    WHERE phone_number = _phone_number
      AND 'contractor' = ANY(allowed_roles)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_profile_phone(_phone_number text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.phone_whitelist
    WHERE phone_number = _phone_number
  );
END;
$$;

-- Order management functions
CREATE OR REPLACE FUNCTION public.approve_order_as_sales_manager(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  UPDATE public.projects_v3
  SET status = 'approved'::project_status_v3,
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
$$;

CREATE OR REPLACE FUNCTION public.reject_order_as_sales_manager(
  _order_id uuid,
  _rejection_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.set_order_schedule(
  _order_id uuid,
  _execution_start_date timestamp with time zone
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;