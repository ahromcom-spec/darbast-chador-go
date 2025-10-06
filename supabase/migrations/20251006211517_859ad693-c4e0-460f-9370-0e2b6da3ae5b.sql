-- Create contractors table
CREATE TABLE public.contractors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT,
  experience_years INTEGER,
  description TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contractor_services table
CREATE TABLE public.contractor_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id UUID NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  sub_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create project_assignments table
CREATE TABLE public.project_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;

-- Contractors policies
CREATE POLICY "Contractors can view their own profile"
ON public.contractors FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Contractors can update their own profile"
ON public.contractors FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can insert contractor profile"
ON public.contractors FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all contractors"
ON public.contractors FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all contractors"
ON public.contractors FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Contractor services policies
CREATE POLICY "Contractors can view their own services"
ON public.contractor_services FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contractors
    WHERE contractors.id = contractor_services.contractor_id
    AND contractors.user_id = auth.uid()
  )
);

CREATE POLICY "Contractors can manage their own services"
ON public.contractor_services FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.contractors
    WHERE contractors.id = contractor_services.contractor_id
    AND contractors.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all services"
ON public.contractor_services FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Project assignments policies
CREATE POLICY "Contractors can view their assignments"
ON public.project_assignments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contractors
    WHERE contractors.id = project_assignments.contractor_id
    AND contractors.user_id = auth.uid()
  )
);

CREATE POLICY "Contractors can update their assignments"
ON public.project_assignments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.contractors
    WHERE contractors.id = project_assignments.contractor_id
    AND contractors.user_id = auth.uid()
  )
);

CREATE POLICY "Customers can view their project assignments"
ON public.project_assignments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.service_requests
    WHERE service_requests.id = project_assignments.service_request_id
    AND service_requests.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all assignments"
ON public.project_assignments FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes
CREATE INDEX idx_contractors_user_id ON public.contractors(user_id);
CREATE INDEX idx_contractor_services_contractor_id ON public.contractor_services(contractor_id);
CREATE INDEX idx_contractor_services_service_type ON public.contractor_services(service_type);
CREATE INDEX idx_project_assignments_contractor_id ON public.project_assignments(contractor_id);
CREATE INDEX idx_project_assignments_service_request_id ON public.project_assignments(service_request_id);
CREATE INDEX idx_project_assignments_status ON public.project_assignments(status);

-- Create triggers for updated_at
CREATE TRIGGER update_contractors_updated_at
BEFORE UPDATE ON public.contractors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_assignments_updated_at
BEFORE UPDATE ON public.project_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add contractor role to app_role enum if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user', 'contractor');
    ELSE
        ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'contractor';
    END IF;
END $$;