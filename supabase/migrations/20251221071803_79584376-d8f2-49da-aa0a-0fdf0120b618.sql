-- Add new columns for staff salary settings
ALTER TABLE public.staff_salary_settings 
ADD COLUMN IF NOT EXISTS previous_month_balance numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS previous_month_extra_received numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonuses numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS deductions numeric DEFAULT 0;