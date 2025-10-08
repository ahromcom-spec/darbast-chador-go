-- =====================================================
-- COMPREHENSIVE WORKFLOW SYSTEM MIGRATION
-- Phase 1: Core schema, entities, and automation
-- =====================================================

-- ============ ENUMS ============

CREATE TYPE project_status AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE service_status AS ENUM ('NEW', 'SCHEDULED', 'IN_PROGRESS', 'DONE_PENDING_QC', 'DONE', 'CLOSED', 'UNDER_REVIEW', 'CANCELLED');
CREATE TYPE payment_status AS ENUM ('UNBILLED', 'INVOICED', 'PARTIAL', 'SETTLED');
CREATE TYPE task_type AS ENUM ('execution_schedule', 'contractor_assignment', 'warehouse_pick', 'procurement', 'qc', 'finance');
CREATE TYPE task_status AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'BLOCKED');
CREATE TYPE media_type AS ENUM ('INSTALLATION_PROOF', 'INSPECTION', 'INVOICE_ATTACHMENT', 'OTHER');
CREATE TYPE inventory_tracking AS ENUM ('NONE', 'SN', 'SN_LOT');
CREATE TYPE service_line_source AS ENUM ('BOM', 'ADHOC');
CREATE TYPE reservation_status AS ENUM ('RESERVED', 'PICKED', 'RETURNED');
CREATE TYPE invoice_status AS ENUM ('DRAFT', 'SENT', 'PAID', 'VOID');
CREATE TYPE payment_status_enum AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');
CREATE TYPE notification_channel AS ENUM ('EMAIL', 'SMS', 'INAPP', 'WHATSAPP', 'WEBHOOK');
CREATE TYPE request_source AS ENUM ('PORTAL', 'AGENT', 'API');

-- ============ CORE TABLES ============

-- Addresses (normalized with geocoding)
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT NOT NULL,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'IR' NOT NULL,
  geo_lat NUMERIC(10, 7),
  geo_lng NUMERIC(10, 7),
  normalized_hash TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Service Types
CREATE TABLE service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  requires_permit BOOLEAN DEFAULT false,
  default_bom JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Projects (new structure - groups multiple services)
CREATE TABLE projects_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  address_id UUID REFERENCES addresses(id) ON DELETE RESTRICT NOT NULL,
  service_type_id UUID REFERENCES service_types(id) ON DELETE RESTRICT NOT NULL,
  status project_status DEFAULT 'ACTIVE' NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  archived_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(customer_id, address_id, service_type_id)
);

-- Services (work orders within projects)
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects_v2(id) ON DELETE CASCADE NOT NULL,
  contractor_id UUID REFERENCES contractors(id) ON DELETE SET NULL,
  status service_status DEFAULT 'NEW' NOT NULL,
  install_start_at TIMESTAMPTZ,
  install_end_at TIMESTAMPTZ,
  completion_date TIMESTAMPTZ,
  payment_status payment_status DEFAULT 'UNBILLED' NOT NULL,
  priority INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Service Requests (intake)
CREATE TABLE service_requests_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  address_id UUID REFERENCES addresses(id) ON DELETE RESTRICT,
  service_type_id UUID REFERENCES service_types(id) ON DELETE RESTRICT NOT NULL,
  requested_for_at TIMESTAMPTZ,
  details JSONB,
  source request_source DEFAULT 'PORTAL' NOT NULL,
  merged_into_service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tasks (departmental tasks)
CREATE TABLE workflow_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE NOT NULL,
  type task_type NOT NULL,
  status task_status DEFAULT 'OPEN' NOT NULL,
  assignee_role app_role,
  due_at TIMESTAMPTZ,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Media (proof uploads)
CREATE TABLE service_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE NOT NULL,
  type media_type DEFAULT 'OTHER' NOT NULL,
  url TEXT NOT NULL,
  checksum TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  metadata JSONB
);

-- ============ INVENTORY & BILLING ============

-- Inventory Items
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  unit TEXT DEFAULT 'EA',
  tracking inventory_tracking DEFAULT 'NONE',
  qty_on_hand NUMERIC(10, 2) DEFAULT 0,
  qty_reserved NUMERIC(10, 2) DEFAULT 0,
  unit_price NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Service Line Items (BOM)
CREATE TABLE service_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE NOT NULL,
  sku TEXT NOT NULL,
  description TEXT NOT NULL,
  qty NUMERIC(10, 2) NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL,
  tax_rate NUMERIC(5, 2) DEFAULT 0,
  source service_line_source DEFAULT 'BOM',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Inventory Reservations
CREATE TABLE inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE NOT NULL,
  sku TEXT NOT NULL,
  qty NUMERIC(10, 2) NOT NULL,
  status reservation_status DEFAULT 'RESERVED',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id) ON DELETE RESTRICT NOT NULL UNIQUE,
  number TEXT UNIQUE NOT NULL,
  total NUMERIC(12, 2) NOT NULL,
  currency TEXT DEFAULT 'IRR',
  status invoice_status DEFAULT 'DRAFT' NOT NULL,
  issued_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  provider TEXT,
  amount NUMERIC(12, 2) NOT NULL,
  status payment_status_enum DEFAULT 'PENDING' NOT NULL,
  paid_at TIMESTAMPTZ,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============ INDEXES ============

CREATE INDEX idx_addresses_customer ON addresses(customer_id);
CREATE INDEX idx_addresses_hash ON addresses(normalized_hash);
CREATE INDEX idx_addresses_geo ON addresses(geo_lat, geo_lng);

CREATE INDEX idx_projects_v2_customer ON projects_v2(customer_id);
CREATE INDEX idx_projects_v2_status ON projects_v2(status);
CREATE INDEX idx_projects_v2_key ON projects_v2(customer_id, address_id, service_type_id);

CREATE INDEX idx_services_project ON services(project_id);
CREATE INDEX idx_services_contractor ON services(contractor_id);
CREATE INDEX idx_services_status ON services(status);
CREATE INDEX idx_services_schedule ON services(install_start_at);

CREATE INDEX idx_service_requests_v2_customer ON service_requests_v2(customer_id);
CREATE INDEX idx_service_requests_v2_merged ON service_requests_v2(merged_into_service_id);

CREATE INDEX idx_workflow_tasks_service ON workflow_tasks(service_id);
CREATE INDEX idx_workflow_tasks_status ON workflow_tasks(status);

CREATE INDEX idx_service_media_service ON service_media(service_id);

CREATE INDEX idx_inventory_reservations_service ON inventory_reservations(service_id);
CREATE INDEX idx_inventory_reservations_sku ON inventory_reservations(sku);

CREATE INDEX idx_invoices_service ON invoices(service_id);
CREATE INDEX idx_invoices_status ON invoices(status);

CREATE INDEX idx_payments_invoice ON payments(invoice_id);

-- ============ TRIGGERS FOR UPDATED_AT ============

CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_v2_updated_at BEFORE UPDATE ON projects_v2
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_tasks_updated_at BEFORE UPDATE ON workflow_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_reservations_updated_at BEFORE UPDATE ON inventory_reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============ WORKFLOW AUTOMATION FUNCTIONS ============

-- Function: Handle new service request
CREATE OR REPLACE FUNCTION handle_new_service_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
  v_service_id UUID;
  v_address_id UUID;
BEGIN
  -- Use existing address or create placeholder
  v_address_id := NEW.address_id;
  
  -- Find or create project
  SELECT id INTO v_project_id
  FROM projects_v2
  WHERE customer_id = NEW.customer_id
    AND address_id = v_address_id
    AND service_type_id = NEW.service_type_id
    AND status = 'ACTIVE';
  
  IF v_project_id IS NULL THEN
    -- Create new project
    INSERT INTO projects_v2 (customer_id, address_id, service_type_id, title)
    SELECT NEW.customer_id, v_address_id, NEW.service_type_id, 
           st.name || ' • ' || COALESCE(a.line1, 'بدون آدرس')
    FROM service_types st
    LEFT JOIN addresses a ON a.id = v_address_id
    WHERE st.id = NEW.service_type_id
    RETURNING id INTO v_project_id;
  END IF;
  
  -- Create service (work order)
  INSERT INTO services (project_id, status, notes)
  VALUES (v_project_id, 'NEW', NEW.details::TEXT)
  RETURNING id INTO v_service_id;
  
  -- Update service request with merged service
  NEW.merged_into_service_id := v_service_id;
  
  -- Create initial tasks
  INSERT INTO workflow_tasks (service_id, type, status, assignee_role)
  VALUES 
    (v_service_id, 'execution_schedule', 'OPEN', 'operations_manager'),
    (v_service_id, 'contractor_assignment', 'OPEN', 'operations_manager'),
    (v_service_id, 'warehouse_pick', 'OPEN', 'warehouse_manager');
  
  -- Log audit
  PERFORM log_audit(NEW.customer_id, 'service_requested', 'services', v_service_id, 
    jsonb_build_object('project_id', v_project_id));
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_service_request_created
  BEFORE INSERT ON service_requests_v2
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_service_request();

-- Function: Handle service scheduling
CREATE OR REPLACE FUNCTION handle_service_scheduled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.install_start_at IS NULL AND NEW.install_start_at IS NOT NULL 
     AND NEW.status = 'NEW' THEN
    NEW.status := 'SCHEDULED';
    
    -- Mark execution_schedule task as done
    UPDATE workflow_tasks
    SET status = 'DONE', updated_at = now()
    WHERE service_id = NEW.id AND type = 'execution_schedule';
    
    -- Log audit
    PERFORM log_audit(auth.uid(), 'service_scheduled', 'services', NEW.id,
      jsonb_build_object('install_start_at', NEW.install_start_at));
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_service_schedule_update
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION handle_service_scheduled();

-- Function: Handle service completion
CREATE OR REPLACE FUNCTION handle_service_done()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_number TEXT;
  v_invoice_id UUID;
  v_total NUMERIC;
BEGIN
  IF OLD.status != 'DONE' AND NEW.status = 'DONE' AND NEW.payment_status = 'UNBILLED' THEN
    -- Calculate total
    SELECT COALESCE(SUM(qty * unit_price * (1 + tax_rate/100)), 0)
    INTO v_total
    FROM service_line_items
    WHERE service_id = NEW.id;
    
    -- Generate invoice number
    v_invoice_number := 'INV-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || substring(NEW.id::TEXT, 1, 8);
    
    -- Create invoice
    INSERT INTO invoices (service_id, number, total, status, issued_at, due_at)
    VALUES (NEW.id, v_invoice_number, v_total, 'DRAFT', now(), now() + INTERVAL '30 days')
    RETURNING id INTO v_invoice_id;
    
    -- Update payment status
    NEW.payment_status := 'INVOICED';
    
    -- Create finance task
    INSERT INTO workflow_tasks (service_id, type, status, assignee_role, payload)
    VALUES (NEW.id, 'finance', 'OPEN', 'finance_manager',
      jsonb_build_object('invoice_id', v_invoice_id, 'amount', v_total));
    
    -- Log audit
    PERFORM log_audit(auth.uid(), 'invoice_created', 'invoices', v_invoice_id,
      jsonb_build_object('service_id', NEW.id, 'amount', v_total));
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_service_done
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION handle_service_done();

-- Function: Handle payment received
CREATE OR REPLACE FUNCTION handle_payment_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status != 'PAID' AND NEW.status = 'PAID' THEN
    -- Update invoice status
    UPDATE invoices
    SET status = 'PAID', updated_at = now()
    WHERE id = NEW.invoice_id;
    
    -- Update service payment status
    UPDATE services s
    SET payment_status = 'SETTLED', updated_at = now()
    FROM invoices i
    WHERE i.id = NEW.invoice_id AND s.id = i.service_id;
    
    -- Log audit
    PERFORM log_audit(auth.uid(), 'payment_received', 'payments', NEW.id,
      jsonb_build_object('invoice_id', NEW.invoice_id, 'amount', NEW.amount));
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_payment_status_change
  AFTER UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION handle_payment_received();

-- Function: Handle service closure
CREATE OR REPLACE FUNCTION handle_service_closure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
  v_has_active_services BOOLEAN;
BEGIN
  IF OLD.status != 'CLOSED' AND NEW.status = 'CLOSED' THEN
    v_project_id := NEW.project_id;
    
    -- Check if project has other active services
    SELECT EXISTS(
      SELECT 1 FROM services
      WHERE project_id = v_project_id
        AND status NOT IN ('CLOSED', 'CANCELLED')
        AND id != NEW.id
    ) INTO v_has_active_services;
    
    IF NOT v_has_active_services THEN
      -- Archive project
      UPDATE projects_v2
      SET status = 'ARCHIVED', archived_at = now(), updated_at = now()
      WHERE id = v_project_id;
      
      -- Log audit
      PERFORM log_audit(auth.uid(), 'project_archived', 'projects_v2', v_project_id,
        jsonb_build_object('reason', 'all_services_closed'));
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_service_closed
  AFTER UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION handle_service_closure();

-- ============ RLS POLICIES ============

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Addresses
CREATE POLICY "Users can manage own addresses" ON addresses FOR ALL
  USING (auth.uid() = customer_id);

CREATE POLICY "Staff can view all addresses" ON addresses FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operations_manager'));

-- Service Types
CREATE POLICY "Anyone can view active service types" ON service_types FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage service types" ON service_types FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Projects V2
CREATE POLICY "Users can view own projects" ON projects_v2 FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "Staff can view all projects" ON projects_v2 FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operations_manager'));

CREATE POLICY "Staff can manage projects" ON projects_v2 FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operations_manager'));

-- Services
CREATE POLICY "Users can view own services" ON services FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects_v2 p
    WHERE p.id = services.project_id AND p.customer_id = auth.uid()
  ));

CREATE POLICY "Contractors can view assigned services" ON services FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM contractors c
    WHERE c.id = services.contractor_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Staff can manage all services" ON services FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operations_manager'));

-- Service Requests V2
CREATE POLICY "Users can create own requests" ON service_requests_v2 FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Users can view own requests" ON service_requests_v2 FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "Staff can view all requests" ON service_requests_v2 FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operations_manager'));

-- Workflow Tasks
CREATE POLICY "Staff can manage tasks" ON workflow_tasks FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operations_manager'));

-- Service Media
CREATE POLICY "Users can view media for own services" ON service_media FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM services s
    JOIN projects_v2 p ON p.id = s.project_id
    WHERE s.id = service_media.service_id AND p.customer_id = auth.uid()
  ));

CREATE POLICY "Contractors can upload media" ON service_media FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM services s
    JOIN contractors c ON c.id = s.contractor_id
    WHERE s.id = service_media.service_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Staff can manage all media" ON service_media FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operations_manager'));

-- Inventory
CREATE POLICY "Staff can manage inventory" ON inventory_items FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager'));

CREATE POLICY "Staff can view inventory" ON inventory_items FOR SELECT
  USING (has_role(auth.uid(), 'operations_manager'));

-- Service Line Items
CREATE POLICY "Users can view own line items" ON service_line_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM services s
    JOIN projects_v2 p ON p.id = s.project_id
    WHERE s.id = service_line_items.service_id AND p.customer_id = auth.uid()
  ));

CREATE POLICY "Staff can manage line items" ON service_line_items FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operations_manager'));

-- Invoices
CREATE POLICY "Users can view own invoices" ON invoices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM services s
    JOIN projects_v2 p ON p.id = s.project_id
    WHERE s.id = invoices.service_id AND p.customer_id = auth.uid()
  ));

CREATE POLICY "Staff can manage invoices" ON invoices FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance_manager'));

-- Payments
CREATE POLICY "Users can view own payments" ON payments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM invoices i
    JOIN services s ON s.id = i.service_id
    JOIN projects_v2 p ON p.id = s.project_id
    WHERE i.id = payments.invoice_id AND p.customer_id = auth.uid()
  ));

CREATE POLICY "Staff can manage payments" ON payments FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance_manager'));

-- ============ SEED DATA ============

-- Insert default service types
INSERT INTO service_types (name, code, requires_permit, default_bom) VALUES
  ('داربست فلزی', 'scaffolding', true, '{"items": [{"sku": "SCF-001", "qty": 10}]}'::jsonb),
  ('چادر برزنتی', 'tarpaulin', false, '{"items": [{"sku": "TRP-001", "qty": 5}]}'::jsonb),
  ('نصب و راه‌اندازی', 'installation', false, NULL);

COMMENT ON TABLE projects_v2 IS 'New projects structure - groups multiple services by customer, address, and service type';
COMMENT ON TABLE services IS 'Work orders within a project - represents a single execution cycle';
COMMENT ON TABLE workflow_tasks IS 'Departmental tasks for managing service lifecycle';