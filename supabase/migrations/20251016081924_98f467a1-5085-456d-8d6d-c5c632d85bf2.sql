-- ایجاد جداول phone_whitelist و verification_requests
CREATE TABLE IF NOT EXISTS public.phone_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  allowed_roles TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.phone_whitelist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only CEO can manage whitelist"
ON public.phone_whitelist
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'ceo'::app_role))
WITH CHECK (has_role(auth.uid(), 'ceo'::app_role));

-- جدول contractor_verification_requests
CREATE TABLE IF NOT EXISTS public.contractor_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  phone_number TEXT NOT NULL,
  company_name TEXT NOT NULL,
  service_category_id UUID REFERENCES public.service_categories(id),
  activity_type_id UUID REFERENCES public.activity_types(id),
  region_id UUID REFERENCES public.regions(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.contractor_verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own request"
ON public.contractor_verification_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own request"
ON public.contractor_verification_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "CEO can manage all requests"
ON public.contractor_verification_requests
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role));

-- جدول staff_verification_requests
CREATE TABLE IF NOT EXISTS public.staff_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  phone_number TEXT NOT NULL,
  requested_role app_role NOT NULL,
  position_id UUID REFERENCES public.organizational_positions(id),
  region_id UUID REFERENCES public.regions(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, requested_role)
);

ALTER TABLE public.staff_verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own staff request"
ON public.staff_verification_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own staff request"
ON public.staff_verification_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "CEO can manage all staff requests"
ON public.staff_verification_requests
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'ceo'::app_role))
WITH CHECK (has_role(auth.uid(), 'ceo'::app_role));

-- تابع بررسی whitelist
CREATE OR REPLACE FUNCTION public.check_phone_whitelist(_phone TEXT)
RETURNS TABLE(is_whitelisted BOOLEAN, allowed_roles TEXT[])
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    EXISTS(SELECT 1 FROM public.phone_whitelist WHERE phone_number = _phone)::BOOLEAN,
    COALESCE((SELECT allowed_roles FROM public.phone_whitelist WHERE phone_number = _phone LIMIT 1), '{}');
$$;

-- Triggerها
CREATE OR REPLACE FUNCTION public.auto_approve_contractor_if_whitelisted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_whitelisted BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.phone_whitelist 
    WHERE phone_number = NEW.phone_number 
    AND 'contractor' = ANY(allowed_roles)
  ) INTO v_whitelisted;
  
  IF v_whitelisted THEN
    NEW.status := 'approved';
    NEW.verified_at := now();
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'contractor'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER contractor_auto_approve
BEFORE INSERT ON public.contractor_verification_requests
FOR EACH ROW
EXECUTE FUNCTION public.auto_approve_contractor_if_whitelisted();

CREATE OR REPLACE FUNCTION public.handle_contractor_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'contractor'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    PERFORM public.send_notification(
      NEW.user_id,
      'درخواست تأیید شد',
      'درخواست پیمانکاری شما تأیید شد.',
      '/profile',
      'success'
    );
  ELSIF OLD.status = 'pending' AND NEW.status = 'rejected' THEN
    PERFORM public.send_notification(
      NEW.user_id,
      'درخواست رد شد',
      'درخواست پیمانکاری شما رد شد. دلیل: ' || COALESCE(NEW.rejection_reason, 'ذکر نشده'),
      '/profile',
      'error'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER contractor_verification_status_change
AFTER UPDATE ON public.contractor_verification_requests
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.handle_contractor_verification();

CREATE OR REPLACE FUNCTION public.auto_approve_staff_if_whitelisted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_whitelisted BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.phone_whitelist 
    WHERE phone_number = NEW.phone_number 
    AND NEW.requested_role::TEXT = ANY(allowed_roles)
  ) INTO v_whitelisted;
  
  IF v_whitelisted THEN
    NEW.status := 'approved';
    NEW.verified_at := now();
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, NEW.requested_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER staff_auto_approve
BEFORE INSERT ON public.staff_verification_requests
FOR EACH ROW
EXECUTE FUNCTION public.auto_approve_staff_if_whitelisted();

CREATE OR REPLACE FUNCTION public.handle_staff_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, NEW.requested_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    PERFORM public.send_notification(
      NEW.user_id,
      'درخواست تأیید شد',
      'درخواست نقش ' || NEW.requested_role || ' شما تأیید شد.',
      '/profile',
      'success'
    );
  ELSIF OLD.status = 'pending' AND NEW.status = 'rejected' THEN
    PERFORM public.send_notification(
      NEW.user_id,
      'درخواست رد شد',
      'درخواست نقش شما رد شد. دلیل: ' || COALESCE(NEW.rejection_reason, 'ذکر نشده'),
      '/profile',
      'error'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER staff_verification_status_change
AFTER UPDATE ON public.staff_verification_requests
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.handle_staff_verification();

CREATE TRIGGER update_phone_whitelist_updated_at
BEFORE UPDATE ON public.phone_whitelist
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contractor_verification_updated_at
BEFORE UPDATE ON public.contractor_verification_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_staff_verification_updated_at
BEFORE UPDATE ON public.staff_verification_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();