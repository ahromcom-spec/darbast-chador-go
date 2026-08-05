CREATE POLICY "Customers can delete their pending repair requests"
ON public.repair_requests FOR DELETE
USING (
  customer_id IN (SELECT customers.id FROM public.customers WHERE customers.user_id = auth.uid())
  AND status = 'pending'
);

CREATE POLICY "Managers can delete repair requests"
ON public.repair_requests FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = ANY (ARRAY['admin'::app_role,'ceo'::app_role,'general_manager'::app_role,'sales_manager'::app_role,'scaffold_executive_manager'::app_role,'executive_manager_scaffold_execution_with_materials'::app_role,'finance_manager'::app_role])
  )
);