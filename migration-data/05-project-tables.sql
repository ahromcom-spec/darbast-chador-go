-- ============================================
-- 05-PROJECT-TABLES.SQL - جداول پروژه و سفارش
-- ============================================

-- سلسله‌مراتب پروژه‌ها
CREATE TABLE projects_hierarchy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id),
  location_id UUID REFERENCES locations(id),
  service_type_id UUID REFERENCES service_types_v3(id),
  subcategory_id UUID REFERENCES subcategories(id),
  title VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- پروژه‌ها (سفارش‌های اصلی)
CREATE TABLE projects_v3 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  province_id UUID REFERENCES provinces(id),
  district_id UUID REFERENCES districts(id),
  subcategory_id UUID REFERENCES subcategories(id),
  hierarchy_project_id UUID REFERENCES projects_hierarchy(id),
  contractor_id UUID REFERENCES contractors(id),
  
  -- اطلاعات مشتری (کپی برای عملکرد بهتر)
  customer_name VARCHAR(255),
  customer_phone VARCHAR(20),
  
  -- اطلاعات مکان
  address TEXT,
  detailed_address TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  
  -- کد و وضعیت
  code VARCHAR(20) NOT NULL UNIQUE,
  status project_status_v3 DEFAULT 'pending',
  
  -- قیمت و پرداخت
  total_price NUMERIC(15,2) DEFAULT 0,
  payment_amount NUMERIC(15,2),
  total_paid NUMERIC(15,2) DEFAULT 0,
  payment_method VARCHAR(50),
  transaction_reference VARCHAR(100),
  
  -- تاریخ‌های مهم
  rental_start_date TIMESTAMPTZ,
  execution_start_date TIMESTAMPTZ,
  execution_end_date TIMESTAMPTZ,
  
  -- مراحل اجرا
  execution_stage VARCHAR(50),
  execution_stage_updated_at TIMESTAMPTZ,
  executed_by UUID,
  
  -- تأییدها
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  rejection_reason TEXT,
  execution_confirmed_at TIMESTAMPTZ,
  
  -- تأییدهای مالی
  financial_confirmed_at TIMESTAMPTZ,
  financial_confirmed_by UUID,
  payment_confirmed_at TIMESTAMPTZ,
  payment_confirmed_by UUID,
  
  -- تأیید مکان
  location_confirmed_at TIMESTAMPTZ,
  location_confirmed_by_customer BOOLEAN DEFAULT false,
  
  -- تکمیل
  customer_completion_date TIMESTAMPTZ,
  executive_completion_date TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  
  -- آرشیو
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  archived_by UUID,
  is_deep_archived BOOLEAN DEFAULT false,
  deep_archived_at TIMESTAMPTZ,
  deep_archived_by UUID,
  
  -- تمدید
  is_renewal BOOLEAN DEFAULT false,
  original_order_id UUID REFERENCES projects_v3(id),
  
  -- انتقال
  transferred_from_user_id UUID,
  transferred_from_phone VARCHAR(20),
  
  -- یادداشت‌ها (JSONB)
  notes JSONB,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- پروژه‌ها (نسخه قدیمی برای سازگاری)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id),
  title VARCHAR(255),
  description TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- سفارش‌ها (نسخه قدیمی)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id),
  project_id UUID NOT NULL REFERENCES projects_hierarchy(id),
  payload JSONB DEFAULT '{}',
  price NUMERIC(15,2),
  notes TEXT,
  status order_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- تخصیص پروژه به پیمانکار
CREATE TABLE project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL,
  contractor_id UUID NOT NULL REFERENCES contractors(id),
  status VARCHAR(50) DEFAULT 'pending',
  assigned_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- تخصیص کارها
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  assignee_user_id UUID NOT NULL,
  assigned_by_user_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  priority VARCHAR(20),
  stage_key VARCHAR(50),
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- رسانه پروژه
CREATE TABLE project_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects_v3(id),
  user_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_type VARCHAR(20) NOT NULL, -- image, video
  file_size INTEGER,
  mime_type VARCHAR(100),
  thumbnail_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- رسانه تأیید شده
CREATE TABLE approved_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES projects_v3(id),
  original_media_id UUID,
  uploaded_by UUID,
  approved_by UUID,
  file_path TEXT NOT NULL,
  file_type VARCHAR(20) NOT NULL,
  thumbnail_path TEXT,
  title VARCHAR(255),
  description TEXT,
  project_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  rejection_reason TEXT,
  is_visible BOOLEAN DEFAULT true,
  display_order INTEGER,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- همکاران پروژه
CREATE TABLE project_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects_hierarchy(id),
  inviter_user_id UUID NOT NULL,
  invitee_user_id UUID,
  invitee_phone_number VARCHAR(20) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  invited_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
