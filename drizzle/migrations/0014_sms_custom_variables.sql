CREATE TABLE public.sms_custom_variables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  label text NOT NULL,
  source_key text NOT NULL,
  format text NOT NULL DEFAULT 'auto',
  fallback text NOT NULL DEFAULT 'ثبت نشده',
  prefix text NOT NULL DEFAULT '',
  suffix text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sms_custom_variables_token_format CHECK (token ~ '^[^{}[:space:]]{2,40}$'),
  CONSTRAINT sms_custom_variables_label_len CHECK (char_length(label) BETWEEN 1 AND 80)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_custom_variables TO authenticated;
GRANT ALL ON public.sms_custom_variables TO service_role;

ALTER TABLE public.sms_custom_variables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers manage sms custom variables"
ON public.sms_custom_variables
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'ceo'::app_role) OR public.has_role(auth.uid(), 'general_manager'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'ceo'::app_role) OR public.has_role(auth.uid(), 'general_manager'::app_role));

CREATE TRIGGER sms_custom_variables_set_updated_at
BEFORE UPDATE ON public.sms_custom_variables
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();