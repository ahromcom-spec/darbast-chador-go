-- اضافه کردن دسترسی admin به جدول profiles برای مشاهده همه کاربران
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));