-- Add new columns to staff_profiles table
ALTER TABLE public.staff_profiles
ADD COLUMN IF NOT EXISTS province text,
ADD COLUMN IF NOT EXISTS staff_category text,
ADD COLUMN IF NOT EXISTS staff_subcategory text,
ADD COLUMN IF NOT EXISTS staff_position text,
ADD COLUMN IF NOT EXISTS description text;