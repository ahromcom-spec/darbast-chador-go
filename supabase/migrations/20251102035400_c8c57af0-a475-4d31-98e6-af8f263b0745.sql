-- جدول پیام‌های سفارش برای تعامل بین کاربر و مدیران
CREATE TABLE public.order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.projects_v3(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_staff BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- فعال‌سازی RLS
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

-- Policy: کاربران می‌توانند پیام‌های سفارشات خود را ببینند
CREATE POLICY "Users can view own order messages"
ON public.order_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects_v3 p
    JOIN customers c ON c.id = p.customer_id
    WHERE p.id = order_messages.order_id 
    AND c.user_id = auth.uid()
  )
);

-- Policy: کاربران می‌توانند برای سفارشات خود پیام ارسال کنند
CREATE POLICY "Users can send messages for own orders"
ON public.order_messages
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM projects_v3 p
    JOIN customers c ON c.id = p.customer_id
    WHERE p.id = order_messages.order_id 
    AND c.user_id = auth.uid()
  )
);

-- Policy: مدیران می‌توانند همه پیام‌ها را ببینند
CREATE POLICY "Staff can view all messages"
ON public.order_messages
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'ceo'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'sales_manager'::app_role) OR
  has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
);

-- Policy: مدیران می‌توانند پیام ارسال کنند
CREATE POLICY "Staff can send messages"
ON public.order_messages
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'ceo'::app_role) OR
    has_role(auth.uid(), 'general_manager'::app_role) OR
    has_role(auth.uid(), 'sales_manager'::app_role) OR
    has_role(auth.uid(), 'scaffold_executive_manager'::app_role)
  )
);

-- فعال‌سازی Realtime برای به‌روزرسانی لحظه‌ای
ALTER TABLE public.order_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;

-- Trigger برای به‌روزرسانی updated_at
CREATE OR REPLACE FUNCTION update_order_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_order_messages_updated_at
BEFORE UPDATE ON public.order_messages
FOR EACH ROW
EXECUTE FUNCTION update_order_messages_updated_at();