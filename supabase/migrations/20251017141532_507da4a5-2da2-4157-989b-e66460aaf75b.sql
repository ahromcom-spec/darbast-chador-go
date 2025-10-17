-- إضافة خدمة سیمانکاری ساختمان
INSERT INTO service_types_v3 (name, code, is_active)
VALUES ('سیمانکاری ساختمان', '60', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = true;

-- إضافة زیرمجموعة افتراضیة لسیمانکاری ساختمان
INSERT INTO subcategories (service_type_id, name, code, is_active)
SELECT id, 'سیمانکاری داخلی و خارجی', 'plastering_interior_exterior', true
FROM service_types_v3
WHERE code = '60'
ON CONFLICT DO NOTHING;