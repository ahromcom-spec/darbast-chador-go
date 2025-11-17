-- Update create_project_v3 function to populate denormalized customer and location data
CREATE OR REPLACE FUNCTION create_project_v3(
  _customer_id UUID,
  _province_id UUID,
  _district_id UUID,
  _subcategory_id UUID,
  _hierarchy_project_id UUID,
  _address TEXT,
  _detailed_address TEXT DEFAULT NULL,
  _notes JSONB DEFAULT NULL
)
RETURNS SETOF projects_v3
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _code TEXT;
  _customer_user_id UUID;
  _customer_name TEXT;
  _customer_phone TEXT;
  _location_lat DOUBLE PRECISION;
  _location_lng DOUBLE PRECISION;
BEGIN
  -- Get customer's user_id
  SELECT user_id INTO _customer_user_id 
  FROM customers 
  WHERE id = _customer_id;

  -- Get customer profile data
  IF _customer_user_id IS NOT NULL THEN
    SELECT full_name, phone_number 
    INTO _customer_name, _customer_phone
    FROM profiles 
    WHERE user_id = _customer_user_id;
  END IF;

  -- Get location coordinates from hierarchy project
  IF _hierarchy_project_id IS NOT NULL THEN
    SELECT l.lat, l.lng
    INTO _location_lat, _location_lng
    FROM projects_hierarchy ph
    JOIN locations l ON l.id = ph.location_id
    WHERE ph.id = _hierarchy_project_id;
  END IF;

  -- Generate unique code
  _code := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');

  -- Insert and return
  RETURN QUERY
  INSERT INTO projects_v3 (
    customer_id,
    province_id,
    district_id,
    subcategory_id,
    hierarchy_project_id,
    address,
    detailed_address,
    notes,
    code,
    status,
    customer_name,
    customer_phone,
    location_lat,
    location_lng
  )
  VALUES (
    _customer_id,
    _province_id,
    _district_id,
    _subcategory_id,
    _hierarchy_project_id,
    _address,
    _detailed_address,
    _notes,
    _code,
    'pending',
    _customer_name,
    _customer_phone,
    _location_lat,
    _location_lng
  )
  RETURNING *;
END;
$$;