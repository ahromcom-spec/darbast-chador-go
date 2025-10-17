-- ایجاد تابع notify_role برای ارسال نوتیفیکیشن به تمام کاربران با نقش مشخص
CREATE OR REPLACE FUNCTION notify_role(
  _role app_role,
  _title TEXT,
  _body TEXT,
  _link TEXT,
  _type TEXT DEFAULT 'info'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_user_id UUID;
BEGIN
  FOR role_user_id IN 
    SELECT user_id FROM public.user_roles WHERE role = _role
  LOOP
    PERFORM public.send_notification(role_user_id, _title, _body, _link, _type);
  END LOOP;
END;
$$;