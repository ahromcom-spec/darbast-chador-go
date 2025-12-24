-- Make order-media bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'order-media';

-- Drop ALL public read policies for order-media bucket
DROP POLICY IF EXISTS "Public read access to order-media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view order media files" ON storage.objects;
DROP POLICY IF EXISTS "order_media_public_read_v2" ON storage.objects;

-- Create owner-based SELECT policy (users can view their own files)
CREATE POLICY "order_media_owner_select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'order-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Create managers SELECT policy (managers can view all files)
CREATE POLICY "order_media_managers_select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'order-media' AND
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'ceo', 'general_manager', 'scaffold_executive_manager', 'executive_manager_scaffold_execution_with_materials', 'sales_manager', 'finance_manager')
  )
);