-- ============================================
-- 1) Activity Logs table
-- ============================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  event_category text NOT NULL DEFAULT 'general',
  action text NOT NULL DEFAULT 'event',
  module_name text,
  entity_table text,
  entity_id text,
  title text,
  actor_user_id uuid,
  actor_name text,
  actor_phone text,
  actor_email text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  diff jsonb,
  ip_address text,
  user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_occurred_at ON public.activity_logs (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_event_type ON public.activity_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_event_category ON public.activity_logs (event_category);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module_name ON public.activity_logs (module_name);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_user_id ON public.activity_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs (entity_table, entity_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CEO can read activity logs"
  ON public.activity_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "CEO can delete activity logs"
  ON public.activity_logs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "Service role manages activity logs"
  ON public.activity_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated clients can insert their own activity entries (e.g. login events).
CREATE POLICY "Authenticated can insert own activity"
  ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (actor_user_id IS NULL OR actor_user_id = auth.uid());

-- ============================================
-- 2) Activity Email Rules table
-- ============================================
CREATE TABLE IF NOT EXISTS public.activity_email_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  event_types text[] NOT NULL DEFAULT '{}'::text[],
  event_categories text[] NOT NULL DEFAULT '{}'::text[],
  modules text[] NOT NULL DEFAULT '{}'::text[],
  actions text[] NOT NULL DEFAULT '{}'::text[],
  recipient_emails text[] NOT NULL DEFAULT '{}'::text[],
  details_filter jsonb,
  schedule text NOT NULL DEFAULT 'instant',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_email_rules TO authenticated;
GRANT ALL ON public.activity_email_rules TO service_role;

ALTER TABLE public.activity_email_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CEO manages email rules"
  ON public.activity_email_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'ceo'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "Service role manages email rules"
  ON public.activity_email_rules FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_activity_email_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_touch_activity_email_rules ON public.activity_email_rules;
CREATE TRIGGER trg_touch_activity_email_rules
BEFORE UPDATE ON public.activity_email_rules
FOR EACH ROW EXECUTE FUNCTION public.touch_activity_email_rules_updated_at();

-- ============================================
-- 3) Generic table-change activity logger
-- ============================================
CREATE OR REPLACE FUNCTION public.log_table_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_module text;
  v_action text;
  v_entity_id text;
  v_actor_id uuid;
  v_actor_name text;
  v_actor_phone text;
  v_actor_email text;
  v_title text;
  v_event_type text;
  v_details jsonb;
  v_diff jsonb;
BEGIN
  v_module := TG_ARGV[0]; -- friendly module name in Persian
  IF (TG_OP = 'INSERT') THEN
    v_action := 'insert';
    v_entity_id := COALESCE((NEW.id)::text, NULL);
    v_details := to_jsonb(NEW);
  ELSIF (TG_OP = 'UPDATE') THEN
    v_action := 'update';
    v_entity_id := COALESCE((NEW.id)::text, NULL);
    v_details := jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW));
    v_diff := to_jsonb(NEW) - to_jsonb(OLD);
  ELSE
    v_action := 'delete';
    v_entity_id := COALESCE((OLD.id)::text, NULL);
    v_details := to_jsonb(OLD);
  END IF;

  -- Try to resolve actor from auth.uid() (works for authenticated session writes)
  BEGIN
    v_actor_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_actor_id := NULL;
  END;

  IF v_actor_id IS NOT NULL THEN
    SELECT full_name, phone_number, email
      INTO v_actor_name, v_actor_phone, v_actor_email
    FROM public.profiles
    WHERE id = v_actor_id
    LIMIT 1;
  END IF;

  v_event_type := v_module || ' - ' || CASE v_action
    WHEN 'insert' THEN 'ثبت جدید'
    WHEN 'update' THEN 'ویرایش'
    WHEN 'delete' THEN 'حذف'
    ELSE v_action
  END;
  v_title := v_event_type || ' در ' || TG_TABLE_NAME;

  INSERT INTO public.activity_logs(
    event_type, event_category, action, module_name,
    entity_table, entity_id, title,
    actor_user_id, actor_name, actor_phone, actor_email,
    details, diff
  ) VALUES (
    v_event_type, 'module_change', v_action, v_module,
    TG_TABLE_NAME, v_entity_id, v_title,
    v_actor_id, v_actor_name, v_actor_phone, v_actor_email,
    v_details, v_diff
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- never break the original write because of logging
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Helper: attach trigger to a table with a friendly module name
CREATE OR REPLACE FUNCTION public.attach_activity_trigger(p_table text, p_module text)
RETURNS void AS $$
DECLARE
  v_trigger text := 'trg_activity_log_' || p_table;
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_trigger, p_table);
  EXECUTE format(
    'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_table_activity(%L)',
    v_trigger, p_table, p_module
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach to high-value tables
SELECT public.attach_activity_trigger('projects_v3',                'سفارشات');
SELECT public.attach_activity_trigger('order_payments',             'پرداخت‌های سفارش');
SELECT public.attach_activity_trigger('order_renewals',             'تمدید سفارش');
SELECT public.attach_activity_trigger('order_transfer_requests',    'انتقال سفارش');
SELECT public.attach_activity_trigger('daily_reports',              'گزارش روزانه');
SELECT public.attach_activity_trigger('daily_report_orders',        'سطرهای گزارش روزانه');
SELECT public.attach_activity_trigger('daily_report_staff',         'پرسنل گزارش روزانه');
SELECT public.attach_activity_trigger('bank_cards',                 'کارت‌های بانکی');
SELECT public.attach_activity_trigger('bank_card_transactions',     'تراکنش‌های بانکی');
SELECT public.attach_activity_trigger('hr_employees',               'منابع انسانی');
SELECT public.attach_activity_trigger('staff_salary_settings',      'تنظیمات حقوق');
SELECT public.attach_activity_trigger('customers',                  'مشتریان');
SELECT public.attach_activity_trigger('profiles',                   'پروفایل کاربران');
SELECT public.attach_activity_trigger('expert_pricing_requests',    'درخواست‌های قیمت کارشناسی');
SELECT public.attach_activity_trigger('collection_requests',        'درخواست‌های وصول');
SELECT public.attach_activity_trigger('scaffolding_pricing_config', 'قیمت‌گذاری داربست');
SELECT public.attach_activity_trigger('module_assignments',         'اختصاص ماژول‌ها');
SELECT public.attach_activity_trigger('user_roles',                 'نقش‌های کاربری');
SELECT public.attach_activity_trigger('phone_whitelist',            'وایت‌لیست شماره‌ها');
SELECT public.attach_activity_trigger('cheques',                    'چک‌ها');
SELECT public.attach_activity_trigger('wallet_transactions',        'تراکنش‌های کیف پول');

-- ============================================
-- 4) Email rule evaluator on activity_logs INSERT
-- ============================================
CREATE OR REPLACE FUNCTION public.dispatch_activity_email_rules()
RETURNS TRIGGER AS $$
DECLARE
  v_rule record;
  v_supabase_url text := 'https://gclbltatkbwbqxqqrcea.supabase.co';
  v_recipient text;
  v_payload jsonb;
  v_occurred text;
BEGIN
  v_occurred := to_char(NEW.occurred_at AT TIME ZONE 'Asia/Tehran', 'YYYY-MM-DD HH24:MI:SS');

  FOR v_rule IN
    SELECT * FROM public.activity_email_rules
    WHERE enabled = true AND schedule = 'instant'
  LOOP
    -- match filters (empty array = match all)
    IF array_length(v_rule.event_types, 1) IS NOT NULL
       AND NOT (NEW.event_type = ANY (v_rule.event_types))
       AND NOT EXISTS (SELECT 1 FROM unnest(v_rule.event_types) e WHERE NEW.event_type ILIKE '%' || e || '%')
    THEN CONTINUE; END IF;

    IF array_length(v_rule.event_categories, 1) IS NOT NULL
       AND NOT (NEW.event_category = ANY (v_rule.event_categories))
    THEN CONTINUE; END IF;

    IF array_length(v_rule.modules, 1) IS NOT NULL
       AND (NEW.module_name IS NULL OR NOT (NEW.module_name = ANY (v_rule.modules)))
    THEN CONTINUE; END IF;

    IF array_length(v_rule.actions, 1) IS NOT NULL
       AND NOT (NEW.action = ANY (v_rule.actions))
    THEN CONTINUE; END IF;

    -- Send to each recipient
    IF array_length(v_rule.recipient_emails, 1) IS NULL THEN CONTINUE; END IF;

    FOREACH v_recipient IN ARRAY v_rule.recipient_emails LOOP
      v_payload := jsonb_build_object(
        'templateName', 'activity-report',
        'recipientEmail', v_recipient,
        'idempotencyKey', 'activity-rule-' || v_rule.id::text || '-' || NEW.id::text,
        'templateData', jsonb_build_object(
          'eventType', NEW.event_type,
          'title', COALESCE(NEW.title, NEW.event_type),
          'actorName', NEW.actor_name,
          'actorPhone', NEW.actor_phone,
          'occurredAt', v_occurred,
          'details', NEW.details
        )
      );
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-transactional-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
          ),
          body := v_payload
        );
      EXCEPTION WHEN OTHERS THEN
        -- swallow network errors; do not block insert
        NULL;
      END;
    END LOOP;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_dispatch_activity_email ON public.activity_logs;
CREATE TRIGGER trg_dispatch_activity_email
AFTER INSERT ON public.activity_logs
FOR EACH ROW EXECUTE FUNCTION public.dispatch_activity_email_rules();

-- ============================================
-- 5) Retention: delete logs older than 1 year
-- ============================================
CREATE OR REPLACE FUNCTION public.purge_old_activity_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.activity_logs WHERE occurred_at < now() - interval '365 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('purge-activity-logs');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'purge-activity-logs',
      '0 3 * * *',
      $cron$ SELECT public.purge_old_activity_logs(); $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;