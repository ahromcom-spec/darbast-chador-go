-- تغییر نام زیرمجموعه داربست فلزی از "محلی" به "حمل"
UPDATE subcategories
SET name = 'خدمات اجراء داربست به همراه اجناس داربست و حمل و نقل'
WHERE service_type_id = (
  SELECT id FROM service_types_v3 WHERE code = '10' LIMIT 1
)
AND code = '01';