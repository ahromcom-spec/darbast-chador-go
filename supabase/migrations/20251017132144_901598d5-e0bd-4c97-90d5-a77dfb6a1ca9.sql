-- غیرفعال کردن تمام زیرمجموعه‌های قدیمی داربست فلزی
UPDATE subcategories
SET is_active = false
WHERE service_type_id = (
  SELECT id FROM service_types_v3 WHERE name = 'داربست فلزی' LIMIT 1
)
AND code NOT IN (
  'scaffolding_with_materials_and_transport',
  'scaffolding_without_materials',
  'scaffolding_materials_purchase_sale',
  'scaffolding_materials_rental',
  'scaffolding_materials_production'
);

-- اطمینان از فعال بودن 5 زیرمجموعه جدید
UPDATE subcategories
SET is_active = true
WHERE service_type_id = (
  SELECT id FROM service_types_v3 WHERE name = 'داربست فلزی' LIMIT 1
)
AND code IN (
  'scaffolding_with_materials_and_transport',
  'scaffolding_without_materials',
  'scaffolding_materials_purchase_sale',
  'scaffolding_materials_rental',
  'scaffolding_materials_production'
);