
-- 1. user_roles: remove the broad self-or-anyone SELECT
DROP POLICY IF EXISTS "Authenticated users can read roles for authorization" ON public.user_roles;
-- "Users can view their own roles" and "Admins and GMs can view all roles" already exist.

-- 2. order_daily_logs: remove anonymous read
DROP POLICY IF EXISTS "Everyone can view order daily logs" ON public.order_daily_logs;
DROP POLICY IF EXISTS "Authenticated users can view order daily logs" ON public.order_daily_logs;
CREATE POLICY "Authenticated users can view order daily logs"
ON public.order_daily_logs
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 3. bank_card_transactions: restrict INSERT to authorized financial roles
DROP POLICY IF EXISTS "Authenticated users can insert transactions" ON public.bank_card_transactions;
DROP POLICY IF EXISTS "Authorized roles can insert bank card transactions" ON public.bank_card_transactions;
CREATE POLICY "Authorized roles can insert bank card transactions"
ON public.bank_card_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'ceo'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'general_manager'::public.app_role)
  OR public.has_role(auth.uid(), 'finance_manager'::public.app_role)
);

-- 4. site_sessions: prevent anonymous tampering, only owner can update
DROP POLICY IF EXISTS "Anyone can update site_sessions" ON public.site_sessions;
DROP POLICY IF EXISTS "Session owners can update their own session" ON public.site_sessions;
CREATE POLICY "Session owners can update their own session"
ON public.site_sessions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 5. profiles.user_password_hash: hide from API reads
REVOKE SELECT (user_password_hash) ON public.profiles FROM authenticated;
REVOKE SELECT (user_password_hash) ON public.profiles FROM anon;

-- 6. voice-messages: switch bucket to private and drop public-read policy
UPDATE storage.buckets SET public = false WHERE id = 'voice-messages';
DROP POLICY IF EXISTS "Public voice messages access" ON storage.objects;

-- 7. order-media: drop the blanket public-read policy
DROP POLICY IF EXISTS "Anyone can view order media" ON storage.objects;
