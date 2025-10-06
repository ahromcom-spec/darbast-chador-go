-- Add project_id to service_requests if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'service_requests' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE public.service_requests ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
  END IF;
END $$;

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

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_assign_service_request_to_project ON public.service_requests;

-- Create trigger for auto-assigning service requests
CREATE TRIGGER trigger_assign_service_request_to_project
BEFORE INSERT ON public.service_requests
FOR EACH ROW
EXECUTE FUNCTION public.assign_service_request_to_project();

-- Create indexes if not exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_service_requests_project_id') THEN
    CREATE INDEX idx_service_requests_project_id ON public.service_requests(project_id);
  END IF;
END $$;