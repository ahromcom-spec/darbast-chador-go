-- Create table for assistant chat messages
CREATE TABLE public.assistant_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  attachments JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_assistant_chat_messages_user_id ON public.assistant_chat_messages(user_id);
CREATE INDEX idx_assistant_chat_messages_created_at ON public.assistant_chat_messages(created_at DESC);

-- Enable RLS
ALTER TABLE public.assistant_chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can only see their own messages
CREATE POLICY "Users can view their own chat messages" 
ON public.assistant_chat_messages 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can create their own messages
CREATE POLICY "Users can create their own chat messages" 
ON public.assistant_chat_messages 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own messages (for cleanup)
CREATE POLICY "Users can delete their own chat messages" 
ON public.assistant_chat_messages 
FOR DELETE 
USING (auth.uid() = user_id);