-- فاز 1 - مرحله 3: تعریف Policies برای جداول جدید

-- فعال‌سازی RLS
ALTER TABLE public.staff_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies برای staff_whitelist
DROP POLICY IF EXISTS "GM select whitelist" ON public.staff_whitelist;
DROP POLICY IF EXISTS "GM insert whitelist" ON public.staff_whitelist;
DROP POLICY IF EXISTS "GM update whitelist" ON public.staff_whitelist;
DROP POLICY IF EXISTS "GM delete whitelist" ON public.staff_whitelist;

CREATE POLICY "GM select whitelist"
  ON public.staff_whitelist FOR SELECT
  USING (has_role(auth.uid(), 'general_manager'));

CREATE POLICY "GM insert whitelist"
  ON public.staff_whitelist FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'general_manager'));

CREATE POLICY "GM update whitelist"
  ON public.staff_whitelist FOR UPDATE
  USING (has_role(auth.uid(), 'general_manager'));

CREATE POLICY "GM delete whitelist"
  ON public.staff_whitelist FOR DELETE
  USING (has_role(auth.uid(), 'general_manager'));

-- RLS Policies برای staff_profiles
DROP POLICY IF EXISTS "User select own staff profile" ON public.staff_profiles;
DROP POLICY IF EXISTS "User insert staff profile" ON public.staff_profiles;
DROP POLICY IF EXISTS "GM select all staff profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "GM update staff profiles" ON public.staff_profiles;

CREATE POLICY "User select own staff profile"
  ON public.staff_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "User insert staff profile"
  ON public.staff_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "GM select all staff profiles"
  ON public.staff_profiles FOR SELECT
  USING (has_role(auth.uid(), 'general_manager'));

CREATE POLICY "GM update staff profiles"
  ON public.staff_profiles FOR UPDATE
  USING (has_role(auth.uid(), 'general_manager'));

-- RLS Policies برای audit_log
DROP POLICY IF EXISTS "GM select audit log" ON public.audit_log;
DROP POLICY IF EXISTS "System insert audit log" ON public.audit_log;

CREATE POLICY "GM select audit log"
  ON public.audit_log FOR SELECT
  USING (has_role(auth.uid(), 'general_manager'));

CREATE POLICY "System insert audit log"
  ON public.audit_log FOR INSERT
  WITH CHECK (true);