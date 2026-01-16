-- ============================================
-- 07-DAILY-REPORT-TABLES.SQL - گزارش روزانه
-- ============================================

-- گزارش روزانه
CREATE TABLE daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL,
  report_date DATE NOT NULL,
  notes TEXT,
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  archived_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- سفارش‌های گزارش روزانه
CREATE TABLE daily_report_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id UUID NOT NULL REFERENCES daily_reports(id),
  order_id UUID NOT NULL REFERENCES projects_v3(id),
  team_name VARCHAR(255),
  service_details TEXT,
  activity_description TEXT,
  notes TEXT,
  row_color VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- پرسنل گزارش روزانه
CREATE TABLE daily_report_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id UUID NOT NULL REFERENCES daily_reports(id),
  staff_user_id UUID,
  staff_name VARCHAR(255),
  work_status VARCHAR(50) DEFAULT 'حاضر',
  overtime_hours INTEGER DEFAULT 0,
  amount_received NUMERIC(15,2) DEFAULT 0,
  receiving_notes TEXT,
  amount_spent NUMERIC(15,2) DEFAULT 0,
  spending_notes TEXT,
  is_cash_box BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
