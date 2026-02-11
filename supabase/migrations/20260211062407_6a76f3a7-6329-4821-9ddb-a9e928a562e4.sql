
-- Create module_shortcuts table for storing user's home page shortcuts
CREATE TABLE public.module_shortcuts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  module_key TEXT NOT NULL,
  module_name TEXT NOT NULL,
  module_description TEXT,
  module_href TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one shortcut per module per user
ALTER TABLE public.module_shortcuts ADD CONSTRAINT unique_user_module_shortcut UNIQUE (user_id, module_key);

-- Enable RLS
ALTER TABLE public.module_shortcuts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own shortcuts
CREATE POLICY "Users can view own shortcuts"
ON public.module_shortcuts FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own shortcuts
CREATE POLICY "Users can create own shortcuts"
ON public.module_shortcuts FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own shortcuts
CREATE POLICY "Users can delete own shortcuts"
ON public.module_shortcuts FOR DELETE
USING (auth.uid() = user_id);

-- Users can update their own shortcuts
CREATE POLICY "Users can update own shortcuts"
ON public.module_shortcuts FOR UPDATE
USING (auth.uid() = user_id);

-- Index for fast lookup
CREATE INDEX idx_module_shortcuts_user_id ON public.module_shortcuts(user_id);
