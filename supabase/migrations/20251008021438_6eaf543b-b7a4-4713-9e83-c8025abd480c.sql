-- فاز 3 - مرحله 1: جداول مدیریت پروژه و ارجاع کار

-- جدول مراحل استاندارد پروژه
CREATE TABLE IF NOT EXISTS public.project_progress_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_key TEXT NOT NULL, -- survey, design, erection, inspection, handover, etc.
  stage_title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(project_id, stage_key)
);

-- جدول ارجاع کار به افراد
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_key TEXT, -- مرحله مربوطه (اختیاری)
  title TEXT NOT NULL,
  description TEXT,
  assignee_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  due_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'blocked', 'done')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ایندکس‌ها
CREATE INDEX IF NOT EXISTS idx_project_progress_stages_project ON public.project_progress_stages(project_id);
CREATE INDEX IF NOT EXISTS idx_project_progress_stages_completed ON public.project_progress_stages(is_completed);
CREATE INDEX IF NOT EXISTS idx_assignments_project ON public.assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_assignments_assignee ON public.assignments(assignee_user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON public.assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_by ON public.assignments(assigned_by_user_id);

-- فعال‌سازی RLS
ALTER TABLE public.project_progress_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;