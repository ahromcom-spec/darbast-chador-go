CREATE TABLE public.order_ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.projects_v3(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL,
  contractor_score smallint,
  contractor_comment text,
  contractor_target_id uuid,
  contractor_target_label text NOT NULL DEFAULT 'پیمانکاری اهرم',
  management_score smallint,
  management_comment text,
  management_target_id uuid,
  management_target_label text NOT NULL DEFAULT 'مدیریت و پیگیری اهرم',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT order_ratings_contractor_score_check CHECK (contractor_score IS NULL OR (contractor_score BETWEEN 1 AND 5)),
  CONSTRAINT order_ratings_management_score_check CHECK (management_score IS NULL OR (management_score BETWEEN 1 AND 5)),
  CONSTRAINT order_ratings_unique_per_rater UNIQUE (order_id, rater_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_ratings TO authenticated;
GRANT ALL ON public.order_ratings TO service_role;

ALTER TABLE public.order_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own order ratings"
ON public.order_ratings FOR SELECT TO authenticated
USING (rater_id = auth.uid());

CREATE POLICY "Users can create their own order ratings"
ON public.order_ratings FOR INSERT TO authenticated
WITH CHECK (rater_id = auth.uid());

CREATE POLICY "Users can update their own order ratings"
ON public.order_ratings FOR UPDATE TO authenticated
USING (rater_id = auth.uid())
WITH CHECK (rater_id = auth.uid());

CREATE POLICY "Users can delete their own order ratings"
ON public.order_ratings FOR DELETE TO authenticated
USING (rater_id = auth.uid());

CREATE POLICY "Managers can view all order ratings"
ON public.order_ratings FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'ceo'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'general_manager'::app_role)
);

CREATE POLICY "Managers can manage all order ratings"
ON public.order_ratings FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'ceo'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE INDEX idx_order_ratings_order_id ON public.order_ratings(order_id);
CREATE INDEX idx_order_ratings_contractor_target ON public.order_ratings(contractor_target_id);

CREATE TRIGGER update_order_ratings_updated_at
BEFORE UPDATE ON public.order_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();