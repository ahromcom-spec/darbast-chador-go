
-- Update create_project_v3 to ensure location is always active
CREATE OR REPLACE FUNCTION public.create_project_v3(
  _customer_id uuid, 
  _province_id uuid, 
  _district_id uuid, 
  _subcategory_id uuid, 
  _hierarchy_project_id uuid, 
  _address text, 
  _detailed_address text DEFAULT NULL::text, 
  _notes jsonb DEFAULT NULL::jsonb
)
RETURNS SETOF projects_v3
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _code TEXT;
  _customer_user_id UUID;
  _customer_name TEXT;
  _customer_phone TEXT;
  _location_lat DOUBLE PRECISION;
  _location_lng DOUBLE PRECISION;
  _location_id UUID;
BEGIN
  -- Validate hierarchy project exists
  IF _hierarchy_project_id IS NULL THEN
    RAISE EXCEPTION 'hierarchy_project_id is required for creating an order';
  END IF;

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

  -- Get location coordinates from hierarchy project and ensure location is active
  SELECT l.id, l.lat, l.lng
  INTO _location_id, _location_lat, _location_lng
  FROM projects_hierarchy ph
  JOIN locations l ON l.id = ph.location_id
  WHERE ph.id = _hierarchy_project_id;

  -- Ensure the location is active so it appears on the globe
  IF _location_id IS NOT NULL THEN
    UPDATE locations SET is_active = true WHERE id = _location_id AND is_active = false;
  END IF;

  -- Generate unique 7-digit sequential code starting from 1000100
  _code := LPAD(nextval('project_code_seq')::text, 7, '0');

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
$function$;
