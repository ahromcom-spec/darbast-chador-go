-- ایجاد foreign key بین service_requests و profiles
ALTER TABLE public.service_requests
ADD CONSTRAINT fk_service_requests_profiles
FOREIGN KEY (user_id)
REFERENCES public.profiles(user_id)
ON DELETE CASCADE;