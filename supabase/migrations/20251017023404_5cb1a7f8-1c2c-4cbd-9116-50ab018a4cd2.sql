-- حذف constraint فرمت شماره تلفن برای اجازه شماره‌های تستی
ALTER TABLE public.phone_whitelist DROP CONSTRAINT IF EXISTS phone_number_format;

-- اضافه کردن شماره‌های تستی به phone_whitelist
INSERT INTO public.phone_whitelist (phone_number, allowed_roles, notes, added_by)
VALUES 
  -- شماره‌های کل (aaa - دسترسی گسترده)
  ('aaa11111111', ARRAY['admin'], 'شماره تستی - مدیر کل', (SELECT id FROM auth.users LIMIT 1)),
  ('aaa22222222', ARRAY['general_manager'], 'شماره تستی - مدیر کل', (SELECT id FROM auth.users LIMIT 1)),
  ('aaa33333333', ARRAY['operations_manager'], 'شماره تستی - مدیر کل عملیات', (SELECT id FROM auth.users LIMIT 1)),
  ('aaa44444444', ARRAY['logistics_manager'], 'شماره تستی - مدیر کل لجستیک', (SELECT id FROM auth.users LIMIT 1)),
  ('aaa55555555', ARRAY['sales_manager'], 'شماره تستی - مدیر کل فروش', (SELECT id FROM auth.users LIMIT 1)),
  ('aaa66666666', ARRAY['project_manager'], 'شماره تستی - مدیر کل پروژه', (SELECT id FROM auth.users LIMIT 1)),
  ('aaa77777777', ARRAY['ceo'], 'شماره تستی - مدیرعامل', (SELECT id FROM auth.users LIMIT 1)),
  ('aaa88888888', ARRAY['resource_manager'], 'شماره تستی - مدیر کل منابع', (SELECT id FROM auth.users LIMIT 1)),
  ('aaa99999999', ARRAY['finance_manager'], 'شماره تستی - مدیر کل مالی', (SELECT id FROM auth.users LIMIT 1)),
  ('aaa10101010', ARRAY['quality_manager'], 'شماره تستی - مدیر کل کیفیت', (SELECT id FROM auth.users LIMIT 1)),
  ('aaa12121212', ARRAY['procurement_manager'], 'شماره تستی - مدیر کل خرید', (SELECT id FROM auth.users LIMIT 1)),
  ('aaa13131313', ARRAY['customer_service_manager'], 'شماره تستی - مدیر کل خدمات مشتری', (SELECT id FROM auth.users LIMIT 1)),
  ('aaa14141414', ARRAY['technical_manager'], 'شماره تستی - مدیر کل فنی', (SELECT id FROM auth.users LIMIT 1)),
  ('aaa15151515', ARRAY['hr_manager'], 'شماره تستی - مدیر کل منابع انسانی', (SELECT id FROM auth.users LIMIT 1)),
  ('aaa16161616', ARRAY['support_manager', 'security_manager'], 'شماره تستی - مدیر کل پشتیبانی و امنیت', (SELECT id FROM auth.users LIMIT 1)),
  
  -- شماره‌های خدمات اجرایی داربست (bbb - دسترسی محدود به داربست)
  ('bbb11111111', ARRAY['scaffold_supervisor'], 'شماره تستی - سرپرست داربست', (SELECT id FROM auth.users LIMIT 1)),
  ('bbb22222222', ARRAY['scaffold_operations_manager'], 'شماره تستی - مدیر عملیات داربست', (SELECT id FROM auth.users LIMIT 1)),
  ('bbb33333333', ARRAY['scaffold_project_manager'], 'شماره تستی - مدیر پروژه داربست', (SELECT id FROM auth.users LIMIT 1)),
  ('bbb44444444', ARRAY['scaffold_quality_manager'], 'شماره تستی - مدیر کیفیت داربست', (SELECT id FROM auth.users LIMIT 1)),
  ('bbb55555555', ARRAY['warehouse_manager'], 'شماره تستی - مدیر انبار', (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT (phone_number) DO UPDATE
SET 
  allowed_roles = EXCLUDED.allowed_roles,
  notes = EXCLUDED.notes,
  updated_at = now();