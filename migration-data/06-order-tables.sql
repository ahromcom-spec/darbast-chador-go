-- ============================================
-- 06-ORDER-TABLES.SQL - جداول سفارش
-- ============================================

-- تأییدیه‌های سفارش
CREATE TABLE order_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES projects_v3(id),
  subcategory_id UUID REFERENCES subcategories(id),
  approver_role VARCHAR(50) NOT NULL,
  approver_user_id UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- پیام‌های سفارش
CREATE TABLE order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES projects_v3(id),
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  audio_path TEXT,
  is_staff BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- پرداخت‌های سفارش
CREATE TABLE order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES projects_v3(id),
  paid_by UUID NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  payment_method VARCHAR(50),
  receipt_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- لاگ روزانه سفارش
CREATE TABLE order_daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES projects_v3(id),
  created_by UUID NOT NULL,
  report_date DATE NOT NULL,
  team_name VARCHAR(255),
  activity_description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- همکاران سفارش
CREATE TABLE order_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES projects_v3(id),
  inviter_user_id UUID NOT NULL,
  invitee_user_id UUID,
  invitee_phone_number VARCHAR(20) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  invited_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- درخواست انتقال سفارش
CREATE TABLE order_transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES projects_v3(id),
  from_user_id UUID NOT NULL,
  to_user_id UUID,
  to_phone_number VARCHAR(20) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  recipient_rejection_reason TEXT,
  recipient_responded_at TIMESTAMPTZ,
  manager_approved_at TIMESTAMPTZ,
  manager_approved_by UUID,
  manager_rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- تمدید سفارش
CREATE TABLE order_renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES projects_v3(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  renewal_number INTEGER DEFAULT 1,
  previous_end_date TIMESTAMPTZ,
  new_start_date TIMESTAMPTZ NOT NULL,
  new_end_date TIMESTAMPTZ,
  original_price NUMERIC(15,2),
  renewal_price NUMERIC(15,2),
  status VARCHAR(50) DEFAULT 'pending',
  manager_notes TEXT,
  rejection_reason TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- درخواست جمع‌آوری
CREATE TABLE collection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES projects_v3(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  description TEXT,
  requested_date TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'pending',
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- پیام‌های درخواست جمع‌آوری
CREATE TABLE collection_request_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_request_id UUID NOT NULL REFERENCES collection_requests(id),
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_staff BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
