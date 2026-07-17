ALTER TABLE public.customer_statements ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false;

-- Delete existing empty auto-created open statements (no linked orders, no payments)
DELETE FROM public.customer_statements cs
WHERE cs.status = 'open'
  AND cs.is_manual = false
  AND cs.total_paid = 0
  AND NOT EXISTS (SELECT 1 FROM public.projects_v3 p WHERE p.statement_id = cs.id);