-- Fix notifications type constraint to allow application-defined types
ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;