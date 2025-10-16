-- Create activity_types table alone
CREATE TABLE IF NOT EXISTS public.activity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.activity_types ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'activity_types' AND policyname = 'Anyone can view active activity types'
  ) THEN
    CREATE POLICY "Anyone can view active activity types"
    ON public.activity_types FOR SELECT
    USING (is_active = true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'activity_types' AND policyname = 'Only admins can manage activity types'
  ) THEN
    CREATE POLICY "Only admins can manage activity types"
    ON public.activity_types FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role));
  END IF;
END $$;

INSERT INTO public.activity_types (name) VALUES
('اجراء با نیروهای اهرم و با اجناس، ابزارالات و ماشین آلات اهرم'),
('اجراء با نیروهای اهرم بدون اجناس، ابزارالات و ماشین آلات اهرم'),
('اجراء با نیروهای پیمانکاران و با اجناس، ابزارالات و ماشین آلات اهرم'),
('اجراء با نیروهای پیمانکاران و با اجناس، ابزارالات و ماشین آلات کاربر مشتری یا کارفرما'),
('خرید کالا و اجناس برای اهرم'),
('فروش از کالاها و اجناس اهرم'),
('کرایه دادن اهرم از اجناس یا موارد خدمات مشخص'),
('کرایه گرفتن اهرم از اجناس یا موارد خدمات مشخص'),
('تولید کالای خدمات مشخص'),
('تعمیر'),
('پورسانت واسطه گری اهرم برای پیمانکاران'),
('پورسانت واسطه گری پیمانکاران برای اهرم'),
('تأمین نیرو از طرف اهرم برای پیمانکاران'),
('تأمین نیرو از طرف پیمانکاران برای اهرم')
ON CONFLICT (name) DO NOTHING;