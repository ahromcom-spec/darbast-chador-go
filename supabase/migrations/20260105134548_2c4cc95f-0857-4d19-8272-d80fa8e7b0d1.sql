-- Create approved_media table for managing media that appears on homepage
CREATE TABLE public.approved_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_media_id UUID,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'video')),
  thumbnail_path TEXT,
  title TEXT,
  description TEXT,
  order_id UUID REFERENCES public.projects_v3(id),
  project_name TEXT,
  uploaded_by UUID,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  display_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.approved_media ENABLE ROW LEVEL SECURITY;

-- Policy for CEOs to manage all media
CREATE POLICY "CEOs can manage all approved_media"
  ON public.approved_media
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.phone_whitelist
      WHERE phone_number = (SELECT phone_number FROM public.profiles WHERE user_id = auth.uid())
      AND 'ceo' = ANY(allowed_roles)
    )
  );

-- Policy for everyone to view approved media
CREATE POLICY "Anyone can view approved media"
  ON public.approved_media
  FOR SELECT
  USING (status = 'approved' AND is_visible = true);

-- Policy for authenticated users to insert pending media
CREATE POLICY "Authenticated users can submit media for approval"
  ON public.approved_media
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create index for faster queries
CREATE INDEX idx_approved_media_status ON public.approved_media(status);
CREATE INDEX idx_approved_media_display_order ON public.approved_media(display_order);
CREATE INDEX idx_approved_media_approved_at ON public.approved_media(approved_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_approved_media_updated_at
  BEFORE UPDATE ON public.approved_media
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();