ALTER TABLE public.project_media ADD COLUMN IF NOT EXISTS bale_sent_at timestamptz;
UPDATE public.project_media SET bale_sent_at = now() WHERE bale_sent_at IS NULL;

CREATE OR REPLACE FUNCTION public.notify_bale_new_project_media()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://gclbltatkbwbqxqqrcea.supabase.co/functions/v1/bale-order-media',
    headers := jsonb_build_object('Content-Type','application/json','apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbGJsdGF0a2J3YnF4cXFyY2VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNjI3MTIsImV4cCI6MjA3NDczODcxMn0.XMlZkzDNSdGtUINYlIqInoAbSyK4pGgZGZT--KOzNYM'),
    body := jsonb_build_object('media_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bale_new_project_media ON public.project_media;
CREATE TRIGGER trg_bale_new_project_media AFTER INSERT ON public.project_media
FOR EACH ROW EXECUTE FUNCTION public.notify_bale_new_project_media();