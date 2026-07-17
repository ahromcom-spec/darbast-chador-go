CREATE POLICY "Public can view districts" ON public.districts FOR SELECT TO anon USING (true);
GRANT SELECT ON public.districts TO anon;