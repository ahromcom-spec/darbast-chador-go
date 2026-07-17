
-- Table: mapping which subcategory (or entire service_type) is available in which province/district
CREATE TABLE public.service_geo_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type_id uuid NOT NULL REFERENCES public.service_types(id) ON DELETE CASCADE,
  subcategory_id uuid REFERENCES public.subcategories(id) ON DELETE CASCADE, -- NULL = همه زیرشاخه‌ها
  province_id uuid NOT NULL REFERENCES public.provinces(id) ON DELETE CASCADE,
  district_id uuid REFERENCES public.districts(id) ON DELETE CASCADE, -- NULL = تمام شهرهای استان
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ux_service_geo_availability_scope
  ON public.service_geo_availability (
    service_type_id,
    COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid),
    province_id,
    COALESCE(district_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX ix_service_geo_availability_lookup
  ON public.service_geo_availability (province_id, district_id, is_active);

GRANT SELECT ON public.service_geo_availability TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.service_geo_availability TO authenticated;
GRANT ALL ON public.service_geo_availability TO service_role;

ALTER TABLE public.service_geo_availability ENABLE ROW LEVEL SECURITY;

-- خواندن برای همه (لازم است تا کاربران مهمان نیز خدمات مجاز شهرشان را ببینند)
CREATE POLICY "geo_avail_read_all"
ON public.service_geo_availability
FOR SELECT
USING (true);

-- فقط مدیرعامل/مدیرکل می‌تواند قوانین جغرافیایی را تعریف/ویرایش/حذف کند
CREATE POLICY "geo_avail_ceo_manage"
ON public.service_geo_availability
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'ceo') OR public.has_role(auth.uid(), 'general_manager'))
WITH CHECK (public.has_role(auth.uid(), 'ceo') OR public.has_role(auth.uid(), 'general_manager'));

CREATE TRIGGER trg_service_geo_availability_updated_at
BEFORE UPDATE ON public.service_geo_availability
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
