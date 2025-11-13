-- افزودن فیلد برای تمدید سفارش
ALTER TABLE public.projects_v3
ADD COLUMN IF NOT EXISTS is_renewal boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS original_order_id uuid REFERENCES public.projects_v3(id);

-- ایجاد ایندکس برای بهبود عملکرد
CREATE INDEX IF NOT EXISTS idx_projects_v3_original_order_id ON public.projects_v3(original_order_id);

COMMENT ON COLUMN public.projects_v3.is_renewal IS 'نشان می‌دهد که آیا این سفارش یک تمدید است یا خیر';
COMMENT ON COLUMN public.projects_v3.original_order_id IS 'شناسه سفارش اصلی که این سفارش تمدید آن است';