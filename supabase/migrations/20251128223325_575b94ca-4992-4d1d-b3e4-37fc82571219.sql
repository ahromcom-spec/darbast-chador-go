-- Update trigger to handle notes as both text and jsonb
CREATE OR REPLACE FUNCTION set_payment_amount_on_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_notes_json jsonb;
  v_payment numeric;
BEGIN
  -- اگر سفارش approved شد و payment_amount خالی است
  IF NEW.approved_at IS NOT NULL AND (OLD IS NULL OR OLD.approved_at IS NULL) AND NEW.payment_amount IS NULL THEN
    -- سعی کن قیمت را از notes استخراج کنی
    IF NEW.notes IS NOT NULL AND NEW.notes != '' THEN
      BEGIN
        -- تبدیل notes به jsonb (خواه text باشد خواه jsonb)
        IF jsonb_typeof(NEW.notes::jsonb) = 'object' THEN
          v_notes_json := NEW.notes::jsonb;
          
          -- استخراج قیمت با اولویت‌های مختلف
          v_payment := COALESCE(
            (v_notes_json->>'estimated_price')::numeric,
            (v_notes_json->>'price')::numeric,
            (v_notes_json->>'totalPrice')::numeric,
            (v_notes_json->>'total_price')::numeric
          );
          
          IF v_payment IS NOT NULL AND v_payment > 0 THEN
            NEW.payment_amount := v_payment;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- اگر خطایی رخ داد، payment_amount را NULL بگذار و ادامه بده
        NEW.payment_amount := NULL;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;