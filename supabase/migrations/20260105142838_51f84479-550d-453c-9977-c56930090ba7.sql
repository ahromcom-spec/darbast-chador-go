-- Add phone_number and visited_pages columns to site_sessions
ALTER TABLE public.site_sessions 
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS visited_pages TEXT[] DEFAULT '{}';

-- Add phone_number column to site_analytics
ALTER TABLE public.site_analytics 
ADD COLUMN IF NOT EXISTS phone_number TEXT;