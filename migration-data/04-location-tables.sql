-- ============================================
-- 04-LOCATION-TABLES.SQL - جداول مکان
-- ============================================

-- مکان‌ها
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id),
  province_id UUID REFERENCES provinces(id),
  district_id UUID REFERENCES districts(id),
  title VARCHAR(255),
  address_line TEXT NOT NULL,
  lat DOUBLE PRECISION DEFAULT 0,
  lng DOUBLE PRECISION DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- آدرس‌ها (برای مشتریان)
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  country VARCHAR(100) DEFAULT 'Iran',
  state VARCHAR(100),
  city VARCHAR(100) NOT NULL,
  line1 TEXT NOT NULL,
  line2 TEXT,
  postal_code VARCHAR(20),
  geo_lat DOUBLE PRECISION,
  geo_lng DOUBLE PRECISION,
  normalized_hash VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
