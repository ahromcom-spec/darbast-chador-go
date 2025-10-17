-- Delete old inactive subcategories for all service types
DELETE FROM subcategories WHERE is_active = false;

-- Now update remaining subcategory codes to numeric format
-- داربست فلزی
UPDATE subcategories SET code = '10' WHERE code = 'scaffolding_with_materials_and_transport';
UPDATE subcategories SET code = '20' WHERE code = 'scaffolding_without_materials';
UPDATE subcategories SET code = '30' WHERE code = 'scaffolding_materials_rental';
UPDATE subcategories SET code = '40' WHERE code = 'scaffolding_materials_purchase_sale';
UPDATE subcategories SET code = '50' WHERE code = 'scaffolding_materials_production';

-- چادر برزنتی  
UPDATE subcategories SET code = '10' WHERE code = 'tarpaulin_full_service';
UPDATE subcategories SET code = '20' WHERE code = 'tarpaulin_installation_only';
UPDATE subcategories SET code = '30' WHERE code = 'tarpaulin_rental';
UPDATE subcategories SET code = '40' WHERE code = 'tarpaulin_sales';
UPDATE subcategories SET code = '50' WHERE code = 'tarpaulin_production';

-- Other
UPDATE subcategories SET code = '10' WHERE code = 'none';