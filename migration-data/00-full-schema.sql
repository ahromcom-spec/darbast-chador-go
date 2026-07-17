-- ============================================
-- FULL DATABASE SCHEMA
-- Generated from live database
-- Run 01-enums.sql FIRST, then this file
-- ============================================

-- === SEQUENCES ===
CREATE SEQUENCE IF NOT EXISTS public.project_code_seq START WITH 1000100 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;

-- === TABLES ===

-- activity_types
CREATE TABLE activity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- addresses
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT NOT NULL,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'IR'::text NOT NULL,
  geo_lat NUMERIC,
  geo_lng NUMERIC,
  normalized_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- approved_media
CREATE TABLE approved_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_media_id UUID,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  thumbnail_path TEXT,
  title TEXT,
  description TEXT,
  order_id UUID,
  project_name TEXT,
  uploaded_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending'::text NOT NULL,
  rejection_reason TEXT,
  display_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- assignments
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  stage_key TEXT,
  title TEXT NOT NULL,
  description TEXT,
  assignee_user_id UUID NOT NULL,
  assigned_by_user_id UUID NOT NULL,
  due_date TIMESTAMPTZ,
  status TEXT DEFAULT 'todo'::text NOT NULL,
  priority TEXT DEFAULT 'medium'::text,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- assistant_chat_messages
CREATE TABLE assistant_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  attachments JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- audit_log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- bank_card_transactions
CREATE TABLE bank_card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_card_id UUID NOT NULL,
  transaction_type VARCHAR NOT NULL,
  amount NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  description TEXT,
  reference_type VARCHAR,
  reference_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  module_name TEXT,
  report_date DATE
);

-- bank_cards
CREATE TABLE bank_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_name VARCHAR NOT NULL,
  bank_name VARCHAR NOT NULL,
  card_number VARCHAR,
  initial_balance NUMERIC DEFAULT 0 NOT NULL,
  current_balance NUMERIC DEFAULT 0 NOT NULL,
  registration_date DATE DEFAULT CURRENT_DATE NOT NULL,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  allowed_modules TEXT[]
);

-- call_logs
CREATE TABLE call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  caller_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  status TEXT DEFAULT 'ringing'::text NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- collection_request_messages
CREATE TABLE collection_request_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_request_id UUID NOT NULL,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_staff BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- collection_requests
CREATE TABLE collection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  description TEXT,
  requested_date TIMESTAMPTZ,
  status TEXT DEFAULT 'pending'::text NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  completed_at TIMESTAMPTZ,
  confirmed_date TIMESTAMPTZ
);

-- contractor_profiles
CREATE TABLE contractor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  phone_verified BOOLEAN DEFAULT false,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  region_id UUID,
  service_category_id UUID,
  activity_type_id UUID,
  status TEXT DEFAULT 'pending'::text,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- contractor_services
CREATE TABLE contractor_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL,
  service_type TEXT NOT NULL,
  sub_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- contractor_verification_requests
CREATE TABLE contractor_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  company_name TEXT NOT NULL,
  service_category_id UUID,
  activity_type_id UUID,
  region_id UUID,
  status TEXT DEFAULT 'pending'::text,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- contractors
CREATE TABLE contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT,
  experience_years INTEGER,
  description TEXT,
  is_approved BOOLEAN DEFAULT false NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  customer_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- daily_report_date_locks
CREATE TABLE daily_report_date_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  locked_by UUID NOT NULL,
  locked_by_module_key TEXT NOT NULL,
  locked_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- daily_report_order_media
CREATE TABLE daily_report_order_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_order_id UUID,
  daily_report_id UUID NOT NULL,
  order_id UUID,
  user_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_type VARCHAR NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR,
  report_date DATE NOT NULL,
  synced_to_project_media BOOLEAN DEFAULT false,
  project_media_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  row_index INTEGER
);

-- daily_report_orders
CREATE TABLE daily_report_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id UUID NOT NULL,
  order_id UUID,
  activity_description TEXT,
  service_details TEXT,
  team_name TEXT,
  notes TEXT,
  row_color TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- daily_report_staff
CREATE TABLE daily_report_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id UUID NOT NULL,
  staff_user_id UUID,
  staff_name TEXT,
  work_status TEXT DEFAULT 'غایب'::text NOT NULL,
  overtime_hours NUMERIC DEFAULT 0,
  amount_received NUMERIC DEFAULT 0,
  receiving_notes TEXT,
  amount_spent NUMERIC DEFAULT 0,
  spending_notes TEXT,
  notes TEXT,
  is_cash_box BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  bank_card_id UUID,
  is_company_expense BOOLEAN DEFAULT false
);

-- daily_reports
CREATE TABLE daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  created_by UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  archived_by UUID,
  module_key VARCHAR DEFAULT 'daily_report'::character varying
);

-- districts
CREATE TABLE districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  province_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (name, province_id)
);

-- email_verification_codes
CREATE TABLE email_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  purpose TEXT DEFAULT 'password_reset'::text NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + '00:10:00'::interval),
  used BOOLEAN DEFAULT false
);

-- expert_pricing_request_media
CREATE TABLE expert_pricing_request_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT DEFAULT 'image'::text NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- expert_pricing_requests
CREATE TABLE expert_pricing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  subcategory_id UUID NOT NULL,
  province_id UUID NOT NULL,
  district_id UUID,
  address TEXT NOT NULL,
  detailed_address TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  description TEXT,
  dimensions JSONB,
  requested_date TIMESTAMPTZ,
  status TEXT DEFAULT 'pending'::text NOT NULL,
  unit_price NUMERIC,
  total_price NUMERIC,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  assigned_expert_id UUID,
  expert_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- hr_employees
CREATE TABLE hr_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT,
  full_name TEXT NOT NULL,
  user_id UUID,
  position TEXT,
  department TEXT,
  hire_date DATE,
  status TEXT DEFAULT 'pending_registration'::text NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- internal_staff_profiles
CREATE TABLE internal_staff_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  phone_verified BOOLEAN DEFAULT false,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  region_id UUID,
  position_id UUID,
  status TEXT DEFAULT 'pending'::text,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- inventory_items
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT DEFAULT 'EA'::text,
  tracking INVENTORY_TRACKING DEFAULT 'NONE'::inventory_tracking,
  qty_on_hand NUMERIC DEFAULT 0,
  qty_reserved NUMERIC DEFAULT 0,
  unit_price NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- inventory_reservations
CREATE TABLE inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL,
  sku TEXT NOT NULL,
  qty NUMERIC NOT NULL,
  status RESERVATION_STATUS DEFAULT 'RESERVED'::reservation_status,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL,
  number TEXT NOT NULL,
  total NUMERIC NOT NULL,
  currency TEXT DEFAULT 'IRR'::text,
  status INVOICE_STATUS DEFAULT 'DRAFT'::invoice_status NOT NULL,
  issued_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- locations
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT,
  province_id UUID,
  district_id UUID,
  address_line TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- module_assignments
CREATE TABLE module_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key TEXT NOT NULL,
  module_name TEXT NOT NULL,
  assigned_phone_number TEXT NOT NULL,
  assigned_user_id UUID,
  assigned_by UUID NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  module_href TEXT,
  module_description TEXT,
  UNIQUE (module_key, assigned_phone_number)
);

-- module_edit_locks
CREATE TABLE module_edit_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key TEXT NOT NULL,
  module_date DATE DEFAULT CURRENT_DATE NOT NULL,
  locked_by UUID NOT NULL,
  locked_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  last_activity_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT (now() + '00:30:00'::interval) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (module_key, module_date)
);

-- module_hierarchy_states
CREATE TABLE module_hierarchy_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  type TEXT NOT NULL,
  hierarchy JSONB DEFAULT '[]'::jsonb NOT NULL,
  custom_names JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (owner_user_id, type)
);

-- module_shortcuts
CREATE TABLE module_shortcuts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  module_key TEXT NOT NULL,
  module_name TEXT NOT NULL,
  module_description TEXT,
  module_href TEXT,
  display_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  color TEXT,
  UNIQUE (user_id, module_key)
);

-- module_version_history
CREATE TABLE module_version_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key TEXT NOT NULL,
  module_date DATE NOT NULL,
  saved_by UUID NOT NULL,
  version_number INTEGER DEFAULT 1 NOT NULL,
  data_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- najva_subscriptions
CREATE TABLE najva_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subscriber_token TEXT NOT NULL,
  device_info JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  link TEXT,
  type TEXT DEFAULT 'info'::text
);

-- order_approvals
CREATE TABLE order_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  approver_role TEXT NOT NULL,
  approver_user_id UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  subcategory_id UUID,
  UNIQUE (order_id, approver_role)
);

-- order_collaborators
CREATE TABLE order_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  inviter_user_id UUID NOT NULL,
  invitee_user_id UUID,
  invitee_phone_number TEXT NOT NULL,
  status TEXT DEFAULT 'pending'::text NOT NULL,
  invited_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- order_daily_logs
CREATE TABLE order_daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  report_date DATE NOT NULL,
  activity_description TEXT,
  team_name TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- order_messages
CREATE TABLE order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_staff BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  audio_path TEXT
);

-- order_payments
CREATE TABLE order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT DEFAULT 'cash'::text,
  receipt_number TEXT,
  notes TEXT,
  paid_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  bank_card_id UUID,
  payment_date TIMESTAMPTZ DEFAULT now()
);

-- order_renewals
CREATE TABLE order_renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  renewal_number INTEGER DEFAULT 1 NOT NULL,
  previous_end_date TIMESTAMPTZ,
  new_start_date TIMESTAMPTZ NOT NULL,
  new_end_date TIMESTAMPTZ,
  original_price NUMERIC,
  renewal_price NUMERIC,
  status TEXT DEFAULT 'pending'::text NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  manager_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (order_id, renewal_number)
);

-- order_transfer_requests
CREATE TABLE order_transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  from_user_id UUID NOT NULL,
  to_user_id UUID,
  to_phone_number TEXT NOT NULL,
  status TEXT DEFAULT 'pending_manager'::text NOT NULL,
  manager_approved_by UUID,
  manager_approved_at TIMESTAMPTZ,
  manager_rejection_reason TEXT,
  recipient_responded_at TIMESTAMPTZ,
  recipient_rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb NOT NULL,
  price NUMERIC,
  status ORDER_STATUS DEFAULT 'pending'::order_status,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- organizational_positions
CREATE TABLE organizational_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  parent_id UUID
);

-- otp_codes
CREATE TABLE otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL,
  provider TEXT,
  amount NUMERIC NOT NULL,
  status PAYMENT_STATUS_ENUM DEFAULT 'PENDING'::payment_status_enum NOT NULL,
  paid_at TIMESTAMPTZ,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- phone_whitelist
CREATE TABLE phone_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  allowed_roles TEXT[] DEFAULT '{}'::text[] NOT NULL,
  notes TEXT,
  added_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- profile_photos
CREATE TABLE profile_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  phone_number TEXT,
  avatar_url TEXT,
  bio TEXT,
  user_password_hash TEXT,
  recovery_email TEXT,
  recovery_email_verified BOOLEAN DEFAULT false,
  password_set_at TIMESTAMPTZ
);

-- project_assignments
CREATE TABLE project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL,
  contractor_id UUID NOT NULL,
  status TEXT DEFAULT 'pending'::text NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- project_collaborators
CREATE TABLE project_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  inviter_user_id UUID NOT NULL,
  invitee_user_id UUID,
  invitee_phone_number TEXT NOT NULL,
  status TEXT DEFAULT 'pending'::text NOT NULL,
  invited_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (project_id, invitee_phone_number)
);

-- project_hierarchy_media
CREATE TABLE project_hierarchy_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hierarchy_project_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT DEFAULT 'image'::text NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- project_media
CREATE TABLE project_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  thumbnail_path TEXT
);

-- project_progress_media
CREATE TABLE project_progress_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  uploaded_by UUID NOT NULL,
  stage TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  media_type TEXT DEFAULT 'image/jpeg'::text,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- project_progress_stages
CREATE TABLE project_progress_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  stage_key TEXT NOT NULL,
  stage_title TEXT NOT NULL,
  order_index INTEGER DEFAULT 0 NOT NULL,
  is_completed BOOLEAN DEFAULT false NOT NULL,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id, stage_key)
);

-- projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  service_type TEXT NOT NULL,
  location_address TEXT NOT NULL,
  project_name TEXT NOT NULL,
  status TEXT DEFAULT 'active'::text NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (user_id, service_type, location_address)
);

-- projects_hierarchy
CREATE TABLE projects_hierarchy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  location_id UUID NOT NULL,
  service_type_id UUID NOT NULL,
  subcategory_id UUID NOT NULL,
  title TEXT,
  status TEXT DEFAULT 'active'::text,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (location_id, service_type_id, subcategory_id)
);

-- projects_v2
CREATE TABLE projects_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  address_id UUID NOT NULL,
  service_type_id UUID NOT NULL,
  status PROJECT_STATUS DEFAULT 'ACTIVE'::project_status NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  archived_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (customer_id, address_id, service_type_id)
);

-- projects_v3
CREATE TABLE projects_v3 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  customer_id UUID NOT NULL,
  contractor_id UUID,
  province_id UUID NOT NULL,
  district_id UUID,
  subcategory_id UUID NOT NULL,
  status PROJECT_STATUS_V3 DEFAULT 'pending'::project_status_v3,
  address TEXT NOT NULL,
  detailed_address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  execution_start_date TIMESTAMPTZ,
  execution_end_date TIMESTAMPTZ,
  executed_by UUID,
  execution_confirmed_at TIMESTAMPTZ,
  payment_confirmed_by UUID,
  payment_confirmed_at TIMESTAMPTZ,
  financial_confirmed_by UUID,
  financial_confirmed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  payment_amount NUMERIC,
  payment_method TEXT,
  transaction_reference TEXT,
  customer_completion_date TIMESTAMPTZ,
  executive_completion_date TIMESTAMPTZ,
  hierarchy_project_id UUID,
  execution_stage EXECUTION_STAGE,
  execution_stage_updated_at TIMESTAMPTZ,
  is_renewal BOOLEAN DEFAULT false,
  original_order_id UUID,
  customer_name TEXT,
  customer_phone TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  transferred_from_user_id UUID,
  transferred_from_phone TEXT,
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  archived_by UUID,
  is_deep_archived BOOLEAN DEFAULT false,
  deep_archived_at TIMESTAMPTZ,
  deep_archived_by UUID,
  total_price NUMERIC DEFAULT 0,
  total_paid NUMERIC DEFAULT 0,
  location_confirmed_by_customer BOOLEAN DEFAULT false,
  location_confirmed_at TIMESTAMPTZ,
  rental_start_date TIMESTAMPTZ
);

-- provinces
CREATE TABLE provinces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- push_subscriptions
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (user_id, endpoint)
);

-- rating_criteria
CREATE TABLE rating_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_type RATING_TYPE NOT NULL,
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  weight NUMERIC DEFAULT 1.0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (rating_type, key)
);

-- rating_helpful_votes
CREATE TABLE rating_helpful_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id UUID,
  voter_id UUID NOT NULL,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (rating_id, voter_id)
);

-- rating_responses
CREATE TABLE rating_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id UUID,
  responder_id UUID NOT NULL,
  response TEXT NOT NULL,
  is_official BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (rating_id, responder_id)
);

-- ratings
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  rating_type RATING_TYPE NOT NULL,
  rater_id UUID NOT NULL,
  rated_id UUID NOT NULL,
  overall_score NUMERIC,
  criteria_scores JSONB,
  comment TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id, rater_id, rated_id, rating_type)
);

-- regions
CREATE TABLE regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  parent_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  code TEXT
);

-- repair_request_media
CREATE TABLE repair_request_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_request_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  user_id UUID NOT NULL
);

-- repair_request_messages
CREATE TABLE repair_request_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_request_id UUID NOT NULL,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_staff BOOLEAN DEFAULT false,
  audio_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- repair_requests
CREATE TABLE repair_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending'::text NOT NULL,
  estimated_cost NUMERIC DEFAULT 1500000,
  final_cost NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  completed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT
);

-- reputation_scores
CREATE TABLE reputation_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  overall_score NUMERIC DEFAULT 0,
  total_ratings INTEGER DEFAULT 0,
  customer_score NUMERIC,
  contractor_score NUMERIC,
  staff_score NUMERIC,
  trust_level TEXT DEFAULT 'new'::text,
  verified_projects INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- scaffolding_requests
CREATE TABLE scaffolding_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  address TEXT,
  details JSONB,
  status TEXT DEFAULT 'submitted'::text NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- service_activity_types
CREATE TABLE service_activity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- service_categories
CREATE TABLE service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- service_line_items
CREATE TABLE service_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL,
  sku TEXT NOT NULL,
  description TEXT NOT NULL,
  qty NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  tax_rate NUMERIC DEFAULT 0,
  source SERVICE_LINE_SOURCE DEFAULT 'BOM'::service_line_source,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- service_media
CREATE TABLE service_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL,
  type MEDIA_TYPE DEFAULT 'OTHER'::media_type NOT NULL,
  url TEXT NOT NULL,
  checksum TEXT,
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  metadata JSONB
);

-- service_requests
CREATE TABLE service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  service_type TEXT NOT NULL,
  sub_type TEXT,
  length NUMERIC NOT NULL,
  width NUMERIC NOT NULL,
  height NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending'::text NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  location_address TEXT,
  location_coordinates POINT,
  location_distance NUMERIC,
  project_id UUID
);

-- service_requests_v2
CREATE TABLE service_requests_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  address_id UUID,
  service_type_id UUID NOT NULL,
  requested_for_at TIMESTAMPTZ,
  details JSONB,
  source REQUEST_SOURCE DEFAULT 'PORTAL'::request_source NOT NULL,
  merged_into_service_id UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- service_types
CREATE TABLE service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  requires_permit BOOLEAN DEFAULT false,
  default_bom JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- service_types_v3
CREATE TABLE service_types_v3 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- services
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  contractor_id UUID,
  status SERVICE_STATUS DEFAULT 'NEW'::service_status NOT NULL,
  install_start_at TIMESTAMPTZ,
  install_end_at TIMESTAMPTZ,
  completion_date TIMESTAMPTZ,
  payment_status PAYMENT_STATUS DEFAULT 'UNBILLED'::payment_status NOT NULL,
  priority INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- services_v3
CREATE TABLE services_v3 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  service_number INTEGER NOT NULL,
  service_code TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending'::text NOT NULL,
  execution_start_date TIMESTAMPTZ,
  execution_end_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (project_id, service_number)
);

-- site_analytics
CREATE TABLE site_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  page_url TEXT,
  page_title TEXT,
  referrer_url TEXT,
  entry_page TEXT,
  device_type TEXT,
  os_name TEXT,
  os_version TEXT,
  browser_name TEXT,
  browser_version TEXT,
  device_model TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  viewport_width INTEGER,
  viewport_height INTEGER,
  language TEXT,
  timezone TEXT,
  ip_address INET,
  country TEXT,
  city TEXT,
  data_transferred_bytes BIGINT DEFAULT 0,
  session_duration_seconds INTEGER DEFAULT 0,
  page_count INTEGER DEFAULT 1,
  scroll_depth_percent INTEGER,
  is_logged_in BOOLEAN DEFAULT false,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  phone_number TEXT
);

-- site_sessions
CREATE TABLE site_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id UUID,
  started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  ended_at TIMESTAMPTZ,
  total_duration_seconds INTEGER DEFAULT 0,
  total_page_views INTEGER DEFAULT 0,
  total_data_bytes BIGINT DEFAULT 0,
  entry_page TEXT,
  exit_page TEXT,
  device_type TEXT,
  os_name TEXT,
  os_version TEXT,
  browser_name TEXT,
  device_model TEXT,
  ip_address INET,
  country TEXT,
  city TEXT,
  is_logged_in BOOLEAN DEFAULT false,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  phone_number TEXT,
  visited_pages TEXT[] DEFAULT '{}'::text[]
);

-- staff_profiles
CREATE TABLE staff_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  requested_role APP_ROLE NOT NULL,
  status TEXT DEFAULT 'pending'::text NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  province TEXT,
  staff_category TEXT,
  staff_subcategory TEXT,
  staff_position TEXT,
  description TEXT,
  UNIQUE (user_id, requested_role)
);

-- staff_roles
CREATE TABLE staff_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role STAFF_ROLE_TYPE NOT NULL,
  service_type_id UUID,
  subcategory_id UUID,
  province_id UUID,
  active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role, service_type_id, province_id)
);

-- staff_salary_settings
CREATE TABLE staff_salary_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_code TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  base_daily_salary NUMERIC DEFAULT 0 NOT NULL,
  overtime_rate_fraction NUMERIC DEFAULT 0.167 NOT NULL,
  notes TEXT,
  created_by UUID DEFAULT auth.uid() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  previous_month_balance NUMERIC DEFAULT 0,
  previous_month_extra_received NUMERIC DEFAULT 0,
  bonuses NUMERIC DEFAULT 0,
  deductions NUMERIC DEFAULT 0,
  effective_from DATE,
  effective_to DATE,
  UNIQUE (staff_code, effective_from)
);

-- staff_verification_requests
CREATE TABLE staff_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  requested_role APP_ROLE NOT NULL,
  position_id UUID,
  region_id UUID,
  status TEXT DEFAULT 'pending'::text,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, requested_role)
);

-- staff_whitelist
CREATE TABLE staff_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  allowed_position_ids _UUID DEFAULT '{}'::uuid[]
);

-- subcategories
CREATE TABLE subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  service_type_id UUID NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (code, service_type_id)
);

-- ticket_attachments
CREATE TABLE ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ticket_messages
CREATE TABLE ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- tickets
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  service_request_id UUID,
  department TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open'::text NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- user_roles
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role APP_ROLE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- voice_call_signals
CREATE TABLE voice_call_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  caller_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  signal_type TEXT NOT NULL,
  signal_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- wallet_transactions
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  transaction_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  balance_after NUMERIC,
  title TEXT NOT NULL,
  description TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- workflow_tasks
CREATE TABLE workflow_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL,
  type TASK_TYPE NOT NULL,
  status TASK_STATUS DEFAULT 'OPEN'::task_status NOT NULL,
  assignee_role APP_ROLE,
  due_at TIMESTAMPTZ,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

