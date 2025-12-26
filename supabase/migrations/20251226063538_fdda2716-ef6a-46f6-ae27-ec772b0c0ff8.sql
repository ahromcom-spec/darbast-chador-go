
-- Drop the problematic policy for daily_report_orders
DROP POLICY IF EXISTS "Users can manage order reports" ON public.daily_report_orders;

-- Create separate INSERT policy with proper WITH CHECK
CREATE POLICY "Managers can insert order reports" 
ON public.daily_report_orders 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM daily_reports dr 
    WHERE dr.id = daily_report_id 
    AND (
      dr.created_by = auth.uid() 
      OR has_role(auth.uid(), 'ceo'::app_role) 
      OR has_role(auth.uid(), 'general_manager'::app_role)
      OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
      OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
    )
  )
);

-- Create UPDATE policy
CREATE POLICY "Managers can update order reports" 
ON public.daily_report_orders 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM daily_reports dr 
    WHERE dr.id = daily_report_id 
    AND (
      dr.created_by = auth.uid() 
      OR has_role(auth.uid(), 'ceo'::app_role) 
      OR has_role(auth.uid(), 'general_manager'::app_role)
      OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
      OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
    )
  )
);

-- Update the INSERT policy for daily_report_staff as well
DROP POLICY IF EXISTS "Managers can manage all staff reports" ON public.daily_report_staff;

CREATE POLICY "Managers can insert staff reports" 
ON public.daily_report_staff 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM daily_reports dr 
    WHERE dr.id = daily_report_id 
    AND (
      dr.created_by = auth.uid() 
      OR has_role(auth.uid(), 'ceo'::app_role) 
      OR has_role(auth.uid(), 'general_manager'::app_role)
      OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
      OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
    )
  )
);

CREATE POLICY "Managers can update staff reports" 
ON public.daily_report_staff 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM daily_reports dr 
    WHERE dr.id = daily_report_id 
    AND (
      dr.created_by = auth.uid() 
      OR has_role(auth.uid(), 'ceo'::app_role) 
      OR has_role(auth.uid(), 'general_manager'::app_role)
      OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
      OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
    )
  )
);

CREATE POLICY "Managers can select staff reports" 
ON public.daily_report_staff 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM daily_reports dr 
    WHERE dr.id = daily_report_id 
    AND (
      dr.created_by = auth.uid() 
      OR has_role(auth.uid(), 'ceo'::app_role) 
      OR has_role(auth.uid(), 'general_manager'::app_role)
      OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
      OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
    )
  )
);
