
-- Drop existing INSERT policy that has recursive RLS issues
DROP POLICY IF EXISTS "Users can upload media for own projects" ON public.project_media;

-- Create simpler INSERT policy using the existing check_order_ownership function
CREATE POLICY "Users can upload media for own projects" 
ON public.project_media
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND public.check_order_ownership(project_id, auth.uid())
);

-- Ensure we have a proper RLS policy for SELECT that also uses the function
DROP POLICY IF EXISTS "Users can view own project media" ON public.project_media;
DROP POLICY IF EXISTS "Project owners can view project media" ON public.project_media;

CREATE POLICY "Users can view own project media" 
ON public.project_media
FOR SELECT
USING (
  public.check_order_ownership(project_id, auth.uid())
);

-- Update DELETE policy to also use the function
DROP POLICY IF EXISTS "Users can delete their unapproved order media" ON public.project_media;

CREATE POLICY "Users can delete their unapproved order media" 
ON public.project_media
FOR DELETE
USING (
  user_id = auth.uid() 
  AND public.check_order_ownership(project_id, auth.uid())
  AND EXISTS (
    SELECT 1 FROM projects_v3 
    WHERE id = project_media.project_id 
    AND approved_at IS NULL
  )
);
