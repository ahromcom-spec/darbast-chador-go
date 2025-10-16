-- سیستم تایید سفارشات - ساده‌سازی شده

-- اضافه کردن ستون‌های مورد نیاز برای تایید سفارش
ALTER TABLE projects_v3
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- اضافه کردن مقدار pending به enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e 
    JOIN pg_type t ON e.enumtypid = t.oid 
    WHERE t.typname = 'project_status_v3' AND e.enumlabel = 'pending') THEN
    ALTER TYPE project_status_v3 ADD VALUE 'pending';
  END IF;
END$$;

-- commit implicit یا
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e 
    JOIN pg_type t ON e.enumtypid = t.oid 
    WHERE t.typname = 'project_status_v3' AND e.enumlabel = 'approved') THEN
    ALTER TYPE project_status_v3 ADD VALUE 'approved';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e 
    JOIN pg_type t ON e.enumtypid = t.oid 
    WHERE t.typname = 'project_status_v3' AND e.enumlabel = 'rejected') THEN
    ALTER TYPE project_status_v3 ADD VALUE 'rejected';
  END IF;
END$$;