-- Allow users to delete their own projects_hierarchy that have no orders
CREATE POLICY "Users can delete own projects without orders"
ON public.projects_hierarchy
FOR DELETE
USING (
  auth.uid() = user_id 
  AND NOT EXISTS (
    SELECT 1 
    FROM projects_v3 
    WHERE projects_v3.hierarchy_project_id = projects_hierarchy.id
  )
);