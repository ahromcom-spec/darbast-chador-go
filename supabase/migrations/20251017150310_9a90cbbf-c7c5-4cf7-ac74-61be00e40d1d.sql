-- افزودن زیرمجموعه "زیرمجموعه‌ای وجود ندارد" برای سیمانکاری ساختمان
INSERT INTO public.subcategories (service_type_id, code, name, is_active)
VALUES (
  '00189d49-b412-4616-b0ef-a974fa81380c',
  'none',
  'زیرمجموعه‌ای وجود ندارد',
  true
)
ON CONFLICT (service_type_id, code) DO NOTHING;