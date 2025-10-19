-- ===================================================================
-- THREE-LEVEL SERVICE STRUCTURE MIGRATION (FIXED)
-- Level 1: Locations (physical addresses with map pins)
-- Level 2: Projects (location + service_type + subcategory)
-- Level 3: Orders (individual service requests)
-- ===================================================================

-- 1) CREATE LOCATIONS TABLE (enhanced addresses with mandatory map pin)
CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  province_id UUID REFERENCES public.provinces(id),
  district_id UUID REFERENCES public.districts(id),
  address_line TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on locations
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- 2) CREATE PROJECTS_HIERARCHY TABLE (unique combination of location + service + subcategory)
CREATE TABLE IF NOT EXISTS public.projects_hierarchy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  service_type_id UUID NOT NULL REFERENCES public.service_types_v3(id),
  subcategory_id UUID NOT NULL REFERENCES public.subcategories(id),
  title TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (location_id, service_type_id, subcategory_id)
);

-- Enable RLS on projects_hierarchy
ALTER TABLE public.projects_hierarchy ENABLE ROW LEVEL SECURITY;

-- 3) CREATE ORDERS TABLE (individual service requests under projects)
CREATE TYPE order_status AS ENUM (
  'draft', 'pending', 'priced', 'confirmed', 
  'scheduled', 'in_progress', 'done', 'canceled'
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects_hierarchy(id) ON DELETE RESTRICT,
  payload JSONB NOT NULL DEFAULT '{}',
  price NUMERIC(12,2),
  status order_status DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 4) RLS POLICIES FOR LOCATIONS
CREATE POLICY "Users can view own locations"
ON public.locations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own locations"
ON public.locations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own locations"
ON public.locations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own locations"
ON public.locations FOR DELETE
USING (auth.uid() = user_id AND NOT EXISTS (
  SELECT 1 FROM public.projects_hierarchy WHERE location_id = locations.id
));

CREATE POLICY "Staff can view all locations"
ON public.locations FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5) RLS POLICIES FOR PROJECTS_HIERARCHY
CREATE POLICY "Users can view own projects"
ON public.projects_hierarchy FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects"
ON public.projects_hierarchy FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
ON public.projects_hierarchy FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all projects"
ON public.projects_hierarchy FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 6) RLS POLICIES FOR ORDERS
CREATE POLICY "Users can view own orders"
ON public.orders FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders"
ON public.orders FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own orders"
ON public.orders FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all orders"
ON public.orders FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can manage all orders"
ON public.orders FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- 7) CREATE HELPER FUNCTION: Get or create project
CREATE OR REPLACE FUNCTION public.get_or_create_project(
  _user_id UUID,
  _location_id UUID,
  _service_type_id UUID,
  _subcategory_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_id UUID;
  project_title TEXT;
  service_name TEXT;
  subcategory_name TEXT;
BEGIN
  -- Check if project exists
  SELECT id INTO project_id
  FROM public.projects_hierarchy
  WHERE location_id = _location_id
    AND service_type_id = _service_type_id
    AND subcategory_id = _subcategory_id
    AND user_id = _user_id;
  
  IF project_id IS NOT NULL THEN
    RETURN project_id;
  END IF;
  
  -- Get service and subcategory names for title
  SELECT st.name, sc.name INTO service_name, subcategory_name
  FROM service_types_v3 st
  JOIN subcategories sc ON sc.id = _subcategory_id
  WHERE st.id = _service_type_id;
  
  project_title := service_name || ' - ' || subcategory_name;
  
  -- Create new project
  INSERT INTO public.projects_hierarchy (
    user_id, location_id, service_type_id, subcategory_id, title
  ) VALUES (
    _user_id, _location_id, _service_type_id, _subcategory_id, project_title
  ) RETURNING id INTO project_id;
  
  RETURN project_id;
END;
$$;

-- 8) CREATE INDEXES for better performance
CREATE INDEX idx_locations_user_id ON public.locations(user_id);
CREATE INDEX idx_locations_province_id ON public.locations(province_id);
CREATE INDEX idx_projects_hierarchy_user_id ON public.projects_hierarchy(user_id);
CREATE INDEX idx_projects_hierarchy_location_id ON public.projects_hierarchy(location_id);
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_project_id ON public.orders(project_id);
CREATE INDEX idx_orders_status ON public.orders(status);

-- 9) CREATE TRIGGERS for updated_at
CREATE TRIGGER update_locations_updated_at
BEFORE UPDATE ON public.locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_hierarchy_updated_at
BEFORE UPDATE ON public.projects_hierarchy
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();