-- Create a simple, user-owned table for scaffolding requests
CREATE TABLE IF NOT EXISTS public.scaffolding_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  address TEXT,
  details JSONB,
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scaffolding_requests ENABLE ROW LEVEL SECURITY;

-- Basic indexes
CREATE INDEX IF NOT EXISTS idx_scaffolding_requests_user ON public.scaffolding_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_scaffolding_requests_created ON public.scaffolding_requests(created_at);

-- RLS policies: users can CRUD their own requests
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'scaffolding_requests' AND policyname = 'Users can insert own requests'
  ) THEN
    CREATE POLICY "Users can insert own requests"
    ON public.scaffolding_requests
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'scaffolding_requests' AND policyname = 'Users can view own requests'
  ) THEN
    CREATE POLICY "Users can view own requests"
    ON public.scaffolding_requests
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'scaffolding_requests' AND policyname = 'Users can update own requests'
  ) THEN
    CREATE POLICY "Users can update own requests"
    ON public.scaffolding_requests
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'scaffolding_requests' AND policyname = 'Users cannot delete requests'
  ) THEN
    CREATE POLICY "Users cannot delete requests"
    ON public.scaffolding_requests
    FOR DELETE
    USING (false);
  END IF;
END $$;

-- Update timestamp trigger using existing helper if present, else create then attach
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_scaffolding_requests_updated_at ON public.scaffolding_requests;
CREATE TRIGGER trg_scaffolding_requests_updated_at
BEFORE UPDATE ON public.scaffolding_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();