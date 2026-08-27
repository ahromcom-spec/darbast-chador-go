CREATE TABLE public.site_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  title text NOT NULL,
  body text,
  order_id uuid,
  order_code text,
  customer_name text,
  customer_phone text,
  actor_user_id uuid,
  source_table text,
  source_id uuid,
  is_important boolean NOT NULL DEFAULT false,
  is_dismissed boolean NOT NULL DEFAULT false,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_notifications TO authenticated;
GRANT ALL ON public.site_notifications TO service_role;

ALTER TABLE public.site_notifications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_site_notifications(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('ceo','general_manager','admin','executive_manager_scaffold_execution_with_materials','scaffold_executive_manager','operations_manager')
  )
$$;

CREATE POLICY "Managers can view site notifications"
ON public.site_notifications FOR SELECT TO authenticated
USING (public.can_manage_site_notifications(auth.uid()));

CREATE POLICY "Managers can update site notifications"
ON public.site_notifications FOR UPDATE TO authenticated
USING (public.can_manage_site_notifications(auth.uid()))
WITH CHECK (public.can_manage_site_notifications(auth.uid()));

CREATE POLICY "Managers can delete site notifications"
ON public.site_notifications FOR DELETE TO authenticated
USING (public.can_manage_site_notifications(auth.uid()));

CREATE INDEX idx_site_notifications_created_at ON public.site_notifications (created_at DESC);
CREATE INDEX idx_site_notifications_active ON public.site_notifications (is_dismissed, created_at DESC);

CREATE TRIGGER trg_site_notifications_updated_at
BEFORE UPDATE ON public.site_notifications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- رویداد پیام داخل سفارش
CREATE OR REPLACE FUNCTION public.notify_site_order_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p RECORD;
BEGIN
  SELECT code, customer_name, customer_phone INTO p FROM public.projects_v3 WHERE id = NEW.order_id;
  INSERT INTO public.site_notifications (event_type, title, body, order_id, order_code, customer_name, customer_phone, actor_user_id, source_table, source_id)
  VALUES ('order_message', 'پیام جدید در سفارش', NEW.message, NEW.order_id, p.code, p.customer_name, p.customer_phone, NEW.user_id, 'order_messages', NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_site_order_message
AFTER INSERT ON public.order_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_site_order_message();

-- رویداد ثبت سفارش جدید
CREATE OR REPLACE FUNCTION public.notify_site_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.site_notifications (event_type, title, body, order_id, order_code, customer_name, customer_phone, actor_user_id, source_table, source_id)
  VALUES ('new_order', 'ثبت سفارش جدید', NEW.notes, NEW.id, NEW.code, NEW.customer_name, NEW.customer_phone, NEW.customer_id, 'projects_v3', NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_site_new_order
AFTER INSERT ON public.projects_v3
FOR EACH ROW EXECUTE FUNCTION public.notify_site_new_order();

-- رویداد درخواست تعمیر
CREATE OR REPLACE FUNCTION public.notify_site_repair_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p RECORD;
BEGIN
  SELECT code, customer_name, customer_phone INTO p FROM public.projects_v3 WHERE id = NEW.order_id;
  INSERT INTO public.site_notifications (event_type, title, body, order_id, order_code, customer_name, customer_phone, source_table, source_id)
  VALUES ('repair_request', 'درخواست تعمیر داربست', NEW.description, NEW.order_id, p.code, p.customer_name, p.customer_phone, 'repair_requests', NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_site_repair_request
AFTER INSERT ON public.repair_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_site_repair_request();

-- رویداد درخواست جمع‌آوری
CREATE OR REPLACE FUNCTION public.notify_site_collection_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p RECORD;
BEGIN
  SELECT code, customer_name, customer_phone INTO p FROM public.projects_v3 WHERE id = NEW.order_id;
  INSERT INTO public.site_notifications (event_type, title, body, order_id, order_code, customer_name, customer_phone, source_table, source_id)
  VALUES ('collection_request', 'درخواست جمع‌آوری داربست', NEW.description, NEW.order_id, p.code, p.customer_name, p.customer_phone, 'collection_requests', NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_site_collection_request
AFTER INSERT ON public.collection_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_site_collection_request();

-- رویداد درخواست تمدید
CREATE OR REPLACE FUNCTION public.notify_site_renewal_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p RECORD;
BEGIN
  SELECT code, customer_name, customer_phone INTO p FROM public.projects_v3 WHERE id = NEW.order_id;
  INSERT INTO public.site_notifications (event_type, title, body, order_id, order_code, customer_name, customer_phone, source_table, source_id)
  VALUES ('renewal_request', 'درخواست تمدید داربست', NULL, NEW.order_id, p.code, p.customer_name, p.customer_phone, 'order_renewals', NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_site_renewal_request
AFTER INSERT ON public.order_renewals
FOR EACH ROW EXECUTE FUNCTION public.notify_site_renewal_request();