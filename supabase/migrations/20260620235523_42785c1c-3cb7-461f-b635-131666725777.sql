GRANT SELECT, INSERT, UPDATE, DELETE ON public.contractors TO authenticated;
GRANT ALL ON public.contractors TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contractor_verification_requests TO authenticated;
GRANT ALL ON public.contractor_verification_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

DROP POLICY IF EXISTS "Managers can delete contractors" ON public.contractors;
CREATE POLICY "Managers can delete contractors"
ON public.contractors
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'general_manager'::public.app_role)
  OR public.has_role(auth.uid(), 'ceo'::public.app_role)
);

CREATE OR REPLACE FUNCTION public.can_manage_contractors(_actor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(_actor_id, 'admin'::public.app_role)
    OR public.has_role(_actor_id, 'general_manager'::public.app_role)
    OR public.has_role(_actor_id, 'ceo'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.approve_contractor(_contractor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _target_user_id uuid;
BEGIN
  IF _actor_id IS NULL OR NOT public.can_manage_contractors(_actor_id) THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز برای تأیید پیمانکار';
  END IF;

  SELECT user_id INTO _target_user_id
  FROM public.contractors
  WHERE id = _contractor_id;

  IF _target_user_id IS NULL THEN
    RAISE EXCEPTION 'پیمانکار پیدا نشد';
  END IF;

  UPDATE public.contractors
  SET is_approved = true,
      is_active = true,
      exit_requested_at = NULL,
      exit_request_reason = NULL,
      updated_at = now()
  WHERE id = _contractor_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_target_user_id, 'contractor'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.contractor_verification_requests
  SET status = 'approved',
      verified_by = _actor_id,
      verified_at = now(),
      rejection_reason = NULL,
      updated_at = now()
  WHERE user_id = _target_user_id
    AND status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_contractor(_contractor_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _contractor public.contractors%ROWTYPE;
BEGIN
  IF _actor_id IS NULL OR NOT public.can_manage_contractors(_actor_id) THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز برای رد پیمانکار';
  END IF;

  SELECT * INTO _contractor
  FROM public.contractors
  WHERE id = _contractor_id;

  IF _contractor.id IS NULL THEN
    RAISE EXCEPTION 'پیمانکار پیدا نشد';
  END IF;

  UPDATE public.contractors
  SET is_approved = false,
      is_active = false,
      updated_at = now()
  WHERE id = _contractor_id;

  DELETE FROM public.user_roles
  WHERE user_id = _contractor.user_id
    AND role = 'contractor'::public.app_role;

  UPDATE public.contractor_verification_requests
  SET status = 'rejected',
      verified_by = _actor_id,
      verified_at = now(),
      rejection_reason = NULLIF(_reason, ''),
      updated_at = now()
  WHERE user_id = _contractor.user_id
    AND status = 'pending';

  IF NOT FOUND THEN
    INSERT INTO public.contractor_verification_requests (
      user_id,
      phone_number,
      company_name,
      service_category_id,
      activity_type_id,
      region_id,
      status,
      verified_by,
      verified_at,
      rejection_reason
    ) VALUES (
      _contractor.user_id,
      _contractor.phone_number,
      _contractor.company_name,
      _contractor.service_category_id,
      _contractor.activity_type_id,
      _contractor.region_id,
      'rejected',
      _actor_id,
      now(),
      NULLIF(_reason, '')
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_contractor_completely(_contractor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _target_user_id uuid;
BEGIN
  IF _actor_id IS NULL OR NOT public.can_manage_contractors(_actor_id) THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز برای حذف پیمانکار';
  END IF;

  SELECT user_id INTO _target_user_id
  FROM public.contractors
  WHERE id = _contractor_id;

  IF _target_user_id IS NULL THEN
    RAISE EXCEPTION 'پیمانکار پیدا نشد';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = _target_user_id
    AND role = 'contractor'::public.app_role;

  DELETE FROM public.contractor_services
  WHERE contractor_id = _contractor_id;

  DELETE FROM public.contractor_verification_requests
  WHERE user_id = _target_user_id;

  DELETE FROM public.contractors
  WHERE id = _contractor_id;
END;
$$;