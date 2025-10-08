-- فاز 3 - مرحله 2: RLS Policies

-- RLS Policies برای project_progress_stages
CREATE POLICY "Users can view stages of their projects"
  ON public.project_progress_stages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_progress_stages.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can update stages"
  ON public.project_progress_stages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_progress_stages.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Operations manager can view all stages"
  ON public.project_progress_stages FOR SELECT
  USING (has_role(auth.uid(), 'operations_manager'));

CREATE POLICY "Operations manager can manage stages"
  ON public.project_progress_stages FOR ALL
  USING (has_role(auth.uid(), 'operations_manager'));

CREATE POLICY "Scaffold supervisor can view and update stages"
  ON public.project_progress_stages FOR ALL
  USING (has_role(auth.uid(), 'scaffold_supervisor'));

CREATE POLICY "Admins can manage all stages"
  ON public.project_progress_stages FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'general_manager'));

-- RLS Policies برای assignments
CREATE POLICY "Users can view their assignments"
  ON public.assignments FOR SELECT
  USING (auth.uid() = assignee_user_id);

CREATE POLICY "Users can update their assignments"
  ON public.assignments FOR UPDATE
  USING (auth.uid() = assignee_user_id);

CREATE POLICY "Project owners can view project assignments"
  ON public.assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = assignments.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Operations manager can manage all assignments"
  ON public.assignments FOR ALL
  USING (has_role(auth.uid(), 'operations_manager'));

CREATE POLICY "Scaffold supervisor can create and view assignments"
  ON public.assignments FOR SELECT
  USING (has_role(auth.uid(), 'scaffold_supervisor'));

CREATE POLICY "Scaffold supervisor can create assignments"
  ON public.assignments FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'scaffold_supervisor'));

CREATE POLICY "Scaffold supervisor can update assignments they created"
  ON public.assignments FOR UPDATE
  USING (
    has_role(auth.uid(), 'scaffold_supervisor') AND
    auth.uid() = assigned_by_user_id
  );

CREATE POLICY "Admins can manage all assignments"
  ON public.assignments FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'general_manager'));

-- تریگرها
CREATE TRIGGER update_project_progress_stages_updated_at
  BEFORE UPDATE ON public.project_progress_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function برای ایجاد مراحل پیش‌فرض هنگام ایجاد پروژه جدید
CREATE OR REPLACE FUNCTION public.create_default_project_stages()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ایجاد مراحل پیش‌فرض برای پروژه‌های داربست
  IF NEW.service_type = 'scaffolding' THEN
    INSERT INTO public.project_progress_stages (project_id, stage_key, stage_title, order_index)
    VALUES
      (NEW.id, 'survey', 'بازدید اولیه', 1),
      (NEW.id, 'design', 'طراحی و برنامه‌ریزی', 2),
      (NEW.id, 'materials', 'تأمین مصالح', 3),
      (NEW.id, 'erection', 'نصب داربست', 4),
      (NEW.id, 'inspection', 'بازرسی ایمنی', 5),
      (NEW.id, 'handover', 'تحویل پروژه', 6);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_project_stages ON public.projects;
CREATE TRIGGER create_project_stages
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_project_stages();

-- Function برای ارسال اعلان هنگام ارجاع کار جدید
CREATE OR REPLACE FUNCTION public.notify_new_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigner_name TEXT;
  project_name TEXT;
BEGIN
  -- دریافت نام ارجاع‌دهنده
  SELECT p.full_name INTO assigner_name
  FROM public.profiles p
  WHERE p.user_id = NEW.assigned_by_user_id;
  
  -- دریافت نام پروژه
  SELECT pr.project_name INTO project_name
  FROM public.projects pr
  WHERE pr.id = NEW.project_id;
  
  -- ارسال اعلان به فرد منتسب‌شده
  PERFORM public.send_notification(
    NEW.assignee_user_id,
    'وظیفه جدید',
    assigner_name || ' یک وظیفه به شما در پروژه "' || project_name || '" ارجاع داد: ' || NEW.title,
    '/projects/' || NEW.project_id::TEXT,
    'info'
  );
  
  -- ثبت در audit log
  PERFORM public.log_audit(
    NEW.assigned_by_user_id,
    'create_assignment',
    'assignments',
    NEW.id,
    jsonb_build_object(
      'assignee_user_id', NEW.assignee_user_id,
      'project_id', NEW.project_id,
      'title', NEW.title
    )
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_assignment_created ON public.assignments;
CREATE TRIGGER notify_assignment_created
  AFTER INSERT ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_assignment();