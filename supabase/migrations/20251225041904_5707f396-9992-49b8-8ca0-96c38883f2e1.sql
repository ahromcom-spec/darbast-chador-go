-- Enable realtime for profiles table so header avatar updates automatically
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;