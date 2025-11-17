-- Add denormalized contact and location columns to projects_v3 for manager visibility
ALTER TABLE public.projects_v3
ADD COLUMN IF NOT EXISTS customer_name text,
ADD COLUMN IF NOT EXISTS customer_phone text,
ADD COLUMN IF NOT EXISTS location_lat double precision,
ADD COLUMN IF NOT EXISTS location_lng double precision;

-- Optional: comments for clarity
COMMENT ON COLUMN public.projects_v3.customer_name IS 'Denormalized customer full name for operational visibility';
COMMENT ON COLUMN public.projects_v3.customer_phone IS 'Denormalized customer phone for operational visibility';
COMMENT ON COLUMN public.projects_v3.location_lat IS 'Project latitude copied from locations at request time';
COMMENT ON COLUMN public.projects_v3.location_lng IS 'Project longitude copied from locations at request time';