-- Create ticket_messages table for chat functionality
CREATE TABLE public.ticket_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages of their own tickets
CREATE POLICY "Users can view messages of their tickets"
ON public.ticket_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tickets
    WHERE tickets.id = ticket_messages.ticket_id
    AND tickets.user_id = auth.uid()
  )
);

-- Users can send messages to their own tickets
CREATE POLICY "Users can send messages to their tickets"
ON public.ticket_messages
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.tickets
    WHERE tickets.id = ticket_messages.ticket_id
    AND tickets.user_id = auth.uid()
  )
  AND is_admin = false
);

-- Admins can view all messages
CREATE POLICY "Admins can view all messages"
ON public.ticket_messages
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can send messages to any ticket
CREATE POLICY "Admins can send messages"
ON public.ticket_messages
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND is_admin = true
);

-- Create index for better performance
CREATE INDEX idx_ticket_messages_ticket_id ON public.ticket_messages(ticket_id);
CREATE INDEX idx_ticket_messages_created_at ON public.ticket_messages(created_at DESC);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_ticket_messages_updated_at
BEFORE UPDATE ON public.ticket_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for ticket_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;