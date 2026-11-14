ALTER TABLE public.sms_templates
  ADD COLUMN IF NOT EXISTS stage_key text,
  ADD COLUMN IF NOT EXISTS service_subcategory_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS excluded_subcategory_ids uuid[] NOT NULL DEFAULT '{}';

UPDATE public.sms_templates SET stage_key = key WHERE stage_key IS NULL;

ALTER TABLE public.sms_templates ALTER COLUMN stage_key SET NOT NULL;

CREATE INDEX IF NOT EXISTS sms_templates_stage_key_idx ON public.sms_templates (stage_key);

COMMENT ON COLUMN public.sms_templates.stage_key IS 'Order stage/event this message belongs to; several rows may share it (general + service-specific variants).';
COMMENT ON COLUMN public.sms_templates.service_subcategory_ids IS 'Target services (subcategories). Empty = general message for all services.';
COMMENT ON COLUMN public.sms_templates.excluded_subcategory_ids IS 'Services that never receive this general message.';

GRANT SELECT ON public.sms_templates TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.sms_templates TO authenticated;
GRANT ALL ON public.sms_templates TO service_role;