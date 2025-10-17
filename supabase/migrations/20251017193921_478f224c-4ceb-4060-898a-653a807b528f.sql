-- Deactivate textual subcategory codes for scaffolding service type to ensure numeric codes are used
-- We keep only two-digit numeric codes active

-- Find scaffolding service type id (code = '1010')
WITH st AS (
  SELECT id FROM service_types_v3 WHERE code = '1010' LIMIT 1
)
UPDATE subcategories sc
SET is_active = false
FROM st
WHERE sc.service_type_id = st.id
  AND sc.is_active = true
  AND sc.code !~ '^[0-9]{2}$';