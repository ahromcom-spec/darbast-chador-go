-- Create table for storing push notification subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users can view their own subscriptions" 
ON public.push_subscriptions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions" 
ON public.push_subscriptions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions" 
ON public.push_subscriptions FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to send notification when order status changes
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_body TEXT;
  customer_user_id UUID;
BEGIN
  -- Get customer's user_id
  SELECT c.user_id INTO customer_user_id
  FROM customers c
  WHERE c.id = NEW.customer_id;

  -- Only notify if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Set notification message based on new status
    CASE NEW.status
      WHEN 'approved' THEN
        notification_title := 'سفارش تایید شد';
        notification_body := 'سفارش شما با کد ' || NEW.code || ' توسط مدیریت تایید شد';
      WHEN 'rejected' THEN
        notification_title := 'سفارش رد شد';
        notification_body := 'متاسفانه سفارش شما با کد ' || NEW.code || ' رد شد';
      WHEN 'in_progress' THEN
        notification_title := 'سفارش در حال اجرا';
        notification_body := 'سفارش شما با کد ' || NEW.code || ' در حال اجرا است';
      WHEN 'completed' THEN
        notification_title := 'سفارش تکمیل شد';
        notification_body := 'سفارش شما با کد ' || NEW.code || ' با موفقیت تکمیل شد';
      ELSE
        notification_title := 'به‌روزرسانی سفارش';
        notification_body := 'وضعیت سفارش شما با کد ' || NEW.code || ' تغییر کرد';
    END CASE;

    -- Insert notification into notifications table
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (
      customer_user_id,
      notification_title,
      notification_body,
      CASE 
        WHEN NEW.status = 'approved' THEN 'success'
        WHEN NEW.status = 'rejected' THEN 'error'
        ELSE 'info'
      END,
      '/order/' || NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for order status changes
DROP TRIGGER IF EXISTS on_order_status_change ON public.projects_v3;
CREATE TRIGGER on_order_status_change
  AFTER UPDATE ON public.projects_v3
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_status_change();