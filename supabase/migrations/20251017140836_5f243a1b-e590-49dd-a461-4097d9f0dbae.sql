-- اصلاح نام زیرمجموعه داربست فلزی: محلی → حمل
UPDATE subcategories
SET name = REPLACE(name, 'محلی', 'حمل')
WHERE service_type_id = (
  SELECT id FROM service_types_v3 WHERE code = '10' LIMIT 1
)
AND code = 'scaffolding_with_materials_and_transport';