-- Add rental_start_date column to projects_v3 for tracking scaffolding rental start date
ALTER TABLE public.projects_v3 
ADD COLUMN rental_start_date TIMESTAMP WITH TIME ZONE NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.projects_v3.rental_start_date IS 'تاریخ شروع کرایه داربست - تعیین شده توسط مدیر اجرایی';