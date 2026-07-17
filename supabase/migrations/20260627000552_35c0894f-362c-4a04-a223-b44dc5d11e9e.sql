
CREATE TABLE public.sms_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  scope TEXT NOT NULL DEFAULT 'customer',
  template TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sms_templates TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.sms_templates TO authenticated;
GRANT ALL ON public.sms_templates TO service_role;

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read sms templates"
  ON public.sms_templates FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage sms templates"
  ON public.sms_templates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_sms_templates_updated_at
  BEFORE UPDATE ON public.sms_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.sms_templates (key, title, description, scope, template) VALUES
  ('submitted', 'ثبت سفارش (مشتری)', 'پس از ثبت اولیه سفارش به مشتری ارسال می‌شود.', 'customer', '📋 سفارش جدید: کد {code} - {serviceType} - آدرس: {address} - مشتری: {customerName} - تاریخ: {dateTime}'),
  ('approved', 'تایید سفارش (مشتری)', 'پس از تایید سفارش توسط مدیریت به مشتری ارسال می‌شود.', 'customer', '📋 سفارش جدید: کد {code} - {serviceType} - آدرس: {address} - مشتری: {customerName} - تاریخ: {dateTime}'),
  ('in_progress', 'شروع اجرا (مشتری)', 'هنگام شروع عملیات اجرایی برای مشتری ارسال می‌شود.', 'customer', '📋 سفارش جدید: کد {code} - {serviceType} - آدرس: {address} - مشتری: {customerName} - تاریخ: {dateTime}'),
  ('executed', 'پایان اجرا (مشتری)', 'پس از اتمام مرحله اجرا.', 'customer', '📋 سفارش جدید: کد {code} - {serviceType} - آدرس: {address} - مشتری: {customerName} - تاریخ: {dateTime}'),
  ('awaiting_payment', 'در انتظار پرداخت (مشتری)', 'یادآور پرداخت به مشتری.', 'customer', '📋 سفارش جدید: کد {code} - {serviceType} - آدرس: {address} - مشتری: {customerName} - تاریخ: {dateTime}'),
  ('paid', 'پرداخت موفق (مشتری)', 'تایید دریافت وجه به مشتری.', 'customer', '📋 سفارش جدید: کد {code} - {serviceType} - آدرس: {address} - مشتری: {customerName} - تاریخ: {dateTime}'),
  ('in_collection', 'جمع‌آوری (مشتری)', 'شروع مرحله جمع‌آوری.', 'customer', '📋 سفارش جدید: کد {code} - {serviceType} - آدرس: {address} - مشتری: {customerName} - تاریخ: {dateTime}'),
  ('completed', 'اتمام سفارش (مشتری)', 'پایان کامل سفارش.', 'customer', '📋 سفارش جدید: کد {code} - {serviceType} - آدرس: {address} - مشتری: {customerName} - تاریخ: {dateTime}'),
  ('ceo_new_order', 'سفارش جدید (مدیرعامل)', 'اعلام سفارش جدید به مدیرعامل.', 'ceo', '📋 سفارش جدید: کد {code} - {serviceType} - آدرس: {address} - مشتری: {customerName} - تاریخ: {dateTime}'),
  ('ceo_payment', 'پرداخت سفارش (مدیرعامل)', 'اعلام دریافت وجه به مدیرعامل.', 'ceo', '📋 سفارش جدید: کد {code} - {serviceType} - آدرس: {address} - مشتری: {customerName} - تاریخ: {dateTime}');
