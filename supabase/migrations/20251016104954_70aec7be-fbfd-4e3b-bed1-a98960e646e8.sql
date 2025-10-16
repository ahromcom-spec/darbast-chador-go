-- اضافه کردن مدیرعامل با تمام دسترسی‌ها
INSERT INTO public.phone_whitelist (phone_number, allowed_roles, notes, added_by)
VALUES (
  '09125511494',
  ARRAY['ceo', 'admin', 'general_manager', 'operations_manager', 'finance_manager', 'warehouse_manager']::text[],
  'مدیرعامل - دسترسی کامل به تمام عملیات',
  NULL
)
ON CONFLICT (phone_number) 
DO UPDATE SET 
  allowed_roles = ARRAY['ceo', 'admin', 'general_manager', 'operations_manager', 'finance_manager', 'warehouse_manager']::text[],
  notes = 'مدیرعامل - دسترسی کامل به تمام عملیات',
  updated_at = now();