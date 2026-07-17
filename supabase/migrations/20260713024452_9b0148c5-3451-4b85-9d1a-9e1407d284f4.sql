-- Trigger to notify approved contractors via SMS when a new service_request is created
CREATE OR REPLACE FUNCTION public.notify_contractors_on_new_service_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := 'https://gclbltatkbwbqxqqrcea.supabase.co/functions/v1/notify-contractors-new-request';
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('service_request_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    -- never block insertion of service requests
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_contractors_new_request ON public.service_requests;

CREATE TRIGGER trg_notify_contractors_new_request
AFTER INSERT ON public.service_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_contractors_on_new_service_request();