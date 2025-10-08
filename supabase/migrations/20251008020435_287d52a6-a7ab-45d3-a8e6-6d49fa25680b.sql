-- فاز 1 - مرحله 1: افزودن نقش‌های جدید به enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'scaffold_worker';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'scaffold_supervisor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operations_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sales_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'general_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'warehouse_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'security_manager';