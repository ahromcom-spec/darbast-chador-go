-- Fix: Restrict staff access to non-draft projects only
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Staff can view all projects" ON public.projects_v3;

-- Create separate policies for better security
-- Admins and GMs can see all projects (including drafts)
CREATE POLICY "Admins and GMs can view all projects"
ON public.projects_v3
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role)
);

-- Staff can only view non-draft projects
CREATE POLICY "Staff can view non-draft projects"
ON public.projects_v3
FOR SELECT
USING (
  status != 'draft'::project_status_v3 AND 
  EXISTS (
    SELECT 1 
    FROM public.staff_roles 
    WHERE user_id = auth.uid() AND active = true
  )
);