-- Fix the project code sequence to prevent cycling and increase max value

-- Drop the existing sequence
DROP SEQUENCE IF EXISTS project_code_seq CASCADE;

-- Create a new sequence with proper settings
-- Start from a safe number above current usage (100060)
-- Set max to 9999999 (7 digits) to have plenty of room
CREATE SEQUENCE project_code_seq 
  START WITH 100060
  MINVALUE 100000
  MAXVALUE 9999999
  NO CYCLE;

-- Update generate_project_code to use 7-digit codes with more capacity
CREATE OR REPLACE FUNCTION public.generate_project_code(
  _customer_id uuid,
  _province_id uuid,
  _subcategory_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code text;
BEGIN
  -- تولید کد 7 رقمی از sequence (برای داشتن ظرفیت بیشتر)
  new_code := LPAD(nextval('project_code_seq')::text, 7, '0');
  RETURN new_code;
END;
$$;