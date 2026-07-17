ALTER TABLE public.contractors
  ADD COLUMN IF NOT EXISTS pending_edits jsonb,
  ADD COLUMN IF NOT EXISTS pending_edits_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_edits_by uuid;

-- RPC: contractor submits an edit request (writes to pending_edits only)
CREATE OR REPLACE FUNCTION public.submit_contractor_edit(
  _contractor_id uuid,
  _edits jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_owner uuid;
  v_allowed jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO v_owner FROM public.contractors WHERE id = _contractor_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Contractor not found';
  END IF;

  IF v_owner <> v_user
     AND NOT has_role(v_user, 'admin')
     AND NOT has_role(v_user, 'ceo')
     AND NOT has_role(v_user, 'general_manager') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- whitelist editable fields
  v_allowed := jsonb_build_object(
    'company_name', _edits->'company_name',
    'contact_person', _edits->'contact_person',
    'address', _edits->'address',
    'description', _edits->'description',
    'experience_years', _edits->'experience_years'
  );

  UPDATE public.contractors
  SET pending_edits = v_allowed,
      pending_edits_at = now(),
      pending_edits_by = v_user,
      updated_at = now()
  WHERE id = _contractor_id;

  INSERT INTO public.contractor_activity_log (contractor_id, user_id, event_type, message, metadata)
  VALUES (
    _contractor_id, v_owner, 'edit_submitted',
    'پیمانکار درخواست ویرایش اطلاعات پروفایل را ارسال کرد و در انتظار تأیید مدیریت است.',
    v_allowed
  );
END;
$$;

-- RPC: admin approves pending edits (applies them to real columns)
CREATE OR REPLACE FUNCTION public.approve_contractor_edit(
  _contractor_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_edits jsonb;
  v_owner uuid;
BEGIN
  IF NOT (has_role(v_user, 'admin') OR has_role(v_user, 'ceo') OR has_role(v_user, 'general_manager')) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT pending_edits, user_id INTO v_edits, v_owner
  FROM public.contractors WHERE id = _contractor_id;

  IF v_edits IS NULL THEN
    RAISE EXCEPTION 'No pending edits';
  END IF;

  UPDATE public.contractors SET
    company_name     = COALESCE(NULLIF(v_edits->>'company_name',''), company_name),
    contact_person   = COALESCE(NULLIF(v_edits->>'contact_person',''), contact_person),
    address          = COALESCE(v_edits->>'address', address),
    description      = COALESCE(v_edits->>'description', description),
    experience_years = COALESCE((v_edits->>'experience_years')::int, experience_years),
    pending_edits = NULL,
    pending_edits_at = NULL,
    pending_edits_by = NULL,
    updated_at = now()
  WHERE id = _contractor_id;

  INSERT INTO public.contractor_activity_log (contractor_id, user_id, event_type, message, metadata)
  VALUES (
    _contractor_id, v_owner, 'edit_approved',
    'ویرایش اطلاعات پروفایل توسط مدیریت تأیید و اعمال شد.',
    v_edits
  );
END;
$$;

-- RPC: admin rejects pending edits (clears them, keeps old data)
CREATE OR REPLACE FUNCTION public.reject_contractor_edit(
  _contractor_id uuid,
  _reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_edits jsonb;
  v_owner uuid;
BEGIN
  IF NOT (has_role(v_user, 'admin') OR has_role(v_user, 'ceo') OR has_role(v_user, 'general_manager')) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT pending_edits, user_id INTO v_edits, v_owner
  FROM public.contractors WHERE id = _contractor_id;

  UPDATE public.contractors SET
    pending_edits = NULL,
    pending_edits_at = NULL,
    pending_edits_by = NULL,
    updated_at = now()
  WHERE id = _contractor_id;

  INSERT INTO public.contractor_activity_log (contractor_id, user_id, event_type, message, metadata)
  VALUES (
    _contractor_id, v_owner, 'edit_rejected',
    COALESCE('ویرایش پیشنهادی رد شد. دلیل: ' || _reason, 'ویرایش پیشنهادی توسط مدیریت رد شد.'),
    v_edits
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_contractor_edit(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_contractor_edit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_contractor_edit(uuid, text) TO authenticated;
