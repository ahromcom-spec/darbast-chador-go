-- Allow users to view module assignments that match their phone number
CREATE POLICY "Users can view own module assignments by phone"
ON public.module_assignments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.phone_number = module_assignments.assigned_phone_number
  )
);