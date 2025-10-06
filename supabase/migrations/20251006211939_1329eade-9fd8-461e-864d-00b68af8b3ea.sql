-- Create projects table for grouping service requests
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  service_type TEXT NOT NULL,
  location_address TEXT NOT NULL,
  project_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, service_type, location_address)
);

-- Add project_id to service_requests
ALTER TABLE public.service_requests ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Users can view their own projects"
ON public.projects FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
ON public.projects FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
ON public.projects FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all projects"
ON public.projects FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create function to auto-assign service requests to projects
CREATE OR REPLACE FUNCTION public.assign_service_request_to_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_project_id UUID;
  new_project_name TEXT;
BEGIN
  -- Check if a project exists for this user, service type, and location
  SELECT id INTO existing_project_id
  FROM public.projects
  WHERE user_id = NEW.user_id
    AND service_type = NEW.service_type
    AND location_address = COALESCE(NEW.location_address, '')
  LIMIT 1;

  -- If project exists, assign to it
  IF existing_project_id IS NOT NULL THEN
    NEW.project_id := existing_project_id;
  ELSE
    -- Create new project
    new_project_name := CASE 
      WHEN NEW.service_type = 'scaffolding' THEN 'پروژه داربست - '
      WHEN NEW.service_type = 'tarpaulin' THEN 'پروژه چادر برزنتی - '
      ELSE 'پروژه - '
    END || COALESCE(NEW.location_address, 'بدون آدرس');

    INSERT INTO public.projects (
      user_id,
      service_type,
      location_address,
      project_name
    ) VALUES (
      NEW.user_id,
      NEW.service_type,
      COALESCE(NEW.location_address, ''),
      new_project_name
    )
    RETURNING id INTO existing_project_id;

    NEW.project_id := existing_project_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for auto-assigning service requests
CREATE TRIGGER trigger_assign_service_request_to_project
BEFORE INSERT ON public.service_requests
FOR EACH ROW
EXECUTE FUNCTION public.assign_service_request_to_project();

-- Create indexes
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_service_requests_project_id ON public.service_requests(project_id);

-- Create trigger for updated_at
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();