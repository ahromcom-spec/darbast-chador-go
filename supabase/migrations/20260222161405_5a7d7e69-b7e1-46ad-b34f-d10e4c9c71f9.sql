-- Allow all authenticated users to view media in daily reports they're assigned to
-- Replace restrictive per-user SELECT with a broader authenticated SELECT
DROP POLICY IF EXISTS "Users can view their own report media" ON public.daily_report_order_media;
DROP POLICY IF EXISTS "Staff can view all report media" ON public.daily_report_order_media;

-- Single policy: any authenticated user can view report media
-- (module assignment logic is handled at the application level)
CREATE POLICY "Authenticated users can view report media"
  ON public.daily_report_order_media
  FOR SELECT
  TO public
  USING (auth.uid() IS NOT NULL);