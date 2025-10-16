-- Ensure CEO notifications and approvals fire on order insert/update
-- 1) Create triggers for projects_v3
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_new_order'
  ) THEN
    CREATE TRIGGER trg_notify_new_order
    AFTER INSERT ON public.projects_v3
    FOR EACH ROW EXECUTE FUNCTION public.notify_new_order();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_handle_order_approval'
  ) THEN
    CREATE TRIGGER trg_handle_order_approval
    AFTER UPDATE OF status ON public.projects_v3
    FOR EACH ROW EXECUTE FUNCTION public.handle_order_approval();
  END IF;
END $$;

-- 2) Whitelist and assign CEO role to the provided phone number
-- Add phone to whitelist with ceo role
INSERT INTO public.phone_whitelist (phone_number, allowed_roles, notes)
VALUES ('09125511494', ARRAY['ceo'], 'System provisioned CEO')
ON CONFLICT (phone_number)
DO UPDATE SET
  allowed_roles = (
    SELECT ARRAY(
      SELECT DISTINCT unnest(COALESCE(public.phone_whitelist.allowed_roles, '{}'::text[]) || ARRAY['ceo'])
    )
  ),
  updated_at = now();

-- Assign ceo role to the user having this phone number (if profile exists)
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'ceo'::public.app_role
FROM public.profiles p
WHERE p.phone_number = '09125511494'
ON CONFLICT (user_id, role) DO NOTHING;
