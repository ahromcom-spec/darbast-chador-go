-- Create staff_salary_settings table for storing salary rules
CREATE TABLE public.staff_salary_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_code text NOT NULL,
  staff_name text NOT NULL,
  base_daily_salary numeric NOT NULL DEFAULT 0,
  overtime_rate_fraction numeric NOT NULL DEFAULT 0.167, -- 1/6 by default
  notes text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_staff_code UNIQUE (staff_code)
);

-- Enable RLS
ALTER TABLE public.staff_salary_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "CEO and managers can view all salary settings"
ON public.staff_salary_settings
FOR SELECT
USING (
  has_role(auth.uid(), 'ceo'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'finance_manager'::app_role)
);

CREATE POLICY "CEO and managers can insert salary settings"
ON public.staff_salary_settings
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'ceo'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role)
);

CREATE POLICY "CEO and managers can update salary settings"
ON public.staff_salary_settings
FOR UPDATE
USING (
  has_role(auth.uid(), 'ceo'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role)
);

CREATE POLICY "CEO and managers can delete salary settings"
ON public.staff_salary_settings
FOR DELETE
USING (
  has_role(auth.uid(), 'ceo'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role)
);

-- Create updated_at trigger
CREATE TRIGGER update_staff_salary_settings_updated_at
BEFORE UPDATE ON public.staff_salary_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();