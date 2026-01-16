-- ============================================
-- 08-FINANCE-TABLES.SQL - جداول مالی
-- ============================================

-- تراکنش‌های کیف پول
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  transaction_type VARCHAR(50) NOT NULL, -- credit, debit, income, expense
  amount NUMERIC(15,2) NOT NULL,
  balance_after NUMERIC(15,2),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  reference_type VARCHAR(50), -- order_approved, order_payment, daily_report_staff
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- خدمات (برای فاکتور)
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price NUMERIC(15,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- فاکتورها
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id),
  number VARCHAR(50) NOT NULL UNIQUE,
  total NUMERIC(15,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'IRR',
  status invoice_status DEFAULT 'draft',
  issued_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- پرداخت‌ها
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  amount NUMERIC(15,2) NOT NULL,
  status payment_status_enum DEFAULT 'pending',
  provider VARCHAR(50),
  reference VARCHAR(100),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- موجودی انبار
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(50),
  unit_price NUMERIC(15,2),
  qty_on_hand NUMERIC(15,2) DEFAULT 0,
  qty_reserved NUMERIC(15,2) DEFAULT 0,
  tracking inventory_tracking DEFAULT 'none',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- رزرو موجودی
CREATE TABLE inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id),
  sku VARCHAR(50) NOT NULL,
  qty NUMERIC(15,2) NOT NULL,
  status reservation_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
