-- غیرفعال کردن زیرمجموعه‌های قبلی چادر برزنتی
UPDATE subcategories
SET is_active = false
WHERE service_type_id = (
  SELECT id FROM service_types_v3 WHERE code = '02' LIMIT 1
);

-- اضافه کردن زیرمجموعه‌های جدید چادر برزنتی
INSERT INTO subcategories (service_type_id, name, code, is_active)
SELECT 
  id,
  'خدمات اجراء و گرایه چادر برزنتی به همراه اجناس و محل و نقل',
  'tarpaulin_full_service',
  true
FROM service_types_v3 WHERE code = '02'
UNION ALL
SELECT 
  id,
  'خدمات اجراء چادر برزنتی بدون چادر برزنتی',
  'tarpaulin_installation_only',
  true
FROM service_types_v3 WHERE code = '02'
UNION ALL
SELECT 
  id,
  'خدمات خرید و فروش چادر برزنتی',
  'tarpaulin_sales',
  true
FROM service_types_v3 WHERE code = '02'
UNION ALL
SELECT 
  id,
  'خدمات گرایه چادر برزنتی',
  'tarpaulin_rental',
  true
FROM service_types_v3 WHERE code = '02'
UNION ALL
SELECT 
  id,
  'خدمات تولید چادر برزنتی',
  'tarpaulin_production',
  true
FROM service_types_v3 WHERE code = '02';