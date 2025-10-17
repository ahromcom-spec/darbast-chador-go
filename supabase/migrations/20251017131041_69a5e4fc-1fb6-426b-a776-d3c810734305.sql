-- Add new subcategories for Metal Scaffolding without deleting existing ones
DO $$
DECLARE
  v_service_type_id uuid;
BEGIN
  -- Get or create service type ID
  SELECT id INTO v_service_type_id 
  FROM service_types_v3 
  WHERE name = 'داربست فلزی' OR code = 'metal_scaffolding'
  LIMIT 1;

  IF v_service_type_id IS NULL THEN
    INSERT INTO service_types_v3 (name, code, is_active)
    VALUES ('داربست فلزی', 'metal_scaffolding', true)
    RETURNING id INTO v_service_type_id;
  END IF;

  -- Insert new subcategories (will ignore if code already exists)
  INSERT INTO subcategories (service_type_id, name, code, is_active) VALUES
  (v_service_type_id, 'خدمات اجراء داربست به همراه اجناس داربست و محلی و نقل', 'scaffolding_with_materials_and_transport', true)
  ON CONFLICT (service_type_id, code) DO UPDATE SET 
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

  INSERT INTO subcategories (service_type_id, name, code, is_active) VALUES
  (v_service_type_id, 'خدمات اجراء داربست بدون اجناس داربست', 'scaffolding_without_materials', true)
  ON CONFLICT (service_type_id, code) DO UPDATE SET 
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

  INSERT INTO subcategories (service_type_id, name, code, is_active) VALUES
  (v_service_type_id, 'خدمات خرید و فروش اجناس داربست', 'scaffolding_materials_purchase_sale', true)
  ON CONFLICT (service_type_id, code) DO UPDATE SET 
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

  INSERT INTO subcategories (service_type_id, name, code, is_active) VALUES
  (v_service_type_id, 'خدمات کرایه اجناس داربست فلزی', 'scaffolding_materials_rental', true)
  ON CONFLICT (service_type_id, code) DO UPDATE SET 
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

  INSERT INTO subcategories (service_type_id, name, code, is_active) VALUES
  (v_service_type_id, 'خدمات تولید اجناس داربست فلزی', 'scaffolding_materials_production', true)
  ON CONFLICT (service_type_id, code) DO UPDATE SET 
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

END $$;