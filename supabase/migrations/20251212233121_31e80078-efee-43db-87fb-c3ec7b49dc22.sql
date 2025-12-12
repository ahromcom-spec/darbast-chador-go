-- Fix RLS policies on project_media so that customers can see their own media again
-- and managers can continue to manage media across all orders without conflicts

-- 1) Drop existing conflicting policies
DROP POLICY IF EXISTS "All managers can view project media" ON public.project_media;
DROP POLICY IF EXISTS "Managers can upload project media" ON public.project_media;
DROP POLICY IF EXISTS "Managers can delete project media" ON public.project_media;
DROP POLICY IF EXISTS "Users can view own project media" ON public.project_media;
DROP POLICY IF EXISTS "Users can upload media for own projects" ON public.project_media;
DROP POLICY IF EXISTS "Users can delete their unapproved order media" ON public.project_media;

-- 2) Create unified SELECT policy for both customers and managers
CREATE POLICY "Users and managers can view project media"
ON public.project_media
FOR SELECT
USING (
  -- Customers who own the order
  public.check_order_ownership(project_id, auth.uid())
  OR
  -- All manager roles that should see any project media
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'ceo'::app_role)
  OR public.has_role(auth.uid(), 'general_manager'::app_role)
  OR public.has_role(auth.uid(), 'sales_manager'::app_role)
  OR public.has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  OR public.has_role(auth.uid(), 'finance_manager'::app_role)
);

-- 3) Create unified INSERT policy for customers (own orders) and managers
CREATE POLICY "Users and managers can upload project media"
ON public.project_media
FOR INSERT
WITH CHECK (
  -- Customers: can upload for their own orders only
  (
    auth.uid() = user_id
    AND public.check_order_ownership(project_id, auth.uid())
  )
  OR
  -- Managers: can upload for any order
  (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'ceo'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
    OR public.has_role(auth.uid(), 'sales_manager'::app_role)
    OR public.has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
    OR public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
    OR public.has_role(auth.uid(), 'finance_manager'::app_role)
  )
);

-- 4) Create unified DELETE policy for customers (own, unapproved) and managers (any)
CREATE POLICY "Users and managers can delete project media"
ON public.project_media
FOR DELETE
USING (
  -- Customers: can delete their own media only while order is not yet approved
  (
    auth.uid() = user_id
    AND public.check_order_ownership(project_id, auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.projects_v3
      WHERE projects_v3.id = project_media.project_id
        AND projects_v3.approved_at IS NULL
    )
  )
  OR
  -- Managers: can delete any media, regardless of approval status
  (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'ceo'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
    OR public.has_role(auth.uid(), 'sales_manager'::app_role)
    OR public.has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
    OR public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
    OR public.has_role(auth.uid(), 'finance_manager'::app_role)
  )
);
