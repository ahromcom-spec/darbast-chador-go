-- ============================================
-- 11-TRIGGERS.SQL - تریگرها
-- ============================================

-- تریگر بروزرسانی timestamp
CREATE TRIGGER update_profiles_timestamp
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_customers_timestamp
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_projects_v3_timestamp
  BEFORE UPDATE ON projects_v3
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_daily_reports_timestamp
  BEFORE UPDATE ON daily_reports
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_daily_report_orders_timestamp
  BEFORE UPDATE ON daily_report_orders
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_daily_report_staff_timestamp
  BEFORE UPDATE ON daily_report_staff
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- تخصیص کد مشتری
CREATE OR REPLACE FUNCTION assign_customer_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_code IS NULL THEN
    NEW.customer_code := generate_customer_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_assign_customer_code
  BEFORE INSERT ON customers
  FOR EACH ROW EXECUTE FUNCTION assign_customer_code();

-- ایجاد تأییدیه‌های سفارش
CREATE OR REPLACE FUNCTION create_order_approvals()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    INSERT INTO order_approvals (order_id, approver_role, subcategory_id)
    VALUES 
      (NEW.id, 'ceo', NEW.subcategory_id),
      (NEW.id, 'sales_manager', NEW.subcategory_id),
      (NEW.id, 'scaffold_executive_manager', NEW.subcategory_id),
      (NEW.id, 'executive_manager_scaffold_execution_with_materials', NEW.subcategory_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_order_approvals
  AFTER INSERT ON projects_v3
  FOR EACH ROW EXECUTE FUNCTION create_order_approvals();

-- همگام‌سازی پرداخت با کیف پول
CREATE OR REPLACE FUNCTION sync_order_payment_to_wallet()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_user_id UUID;
  v_order_code TEXT;
BEGIN
  SELECT p.code, c.user_id 
  INTO v_order_code, v_customer_user_id
  FROM projects_v3 p
  JOIN customers c ON c.id = p.customer_id
  WHERE p.id = NEW.order_id;
  
  IF v_customer_user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM wallet_transactions 
      WHERE reference_type = 'order_payment' AND reference_id = NEW.id
    ) THEN
      INSERT INTO wallet_transactions (
        user_id, transaction_type, amount, title, description,
        reference_type, reference_id
      ) VALUES (
        v_customer_user_id, 'credit', NEW.amount,
        'پرداخت سفارش ' || COALESCE(v_order_code, NEW.order_id::TEXT),
        'پرداخت برای سفارش شماره ' || COALESCE(v_order_code, NEW.order_id::TEXT),
        'order_payment', NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_order_payment_to_wallet
  AFTER INSERT ON order_payments
  FOR EACH ROW EXECUTE FUNCTION sync_order_payment_to_wallet();

-- همگام‌سازی گزارش روزانه با کیف پول
CREATE OR REPLACE FUNCTION sync_daily_report_to_wallet()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_report_date DATE;
BEGIN
  IF NEW.staff_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  v_user_id := NEW.staff_user_id;
  
  SELECT report_date INTO v_report_date
  FROM daily_reports WHERE id = NEW.daily_report_id;
  
  -- حذف تراکنش‌های قبلی
  DELETE FROM wallet_transactions
  WHERE reference_type = 'daily_report_staff' AND reference_id = NEW.id;
  
  -- درآمد
  IF NEW.amount_received IS NOT NULL AND NEW.amount_received > 0 THEN
    INSERT INTO wallet_transactions (
      user_id, transaction_type, amount, title, description,
      reference_type, reference_id, created_at
    ) VALUES (
      v_user_id, 'income', NEW.amount_received,
      'دریافتی از گزارش روزانه',
      COALESCE(NEW.receiving_notes, '') || ' | تاریخ: ' || v_report_date::TEXT,
      'daily_report_staff', NEW.id, COALESCE(v_report_date::TIMESTAMPTZ, now())
    );
  END IF;
  
  -- هزینه
  IF NEW.amount_spent IS NOT NULL AND NEW.amount_spent > 0 THEN
    INSERT INTO wallet_transactions (
      user_id, transaction_type, amount, title, description,
      reference_type, reference_id, created_at
    ) VALUES (
      v_user_id, 'expense', -1 * NEW.amount_spent,
      'پرداختی در گزارش روزانه',
      COALESCE(NEW.spending_notes, '') || ' | تاریخ: ' || v_report_date::TEXT,
      'daily_report_staff', NEW.id, COALESCE(v_report_date::TIMESTAMPTZ, now())
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_daily_report_to_wallet
  AFTER INSERT OR UPDATE ON daily_report_staff
  FOR EACH ROW EXECUTE FUNCTION sync_daily_report_to_wallet();

-- حذف تراکنش‌های کیف پول مرتبط با گزارش روزانه
CREATE OR REPLACE FUNCTION delete_daily_report_staff_wallet_transactions()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM wallet_transactions
  WHERE reference_type = 'daily_report_staff' AND reference_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_delete_daily_report_staff_wallet
  BEFORE DELETE ON daily_report_staff
  FOR EACH ROW EXECUTE FUNCTION delete_daily_report_staff_wallet_transactions();
