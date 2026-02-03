
-- اصلاح RLS policy برای locations
-- کاربران باید بتوانند مکان‌هایی را ببینند که:
-- 1. مالک آنها هستند (user_id = auth.uid())
-- 2. یا به عنوان مشتری در پروژه‌های آن مکان سفارش ثبت کرده‌اند

-- ابتدا policy قدیمی را حذف می‌کنیم
DROP POLICY IF EXISTS "Users can view own locations" ON public.locations;

-- policy جدید با پشتیبانی از مشتریان
CREATE POLICY "Users can view own or customer locations" 
ON public.locations 
FOR SELECT 
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM projects_hierarchy ph
    JOIN projects_v3 pv ON pv.hierarchy_project_id = ph.id
    JOIN customers c ON pv.customer_id = c.id
    WHERE ph.location_id = locations.id
    AND c.user_id = auth.uid()
  )
);
