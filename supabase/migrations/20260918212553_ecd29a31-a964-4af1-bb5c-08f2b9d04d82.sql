DROP POLICY IF EXISTS "Collaborators can view hierarchy of accepted orders" ON public.projects_hierarchy;
CREATE POLICY "Collaborators can view hierarchy of accepted orders"
ON public.projects_hierarchy
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects_v3 pv
    JOIN public.order_collaborators oc ON oc.order_id = pv.id
    WHERE pv.hierarchy_project_id = projects_hierarchy.id
      AND oc.status IN ('accepted', 'approved')
      AND (
        oc.invitee_user_id = auth.uid()
        OR oc.invitee_phone_number = (SELECT p.phone_number FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1)
      )
  )
);

DROP POLICY IF EXISTS "Collaborators can view locations of accepted orders" ON public.locations;
CREATE POLICY "Collaborators can view locations of accepted orders"
ON public.locations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects_hierarchy ph
    JOIN public.projects_v3 pv ON pv.hierarchy_project_id = ph.id
    JOIN public.order_collaborators oc ON oc.order_id = pv.id
    WHERE ph.location_id = locations.id
      AND oc.status IN ('accepted', 'approved')
      AND (
        oc.invitee_user_id = auth.uid()
        OR oc.invitee_phone_number = (SELECT p.phone_number FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1)
      )
  )
);