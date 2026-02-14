
-- Add confirmed_date column to collection_requests to separate customer requested date from actual collection date
ALTER TABLE public.collection_requests ADD COLUMN confirmed_date TIMESTAMPTZ;

-- Migrate existing approved/completed requests: copy requested_date to confirmed_date
UPDATE public.collection_requests 
SET confirmed_date = requested_date 
WHERE status IN ('approved', 'completed') AND requested_date IS NOT NULL;
