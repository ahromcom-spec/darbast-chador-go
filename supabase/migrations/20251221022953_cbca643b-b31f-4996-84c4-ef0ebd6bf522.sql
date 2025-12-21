-- Drop existing policies on daily_reports
DROP POLICY IF EXISTS "CEO and managers can create daily reports" ON public.daily_reports;
DROP POLICY IF EXISTS "CEO and managers can delete own daily reports" ON public.daily_reports;
DROP POLICY IF EXISTS "CEO and managers can update own daily reports" ON public.daily_reports;
DROP POLICY IF EXISTS "CEO and managers can view all daily reports" ON public.daily_reports;

-- Create updated policies that include scaffold_executive_manager
CREATE POLICY "CEO and managers can create daily reports" 
ON public.daily_reports 
FOR INSERT 
WITH CHECK (
  auth.uid() = created_by AND (
    has_role(auth.uid(), 'ceo'::app_role) OR 
    has_role(auth.uid(), 'general_manager'::app_role) OR 
    has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR
    has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  )
);

CREATE POLICY "CEO and managers can delete own daily reports" 
ON public.daily_reports 
FOR DELETE 
USING (
  created_by = auth.uid() AND (
    has_role(auth.uid(), 'ceo'::app_role) OR 
    has_role(auth.uid(), 'general_manager'::app_role) OR 
    has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR
    has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  )
);

CREATE POLICY "CEO and managers can update own daily reports" 
ON public.daily_reports 
FOR UPDATE 
USING (
  created_by = auth.uid() AND (
    has_role(auth.uid(), 'ceo'::app_role) OR 
    has_role(auth.uid(), 'general_manager'::app_role) OR 
    has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR
    has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  )
);

CREATE POLICY "CEO and managers can view all daily reports" 
ON public.daily_reports 
FOR SELECT 
USING (
  has_role(auth.uid(), 'ceo'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role) OR 
  has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR
  has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
);