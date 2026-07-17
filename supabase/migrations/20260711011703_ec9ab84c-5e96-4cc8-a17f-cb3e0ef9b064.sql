-- Dynamic services management: add tree/nesting support to existing tables (non-breaking)
ALTER TABLE public.subcategories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.subcategories(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS form_path text;

ALTER TABLE public.service_types_v3
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_subcategories_parent_id ON public.subcategories(parent_id);

-- Prevent self-parent cycles at insert/update time
CREATE OR REPLACE FUNCTION public.prevent_subcategory_cycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_parent uuid := NEW.parent_id;
  hops int := 0;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'A subcategory cannot be its own parent';
  END IF;
  WHILE current_parent IS NOT NULL AND hops < 20 LOOP
    SELECT parent_id INTO current_parent FROM public.subcategories WHERE id = current_parent;
    IF current_parent = NEW.id THEN
      RAISE EXCEPTION 'Cycle detected in subcategory hierarchy';
    END IF;
    hops := hops + 1;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_subcategory_cycle ON public.subcategories;
CREATE TRIGGER trg_prevent_subcategory_cycle
BEFORE INSERT OR UPDATE OF parent_id ON public.subcategories
FOR EACH ROW EXECUTE FUNCTION public.prevent_subcategory_cycle();

-- RLS: CEO can manage service_types_v3 and subcategories (existing SELECT policies remain untouched)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='service_types_v3' AND policyname='CEO can manage service types'
  ) THEN
    CREATE POLICY "CEO can manage service types"
      ON public.service_types_v3
      FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), 'ceo'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'ceo'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='subcategories' AND policyname='CEO can manage subcategories'
  ) THEN
    CREATE POLICY "CEO can manage subcategories"
      ON public.subcategories
      FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), 'ceo'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'ceo'::app_role));
  END IF;
END$$;