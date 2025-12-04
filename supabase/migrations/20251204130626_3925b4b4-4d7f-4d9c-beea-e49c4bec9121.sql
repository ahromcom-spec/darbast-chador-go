-- Drop existing policies and recreate with all manager roles
DROP POLICY IF EXISTS "Staff can view all project media" ON project_media;
DROP POLICY IF EXISTS "Executive managers can view all project media" ON project_media;

-- Create comprehensive view policy for all staff/managers
CREATE POLICY "All managers can view project media"
ON project_media
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'ceo'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'sales_manager'::app_role) OR
  has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR 
  has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR
  has_role(auth.uid(), 'finance_manager'::app_role)
);

-- Allow managers to upload media for orders
CREATE POLICY "Managers can upload project media"
ON project_media
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'ceo'::app_role) OR 
    has_role(auth.uid(), 'general_manager'::app_role) OR
    has_role(auth.uid(), 'sales_manager'::app_role) OR
    has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR 
    has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  )
);

-- Allow managers to delete project media
CREATE POLICY "Managers can delete project media"
ON project_media
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'ceo'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'sales_manager'::app_role) OR
  has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR 
  has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
);