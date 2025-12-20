-- Fix RLS policies for module_assignments to require authenticated users and avoid recursive RLS by using has_role()

-- Drop old policies
DROP POLICY IF EXISTS "CEOs can view all module assignments" ON public.module_assignments;
DROP POLICY IF EXISTS "CEOs can insert module assignments" ON public.module_assignments;
DROP POLICY IF EXISTS "CEOs can update module assignments" ON public.module_assignments;
DROP POLICY IF EXISTS "CEOs can delete module assignments" ON public.module_assignments;

-- Recreate policies (CEO only)
CREATE POLICY "CEOs can view all module assignments"
ON public.module_assignments
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "CEOs can insert module assignments"
ON public.module_assignments
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "CEOs can update module assignments"
ON public.module_assignments
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "CEOs can delete module assignments"
ON public.module_assignments
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'ceo'::app_role));

-- Ensure assigned_by is always set on insert/update from app layer (defensive)
ALTER TABLE public.module_assignments ALTER COLUMN assigned_by SET NOT NULL;