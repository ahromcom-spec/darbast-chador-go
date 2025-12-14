-- Update the trigger function to send notifications based on service type
CREATE OR REPLACE FUNCTION public.trigger_order_automation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  customer_user_id UUID;
  customer_name TEXT;
  customer_phone TEXT;
  province_name TEXT;
  subcategory_name TEXT;
  subcategory_code TEXT;
  manager_record RECORD;
  v_notes JSONB;
  detail_text TEXT := '';
  basic_text TEXT := '';
BEGIN
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status != 'pending') THEN
    -- Get subcategory code
    SELECT s.code, s.name INTO subcategory_code, subcategory_name
    FROM subcategories s
    WHERE s.id = NEW.subcategory_id;

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

      -- Try to parse notes JSON if present
      IF NEW.notes IS NOT NULL THEN
        BEGIN
          v_notes := NEW.notes::jsonb;
        EXCEPTION WHEN others THEN
          v_notes := NULL;
        END;
      END IF;

      -- Build detailed text
      IF v_notes IS NOT NULL THEN
        IF v_notes ? 'service_type' THEN
          detail_text := detail_text || E'\nنوع خدمت: ' || COALESCE(v_notes->>'service_type', '');
        END IF;
        IF v_notes ? 'scaffold_type' THEN
          detail_text := detail_text || E'\nنوع داربست: ' || COALESCE(v_notes->>'scaffold_type', '');
        END IF;
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
      END IF;

      basic_text :=
        'سفارش جدید از ' || COALESCE(customer_name, 'مشتری') ||
        CASE WHEN customer_phone IS NOT NULL AND customer_phone <> '' THEN ' (' || customer_phone || ')' ELSE '' END ||
        E'\nکد: ' || NEW.code ||
        E'\nخدمت: ' || COALESCE(subcategory_name, '—') ||
        E'\nاستان/آدرس: ' || COALESCE(province_name, '') || ' - ' || COALESCE(NEW.address, '') ||
        CASE WHEN NEW.detailed_address IS NOT NULL AND NEW.detailed_address <> '' THEN E'\nجزئیات آدرس: ' || NEW.detailed_address ELSE '' END ||
        detail_text;

      -- 1. ALWAYS notify CEO (مدیرعامل) for ALL orders
      FOR manager_record IN 
        SELECT DISTINCT ur.user_id
        FROM user_roles ur
        WHERE ur.role = 'ceo'
      LOOP
        PERFORM send_notification(
          manager_record.user_id,
          'سفارش جدید ' || NEW.code,
          basic_text,
          '/ceo/orders',
          'info'
        );
      END LOOP;

      -- 2. Route based on subcategory code
      IF subcategory_code = '10' THEN
        -- خدمات اجرای داربست به همراه اجناس - فقط به مدیر اجرایی داربست به همراه اجناس
        FOR manager_record IN 
          SELECT DISTINCT ur.user_id
          FROM user_roles ur
          WHERE ur.role = 'executive_manager_scaffold_execution_with_materials'
        LOOP
          PERFORM send_notification(
            manager_record.user_id,
            'سفارش جدید داربست با اجناس ' || NEW.code,
            basic_text,
            '/executive/orders',
            'info'
          );
        END LOOP;
        
      ELSIF subcategory_code = '20' THEN
        -- خدمات اجرای داربست بدون اجناس - به مدیر اجرایی داربست
        FOR manager_record IN 
          SELECT DISTINCT ur.user_id
          FROM user_roles ur
          WHERE ur.role = 'scaffold_executive_manager'
        LOOP
          PERFORM send_notification(
            manager_record.user_id,
            'سفارش جدید داربست ' || NEW.code,
            basic_text,
            '/executive/orders',
            'info'
          );
        END LOOP;
        
      ELSE
        -- سایر خدمات - به مدیر فروش و مدیر ارشد
        PERFORM notify_role(
          'sales_manager'::app_role,
          'سفارش جدید ' || NEW.code,
          basic_text,
          '/sales/pending-orders',
          'info'
        );
        
        PERFORM notify_role(
          'general_manager'::app_role,
          'سفارش جدید ' || NEW.code,
          basic_text,
          '/admin/orders',
          'info'
        );
      END IF;

      -- Notify Customer
      PERFORM send_notification(
        customer_user_id,
        'سفارش ' || NEW.code || ' ثبت شد',
        'سفارش شما برای ' || COALESCE(subcategory_name, 'خدمات') || ' ثبت شد و در حال بررسی توسط مدیریت است.',
        '/user/my-orders',
        'success'
      );

      -- Audit log
      PERFORM log_audit(
        customer_user_id,
        'automation_started',
        'projects_v3',
        NEW.id,
        jsonb_build_object(
          'order_code', NEW.code,
          'subcategory_code', subcategory_code,
          'automation_type', 'order_workflow',
          'timestamp', now()
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;