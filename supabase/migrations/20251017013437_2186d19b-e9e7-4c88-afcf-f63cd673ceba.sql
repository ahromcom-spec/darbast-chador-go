-- Add unique constraints for contractor email and phone number
ALTER TABLE contractors 
ADD CONSTRAINT contractors_email_unique UNIQUE (email);

ALTER TABLE contractors 
ADD CONSTRAINT contractors_phone_unique UNIQUE (phone_number);