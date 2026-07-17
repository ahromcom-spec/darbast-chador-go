
-- Allow accepted collaborators to view the project's hierarchy and location
-- so collaboration orders appear on the recipient's globe map.

CREATE POLICY "Collaborators can view hierarchy of accepted orders"
ON public.projects_hierarchy
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.projects_v3 pv
    JOIN public.order_collaborators oc ON oc.order_id = pv.id
    WHERE pv.hierarchy_project_id = projects_hierarchy.id
      AND oc.invitee_user_id = auth.uid()
      AND oc.status IN ('accepted', 'approved')
  )
);

CREATE POLICY "Collaborators can view locations of accepted orders"
ON public.locations
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.projects_hierarchy ph
    JOIN public.projects_v3 pv ON pv.hierarchy_project_id = ph.id
    JOIN public.order_collaborators oc ON oc.order_id = pv.id
    WHERE ph.location_id = locations.id
      AND oc.invitee_user_id = auth.uid()
      AND oc.status IN ('accepted', 'approved')
  )
);
