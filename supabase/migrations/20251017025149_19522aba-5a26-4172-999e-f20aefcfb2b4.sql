-- مرحله 1: اضافه کردن نقش‌های جدید
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'scaffold_executive_manager';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'sales_manager';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'finance_manager';

-- مرحله 1: اضافه کردن وضعیت‌های جدید
ALTER TYPE project_status_v3 ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE project_status_v3 ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE project_status_v3 ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE project_status_v3 ADD VALUE IF NOT EXISTS 'closed';