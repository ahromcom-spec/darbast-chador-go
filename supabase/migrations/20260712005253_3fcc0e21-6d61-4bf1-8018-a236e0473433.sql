DROP FUNCTION IF EXISTS public.create_project_v3(uuid, uuid, uuid, uuid, uuid, text, text, text, double precision, double precision);
DROP FUNCTION IF EXISTS public.create_project_v3(uuid, uuid, uuid, uuid, uuid, text, text, jsonb);
DROP FUNCTION IF EXISTS public.create_project_v3(uuid, uuid, uuid, uuid, uuid, text, text, jsonb, double precision, double precision);

CREATE OR REPLACE FUNCTION public.create_project_v3(
  _customer_id uuid,
  _province_id uuid,
  _district_id uuid,
  _subcategory_id uuid,
  _hierarchy_project_id uuid,
  _address text,
  _detailed_address text DEFAULT NULL::text,
  _notes jsonb DEFAULT NULL::jsonb,
  _location_lat double precision DEFAULT NULL::double precision,
  _location_lng double precision DEFAULT NULL::double precision
)
RETURNS SETOF public.projects_v3
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _code text;
  _customer_user_id uuid;
  _customer_name text;
  _customer_phone text;
  _resolved_location_lat double precision;
  _resolved_location_lng double precision;
  _location_id uuid;
  _notes_text text;
BEGIN
  IF _hierarchy_project_id IS NULL THEN
    RAISE EXCEPTION 'hierarchy_project_id is required for creating an order';
  END IF;

  SELECT user_id INTO _customer_user_id
  FROM public.customers
  WHERE id = _customer_id;

  IF _customer_user_id IS NOT NULL THEN
    SELECT full_name, phone_number
    INTO _customer_name, _customer_phone
    FROM public.profiles
    WHERE user_id = _customer_user_id;
  END IF;

  SELECT l.id, l.lat, l.lng
  INTO _location_id, _resolved_location_lat, _resolved_location_lng
  FROM public.projects_hierarchy ph
  JOIN public.locations l ON l.id = ph.location_id
  WHERE ph.id = _hierarchy_project_id;

  IF _location_id IS NOT NULL THEN
    UPDATE public.locations
    SET is_active = true
    WHERE id = _location_id AND is_active = false;
  END IF;

  IF _notes IS NULL THEN
    _notes_text := NULL;
  ELSIF jsonb_typeof(_notes) = 'string' THEN
    _notes_text := _notes #>> '{}';
  ELSE
    _notes_text := _notes::text;
  END IF;

  _code := LPAD(nextval('public.project_code_seq')::text, 7, '0');

  RETURN QUERY
  INSERT INTO public.projects_v3 (
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
    _notes_text,
    _code,
    'pending',
    _customer_name,
    _customer_phone,
    COALESCE(_location_lat, _resolved_location_lat),
    COALESCE(_location_lng, _resolved_location_lng)
  )
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_project_v3(uuid, uuid, uuid, uuid, uuid, text, text, jsonb, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_project_v3(uuid, uuid, uuid, uuid, uuid, text, text, jsonb, double precision, double precision) TO service_role;