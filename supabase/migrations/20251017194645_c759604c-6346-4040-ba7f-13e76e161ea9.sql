-- Map all old subcategories to new ones
-- کد 10 قدیمی (نصب با مصالح) -> scaffolding_with_materials_and_transport
UPDATE projects_v3 p
SET subcategory_id = (
  SELECT id FROM subcategories 
  WHERE code = 'scaffolding_with_materials_and_transport' 
    AND service_type_id = '37726fa7-7679-42f0-b893-4893b654e694'
  LIMIT 1
)
WHERE p.subcategory_id IN (
  SELECT id FROM subcategories 
  WHERE service_type_id = '37726fa7-7679-42f0-b893-4893b654e694' 
    AND is_active = false
    AND code = '10'
);

-- کد 11 قدیمی (نصب بدون مصالح) -> scaffolding_without_materials
UPDATE projects_v3 p
SET subcategory_id = (
  SELECT id FROM subcategories 
  WHERE code = 'scaffolding_without_materials' 
    AND service_type_id = '37726fa7-7679-42f0-b893-4893b654e694'
  LIMIT 1
)
WHERE p.subcategory_id IN (
  SELECT id FROM subcategories 
  WHERE service_type_id = '37726fa7-7679-42f0-b893-4893b654e694' 
    AND is_active = false
    AND code = '11'
);

-- Update any remaining old codes to scaffolding_with_materials_and_transport
UPDATE projects_v3 p
SET subcategory_id = (
  SELECT id FROM subcategories 
  WHERE code = 'scaffolding_with_materials_and_transport' 
    AND service_type_id = '37726fa7-7679-42f0-b893-4893b654e694'
  LIMIT 1
)
WHERE p.subcategory_id IN (
  SELECT id FROM subcategories 
  WHERE service_type_id = '37726fa7-7679-42f0-b893-4893b654e694' 
    AND is_active = false
);

-- Delete old inactive subcategories
DELETE FROM subcategories 
WHERE service_type_id = '37726fa7-7679-42f0-b893-4893b654e694' 
  AND is_active = false;