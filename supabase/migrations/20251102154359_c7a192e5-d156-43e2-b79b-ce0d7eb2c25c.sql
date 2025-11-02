-- Add thumbnail_path column to project_media table
ALTER TABLE public.project_media 
ADD COLUMN IF NOT EXISTS thumbnail_path text;