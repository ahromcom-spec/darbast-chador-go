CREATE POLICY "help videos readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'help-videos');

CREATE POLICY "managers upload help videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'help-videos' AND (public.has_role(auth.uid(), 'ceo') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'general_manager')));

CREATE POLICY "managers update help videos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'help-videos' AND (public.has_role(auth.uid(), 'ceo') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'general_manager')));

CREATE POLICY "managers delete help videos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'help-videos' AND (public.has_role(auth.uid(), 'ceo') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'general_manager')));