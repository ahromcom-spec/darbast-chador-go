
-- جدول گزارش روزانه
CREATE TABLE public.daily_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_date DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(report_date, created_by)
);

-- جدول گزارش سفارشات مشتری
CREATE TABLE public.daily_report_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_report_id UUID NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.projects_v3(id),
  activity_description TEXT,
  service_details TEXT,
  team_name TEXT,
  notes TEXT,
  row_color TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- جدول گزارش نیروها
CREATE TABLE public.daily_report_staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_report_id UUID NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
  staff_user_id UUID REFERENCES auth.users(id),
  staff_name TEXT,
  work_status TEXT NOT NULL DEFAULT 'غایب' CHECK (work_status IN ('حاضر', 'غایب')),
  overtime_hours DECIMAL(5,2) DEFAULT 0,
  amount_received DECIMAL(15,0) DEFAULT 0,
  receiving_notes TEXT,
  amount_spent DECIMAL(15,0) DEFAULT 0,
  spending_notes TEXT,
  notes TEXT,
  is_cash_box BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_staff ENABLE ROW LEVEL SECURITY;

-- Policies for daily_reports
CREATE POLICY "CEO and managers can view all daily reports"
ON public.daily_reports FOR SELECT
USING (
  public.has_role(auth.uid(), 'ceo'::app_role) OR
  public.has_role(auth.uid(), 'general_manager'::app_role) OR
  public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
);

CREATE POLICY "CEO and managers can create daily reports"
ON public.daily_reports FOR INSERT
WITH CHECK (
  auth.uid() = created_by AND (
    public.has_role(auth.uid(), 'ceo'::app_role) OR
    public.has_role(auth.uid(), 'general_manager'::app_role) OR
    public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  )
);

CREATE POLICY "CEO and managers can update own daily reports"
ON public.daily_reports FOR UPDATE
USING (
  created_by = auth.uid() AND (
    public.has_role(auth.uid(), 'ceo'::app_role) OR
    public.has_role(auth.uid(), 'general_manager'::app_role) OR
    public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  )
);

CREATE POLICY "CEO and managers can delete own daily reports"
ON public.daily_reports FOR DELETE
USING (
  created_by = auth.uid() AND (
    public.has_role(auth.uid(), 'ceo'::app_role) OR
    public.has_role(auth.uid(), 'general_manager'::app_role) OR
    public.has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)
  )
);

-- Policies for daily_report_orders
CREATE POLICY "Users can view order reports they have access to"
ON public.daily_report_orders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.daily_reports dr
    WHERE dr.id = daily_report_id
  )
);

CREATE POLICY "Users can manage order reports"
ON public.daily_report_orders FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.daily_reports dr
    WHERE dr.id = daily_report_id AND dr.created_by = auth.uid()
  )
);

-- Policies for daily_report_staff
CREATE POLICY "Users can view staff reports they have access to"
ON public.daily_report_staff FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.daily_reports dr
    WHERE dr.id = daily_report_id
  )
);

CREATE POLICY "Users can manage staff reports"
ON public.daily_report_staff FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.daily_reports dr
    WHERE dr.id = daily_report_id AND dr.created_by = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_daily_reports_updated_at
BEFORE UPDATE ON public.daily_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_report_orders_updated_at
BEFORE UPDATE ON public.daily_report_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_report_staff_updated_at
BEFORE UPDATE ON public.daily_report_staff
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
