-- Allow staff members to view their own salary settings
CREATE POLICY "Staff can view own salary settings" 
ON public.staff_salary_settings 
FOR SELECT 
USING (
  -- Match by phone number in staff_code
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND (
      p.phone_number = staff_code 
      OR staff_code = SUBSTRING(p.phone_number FROM 2)
      OR p.phone_number = CONCAT('0', staff_code)
    )
  )
  -- Or match by staff name from profiles or hr_employees
  OR EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.full_name = staff_name
  )
  OR EXISTS (
    SELECT 1 FROM hr_employees h 
    WHERE h.user_id = auth.uid() 
    AND (h.phone_number = staff_code OR h.full_name = staff_name)
  )
);