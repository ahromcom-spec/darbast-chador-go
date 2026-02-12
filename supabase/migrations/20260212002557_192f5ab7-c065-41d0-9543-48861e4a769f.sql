
-- Add effective date range to salary settings
ALTER TABLE public.staff_salary_settings
  ADD COLUMN effective_from DATE,
  ADD COLUMN effective_to DATE;

-- Remove the unique constraint on staff_code so one person can have multiple salary periods
ALTER TABLE public.staff_salary_settings DROP CONSTRAINT IF EXISTS staff_salary_settings_staff_code_key;

-- Add a unique constraint on (staff_code, effective_from) to prevent duplicate periods
ALTER TABLE public.staff_salary_settings ADD CONSTRAINT staff_salary_settings_staff_code_effective_from_key UNIQUE (staff_code, effective_from);
