-- Drop existing policies for order_renewals
DROP POLICY IF EXISTS "Staff can create renewals" ON public.order_renewals;
DROP POLICY IF EXISTS "Staff can update renewals" ON public.order_renewals;
DROP POLICY IF EXISTS "Staff can view all renewals" ON public.order_renewals;

-- Create new policies using module_assignments instead of internal_staff_profiles
-- Staff/Managers who have module assignments can view all renewals
CREATE POLICY "Staff can view all renewals" 
ON public.order_renewals 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM module_assignments 
    WHERE assigned_user_id = auth.uid() 
    AND is_active = true
  )
);

-- Staff/Managers who have module assignments can create renewals
CREATE POLICY "Staff can create renewals" 
ON public.order_renewals 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM module_assignments 
    WHERE assigned_user_id = auth.uid() 
    AND is_active = true
  )
);

-- Staff/Managers who have module assignments can update renewals
CREATE POLICY "Staff can update renewals" 
ON public.order_renewals 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM module_assignments 
    WHERE assigned_user_id = auth.uid() 
    AND is_active = true
  )
);

-- Staff/Managers who have module assignments can delete renewals  
CREATE POLICY "Staff can delete renewals" 
ON public.order_renewals 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM module_assignments 
    WHERE assigned_user_id = auth.uid() 
    AND is_active = true
  )
);