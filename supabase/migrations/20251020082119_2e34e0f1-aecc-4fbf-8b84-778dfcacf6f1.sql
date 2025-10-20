-- Create atomic project creation function to avoid duplicate code conflicts
CREATE OR REPLACE FUNCTION public.create_project_v3(
  _customer_id uuid,
  _province_id uuid,
  _district_id uuid,
  _subcategory_id uuid,
  _hierarchy_project_id uuid,
  _address text,
  _detailed_address text,
  _notes jsonb DEFAULT NULL
)
RETURNS TABLE(id uuid, code text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_project_number text;
  v_service_code text;
  v_project_id uuid;
  attempts int := 0;
BEGIN
  LOOP
    attempts := attempts + 1;
    -- Generate candidate code
    v_code := public.generate_project_code(_customer_id, _province_id, _subcategory_id);
    BEGIN
      v_project_number := split_part(v_code, '/', 2);
      v_service_code := split_part(v_code, '/', 3);

      INSERT INTO public.projects_v3 (
        customer_id, province_id, district_id, subcategory_id, hierarchy_project_id,
        code, project_number, service_code, address, detailed_address, notes, status
      ) VALUES (
        _customer_id, _province_id, _district_id, _subcategory_id, _hierarchy_project_id,
        v_code, v_project_number, v_service_code, _address, _detailed_address, _notes, 'pending'
      ) RETURNING id INTO v_project_id;

      -- Success, return inserted row
      id := v_project_id;
      code := v_code;
      RETURN NEXT;
    EXCEPTION WHEN unique_violation THEN
      -- If code already exists, retry a few times
      IF attempts >= 5 THEN
        RAISE;
      END IF;
      -- continue loop to get a new generated code
    END;
  END LOOP;
END;
$$;