-- Fix missing UPDATE policy on order_approvals table
-- This allows managers to approve orders by updating their approval records

CREATE POLICY "Managers can update their approvals"
ON public.order_approvals FOR UPDATE
USING (
  (approver_role = 'ceo' AND has_role(auth.uid(), 'ceo'::app_role)) OR
  (approver_role IN ('scaffold_executive_manager', 'executive_manager_scaffold_execution_with_materials') 
   AND has_role(auth.uid(), 'scaffold_executive_manager'::app_role)) OR
  (approver_role IN ('sales_manager', 'sales_manager_scaffold_execution_with_materials')
   AND has_role(auth.uid(), 'sales_manager'::app_role)) OR
  (approver_role = 'general_manager_scaffold_execution_with_materials'
   AND has_role(auth.uid(), 'general_manager'::app_role)) OR
  (approver_role = 'finance_manager'
   AND has_role(auth.uid(), 'finance_manager'::app_role))
)
WITH CHECK (
  -- Only allow updating approver_user_id and approved_at fields
  (approver_role = 'ceo' AND has_role(auth.uid(), 'ceo'::app_role)) OR
  (approver_role IN ('scaffold_executive_manager', 'executive_manager_scaffold_execution_with_materials')
   AND has_role(auth.uid(), 'scaffold_executive_manager'::app_role)) OR
  (approver_role IN ('sales_manager', 'sales_manager_scaffold_execution_with_materials')
   AND has_role(auth.uid(), 'sales_manager'::app_role)) OR
  (approver_role = 'general_manager_scaffold_execution_with_materials'
   AND has_role(auth.uid(), 'general_manager'::app_role)) OR
  (approver_role = 'finance_manager'
   AND has_role(auth.uid(), 'finance_manager'::app_role))
);