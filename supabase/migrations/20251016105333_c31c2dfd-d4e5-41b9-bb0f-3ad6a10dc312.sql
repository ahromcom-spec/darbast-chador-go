-- ساده‌سازی نقش‌های مدیرعامل - حذف نقش‌های تکراری
-- نقش admin شامل تمام دسترسی‌های operations_manager, finance_manager, و warehouse_manager است
UPDATE public.phone_whitelist 
SET allowed_roles = ARRAY['ceo', 'admin']::text[],
    notes = 'مدیرعامل - دسترسی کامل (نقش admin شامل همه دسترسی‌ها)',
    updated_at = now()
WHERE phone_number = '09125511494';