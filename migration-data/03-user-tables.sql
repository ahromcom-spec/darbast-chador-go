-- ============================================
-- 03-USER-TABLES.SQL - جداول کاربران
-- ============================================

-- پروفایل کاربران
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE, -- References auth.users
  full_name VARCHAR(255),
  phone_number VARCHAR(20),
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- مشتریان
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(user_id),
  customer_code VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- نقش‌های کاربران
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id),
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- لیست سفید شماره‌ها
CREATE TABLE phone_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL UNIQUE,
  allowed_roles TEXT[] DEFAULT '{}',
  notes TEXT,
  added_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- کدهای OTP
CREATE TABLE otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL,
  code VARCHAR(10) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- پیمانکاران
CREATE TABLE contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id),
  company_name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone_number VARCHAR(20) NOT NULL,
  address TEXT,
  description TEXT,
  experience_years INTEGER,
  is_active BOOLEAN DEFAULT true,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- پروفایل پیمانکاران
CREATE TABLE contractor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id),
  region_id UUID REFERENCES regions(id),
  service_category_id UUID REFERENCES service_categories(id),
  activity_type_id UUID REFERENCES service_activity_types(id),
  status VARCHAR(50) DEFAULT 'pending',
  phone_verified BOOLEAN DEFAULT false,
  rejection_reason TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- درخواست تأیید پیمانکاران
CREATE TABLE contractor_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id),
  company_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  region_id UUID REFERENCES regions(id),
  service_category_id UUID REFERENCES service_categories(id),
  activity_type_id UUID REFERENCES activity_types(id),
  status VARCHAR(50) DEFAULT 'pending',
  rejection_reason TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- خدمات پیمانکاران
CREATE TABLE contractor_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractors(id),
  service_type VARCHAR(100) NOT NULL,
  sub_type VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- پروفایل کارکنان داخلی
CREATE TABLE internal_staff_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id),
  position_id UUID REFERENCES organizational_positions(id),
  region_id UUID REFERENCES regions(id),
  status VARCHAR(50) DEFAULT 'pending',
  phone_verified BOOLEAN DEFAULT false,
  rejection_reason TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- درخواست نقش کارکنان
CREATE TABLE staff_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id),
  requested_role VARCHAR(50),
  staff_category VARCHAR(100),
  staff_subcategory VARCHAR(100),
  staff_position VARCHAR(100),
  province VARCHAR(100),
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  rejection_reason TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- کارکنان HR
CREATE TABLE hr_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id),
  full_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  department VARCHAR(100),
  position VARCHAR(100),
  hire_date DATE,
  status VARCHAR(50) DEFAULT 'active',
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- عکس‌های پروفایل
CREATE TABLE profile_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id),
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
