-- ============================================
-- 01-ENUMS.SQL - Current Database Enums
-- Generated from live database
-- ============================================

CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'contractor', 'scaffold_worker', 'scaffold_supervisor', 'operations_manager', 'finance_manager', 'sales_manager', 'support_manager', 'general_manager', 'warehouse_manager', 'security_manager', 'ceo', 'scaffold_executive_manager', 'executive_manager_scaffold_execution_with_materials', 'rental_executive_manager');

CREATE TYPE public.execution_stage AS ENUM ('awaiting_payment', 'order_executed', 'awaiting_collection', 'in_collection', 'collected');

CREATE TYPE public.inventory_tracking AS ENUM ('NONE', 'SN', 'SN_LOT');

CREATE TYPE public.invoice_status AS ENUM ('DRAFT', 'SENT', 'PAID', 'VOID');

CREATE TYPE public.media_type AS ENUM ('INSTALLATION_PROOF', 'INSPECTION', 'INVOICE_ATTACHMENT', 'OTHER');

CREATE TYPE public.notification_channel AS ENUM ('EMAIL', 'SMS', 'INAPP', 'WHATSAPP', 'WEBHOOK');

CREATE TYPE public.order_status AS ENUM ('draft', 'pending', 'priced', 'confirmed', 'scheduled', 'in_progress', 'done', 'canceled');

CREATE TYPE public.payment_status AS ENUM ('UNBILLED', 'INVOICED', 'PARTIAL', 'SETTLED');

CREATE TYPE public.payment_status_enum AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

CREATE TYPE public.project_status AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TYPE public.project_status_v3 AS ENUM ('draft', 'pending_execution', 'active', 'completed', 'pending', 'approved', 'rejected', 'in_progress', 'paid', 'closed', 'scheduled');

CREATE TYPE public.rating_context AS ENUM ('project_completion', 'service_quality', 'communication', 'professionalism', 'punctuality');

CREATE TYPE public.rating_type AS ENUM ('customer_to_contractor', 'contractor_to_customer', 'staff_to_contractor', 'contractor_to_staff', 'customer_to_staff', 'staff_to_customer');

CREATE TYPE public.request_source AS ENUM ('PORTAL', 'AGENT', 'API');

CREATE TYPE public.reservation_status AS ENUM ('RESERVED', 'PICKED', 'RETURNED');

CREATE TYPE public.service_line_source AS ENUM ('BOM', 'ADHOC');

CREATE TYPE public.service_status AS ENUM ('NEW', 'SCHEDULED', 'IN_PROGRESS', 'DONE_PENDING_QC', 'DONE', 'CLOSED', 'UNDER_REVIEW', 'CANCELLED');

CREATE TYPE public.staff_role_type AS ENUM ('manager', 'supervisor', 'operations_manager', 'support', 'accounting', 'sales', 'warehouse', 'hr');

CREATE TYPE public.task_status AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'BLOCKED');

CREATE TYPE public.task_type AS ENUM ('execution_schedule', 'contractor_assignment', 'warehouse_pick', 'procurement', 'qc', 'finance');

