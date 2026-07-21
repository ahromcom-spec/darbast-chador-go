
-- Backfill: deactivate locations whose all orders are archived
UPDATE public.locations l
SET is_active = false
WHERE l.is_active = true
  AND EXISTS (SELECT 1 FROM public.projects_hierarchy ph WHERE ph.location_id = l.id)
  AND NOT EXISTS (
    SELECT 1
    FROM public.projects_hierarchy ph
    JOIN public.projects_v3 pv ON pv.hierarchy_project_id = ph.id
    WHERE ph.location_id = l.id
      AND (pv.is_archived IS NULL OR pv.is_archived = false)
  );
