CREATE POLICY "CEO and GM can archive or restore orders"
ON public.projects_v3
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role));