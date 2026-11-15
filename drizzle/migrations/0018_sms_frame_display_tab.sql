ALTER TABLE public.sms_templates ADD COLUMN IF NOT EXISTS display_tab text;
ALTER TABLE public.sms_templates DROP CONSTRAINT IF EXISTS sms_templates_display_tab_check;
ALTER TABLE public.sms_templates ADD CONSTRAINT sms_templates_display_tab_check
  CHECK (display_tab IS NULL OR (scope = 'custom' AND display_tab IN ('customer', 'ceo')));
COMMENT ON COLUMN public.sms_templates.display_tab IS 'Management screen tab where a custom frame is shown in addition to the frames tab (customer|ceo); display only, never affects sending.';