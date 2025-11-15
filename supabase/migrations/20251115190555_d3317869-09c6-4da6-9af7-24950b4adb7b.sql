-- Enhance trigger to send detailed notifications to all managers when an order becomes pending
CREATE OR REPLACE FUNCTION public.trigger_order_automation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  customer_user_id UUID;
  customer_name TEXT;
  customer_phone TEXT;
  province_name TEXT;
  subcategory_name TEXT;
  subcategory_code TEXT;
  ceo_managers RECORD;
  v_notes JSONB;
  detail_text TEXT := '';
  basic_text TEXT := '';
BEGIN
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status != 'pending') THEN
    -- Only for scaffold with materials (subcategory code 10)
    SELECT s.code INTO subcategory_code
    FROM subcategories s
    WHERE s.id = NEW.subcategory_id;

    IF subcategory_code != '10' THEN
      RETURN NEW;
    END IF;

    -- Resolve customer user id
    SELECT c.user_id INTO customer_user_id
    FROM customers c
    WHERE c.id = NEW.customer_id;

    IF customer_user_id IS NOT NULL THEN
      -- Enrich context
      SELECT p.full_name, p.phone_number INTO customer_name, customer_phone
      FROM profiles p
      WHERE p.user_id = customer_user_id;

      SELECT pr.name INTO province_name
      FROM provinces pr
      WHERE pr.id = NEW.province_id;

      SELECT s.name INTO subcategory_name
      FROM subcategories s
      WHERE s.id = NEW.subcategory_id;

      -- Try to parse notes JSON if present
      IF NEW.notes IS NOT NULL THEN
        BEGIN
          v_notes := NEW.notes::jsonb;
        EXCEPTION WHEN others THEN
          v_notes := NULL; -- ignore invalid JSON
        END;
      END IF;

      -- Build detailed text
      IF v_notes ? 'service_type' THEN
        detail_text := detail_text || E'\nنوع خدمت: ' || COALESCE(v_notes->>'service_type', '');
      END IF;
      IF v_notes ? 'scaffold_type' THEN
        detail_text := detail_text || E'\nنوع داربست: ' || COALESCE(v_notes->>'scaffold_type', '');
      END IF;
      -- Dimensions array or single fields
      IF v_notes ? 'dimensions' THEN
        detail_text := detail_text || E'\nابعاد: ' || (
          SELECT string_agg(
            TRIM(BOTH ' ' FROM COALESCE(d->>'length','?')) || 'x' ||
            TRIM(BOTH ' ' FROM COALESCE(d->>'width','?')) || 'x' ||
            TRIM(BOTH ' ' FROM COALESCE(d->>'height','?'))
          , ' | ')
          FROM jsonb_array_elements(v_notes->'dimensions') AS d
        );
      ELSIF (v_notes ? 'length' OR v_notes ? 'width' OR v_notes ? 'height') THEN
        detail_text := detail_text || E'\nابعاد: ' ||
          COALESCE(v_notes->>'length','?') || 'x' || COALESCE(v_notes->>'width','?') || 'x' || COALESCE(v_notes->>'height','?');
      END IF;
      IF v_notes ? 'additional_notes' THEN
        detail_text := detail_text || E'\nتوضیحات: ' || COALESCE(v_notes->>'additional_notes','');
      ELSIF v_notes ? 'description' THEN
        detail_text := detail_text || E'\nتوضیحات: ' || COALESCE(v_notes->>'description','');
      END IF;

      basic_text :=
        'سفارش جدید از ' || COALESCE(customer_name, 'مشتری') ||
        CASE WHEN customer_phone IS NOT NULL AND customer_phone <> '' THEN ' (' || customer_phone || ')' ELSE '' END ||
        E'\nکد: ' || NEW.code ||
        E'\nخدمت: ' || COALESCE(subcategory_name, '—') ||
        E'\nاستان/آدرس: ' || COALESCE(province_name, '') || ' - ' || COALESCE(NEW.address, '') ||
        CASE WHEN NEW.detailed_address IS NOT NULL AND NEW.detailed_address <> '' THEN E'\nجزئیات آدرس: ' || NEW.detailed_address ELSE '' END ||
        detail_text;

      -- Notify CEO and General Manager individually
      FOR ceo_managers IN 
        SELECT DISTINCT ur.user_id
        FROM user_roles ur
        WHERE ur.role IN ('ceo', 'general_manager')
      LOOP
        PERFORM send_notification(
          ceo_managers.user_id,
          'سفارش جدید ' || NEW.code,
          basic_text,
          '/ceo/orders',
          'info'
        );
      END LOOP;

      -- Notify Sales Manager role (list page)
      PERFORM notify_role(
        'sales_manager'::app_role,
        'سفارش جدید در انتظار تایید فروش',
        basic_text,
        '/sales/pending-orders',
        'info'
      );

      -- Notify Executive Manager roles too (so they see full details at approval time)
      PERFORM notify_role(
        'scaffold_executive_manager'::app_role,
        'سفارش جدید در انتظار تایید اجرا',
        basic_text,
        '/executive/orders',
        'info'
      );
      PERFORM notify_role(
        'executive_manager_scaffold_execution_with_materials'::app_role,
        'سفارش جدید در انتظار تایید اجرا',
        basic_text,
        '/executive/orders',
        'info'
      );

      -- Notify Customer (short message)
      PERFORM send_notification(
        customer_user_id,
        'سفارش ' || NEW.code || ' ثبت شد',
        'سفارش شما برای ' || COALESCE(subcategory_name, 'خدمات داربست') || ' ثبت شد و در حال بررسی توسط مدیریت است.',
        '/user/my-orders',
        'success'
      );

      -- Audit log (unchanged)
      PERFORM log_audit(
        customer_user_id,
        'automation_started',
        'projects_v3',
        NEW.id,
        jsonb_build_object(
          'order_code', NEW.code,
          'automation_type', 'order_workflow',
          'timestamp', now()
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;