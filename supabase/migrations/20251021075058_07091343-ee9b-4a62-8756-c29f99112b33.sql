-- Create function to generate unique 6-digit order code
CREATE OR REPLACE FUNCTION generate_unique_order_code()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 6-digit number (100000 to 999999)
    new_code := LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0');
    
    -- Check if this code already exists
    SELECT EXISTS(
      SELECT 1 FROM projects_v3 WHERE code = new_code
    ) INTO code_exists;
    
    -- If code doesn't exist, use it
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically assign unique code before insert
CREATE OR REPLACE FUNCTION set_unique_order_code()
RETURNS TRIGGER AS $$
BEGIN
  -- If code is not provided or is empty, generate a new one
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := generate_unique_order_code();
  ELSE
    -- If code is provided, check if it's unique
    IF EXISTS(SELECT 1 FROM projects_v3 WHERE code = NEW.code AND id != NEW.id) THEN
      RAISE EXCEPTION 'کد سفارش % قبلاً استفاده شده است', NEW.code;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_set_unique_order_code ON projects_v3;
CREATE TRIGGER trigger_set_unique_order_code
  BEFORE INSERT ON projects_v3
  FOR EACH ROW
  EXECUTE FUNCTION set_unique_order_code();