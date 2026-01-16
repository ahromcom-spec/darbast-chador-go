-- ============================================
-- 01-ENUMS.SQL - تعریف انواع شمارشی
-- ============================================

-- نقش‌های کاربری
CREATE TYPE app_role AS ENUM (
  'admin',
  'general_manager',
  'ceo',
  'sales_manager',
  'scaffold_executive_manager',
  'executive_manager_scaffold_execution_with_materials',
  'rental_executive_manager',
  'finance_manager',
  'warehouse_manager',
  'support_security_manager',
  'contractor',
  'customer'
);

-- وضعیت سفارش
CREATE TYPE project_status_v3 AS ENUM (
  'pending',
  'approved',
  'rejected',
  'pending_execution',
  'scheduled',
  'in_progress',
  'completed',
  'closed',
  'cancelled'
);

-- مراحل اجرا
CREATE TYPE execution_stage_enum AS ENUM (
  'awaiting_scheduling',
  'scheduled',
  'in_progress',
  'order_executed',
  'awaiting_payment',
  'in_collection',
  'awaiting_collection',
  'collected'
);

-- وضعیت سفارش قدیمی
CREATE TYPE order_status AS ENUM (
  'draft',
  'pending',
  'approved',
  'rejected',
  'completed',
  'cancelled'
);

-- وضعیت فاکتور
CREATE TYPE invoice_status AS ENUM (
  'draft',
  'issued',
  'paid',
  'overdue',
  'cancelled'
);

-- وضعیت پرداخت
CREATE TYPE payment_status_enum AS ENUM (
  'pending',
  'completed',
  'failed',
  'refunded'
);

-- پیگیری موجودی
CREATE TYPE inventory_tracking AS ENUM (
  'none',
  'serial',
  'lot'
);

-- وضعیت رزرو
CREATE TYPE reservation_status AS ENUM (
  'pending',
  'confirmed',
  'released',
  'consumed'
);
