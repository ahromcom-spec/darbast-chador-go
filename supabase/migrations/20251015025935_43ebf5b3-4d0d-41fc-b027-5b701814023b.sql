-- Fix search_path warnings for validation functions
ALTER FUNCTION public.validate_phone_number(_phone TEXT) SET search_path = public;
ALTER FUNCTION public.validate_contractor_phone() SET search_path = public;
ALTER FUNCTION public.validate_profile_phone() SET search_path = public;