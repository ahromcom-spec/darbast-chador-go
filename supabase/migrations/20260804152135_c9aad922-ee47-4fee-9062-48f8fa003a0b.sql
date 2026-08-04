CREATE OR REPLACE FUNCTION public.recalc_location_active_for_hierarchy(_hierarchy_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _loc uuid;
  _cnt int;
BEGIN
  IF _hierarchy_id IS NULL THEN RETURN; END IF;
  SELECT location_id INTO _loc FROM public.projects_hierarchy WHERE id = _hierarchy_id;
  IF _loc IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO _cnt
  FROM public.projects_v3 p
  WHERE p.hierarchy_project_id = _hierarchy_id
    AND coalesce(p.is_archived, false) = false
    AND coalesce(p.is_deep_archived, false) = false
    AND p.status <> 'rejected';
  UPDATE public.locations SET is_active = (_cnt > 0) WHERE id = _loc;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_location_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_location_active_for_hierarchy(OLD.hierarchy_project_id);
    RETURN OLD;
  END IF;
  PERFORM public.recalc_location_active_for_hierarchy(NEW.hierarchy_project_id);
  IF TG_OP = 'UPDATE' AND OLD.hierarchy_project_id IS DISTINCT FROM NEW.hierarchy_project_id THEN
    PERFORM public.recalc_location_active_for_hierarchy(OLD.hierarchy_project_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_location_active_on_orders ON public.projects_v3;
CREATE TRIGGER sync_location_active_on_orders
AFTER INSERT OR UPDATE OF is_archived, is_deep_archived, status, hierarchy_project_id OR DELETE
ON public.projects_v3
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_location_active();

-- Backfill all locations
UPDATE public.locations l
SET is_active = EXISTS (
  SELECT 1 FROM public.projects_v3 p
  JOIN public.projects_hierarchy ph ON ph.id = p.hierarchy_project_id
  WHERE ph.location_id = l.id
    AND coalesce(p.is_archived, false) = false
    AND coalesce(p.is_deep_archived, false) = false
    AND p.status <> 'rejected'
)
WHERE EXISTS (SELECT 1 FROM public.projects_hierarchy ph2 WHERE ph2.location_id = l.id);