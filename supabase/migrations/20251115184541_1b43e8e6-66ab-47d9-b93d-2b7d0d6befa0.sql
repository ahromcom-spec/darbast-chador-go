-- Drop existing policy if exists first, then create new one
DROP POLICY IF EXISTS "Executive managers can view all project media" ON project_media;

CREATE POLICY "Executive managers can view all project media"
ON project_media
FOR SELECT
USING (
  has_role(auth.uid(), 'scaffold_executive_manager'::app_role) 
  OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
);