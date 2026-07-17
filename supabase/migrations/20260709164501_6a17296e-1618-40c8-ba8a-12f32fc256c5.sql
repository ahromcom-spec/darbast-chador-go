CREATE OR REPLACE FUNCTION public.sync_project_v3_location_to_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _location_id uuid;
  _address text;
  _detailed_address text;
  _combined_address text;
BEGIN
  IF NEW.hierarchy_project_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NOT (
    NEW.hierarchy_project_id IS DISTINCT FROM OLD.hierarchy_project_id OR
    NEW.address IS DISTINCT FROM OLD.address OR
    NEW.detailed_address IS DISTINCT FROM OLD.detailed_address OR
    NEW.location_lat IS DISTINCT FROM OLD.location_lat OR
    NEW.location_lng IS DISTINCT FROM OLD.location_lng
  ) THEN
    RETURN NEW;
  END IF;

  SELECT ph.location_id
    INTO _location_id
  FROM public.projects_hierarchy ph
  WHERE ph.id = NEW.hierarchy_project_id;

  IF _location_id IS NULL THEN
    RETURN NEW;
  END IF;

  _address := btrim(COALESCE(NEW.address, ''));
  _detailed_address := btrim(COALESCE(NEW.detailed_address, ''));

  _combined_address := CASE
    WHEN _address <> '' AND _detailed_address <> '' AND _detailed_address <> _address
      THEN _address || '، ' || _detailed_address
    WHEN _address <> '' THEN _address
    WHEN _detailed_address <> '' THEN _detailed_address
    ELSE NULL
  END;

  UPDATE public.locations
  SET
    address_line = COALESCE(_combined_address, address_line),
    lat = CASE WHEN NEW.location_lat IS NOT NULL THEN NEW.location_lat ELSE lat END,
    lng = CASE WHEN NEW.location_lng IS NOT NULL THEN NEW.location_lng ELSE lng END,
    updated_at = now()
  WHERE id = _location_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_project_v3_location_to_hierarchy_trigger ON public.projects_v3;

CREATE TRIGGER sync_project_v3_location_to_hierarchy_trigger
AFTER INSERT OR UPDATE OF hierarchy_project_id, address, detailed_address, location_lat, location_lng
ON public.projects_v3
FOR EACH ROW
EXECUTE FUNCTION public.sync_project_v3_location_to_hierarchy();