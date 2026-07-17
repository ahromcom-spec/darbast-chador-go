INSERT INTO public.module_assignments (module_key, module_name, module_href, module_description, assigned_phone_number, assigned_by, is_active)
SELECT 'user_impersonation', 'ماژول ورود به حساب کاربران', '/admin/users', 'ورود به حساب کاربران سایت برای انجام عملیات به نمایندگی از آن‌ها', '09125511494', p.user_id, true
FROM public.profiles p
WHERE p.phone_number = '09125511494'
LIMIT 1
ON CONFLICT DO NOTHING;