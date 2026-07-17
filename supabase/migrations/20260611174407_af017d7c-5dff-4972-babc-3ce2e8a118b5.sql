
-- 1) profiles: column-level revoke sensitive fields
REVOKE SELECT (user_password_hash, recovery_email) ON public.profiles FROM anon, authenticated;
GRANT SELECT (user_password_hash, recovery_email) ON public.profiles TO service_role;

-- 2) module_version_history: restrict DELETE to admin/ceo
DROP POLICY IF EXISTS "System can delete old versions" ON public.module_version_history;
CREATE POLICY "Admins and CEO can delete old versions"
  ON public.module_version_history FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'ceo'));

-- 3) order_daily_logs: scope INSERT/UPDATE
DROP POLICY IF EXISTS "Authenticated users can insert order daily logs" ON public.order_daily_logs;
DROP POLICY IF EXISTS "Authenticated users can update order daily logs" ON public.order_daily_logs;

CREATE POLICY "Creators and managers can insert order daily logs"
  ON public.order_daily_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'ceo')
    OR public.has_role(auth.uid(),'general_manager')
    OR public.has_role(auth.uid(),'scaffold_executive_manager')
    OR public.has_role(auth.uid(),'rental_executive_manager')
    OR public.has_role(auth.uid(),'executive_manager_scaffold_execution_with_materials')
  );

CREATE POLICY "Creators and managers can update order daily logs"
  ON public.order_daily_logs FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'ceo')
    OR public.has_role(auth.uid(),'general_manager')
    OR public.has_role(auth.uid(),'scaffold_executive_manager')
    OR public.has_role(auth.uid(),'rental_executive_manager')
    OR public.has_role(auth.uid(),'executive_manager_scaffold_execution_with_materials')
  );

-- 4) reputation_scores: restrict SELECT to owner + managers
DROP POLICY IF EXISTS "Authenticated users can view reputation scores" ON public.reputation_scores;
CREATE POLICY "Owner and managers can view reputation scores"
  ON public.reputation_scores FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'ceo')
    OR public.has_role(auth.uid(),'general_manager')
  );

-- 5) Storage: voice-messages bucket — restrict SELECT to uploader folder
DROP POLICY IF EXISTS "Users can view voice messages for their orders" ON storage.objects;
CREATE POLICY "Users can view own voice messages"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'voice-messages' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 6) Storage: order-media bucket — remove redundant permissive INSERT policies
DROP POLICY IF EXISTS "Authenticated can upload to order-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload order media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to order-media" ON storage.objects;
-- The folder-scoped policy order_media_user_folder_upload_v2 remains.
