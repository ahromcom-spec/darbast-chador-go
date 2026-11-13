-- Helper: who may manage cheques and cheque images
CREATE OR REPLACE FUNCTION public.can_manage_cheques(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_payment_reviewer(_uid) OR public.can_manage_order_renewals(_uid);
$$;
REVOKE EXECUTE ON FUNCTION public.can_manage_cheques(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_cheques(uuid) TO authenticated, service_role;

-- cheques
DROP POLICY IF EXISTS "Authenticated can view cheques" ON public.cheques;
DROP POLICY IF EXISTS "Authenticated can update cheques" ON public.cheques;
DROP POLICY IF EXISTS "Authenticated can delete cheques" ON public.cheques;

CREATE POLICY "Staff and owning customers can view cheques" ON public.cheques
FOR SELECT TO authenticated
USING (
  public.can_manage_cheques(auth.uid())
  OR created_by = auth.uid()
  OR customer_id IN (SELECT c.id FROM public.customers c WHERE c.user_id = auth.uid())
);
CREATE POLICY "Staff can update cheques" ON public.cheques
FOR UPDATE TO authenticated
USING (public.can_manage_cheques(auth.uid()))
WITH CHECK (public.can_manage_cheques(auth.uid()));
CREATE POLICY "Staff can delete cheques" ON public.cheques
FOR DELETE TO authenticated
USING (public.can_manage_cheques(auth.uid()));

-- cheque-images storage
DROP POLICY IF EXISTS "Public can view cheque images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update cheque images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete cheque images" ON storage.objects;

CREATE POLICY "Staff or uploader can view cheque images" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'cheque-images'
  AND (public.can_manage_cheques(auth.uid()) OR (storage.foldername(name))[1] = (auth.uid())::text)
);
CREATE POLICY "Staff or uploader can update cheque images" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'cheque-images'
  AND (public.can_manage_cheques(auth.uid()) OR (storage.foldername(name))[1] = (auth.uid())::text)
)
WITH CHECK (
  bucket_id = 'cheque-images'
  AND (public.can_manage_cheques(auth.uid()) OR (storage.foldername(name))[1] = (auth.uid())::text)
);
CREATE POLICY "Staff or uploader can delete cheque images" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'cheque-images'
  AND (public.can_manage_cheques(auth.uid()) OR (storage.foldername(name))[1] = (auth.uid())::text)
);

-- help-videos storage: remove the unrestricted read rule; managers can still preview inactive files
DROP POLICY IF EXISTS "help videos readable" ON storage.objects;
CREATE POLICY "managers view help videos" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'help-videos'
  AND (
    public.has_role(auth.uid(), 'ceo'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'general_manager'::public.app_role)
    OR public.is_assigned_to_module(auth.uid(), 'help_videos')
  )
);

-- scheduled_sms: only the server queues messages; only managers read the queue
DROP POLICY IF EXISTS "Authenticated can schedule sms" ON public.scheduled_sms;
DROP POLICY IF EXISTS "Staff can view scheduled sms" ON public.scheduled_sms;
CREATE POLICY "Managers can view scheduled sms" ON public.scheduled_sms
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'ceo'::public.app_role)
  OR public.has_role(auth.uid(), 'general_manager'::public.app_role)
  OR public.can_manage_site_notifications(auth.uid())
  OR public.is_assigned_to_module(auth.uid(), 'sms_management')
  OR public.is_assigned_to_module(auth.uid(), 'site_notifications')
  OR created_by = auth.uid()
);

-- sms_send_window: readable only by the managers who already manage it (covered by sms_send_window_manage)
DROP POLICY IF EXISTS "sms_send_window_read" ON public.sms_send_window;

-- order_messages: re-check the manager role on the edited row
DROP POLICY IF EXISTS "Managers can update order messages" ON public.order_messages;
CREATE POLICY "Managers can update order messages" ON public.order_messages
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'ceo'::public.app_role)
  OR public.has_role(auth.uid(), 'general_manager'::public.app_role) OR public.has_role(auth.uid(), 'sales_manager'::public.app_role)
  OR public.has_role(auth.uid(), 'scaffold_executive_manager'::public.app_role) OR public.has_role(auth.uid(), 'rental_executive_manager'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'ceo'::public.app_role)
  OR public.has_role(auth.uid(), 'general_manager'::public.app_role) OR public.has_role(auth.uid(), 'sales_manager'::public.app_role)
  OR public.has_role(auth.uid(), 'scaffold_executive_manager'::public.app_role) OR public.has_role(auth.uid(), 'rental_executive_manager'::public.app_role)
);

-- daily_report_order_media: scope reads to uploader, report participants and managers
DROP POLICY IF EXISTS "Authenticated users can view report media" ON public.daily_report_order_media;
CREATE POLICY "Report participants and managers can view report media" ON public.daily_report_order_media
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'ceo'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'general_manager'::public.app_role)
  OR public.has_role(auth.uid(), 'scaffold_executive_manager'::public.app_role)
  OR public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::public.app_role)
  OR public.has_role(auth.uid(), 'sales_manager'::public.app_role)
  OR public.has_role(auth.uid(), 'finance_manager'::public.app_role)
  OR public.is_assigned_to_module(auth.uid(), 'daily_report')
  OR EXISTS (
    SELECT 1 FROM public.daily_reports dr
    WHERE dr.id = daily_report_order_media.daily_report_id
      AND (
        dr.created_by = auth.uid()
        OR (dr.module_key IS NOT NULL AND public.is_assigned_to_module(auth.uid(), dr.module_key::text))
        OR public.daily_report_contains_staff(dr.id, auth.uid())
      )
  )
);