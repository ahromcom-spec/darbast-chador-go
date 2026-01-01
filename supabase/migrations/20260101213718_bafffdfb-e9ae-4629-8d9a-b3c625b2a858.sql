-- سیاست برای اجازه خواندن توکن‌ها توسط سرویس
CREATE POLICY "Service role can read all subscriptions" 
ON public.najva_subscriptions 
FOR SELECT 
TO service_role
USING (true);