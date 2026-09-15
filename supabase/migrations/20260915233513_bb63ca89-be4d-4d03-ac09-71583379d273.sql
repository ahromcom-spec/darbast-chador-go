insert into public.module_assignments (module_key, module_name, assigned_phone_number, assigned_user_id, assigned_by, module_href, module_description, is_active)
select 'help_videos', 'ماژول فیلم‌های آموزشی سایت', '09125511494', p.user_id, p.user_id, '/help-videos', 'آپلود و اتصال فیلم‌های راهنما به هر بخش سایت (صفحه نخست، پروفایل، فرم‌ها و...)', true
from public.profiles p
where p.phone_number = '09125511494'
and not exists (
  select 1 from public.module_assignments ma
  where ma.module_key = 'help_videos' and ma.assigned_phone_number = '09125511494' and ma.is_active = true
);