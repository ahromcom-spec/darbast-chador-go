-- Create site analytics table to track all visitor events
CREATE TABLE public.site_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'page_view', 'login', 'logout', 'download', 'upload', 'screenshot'
  page_url TEXT,
  page_title TEXT,
  referrer_url TEXT,
  entry_page TEXT,
  device_type TEXT, -- 'mobile', 'tablet', 'desktop'
  os_name TEXT, -- 'Android', 'iOS', 'Windows', 'MacOS', 'Linux', etc.
  os_version TEXT,
  browser_name TEXT,
  browser_version TEXT,
  device_model TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  viewport_width INTEGER,
  viewport_height INTEGER,
  language TEXT,
  timezone TEXT,
  ip_address INET,
  country TEXT,
  city TEXT,
  data_transferred_bytes BIGINT DEFAULT 0, -- bytes downloaded/uploaded
  session_duration_seconds INTEGER DEFAULT 0,
  page_count INTEGER DEFAULT 1,
  scroll_depth_percent INTEGER,
  is_logged_in BOOLEAN DEFAULT false,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create site sessions table to aggregate session data
CREATE TABLE public.site_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  total_duration_seconds INTEGER DEFAULT 0,
  total_page_views INTEGER DEFAULT 0,
  total_data_bytes BIGINT DEFAULT 0,
  entry_page TEXT,
  exit_page TEXT,
  device_type TEXT,
  os_name TEXT,
  os_version TEXT,
  browser_name TEXT,
  device_model TEXT,
  ip_address INET,
  country TEXT,
  city TEXT,
  is_logged_in BOOLEAN DEFAULT false,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for site_analytics - only CEO can view
CREATE POLICY "CEO can view all analytics" 
ON public.site_analytics 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND p.phone_number IN (
      SELECT phone_number FROM public.phone_whitelist 
      WHERE 'ceo' = ANY(allowed_roles)
    )
  )
);

-- Anyone can insert analytics (for tracking)
CREATE POLICY "Anyone can insert analytics" 
ON public.site_analytics 
FOR INSERT 
WITH CHECK (true);

-- Policies for site_sessions - only CEO can view
CREATE POLICY "CEO can view all sessions" 
ON public.site_sessions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND p.phone_number IN (
      SELECT phone_number FROM public.phone_whitelist 
      WHERE 'ceo' = ANY(allowed_roles)
    )
  )
);

-- Anyone can insert/update sessions
CREATE POLICY "Anyone can insert sessions" 
ON public.site_sessions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update sessions" 
ON public.site_sessions 
FOR UPDATE 
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_site_analytics_created_at ON public.site_analytics(created_at DESC);
CREATE INDEX idx_site_analytics_user_id ON public.site_analytics(user_id);
CREATE INDEX idx_site_analytics_session_id ON public.site_analytics(session_id);
CREATE INDEX idx_site_analytics_event_type ON public.site_analytics(event_type);
CREATE INDEX idx_site_sessions_started_at ON public.site_sessions(started_at DESC);
CREATE INDEX idx_site_sessions_user_id ON public.site_sessions(user_id);

-- Function to update timestamps
CREATE TRIGGER update_site_analytics_updated_at
BEFORE UPDATE ON public.site_analytics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_site_sessions_updated_at
BEFORE UPDATE ON public.site_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();