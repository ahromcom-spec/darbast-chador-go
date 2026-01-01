-- جدول برای ذخیره توکن‌های نجوا
CREATE TABLE IF NOT EXISTS public.najva_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subscriber_token TEXT NOT NULL UNIQUE,
  device_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ایندکس برای جستجوی سریع بر اساس user_id
CREATE INDEX IF NOT EXISTS idx_najva_subscriptions_user_id ON public.najva_subscriptions(user_id);

-- فعال‌سازی RLS
ALTER TABLE public.najva_subscriptions ENABLE ROW LEVEL SECURITY;

-- سیاست‌های RLS
CREATE POLICY "Users can view their own subscriptions" 
ON public.najva_subscriptions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions" 
ON public.najva_subscriptions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions" 
ON public.najva_subscriptions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions" 
ON public.najva_subscriptions 
FOR DELETE 
USING (auth.uid() = user_id);

-- تریگر برای به‌روزرسانی updated_at
CREATE OR REPLACE TRIGGER update_najva_subscriptions_updated_at
BEFORE UPDATE ON public.najva_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();