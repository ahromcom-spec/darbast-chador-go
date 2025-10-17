-- Drop unique constraint temporarily
ALTER TABLE subcategories DROP CONSTRAINT IF EXISTS subcategories_code_service_type_id_key;

-- Update subcategory codes to numeric format (order matters to avoid conflicts)
-- داربست فلزی (service_type_id: 37726fa7-7679-42f0-b893-4893b654e694)
UPDATE subcategories SET code = '10' WHERE id = '3b44e5ee-8a2c-4e50-8f70-df753df8ef3d'; -- scaffolding_with_materials_and_transport
UPDATE subcategories SET code = '20' WHERE id = '527e9baa-54c6-4131-81cb-32d29ebae91a'; -- scaffolding_without_materials
UPDATE subcategories SET code = '30' WHERE id = '5dbe340f-5f16-41d4-ad8f-3d33cc43b063'; -- scaffolding_materials_rental
UPDATE subcategories SET code = '40' WHERE id = '8aa0e080-4f7c-485b-b4ef-fa25c3d2469e'; -- scaffolding_materials_purchase_sale
UPDATE subcategories SET code = '50' WHERE id = '92f4d56e-781f-48cb-8624-4e4bbd6d9540'; -- scaffolding_materials_production

-- چادر برزنتی (service_type_id: c634bd3d-1e7f-4df6-950b-540671a91052)
UPDATE subcategories SET code = '10' WHERE id = '78eabdc2-794c-45aa-8d9b-f98110030fe2'; -- tarpaulin_full_service
UPDATE subcategories SET code = '20' WHERE id = '216f586b-45a5-40fc-800b-ce9356306930'; -- tarpaulin_installation_only
UPDATE subcategories SET code = '30' WHERE id = 'ad99d194-14d9-4a4a-b585-f7b5f5b2c9af'; -- tarpaulin_rental
UPDATE subcategories SET code = '40' WHERE id = 'a172cc10-0ff5-4ee8-b6cd-6e343cad47b8'; -- tarpaulin_sales
UPDATE subcategories SET code = '50' WHERE id = 'fc480b29-990a-4b73-903f-80a4a069ed91'; -- tarpaulin_production

-- سیمانکاری
UPDATE subcategories SET code = '10' WHERE id = '2ca6ce77-daf5-4ed7-81fd-081438a7b482'; -- none

-- Re-add unique constraint
ALTER TABLE subcategories ADD CONSTRAINT subcategories_code_service_type_id_key UNIQUE (code, service_type_id);