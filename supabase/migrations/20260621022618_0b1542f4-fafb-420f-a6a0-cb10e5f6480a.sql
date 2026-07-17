
CREATE POLICY "Contractors can view their v3 assignments projects"
ON public.projects_v3
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.project_v3_assignments pa
    JOIN public.contractors c ON c.id = pa.contractor_id
    WHERE pa.project_id = projects_v3.id
      AND c.user_id = auth.uid()
  )
);
