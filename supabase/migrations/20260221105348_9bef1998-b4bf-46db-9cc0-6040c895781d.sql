-- Allow staff/admins to view all report media (not just their own)
CREATE POLICY "Staff can view all report media"
ON public.daily_report_order_media
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR has_role(auth.uid(), 'sales_manager'::app_role)
  OR has_role(auth.uid(), 'finance_manager'::app_role)
);

-- Allow staff/admins to insert media on behalf of report
CREATE POLICY "Staff can insert report media"
ON public.daily_report_order_media
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'general_manager'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  OR has_role(auth.uid(), 'sales_manager'::app_role)
  OR has_role(auth.uid(), 'finance_manager'::app_role)
);