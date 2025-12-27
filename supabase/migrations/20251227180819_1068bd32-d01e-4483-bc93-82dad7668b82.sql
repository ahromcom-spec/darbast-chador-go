-- Add location confirmation fields to projects_v3
ALTER TABLE public.projects_v3
ADD COLUMN location_confirmed_by_customer boolean DEFAULT false,
ADD COLUMN location_confirmed_at timestamp with time zone;