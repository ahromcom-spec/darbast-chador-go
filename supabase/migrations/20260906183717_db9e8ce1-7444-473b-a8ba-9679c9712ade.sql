ALTER TABLE public.projects_v3
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_before_discount numeric,
  ADD COLUMN IF NOT EXISTS discount_note text,
  ADD COLUMN IF NOT EXISTS discount_by uuid,
  ADD COLUMN IF NOT EXISTS discount_at timestamptz;

CREATE OR REPLACE FUNCTION public.enforce_discount_manager_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.discount_amount, 0) IS DISTINCT FROM COALESCE(OLD.discount_amount, 0)
     OR COALESCE(NEW.price_before_discount, -1) IS DISTINCT FROM COALESCE(OLD.price_before_discount, -1)
     OR COALESCE(NEW.discount_note, '') IS DISTINCT FROM COALESCE(OLD.discount_note, '') THEN
    IF NOT (
      has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'ceo')
      OR has_role(auth.uid(), 'general_manager') OR has_role(auth.uid(), 'sales_manager')
      OR has_role(auth.uid(), 'finance_manager') OR has_role(auth.uid(), 'operations_manager')
      OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials')
      OR has_role(auth.uid(), 'scaffold_executive_manager') OR has_role(auth.uid(), 'rental_executive_manager')
      OR auth.uid() IS NULL
    ) THEN
      RAISE EXCEPTION 'اعمال تخفیف فقط توسط مدیریت امکان‌پذیر است';
    END IF;
    NEW.discount_by := COALESCE(auth.uid(), NEW.discount_by);
    NEW.discount_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_discount_manager_only ON public.projects_v3;
CREATE TRIGGER trg_enforce_discount_manager_only
BEFORE UPDATE ON public.projects_v3
FOR EACH ROW EXECUTE FUNCTION public.enforce_discount_manager_only();