-- Drop existing restrictive policies
DROP POLICY IF EXISTS "CEO can view all analytics" ON public.site_analytics;
DROP POLICY IF EXISTS "CEO can view all sessions" ON public.site_sessions;
DROP POLICY IF EXISTS "Anyone can insert analytics" ON public.site_analytics;
DROP POLICY IF EXISTS "Anyone can update sessions" ON public.site_sessions;

-- Create proper policies for site_analytics
-- Allow anyone (including anonymous/guests) to insert analytics events
CREATE POLICY "Anyone can insert site_analytics"
  ON public.site_analytics
  FOR INSERT
  WITH CHECK (true);

-- CEOs and managers can view all analytics
CREATE POLICY "CEOs and managers can view all site_analytics"
  ON public.site_analytics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.phone_whitelist pw
      JOIN public.profiles p ON p.phone_number = pw.phone_number
      WHERE p.user_id = auth.uid()
      AND ('ceo' = ANY(pw.allowed_roles) OR 'general_manager' = ANY(pw.allowed_roles))
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('ceo', 'general_manager', 'admin')
    )
  );

-- Create proper policies for site_sessions  
-- Allow anyone to insert sessions
CREATE POLICY "Anyone can insert site_sessions"
  ON public.site_sessions
  FOR INSERT
  WITH CHECK (true);

-- Allow anyone to update their own session (by session_id since no auth required)
CREATE POLICY "Anyone can update site_sessions"
  ON public.site_sessions
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- CEOs and managers can view all sessions
CREATE POLICY "CEOs and managers can view all site_sessions"
  ON public.site_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.phone_whitelist pw
      JOIN public.profiles p ON p.phone_number = pw.phone_number
      WHERE p.user_id = auth.uid()
      AND ('ceo' = ANY(pw.allowed_roles) OR 'general_manager' = ANY(pw.allowed_roles))
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('ceo', 'general_manager', 'admin')
    )
  );