-- Fix historical daily_report_staff records: match staff_name containing phone numbers to profiles.user_id
UPDATE public.daily_report_staff drs
SET staff_user_id = p.user_id
FROM public.profiles p
WHERE drs.staff_user_id IS NULL
  AND drs.is_cash_box = FALSE
  AND drs.staff_name IS NOT NULL
  AND drs.staff_name LIKE '%' || p.phone_number || '%'
  AND p.user_id IS NOT NULL;
