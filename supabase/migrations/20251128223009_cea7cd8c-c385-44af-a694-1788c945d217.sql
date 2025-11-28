-- Create function to automatically set payment_amount when order is approved
CREATE OR REPLACE FUNCTION set_payment_amount_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- اگر سفارش approved شد و payment_amount خالی است
  IF NEW.approved_at IS NOT NULL AND OLD.approved_at IS NULL AND NEW.payment_amount IS NULL THEN
    -- سعی کن قیمت را از notes استخراج کنی
    IF NEW.notes IS NOT NULL THEN
      BEGIN
        -- اگر notes به صورت JSON است، estimated_price یا price را استخراج کن
        NEW.payment_amount := COALESCE(
          (NEW.notes::jsonb->>'estimated_price')::numeric,
          (NEW.notes::jsonb->>'price')::numeric,
          (NEW.notes::jsonb->>'totalPrice')::numeric
        );
      EXCEPTION WHEN OTHERS THEN
        -- اگر خطایی رخ داد، payment_amount را NULL بگذار
        NEW.payment_amount := NULL;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on projects_v3 table
DROP TRIGGER IF EXISTS trigger_set_payment_amount_on_approval ON projects_v3;
CREATE TRIGGER trigger_set_payment_amount_on_approval
  BEFORE UPDATE ON projects_v3
  FOR EACH ROW
  EXECUTE FUNCTION set_payment_amount_on_approval();