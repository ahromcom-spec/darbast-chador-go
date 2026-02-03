
-- اصلاح RLS policy برای projects_hierarchy
-- کاربران باید بتوانند پروژه‌هایی را ببینند که:
-- 1. مالک آنها هستند (user_id = auth.uid())
-- 2. یا به عنوان مشتری در سفارشات آن پروژه ثبت شده‌اند

-- ابتدا policy قدیمی را حذف می‌کنیم
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects_hierarchy;

-- policy جدید با پشتیبانی از مشتریان
CREATE POLICY "Users can view own or customer projects" 
ON public.projects_hierarchy 
FOR SELECT 
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM projects_v3 pv
    JOIN customers c ON pv.customer_id = c.id
    WHERE pv.hierarchy_project_id = projects_hierarchy.id
    AND c.user_id = auth.uid()
  )
);
