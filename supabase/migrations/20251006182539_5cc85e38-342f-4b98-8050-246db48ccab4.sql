-- Create tickets table
CREATE TABLE public.tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_request_id uuid REFERENCES public.service_requests(id) ON DELETE SET NULL,
  department text NOT NULL CHECK (department IN ('order', 'execution', 'support', 'financial', 'management')),
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tickets
CREATE POLICY "Users can view their own tickets"
ON public.tickets
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tickets"
ON public.tickets
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all tickets"
ON public.tickets
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all tickets"
ON public.tickets
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create ticket_attachments table
CREATE TABLE public.ticket_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for attachments
CREATE POLICY "Users can view attachments of their tickets"
ON public.ticket_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tickets
    WHERE tickets.id = ticket_attachments.ticket_id
    AND tickets.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create attachments for their tickets"
ON public.ticket_attachments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tickets
    WHERE tickets.id = ticket_attachments.ticket_id
    AND tickets.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all attachments"
ON public.ticket_attachments
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_tickets_updated_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for ticket attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-attachments',
  'ticket-attachments',
  false,
  73400320,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'application/pdf']
);

-- Storage policies for ticket attachments
CREATE POLICY "Users can upload their ticket attachments"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'ticket-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their ticket attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'ticket-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all ticket attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'ticket-attachments' AND
  has_role(auth.uid(), 'admin'::app_role)
);