-- Allow executive managers to view historical orders (paid/closed)
-- This addresses visibility of previously completed orders in executive tabs

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'projects_v3' AND policyname = 'Executive managers can view paid and closed'
  ) THEN
    CREATE POLICY "Executive managers can view paid and closed"
    ON public.projects_v3
    FOR SELECT
    USING (
      (has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role))
      AND (status = ANY (ARRAY['paid'::project_status_v3, 'closed'::project_status_v3]))
    );
  END IF;
END $$;