
CREATE TABLE public.scaffolding_pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'تومان',
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.scaffolding_pricing_config TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scaffolding_pricing_config TO authenticated;
GRANT ALL ON public.scaffolding_pricing_config TO service_role;

ALTER TABLE public.scaffolding_pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pricing config"
ON public.scaffolding_pricing_config FOR SELECT
USING (true);

CREATE POLICY "CEO can insert pricing config"
ON public.scaffolding_pricing_config FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "CEO can update pricing config"
ON public.scaffolding_pricing_config FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "CEO can delete pricing config"
ON public.scaffolding_pricing_config FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'ceo'::app_role));

CREATE TRIGGER update_scaffolding_pricing_config_updated_at
BEFORE UPDATE ON public.scaffolding_pricing_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- مقادیر اولیه - دقیقاً برابر اعداد فعلی فرم
INSERT INTO public.scaffolding_pricing_config (key, category, label, value, unit, description, sort_order) VALUES
-- داربست سطحی نما
('facade_fixed_under_50', 'facade', 'داربست نما - قیمت ثابت زیر ۵۰ متر مربع', 3200000, 'تومان', 'متراژ <= 50', 10),
('facade_fixed_50_to_100', 'facade', 'داربست نما - قیمت ثابت ۵۰ تا ۱۰۰ متر مربع', 4200000, 'تومان', 'متراژ 50 تا 100', 11),
('facade_per_meter_over_100', 'facade', 'داربست نما - قیمت هر متر مربع بالای ۱۰۰', 45000, 'تومان/مترمربع', 'متراژ > 100', 12),

-- کفراژ (formwork)
('formwork_fixed_under_100', 'formwork', 'کفراژ - قیمت ثابت زیر ۱۰۰ متر مربع', 3200000, 'تومان', 'متراژ <= 100', 20),
('formwork_fixed_100_to_200', 'formwork', 'کفراژ - قیمت ثابت ۱۰۰ تا ۲۰۰ متر مربع', 4000000, 'تومان', 'متراژ 100 تا 200', 21),
('formwork_per_meter_over_200', 'formwork', 'کفراژ - قیمت هر متر مربع بالای ۲۰۰', 20000, 'تومان/مترمربع', 'متراژ > 200', 22),

-- زیر بتن تیرچه (یونولیت/سفال)
('ceiling_beam_fixed_under_100', 'ceiling_beam', 'زیربتن تیرچه - قیمت ثابت زیر ۱۰۰ متر مربع', 7500000, 'تومان', 'یونولیت و سفال', 30),
('ceiling_beam_fixed_100_to_200', 'ceiling_beam', 'زیربتن تیرچه - قیمت ثابت ۱۰۰ تا ۲۰۰ متر مربع', 11000000, 'تومان', 'یونولیت و سفال', 31),
('ceiling_beam_per_meter_over_200', 'ceiling_beam', 'زیربتن تیرچه - قیمت هر متر مربع بالای ۲۰۰', 45000, 'تومان/مترمربع', 'یونولیت و سفال', 32),

-- زیر بتن دال/وافل
('ceiling_slab_fixed_under_100', 'ceiling_slab', 'زیربتن دال/وافل - قیمت ثابت زیر ۱۰۰ متر مربع', 8000000, 'تومان', '', 40),
('ceiling_slab_fixed_100_to_200', 'ceiling_slab', 'زیربتن دال/وافل - قیمت ثابت ۱۰۰ تا ۲۰۰ متر مربع', 15000000, 'تومان', '', 41),
('ceiling_slab_per_meter_over_200', 'ceiling_slab', 'زیربتن دال/وافل - قیمت هر متر مربع بالای ۲۰۰', 70000, 'تومان/مترمربع', '', 42),

-- داربست به طول لوله مصرفی
('pipe_fixed_under_100m', 'pipe_length', 'داربست لوله‌ای - قیمت ثابت زیر ۱۰۰ متر لوله', 3200000, 'تومان', '', 50),
('pipe_fixed_100_to_200m', 'pipe_length', 'داربست لوله‌ای - قیمت ثابت ۱۰۰ تا ۲۰۰ متر لوله', 4200000, 'تومان', '', 51),
('pipe_per_meter_over_200', 'pipe_length', 'داربست لوله‌ای - قیمت هر متر لوله بالای ۲۰۰', 30000, 'تومان/متر', '', 52),

-- داربست ستونی
('column_price_per_unit', 'column', 'داربست ستونی - قیمت هر واحد', 1000000, 'تومان/واحد', 'هر 3 متر طول = 1 واحد، هر 3.5 متر ارتفاع = 1 طبقه', 60),

-- ضرایب فاصله از مرکز شهر (افزایش قیمت به ازای کیلومتر)
('distance_15_to_25_pct', 'distance', 'افزایش قیمت فاصله ۱۵ تا ۲۵ کیلومتر', 20, 'درصد', '+20%', 70),
('distance_25_to_50_pct', 'distance', 'افزایش قیمت فاصله ۲۵ تا ۵۰ کیلومتر', 40, 'درصد', '+40%', 71),
('distance_50_to_85_pct', 'distance', 'افزایش قیمت فاصله ۵۰ تا ۸۵ کیلومتر', 70, 'درصد', '+70%', 72),

-- ارتفاع پای کار
('platform_height_under_3_pct', 'platform_height', 'ارتفاع پای کار تا ۳ متر', 20, 'درصد', '+20%', 80),
('platform_height_3_to_6_pct', 'platform_height', 'ارتفاع پای کار ۳ تا ۶ متر', 40, 'درصد', '+40%', 81),
('platform_height_over_6_pct', 'platform_height', 'ارتفاع پای کار بیش از ۶ متر', 60, 'درصد', '+60%', 82),

-- ارتفاع داربست از پای کار
('scaffold_height_over_15_pct', 'scaffold_height', 'ارتفاع داربست بیش از ۱۵ متر', 20, 'درصد', '+20%', 90),

-- فاصله خودرو تا محل اجرا
('vehicle_distance_under_50_pct', 'vehicle_distance', 'فاصله خودرو تا ۵۰ متر', 10, 'درصد', '+10%', 100),
('vehicle_distance_50_to_100_pct', 'vehicle_distance', 'فاصله خودرو ۵۰ تا ۱۰۰ متر', 15, 'درصد', '+15%', 101),
('vehicle_distance_over_100_pct', 'vehicle_distance', 'فاصله خودرو بیش از ۱۰۰ متر', 25, 'درصد', '+25%', 102),

-- تخفیف اجاره چند ماهه (فقط نما)
('rental_discount_2_months_pct', 'rental_discount', 'تخفیف اجاره ۲ ماهه (نما)', 10, 'درصد', '-10% هر ماه', 110),
('rental_discount_3plus_months_pct', 'rental_discount', 'تخفیف اجاره ۳ ماهه یا بیشتر (نما)', 15, 'درصد', '-15% هر ماه', 111),

-- ضریب ماه‌های اضافی (غیر از نما)
('extra_month_factor_pct', 'extra_month', 'ضریب ماه‌های اضافی (سایر خدمات)', 70, 'درصد', 'هر ماه اضافه = 70% قیمت ماه اول', 120);
