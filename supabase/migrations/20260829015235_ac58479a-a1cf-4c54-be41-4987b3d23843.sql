ALTER TABLE public.order_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.mark_order_message_edited()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.message IS DISTINCT FROM OLD.message THEN
    NEW.edited_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_order_message_edited ON public.order_messages;
CREATE TRIGGER trg_mark_order_message_edited
BEFORE UPDATE ON public.order_messages
FOR EACH ROW EXECUTE FUNCTION public.mark_order_message_edited();

CREATE OR REPLACE FUNCTION public.notify_site_order_message_edited()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p RECORD;
BEGIN
  IF NEW.message IS DISTINCT FROM OLD.message THEN
    SELECT code, customer_name, customer_phone INTO p FROM public.projects_v3 WHERE id = NEW.order_id;
    INSERT INTO public.site_notifications (event_type, title, body, order_id, order_code, customer_name, customer_phone, actor_user_id, source_table, source_id)
    VALUES ('order_message_edited', 'ویرایش پیام سفارش', NEW.message, NEW.order_id, p.code, p.customer_name, p.customer_phone, NEW.user_id, 'order_messages', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_site_order_message_edited ON public.order_messages;
CREATE TRIGGER trg_notify_site_order_message_edited
AFTER UPDATE ON public.order_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_site_order_message_edited();