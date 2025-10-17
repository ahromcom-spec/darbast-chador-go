-- غیرفعال کردن زیرمجموعه‌های قبلی چادر برزنتی
UPDATE subcategories
SET is_active = false
WHERE service_type_id = (
  SELECT id FROM service_types_v3 WHERE code = 'tarpaulin' LIMIT 1
);

-- اضافه کردن زیرمجموعه‌های جدید چادر برزنتی
INSERT INTO subcategories (service_type_id, name, code, is_active)
SELECT 
  st.id,
  subcategory.name,
  subcategory.code,
  true
FROM service_types_v3 st,
LATERAL (VALUES
  ('خدمات اجراء و گرایه چادر برزنتی به همراه اجناس و محل و نقل', '01'),
  ('خدمات اجراء چادر برزنتی بدون چادر برزنتی', '02'),
  ('خدمات خرید و فروش چادر برزنتی', '03'),
  ('خدمات گرایه چادر برزنتی', '04'),
  ('خدمات تولید چادر برزنتی', '05')
) AS subcategory(name, code)
WHERE st.code = 'tarpaulin';