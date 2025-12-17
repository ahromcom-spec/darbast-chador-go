-- Add is_archived column to projects_v3 table
ALTER TABLE public.projects_v3 
ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;

-- Add archived_at timestamp
ALTER TABLE public.projects_v3 
ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone DEFAULT NULL;

-- Add archived_by to track who archived the order
ALTER TABLE public.projects_v3 
ADD COLUMN IF NOT EXISTS archived_by uuid DEFAULT NULL;

-- Create index for faster archived queries
CREATE INDEX IF NOT EXISTS idx_projects_v3_is_archived ON public.projects_v3(is_archived);