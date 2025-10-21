-- Double limits and whitelist bypass for OTP, service requests, and directory queries

-- check_otp_rate_limit: double to 6 per 5 minutes; bypass if phone in phone_whitelist
CREATE OR REPLACE FUNCTION public.check_otp_rate_limit(_phone_number text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recent_count integer;
  v_is_whitelisted boolean;
BEGIN
  -- Bypass for whitelisted phone numbers
  SELECT EXISTS(
    SELECT 1 FROM public.phone_whitelist
    WHERE phone_number = _phone_number
  ) INTO v_is_whitelisted;
  
  IF v_is_whitelisted THEN
    RETURN true;
  END IF;

  -- Count OTP requests from this phone in last 5 minutes
  SELECT COUNT(*)
  INTO recent_count
  FROM public.otp_codes
  WHERE phone_number = _phone_number
    AND created_at > now() - interval '5 minutes';
  
  -- Allow maximum 6 requests per 5 minutes (doubled from 3)
  RETURN recent_count < 6;
END;
$function$;

-- check_service_request_rate_limit: double to 10 per 10 minutes; bypass if user's phone is whitelisted
CREATE OR REPLACE FUNCTION public.check_service_request_rate_limit(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  request_count INTEGER;
  v_phone TEXT;
  v_is_whitelisted BOOLEAN;
BEGIN
  -- Fetch user's phone number from profile
  SELECT phone_number INTO v_phone
  FROM public.profiles
  WHERE user_id = _user_id;

  -- Bypass for whitelisted phone numbers
  SELECT EXISTS(
    SELECT 1 FROM public.phone_whitelist
    WHERE phone_number = v_phone
  ) INTO v_is_whitelisted;

  IF v_is_whitelisted THEN
    RETURN true;
  END IF;
  
  -- Count service requests in last 10 minutes
  SELECT COUNT(*)
  INTO request_count
  FROM public.service_requests_v2
  WHERE customer_id = _user_id
    AND created_at > now() - interval '10 minutes';
  
  -- Allow maximum 10 requests per 10 minutes (doubled from 5)
  RETURN request_count < 10;
END;
$function$;

-- check_directory_rate_limit: double to 20 per minute; bypass if user's phone is whitelisted
CREATE OR REPLACE FUNCTION public.check_directory_rate_limit(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  query_count INTEGER;
  v_phone TEXT;
  v_is_whitelisted BOOLEAN;
BEGIN
  -- Fetch user's phone
  SELECT phone_number INTO v_phone
  FROM public.profiles
  WHERE user_id = _user_id;

  -- Bypass for whitelisted numbers
  SELECT EXISTS(
    SELECT 1 FROM public.phone_whitelist
    WHERE phone_number = v_phone
  ) INTO v_is_whitelisted;

  IF v_is_whitelisted THEN
    RETURN true;
  END IF;

  -- Count directory queries in last 1 minute
  SELECT COUNT(*)
  INTO query_count
  FROM public.audit_log
  WHERE actor_user_id = _user_id
    AND action = 'view_contractor_directory'
    AND created_at > now() - interval '1 minute';
  
  -- Allow maximum 20 queries per minute (doubled from 10)
  RETURN query_count < 20;
END;
$function$;