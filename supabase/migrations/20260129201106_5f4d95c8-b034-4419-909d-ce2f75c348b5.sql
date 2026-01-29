-- Drop existing SELECT policy on bank_cards if exists
DROP POLICY IF EXISTS "CEO and admins can view bank cards" ON public.bank_cards;
DROP POLICY IF EXISTS "Users with daily_report module can view bank cards" ON public.bank_cards;

-- Create new policy: All users with daily_report module access OR CEO/admin can view all bank cards
CREATE POLICY "Users with daily_report or CEO can view bank cards"
ON public.bank_cards
FOR SELECT
TO authenticated
USING (
  -- CEO role
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'ceo')
  OR
  -- Admin role  
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  OR
  -- Users assigned to daily_report module
  EXISTS (
    SELECT 1 FROM module_assignments 
    WHERE assigned_user_id = auth.uid() 
    AND module_key = 'daily_report' 
    AND is_active = true
  )
);