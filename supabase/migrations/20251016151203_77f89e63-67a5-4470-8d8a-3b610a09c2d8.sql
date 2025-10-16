-- Fix Missing RLS on reference tables
-- Add INSERT/UPDATE/DELETE policies restricted to admins for reference tables

-- Provinces: Already has SELECT policy, add modification policies
CREATE POLICY "Only admins can insert provinces"
ON public.provinces
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update provinces"
ON public.provinces
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete provinces"
ON public.provinces
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Districts: Already has SELECT policy, add modification policies
CREATE POLICY "Only admins can insert districts"
ON public.districts
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update districts"
ON public.districts
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete districts"
ON public.districts
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Subcategories: Already has SELECT policy, add modification policies
CREATE POLICY "Only admins can insert subcategories"
ON public.subcategories
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update subcategories"
ON public.subcategories
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete subcategories"
ON public.subcategories
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service Types V3: Already has SELECT policy, add modification policies
CREATE POLICY "Only admins can insert service types v3"
ON public.service_types_v3
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update service types v3"
ON public.service_types_v3
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete service types v3"
ON public.service_types_v3
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Check if organizational_positions table exists and add policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizational_positions') THEN
    -- Enable RLS if not already enabled
    ALTER TABLE public.organizational_positions ENABLE ROW LEVEL SECURITY;
    
    -- Add policies
    CREATE POLICY "Anyone can view active organizational positions"
    ON public.organizational_positions
    FOR SELECT
    USING (is_active = true);
    
    CREATE POLICY "Only admins can insert organizational positions"
    ON public.organizational_positions
    FOR INSERT
    TO authenticated
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
    
    CREATE POLICY "Only admins can update organizational positions"
    ON public.organizational_positions
    FOR UPDATE
    TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role));
    
    CREATE POLICY "Only admins can delete organizational positions"
    ON public.organizational_positions
    FOR DELETE
    TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;