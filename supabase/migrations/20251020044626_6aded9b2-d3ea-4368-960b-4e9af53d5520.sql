-- اضافه کردن فیلد hierarchy_project_id به projects_v3 برای لینک کردن سفارشات به پروژه‌های hierarchy
ALTER TABLE public.projects_v3
ADD COLUMN hierarchy_project_id uuid REFERENCES public.projects_hierarchy(id);

-- ایجاد index برای بهبود performance
CREATE INDEX idx_projects_v3_hierarchy_project_id ON public.projects_v3(hierarchy_project_id);

-- اضافه کردن کامنت توضیحی
COMMENT ON COLUMN public.projects_v3.hierarchy_project_id IS 'لینک به پروژه در projects_hierarchy برای سازماندهی سلسله مراتبی';