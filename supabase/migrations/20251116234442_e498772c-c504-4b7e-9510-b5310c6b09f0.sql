-- اصلاح فانکشن notify_managers_on_new_order برای استفاده از type معتبر
CREATE OR REPLACE FUNCTION public.notify_managers_on_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manager_id uuid;
  v_province_name text;
  v_district_name text;
  v_address text;
  v_detailed_address text;
  v_code text;
  v_subcategory_name text;
BEGIN
  -- فقط برای سفارش‌های جدید با وضعیت pending
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- دریافت اطلاعات آدرس و لوکیشن
  SELECT 
    COALESCE(p.name, ''),
    COALESCE(d.name, ''),
    COALESCE(NEW.address, ''),
    COALESCE(NEW.detailed_address, ''),
    NEW.code,
    COALESCE(s.name, '')
  INTO 
    v_province_name,
    v_district_name,
    v_address,
    v_detailed_address,
    v_code,
    v_subcategory_name
  FROM provinces p
  LEFT JOIN districts d ON d.id = NEW.district_id
  LEFT JOIN subcategories s ON s.id = NEW.subcategory_id
  WHERE p.id = NEW.province_id;

  -- ارسال نوتیفیکیشن به مدیران (general_manager, sales_manager, scaffold_executive_manager)
  FOR v_manager_id IN 
    SELECT DISTINCT user_id 
    FROM user_roles 
    WHERE role IN ('general_manager', 'sales_manager', 'scaffold_executive_manager')
  LOOP
    INSERT INTO notifications (
      user_id,
      title,
      body,
      link,
      type
    ) VALUES (
      v_manager_id,
      'سفارش جدید ثبت شد - کد: ' || v_code,
      'سفارش جدید ' || v_subcategory_name || ' در ' || v_province_name || 
      CASE WHEN v_district_name != '' THEN '، ' || v_district_name ELSE '' END ||
      CASE WHEN v_address != '' THEN ' - آدرس: ' || v_address ELSE '' END,
      '/orders/' || NEW.id::text,
      'info'
    );
  END LOOP;

  RETURN NEW;
END;
$$;