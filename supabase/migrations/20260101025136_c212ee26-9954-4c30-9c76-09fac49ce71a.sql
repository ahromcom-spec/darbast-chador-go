-- Add RLS policy for CEO to delete deep archived orders
CREATE POLICY "CEO can delete deep archived orders"
ON public.projects_v3
FOR DELETE
USING (
  is_deep_archived = true
  AND public.has_role(auth.uid(), 'ceo')
);