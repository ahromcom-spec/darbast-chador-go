UPDATE public.locations l
SET is_active = true
WHERE l.is_active = false
  AND EXISTS (
    SELECT 1
    FROM public.projects_hierarchy ph
    JOIN public.projects_v3 p ON p.hierarchy_project_id = ph.id
    WHERE ph.location_id = l.id
      AND p.status <> 'rejected'
      AND COALESCE(p.is_archived, false) = false
      AND COALESCE(p.is_deep_archived, false) = false
  );