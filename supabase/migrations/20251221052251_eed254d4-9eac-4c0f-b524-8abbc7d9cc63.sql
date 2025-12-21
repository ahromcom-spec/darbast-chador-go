-- Drop existing INSERT policy
DROP POLICY IF EXISTS "CEO and managers can insert salary settings" ON public.staff_salary_settings;

-- Create updated INSERT policy including finance_manager
CREATE POLICY "CEO and managers can insert salary settings" 
  ON public.staff_salary_settings 
  FOR INSERT 
  WITH CHECK (
    has_role(auth.uid(), 'ceo'::app_role) OR 
    has_role(auth.uid(), 'general_manager'::app_role) OR
    has_role(auth.uid(), 'finance_manager'::app_role)
  );

-- Also update UPDATE policy to include finance_manager
DROP POLICY IF EXISTS "CEO and managers can update salary settings" ON public.staff_salary_settings;

CREATE POLICY "CEO and managers can update salary settings" 
  ON public.staff_salary_settings 
  FOR UPDATE 
  USING (
    has_role(auth.uid(), 'ceo'::app_role) OR 
    has_role(auth.uid(), 'general_manager'::app_role) OR
    has_role(auth.uid(), 'finance_manager'::app_role)
  );

-- Also update DELETE policy to include finance_manager
DROP POLICY IF EXISTS "CEO and managers can delete salary settings" ON public.staff_salary_settings;

CREATE POLICY "CEO and managers can delete salary settings" 
  ON public.staff_salary_settings 
  FOR DELETE 
  USING (
    has_role(auth.uid(), 'ceo'::app_role) OR 
    has_role(auth.uid(), 'general_manager'::app_role) OR
    has_role(auth.uid(), 'finance_manager'::app_role)
  );