-- Add deep archive field to projects_v3
ALTER TABLE public.projects_v3 
ADD COLUMN IF NOT EXISTS is_deep_archived boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS deep_archived_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS deep_archived_by uuid;