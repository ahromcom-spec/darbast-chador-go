CREATE POLICY "Authors can update own order messages"
ON public.order_messages FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authors can delete own order messages"
ON public.order_messages FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Managers can delete order messages"
ON public.order_messages FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
  OR has_role(auth.uid(), 'sales_manager'::app_role)
  OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR has_role(auth.uid(), 'rental_executive_manager'::app_role)
);

CREATE POLICY "Managers can update order messages"
ON public.order_messages FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
  OR has_role(auth.uid(), 'sales_manager'::app_role)
  OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR has_role(auth.uid(), 'rental_executive_manager'::app_role)
)
WITH CHECK (true);

GRANT UPDATE, DELETE ON public.order_messages TO authenticated;