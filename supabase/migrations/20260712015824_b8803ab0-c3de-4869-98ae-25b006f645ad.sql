ALTER TABLE public.service_geo_availability
  DROP CONSTRAINT IF EXISTS service_geo_availability_service_type_id_fkey;

ALTER TABLE public.service_geo_availability
  ADD CONSTRAINT service_geo_availability_service_type_id_fkey
  FOREIGN KEY (service_type_id)
  REFERENCES public.service_types_v3(id)
  ON DELETE CASCADE;