-- حذف constraint unique نامناسب و اضافه کردن code
ALTER TABLE public.regions DROP CONSTRAINT IF EXISTS regions_name_key;
ALTER TABLE public.regions ADD COLUMN IF NOT EXISTS code TEXT;

-- حذف داده‌های قبلی
TRUNCATE TABLE public.regions CASCADE;

-- Insert Provinces
INSERT INTO public.regions (name, type, code) VALUES
('استان قم', 'province', 'qom'),
('استان تهران', 'province', 'tehran'),
('استان البرز', 'province', 'alborz');

-- Helper function
CREATE OR REPLACE FUNCTION temp_add_district(p_province_id UUID, p_district_name TEXT, p_city_name TEXT)
RETURNS void AS $$
DECLARE
  v_district_id UUID;
BEGIN
  INSERT INTO public.regions (name, type, parent_id) 
  VALUES (p_district_name, 'district', p_province_id) 
  RETURNING id INTO v_district_id;
  
  INSERT INTO public.regions (name, type, parent_id) 
  VALUES (p_city_name, 'city', v_district_id);
END;
$$ LANGUAGE plpgsql;

-- قم با شهرستان و شهرهای مختلف
DO $$
DECLARE
  v_qom_id UUID;
  v_district_id UUID;
BEGIN
  SELECT id INTO v_qom_id FROM public.regions WHERE code = 'qom';
  
  INSERT INTO public.regions (name, type, parent_id) 
  VALUES ('شهر قم', 'district', v_qom_id) 
  RETURNING id INTO v_district_id;
  
  INSERT INTO public.regions (name, type, parent_id) VALUES
  ('جعفریه', 'city', v_district_id),
  ('سلفچگان', 'city', v_district_id),
  ('کهک', 'city', v_district_id);
END $$;

-- تهران
DO $$
DECLARE
  v_tehran_id UUID;
BEGIN
  SELECT id INTO v_tehran_id FROM public.regions WHERE code = 'tehran';
  
  PERFORM temp_add_district(v_tehran_id, 'تهران', 'تهران');
  PERFORM temp_add_district(v_tehran_id, 'ری', 'ری');
  PERFORM temp_add_district(v_tehran_id, 'شمیرانات', 'شمیرانات');
  PERFORM temp_add_district(v_tehran_id, 'اسلام‌شهر', 'اسلام‌شهر');
  PERFORM temp_add_district(v_tehran_id, 'بهارستان', 'بهارستان');
  PERFORM temp_add_district(v_tehran_id, 'قدس', 'قدس');
  PERFORM temp_add_district(v_tehran_id, 'ملارد', 'ملارد');
  PERFORM temp_add_district(v_tehran_id, 'رباط‌کریم', 'رباط‌کریم');
  PERFORM temp_add_district(v_tehran_id, 'شهریار', 'شهریار');
  PERFORM temp_add_district(v_tehran_id, 'پردیس', 'پردیس');
  PERFORM temp_add_district(v_tehran_id, 'دماوند', 'دماوند');
  PERFORM temp_add_district(v_tehran_id, 'فیروزکوه', 'فیروزکوه');
  PERFORM temp_add_district(v_tehran_id, 'ورامین', 'ورامین');
  PERFORM temp_add_district(v_tehran_id, 'پیشوا', 'پیشوا');
  PERFORM temp_add_district(v_tehran_id, 'قرچک', 'قرچک');
  PERFORM temp_add_district(v_tehran_id, 'پاکدشت', 'پاکدشت');
END $$;

-- البرز
DO $$
DECLARE
  v_alborz_id UUID;
BEGIN
  SELECT id INTO v_alborz_id FROM public.regions WHERE code = 'alborz';
  
  PERFORM temp_add_district(v_alborz_id, 'کرج', 'کرج');
  PERFORM temp_add_district(v_alborz_id, 'فردیس', 'فردیس');
  PERFORM temp_add_district(v_alborz_id, 'ساوجبلاغ', 'ساوجبلاغ');
  PERFORM temp_add_district(v_alborz_id, 'نظرآباد', 'نظرآباد');
  PERFORM temp_add_district(v_alborz_id, 'اشتهارد', 'اشتهارد');
  PERFORM temp_add_district(v_alborz_id, 'چهارباغ', 'چهارباغ');
  PERFORM temp_add_district(v_alborz_id, 'طالقان', 'طالقان');
END $$;

DROP FUNCTION temp_add_district;