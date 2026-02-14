
-- Allow NULL phone numbers for employees without phones
ALTER TABLE hr_employees ALTER COLUMN phone_number DROP NOT NULL;

-- Drop the existing unique constraint that blocks multiple empty phones
ALTER TABLE hr_employees DROP CONSTRAINT hr_employees_phone_number_key;

-- Add a partial unique index only for non-null, non-empty phone numbers
CREATE UNIQUE INDEX hr_employees_phone_number_unique 
ON hr_employees (phone_number) 
WHERE phone_number IS NOT NULL AND phone_number != '';
