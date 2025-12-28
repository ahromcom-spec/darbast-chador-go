-- جدول درخواست‌های تمدید سفارش
CREATE TABLE public.order_renewals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.projects_v3(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  renewal_number INTEGER NOT NULL DEFAULT 1, -- شماره سری تمدید (1 تا 12)
  
  -- تاریخ‌ها
  previous_end_date TIMESTAMP WITH TIME ZONE, -- تاریخ پایان دوره قبلی
  new_start_date TIMESTAMP WITH TIME ZONE NOT NULL, -- تاریخ شروع دوره جدید
  new_end_date TIMESTAMP WITH TIME ZONE, -- تاریخ پایان دوره جدید (یک ماه بعد)
  
  -- قیمت
  original_price NUMERIC, -- قیمت اصلی سفارش
  renewal_price NUMERIC, -- قیمت تمدید (ممکن است توسط مدیر تغییر کند)
  
  -- وضعیت
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  
  -- تایید مدیر
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  manager_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- محدودیت: هر سفارش حداکثر 12 بار تمدید
  CONSTRAINT renewal_number_max CHECK (renewal_number >= 1 AND renewal_number <= 12),
  -- محدودیت: هر شماره سری فقط یکبار برای هر سفارش
  CONSTRAINT unique_renewal_per_order UNIQUE (order_id, renewal_number)
);

-- Enable RLS
ALTER TABLE public.order_renewals ENABLE ROW LEVEL SECURITY;

-- سیاست‌های دسترسی
-- مشتریان می‌توانند تمدیدهای خود را ببینند
CREATE POLICY "Customers can view their own renewals" 
ON public.order_renewals 
FOR SELECT 
USING (
  customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
);

-- مشتریان می‌توانند درخواست تمدید ایجاد کنند
CREATE POLICY "Customers can create renewal requests" 
ON public.order_renewals 
FOR INSERT 
WITH CHECK (
  customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
);

-- مدیران می‌توانند همه تمدیدها را ببینند
CREATE POLICY "Staff can view all renewals" 
ON public.order_renewals 
FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM internal_staff_profiles WHERE user_id = auth.uid() AND status = 'verified')
);

-- مدیران می‌توانند تمدیدها را به‌روزرسانی کنند (تایید/رد)
CREATE POLICY "Staff can update renewals" 
ON public.order_renewals 
FOR UPDATE 
USING (
  EXISTS (SELECT 1 FROM internal_staff_profiles WHERE user_id = auth.uid() AND status = 'verified')
);

-- مدیران می‌توانند تمدید ایجاد کنند
CREATE POLICY "Staff can create renewals" 
ON public.order_renewals 
FOR INSERT 
WITH CHECK (
  EXISTS (SELECT 1 FROM internal_staff_profiles WHERE user_id = auth.uid() AND status = 'verified')
);

-- ایندکس‌ها
CREATE INDEX idx_order_renewals_order_id ON public.order_renewals(order_id);
CREATE INDEX idx_order_renewals_customer_id ON public.order_renewals(customer_id);
CREATE INDEX idx_order_renewals_status ON public.order_renewals(status);

-- تریگر برای به‌روزرسانی updated_at
CREATE TRIGGER update_order_renewals_updated_at
BEFORE UPDATE ON public.order_renewals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();