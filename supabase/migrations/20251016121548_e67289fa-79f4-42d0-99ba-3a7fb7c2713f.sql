-- Step 1: Clean invalid phone numbers
UPDATE profiles
SET phone_number = NULL
WHERE phone_number IS NOT NULL 
  AND phone_number !~ '^09[0-9]{9}$';

-- Step 2: Fix address that are too short or too long
UPDATE projects_v3
SET address = CASE
  WHEN char_length(address) < 10 THEN address || ' - نیاز به اصلاح آدرس'
  WHEN char_length(address) > 500 THEN substring(address, 1, 497) || '...'
  ELSE address
END
WHERE char_length(address) < 10 OR char_length(address) > 500;

-- Step 3: Fix detailed_address that is too long
UPDATE projects_v3
SET detailed_address = substring(detailed_address, 1, 500)
WHERE detailed_address IS NOT NULL AND char_length(detailed_address) > 500;

-- Step 4: Truncate notes that are too long (keep as JSON-valid if possible)
UPDATE projects_v3
SET notes = substring(notes::text, 1, 4997)::jsonb || '{"truncated": true}'::jsonb
WHERE notes IS NOT NULL AND char_length(notes::text) > 5000;

-- Now add phone constraints
ALTER TABLE profiles
ADD CONSTRAINT phone_number_format
CHECK (phone_number IS NULL OR phone_number ~ '^09[0-9]{9}$');

ALTER TABLE contractors
ADD CONSTRAINT phone_number_format
CHECK (phone_number ~ '^09[0-9]{9}$');

ALTER TABLE phone_whitelist
ADD CONSTRAINT phone_number_format
CHECK (phone_number ~ '^09[0-9]{9}$');

-- Add address and notes constraints
ALTER TABLE projects_v3
ADD CONSTRAINT address_length_check
CHECK (char_length(address) >= 10 AND char_length(address) <= 500);

ALTER TABLE projects_v3
ADD CONSTRAINT detailed_address_length_check
CHECK (detailed_address IS NULL OR char_length(detailed_address) <= 500);

ALTER TABLE projects_v3
ADD CONSTRAINT notes_length_check
CHECK (notes IS NULL OR char_length(notes::text) <= 5000);

-- Update RLS policy
DROP POLICY IF EXISTS "Customers can update own draft projects" ON projects_v3;

CREATE POLICY "Customers can update own draft projects only"
ON projects_v3 FOR UPDATE
USING (
  EXISTS(SELECT 1 FROM customers c WHERE c.id = customer_id AND c.user_id = auth.uid())
  AND status = 'draft'
)
WITH CHECK (
  EXISTS(SELECT 1 FROM customers c WHERE c.id = customer_id AND c.user_id = auth.uid())
  AND status = 'draft'
);

COMMENT ON POLICY "Customers can update own draft projects only" ON projects_v3 IS 
'Security: Customers can only edit orders in draft status. Once submitted (pending), orders are read-only to prevent tampering.';