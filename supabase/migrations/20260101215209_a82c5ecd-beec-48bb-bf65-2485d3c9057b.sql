-- Enable realtime for in-app notifications
-- This is required for the client subscription in src/hooks/useNotifications.ts
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;