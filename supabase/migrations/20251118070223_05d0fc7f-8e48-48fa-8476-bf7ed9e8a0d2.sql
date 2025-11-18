-- Relax address length from 10 to 5 characters on projects_v3
ALTER TABLE public.projects_v3
  DROP CONSTRAINT IF EXISTS address_length_check;

ALTER TABLE public.projects_v3
  ADD CONSTRAINT address_length_check
  CHECK (char_length(btrim(address)) >= 5);

-- Optional: ensure no leading/trailing spaces bypass the rule via btrim
-- Existing rows already satisfied previous >=10, so this is safe.