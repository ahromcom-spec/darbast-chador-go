ALTER TABLE public.order_collaborators
  ADD COLUMN IF NOT EXISTS collaborator_name text,
  ADD COLUMN IF NOT EXISTS collaborator_role text;