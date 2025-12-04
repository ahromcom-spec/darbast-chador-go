-- حذف سیاست قبلی که محدودیت اشتباه داشت
DROP POLICY IF EXISTS "Managers can upload project media" ON public.project_media;

-- ایجاد سیاست جدید که مدیران بتوانند به هر سفارشی مدیا اضافه کنند
CREATE POLICY "Managers can upload project media" 
ON public.project_media 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'ceo'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role) OR 
  has_role(auth.uid(), 'sales_manager'::app_role) OR 
  has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR 
  has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
);