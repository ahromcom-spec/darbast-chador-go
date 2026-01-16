-- ============================================
-- 10-FUNCTIONS.SQL - توابع دیتابیس
-- ============================================

-- بررسی نقش کاربر
CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ارسال نوتیفیکیشن
CREATE OR REPLACE FUNCTION send_notification(
  _user_id UUID,
  _title TEXT,
  _body TEXT,
  _link TEXT DEFAULT NULL,
  _type TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  _notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, title, body, link, type)
  VALUES (_user_id, _title, _body, _link, _type)
  RETURNING id INTO _notification_id;
  
  RETURN _notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ثبت لاگ
CREATE OR REPLACE FUNCTION log_audit(
  _action TEXT,
  _entity TEXT,
  _entity_id TEXT DEFAULT NULL,
  _meta JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  _audit_id UUID;
BEGIN
  INSERT INTO audit_log (action, entity, entity_id, meta, actor_user_id)
  VALUES (_action, _entity, _entity_id, _meta, current_setting('app.current_user_id', true)::UUID)
  RETURNING id INTO _audit_id;
  
  RETURN _audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- بررسی لیست سفید
CREATE OR REPLACE FUNCTION check_phone_whitelist(_phone TEXT)
RETURNS TABLE(is_whitelisted BOOLEAN, allowed_roles TEXT[]) AS $$
  SELECT 
    EXISTS(SELECT 1 FROM phone_whitelist WHERE phone_number = _phone)::BOOLEAN,
    COALESCE((SELECT allowed_roles FROM phone_whitelist WHERE phone_number = _phone LIMIT 1), '{}');
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- دریافت موجودی کیف پول
CREATE OR REPLACE FUNCTION get_wallet_balance(_user_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM wallet_transactions
  WHERE user_id = _user_id;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- افزودن تراکنش کیف پول
CREATE OR REPLACE FUNCTION add_wallet_transaction(
  _user_id UUID,
  _transaction_type TEXT,
  _amount NUMERIC,
  _title TEXT,
  _description TEXT DEFAULT NULL,
  _reference_type TEXT DEFAULT NULL,
  _reference_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  _transaction_id UUID;
  _current_balance NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO _current_balance
  FROM wallet_transactions
  WHERE user_id = _user_id;

  INSERT INTO wallet_transactions (
    user_id, transaction_type, amount, balance_after,
    title, description, reference_type, reference_id
  ) VALUES (
    _user_id, _transaction_type, _amount, _current_balance + _amount,
    _title, _description, _reference_type, _reference_id
  ) RETURNING id INTO _transaction_id;

  RETURN _transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- بررسی مالکیت سفارش
CREATE OR REPLACE FUNCTION check_order_ownership(_order_id UUID, _user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM projects_v3 p
    JOIN customers c ON c.id = p.customer_id
    WHERE p.id = _order_id AND c.user_id = _user_id
  )
  OR EXISTS (
    SELECT 1
    FROM order_collaborators oc
    WHERE oc.order_id = _order_id 
      AND oc.invitee_user_id = _user_id 
      AND oc.status = 'accepted'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- اعتبارسنجی شماره تلفن
CREATE OR REPLACE FUNCTION validate_phone_number(_phone TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN _phone ~ '^09[0-9]{9}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- تولید کد سفارش
CREATE OR REPLACE FUNCTION generate_project_code()
RETURNS TEXT AS $$
BEGIN
  RETURN LPAD(nextval('project_code_seq')::TEXT, 7, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- تولید کد مشتری
CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TEXT AS $$
BEGIN
  RETURN LPAD(floor(random() * 99999999)::TEXT, 8, '0');
END;
$$ LANGUAGE plpgsql;

-- بروزرسانی updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- اعلان به نقش
CREATE OR REPLACE FUNCTION notify_role(_role app_role, _title TEXT, _body TEXT, _link TEXT, _type TEXT)
RETURNS VOID AS $$
DECLARE
  _user_id UUID;
BEGIN
  FOR _user_id IN SELECT user_id FROM user_roles WHERE role = _role
  LOOP
    PERFORM send_notification(_user_id, _title, _body, _link, _type);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
