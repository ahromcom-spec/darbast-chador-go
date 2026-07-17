CREATE OR REPLACE FUNCTION public.lookup_profile_by_phone(_phone text)
RETURNS TABLE(user_id uuid, full_name text, phone_number text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_phone := regexp_replace(coalesce(_phone, ''), '\D', '', 'g');
  IF left(v_phone, 2) = '98' THEN
    v_phone := '0' || substr(v_phone, 3);
  END IF;
  IF left(v_phone, 1) <> '0' AND length(v_phone) = 10 THEN
    v_phone := '0' || v_phone;
  END IF;

  IF v_phone !~ '^09[0-9]{9}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.user_id, p.full_name, p.phone_number
  FROM public.profiles p
  WHERE p.phone_number = v_phone
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_profile_by_phone(text) TO authenticated;

DROP POLICY IF EXISTS "Invitee can view own invitations" ON public.order_collaborators;
CREATE POLICY "Invitee can view own invitations"
ON public.order_collaborators
FOR SELECT
USING (
  invitee_user_id = auth.uid()
  OR invitee_phone_number = (
    SELECT p.phone_number FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
  )
);

DROP POLICY IF EXISTS "Invitee can respond to invitation" ON public.order_collaborators;
CREATE POLICY "Invitee can respond to invitation"
ON public.order_collaborators
FOR UPDATE
USING (
  invitee_user_id = auth.uid()
  OR invitee_phone_number = (
    SELECT p.phone_number FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
  )
)
WITH CHECK (
  invitee_user_id = auth.uid()
  OR invitee_phone_number = (
    SELECT p.phone_number FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
  )
);

CREATE OR REPLACE FUNCTION public.auto_assign_pending_transfers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  transfer_record record;
  v_phone text;
BEGIN
  v_phone := NEW.phone_number;
  IF v_phone IS NULL THEN
    RETURN NEW;
  END IF;

  FOR transfer_record IN
    SELECT *
    FROM public.order_transfer_requests
    WHERE to_phone_number = v_phone
      AND status = 'pending_registration'
  LOOP
    UPDATE public.order_transfer_requests
    SET
      to_user_id = NEW.user_id,
      status = 'pending_recipient',
      updated_at = now()
    WHERE id = transfer_record.id;

    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (
      NEW.user_id,
      'درخواست انتقال سفارش',
      'یک سفارش برای انتقال به شما آماده است. لطفاً آن را بررسی و تایید کنید.',
      'transfer_request',
      '/user/orders'
    );

    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (
      transfer_record.from_user_id,
      'کاربر مقصد ثبت‌نام کرد',
      'کاربر مقصد سفارش انتقالی اکنون ثبت‌نام کرده است و سفارش در انتظار تایید ایشان است.',
      'transfer_update',
      '/user/orders/' || transfer_record.order_id
    );
  END LOOP;

  UPDATE public.order_collaborators
  SET invitee_user_id = NEW.user_id,
      updated_at = now()
  WHERE invitee_phone_number = v_phone
    AND invitee_user_id IS NULL
    AND status = 'pending';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_check_transfers ON public.profiles;
CREATE TRIGGER on_profile_created_check_transfers
AFTER INSERT OR UPDATE OF phone_number ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_pending_transfers();