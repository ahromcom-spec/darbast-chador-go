-- Allow project owners to view media uploaded by others on their projects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'project_media' AND policyname = 'Project owners can view project media'
  ) THEN
    CREATE POLICY "Project owners can view project media"
    ON public.project_media
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.projects_v3 p
        JOIN public.customers c ON c.id = p.customer_id
        WHERE p.id = project_media.project_id
          AND c.user_id = auth.uid()
      )
    );
  END IF;
END $$;