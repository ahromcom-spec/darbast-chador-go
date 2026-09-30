REVOKE EXECUTE ON FUNCTION public.classify_site_notification_actor() FROM PUBLIC, anon, authenticated;
CREATE POLICY "No client access" ON public.impersonation_sessions FOR SELECT TO authenticated USING (false);
UPDATE public.site_notifications n SET actor_source = CASE
  WHEN n.title LIKE 'ورود مدیر به حساب%' THEN 'impersonation'
  WHEN n.event_type='user_visit' AND (n.actor_user_id IS NULL OR n.title LIKE 'بازدید مهمان%') THEN 'guest'
  WHEN n.actor_user_id IS NULL THEN 'system'
  WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=n.actor_user_id AND r.role NOT IN ('user','contractor')) THEN 'admin'
  ELSE 'customer' END,
  actor_name = (SELECT full_name FROM public.profiles p WHERE p.user_id=n.actor_user_id)
WHERE actor_source IS NULL;