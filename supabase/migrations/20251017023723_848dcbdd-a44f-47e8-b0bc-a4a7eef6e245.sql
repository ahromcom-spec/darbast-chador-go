-- به‌روزرسانی notes و نقش‌های شماره‌های تستی مطابق با جدول

-- مدیریت کل
UPDATE public.phone_whitelist
SET notes = 'مدیریت کل'
WHERE phone_number = 'aaa11111111';

-- مدیریت اجرای خدمات داربست به همراه اجناس
UPDATE public.phone_whitelist
SET 
  allowed_roles = ARRAY['scaffold_operations_manager', 'warehouse_manager'],
  notes = 'مدیریت اجرای خدمات داربست به همراه اجناس'
WHERE phone_number = 'bbb11111111';