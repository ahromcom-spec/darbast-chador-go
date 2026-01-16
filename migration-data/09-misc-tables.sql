-- ============================================
-- 09-MISC-TABLES.SQL - جداول متفرقه
-- ============================================

-- اعلان‌ها
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  type VARCHAR(50),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- لاگ عملیات
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(100) NOT NULL,
  entity_id VARCHAR(100),
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- لاگ تماس
CREATE TABLE call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES projects_v3(id),
  caller_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  status VARCHAR(50) DEFAULT 'initiated',
  started_at TIMESTAMPTZ DEFAULT now(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- تخصیص ماژول
CREATE TABLE module_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_by UUID NOT NULL,
  assigned_user_id UUID,
  assigned_phone_number VARCHAR(20) NOT NULL,
  module_key VARCHAR(100) NOT NULL,
  module_name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- وضعیت سلسله‌مراتب ماژول
CREATE TABLE module_hierarchy_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL,
  hierarchy JSONB DEFAULT '{}',
  custom_names JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- پیام‌های چت دستیار
CREATE TABLE assistant_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role VARCHAR(20) NOT NULL, -- user, assistant
  content TEXT NOT NULL,
  attachments JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- درخواست قیمت‌گذاری کارشناسی
CREATE TABLE expert_pricing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  province_id UUID NOT NULL REFERENCES provinces(id),
  district_id UUID REFERENCES districts(id),
  subcategory_id UUID NOT NULL REFERENCES subcategories(id),
  assigned_expert_id UUID,
  address TEXT NOT NULL,
  detailed_address TEXT,
  description TEXT,
  dimensions JSONB,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  requested_date TIMESTAMPTZ,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  unit_price NUMERIC(15,2),
  total_price NUMERIC(15,2),
  expert_notes TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- رسانه درخواست قیمت‌گذاری
CREATE TABLE expert_pricing_request_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES expert_pricing_requests(id),
  user_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_type VARCHAR(20) DEFAULT 'image',
  file_size INTEGER,
  mime_type VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- اشتراک Najva
CREATE TABLE najva_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subscriber_token TEXT NOT NULL,
  device_info JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- درخواست سرویس
CREATE TABLE service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  service_type VARCHAR(100),
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- امتیازدهی
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_user_id UUID NOT NULL,
  rated_user_id UUID NOT NULL,
  order_id UUID REFERENCES projects_v3(id),
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
  review TEXT,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- رأی‌های مفید بودن امتیاز
CREATE TABLE rating_helpful_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id UUID NOT NULL REFERENCES ratings(id),
  user_id UUID NOT NULL,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rating_id, user_id)
);

-- سکانس کد سفارش
CREATE SEQUENCE project_code_seq START WITH 1000100;
