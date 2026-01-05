-- Drop existing SELECT policies and create a new one that allows module access based on module_assignments
DROP POLICY IF EXISTS "Users with module access can view HR employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can view their own HR record" ON public.hr_employees;

-- Create a new policy that allows:
-- 1. CEOs and GMs to view all
-- 2. Users assigned to hr_management module to view all
-- 3. Users who are in the hr_employees table to view their own record
CREATE POLICY "HR employees readable by module users"
ON public.hr_employees
FOR SELECT
USING (
  -- CEO or GM can see all
  has_role(auth.uid(), 'ceo'::app_role) 
  OR has_role(auth.uid(), 'general_manager'::app_role)
  -- Users with hr_management module assignment can see all
  OR EXISTS (
    SELECT 1 FROM module_assignments 
    WHERE module_key = 'hr_management' 
    AND is_active = true 
    AND assigned_user_id = auth.uid()
  )
  -- Users can see their own record
  OR auth.uid() = user_id
);