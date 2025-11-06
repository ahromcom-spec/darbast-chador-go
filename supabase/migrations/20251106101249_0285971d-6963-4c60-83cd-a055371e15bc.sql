-- افزودن پالیسی برای نقش executive_manager_scaffold_execution_with_materials

-- project_progress_media policies
CREATE POLICY "Exec-with-materials INSERT progress media"
ON project_progress_media
FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'scaffold_executive_manager'::app_role) 
   OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role))
  AND auth.uid() = uploaded_by
);

CREATE POLICY "Exec-with-materials SELECT progress media"
ON project_progress_media
FOR SELECT
USING (
  (has_role(auth.uid(), 'scaffold_executive_manager'::app_role) 
   OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role))
  AND auth.uid() = uploaded_by
);

CREATE POLICY "Exec-with-materials DELETE progress media"
ON project_progress_media
FOR DELETE
USING (
  (has_role(auth.uid(), 'scaffold_executive_manager'::app_role) 
   OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role))
  AND auth.uid() = uploaded_by
);

-- storage policies
CREATE POLICY "Exec-with-materials INSERT to progress bucket"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'executive-progress'
  AND (has_role(auth.uid(), 'scaffold_executive_manager'::app_role) 
       OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role))
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Exec-with-materials SELECT uploads"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'executive-progress'
  AND (has_role(auth.uid(), 'scaffold_executive_manager'::app_role) 
       OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role))
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Exec-with-materials DELETE uploads"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'executive-progress'
  AND (has_role(auth.uid(), 'scaffold_executive_manager'::app_role) 
       OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role))
  AND (storage.foldername(name))[1] = auth.uid()::text
);
