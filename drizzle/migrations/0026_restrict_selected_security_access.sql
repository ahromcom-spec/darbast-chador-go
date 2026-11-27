REVOKE EXECUTE ON FUNCTION public.attach_activity_trigger(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attach_activity_trigger(text, text) TO service_role;

ALTER POLICY "Authenticated users can view profile photos" ON public.profile_photos
TO authenticated
USING (user_id = (SELECT auth.uid()) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'ceo'::public.app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'general_manager'::public.app_role)));

ALTER POLICY "messenger_settings_select_auth" ON public.messenger_settings
TO authenticated
USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'ceo'::public.app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'general_manager'::public.app_role)));

ALTER POLICY "Authenticated can read sms templates" ON public.sms_templates
TO authenticated
USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'ceo'::public.app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'general_manager'::public.app_role)));