-- ============================================
-- 13-RLS-POLICIES.SQL - Row Level Security
-- Generated from live database
-- ============================================

ALTER TABLE public.activity_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active activity types" ON public.activity_types FOR SELECT TO public
  USING ((is_active = true));

ALTER TABLE public.activity_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can manage activity types" ON public.activity_types FOR ALL TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view all addresses" ON public.addresses FOR SELECT TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations_manager'::app_role)));

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own addresses" ON public.addresses FOR ALL TO public
  USING ((auth.uid() = customer_id));

ALTER TABLE public.approved_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view approved media" ON public.approved_media FOR SELECT TO public
  USING (((status = 'approved'::text) AND (is_visible = true)));

ALTER TABLE public.approved_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can submit media for approval" ON public.approved_media FOR INSERT TO public
  WITH CHECK ((auth.uid() IS NOT NULL));

ALTER TABLE public.approved_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEOs can manage all approved_media" ON public.approved_media FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'admin'::app_role)))
  WITH CHECK ((has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all assignments" ON public.assignments FOR ALL TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operations manager can manage all assignments" ON public.assignments FOR ALL TO public
  USING (has_role(auth.uid(), 'operations_manager'::app_role));

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project owners can view project assignments" ON public.assignments FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM projects
  WHERE ((projects.id = assignments.project_id) AND (projects.user_id = auth.uid())))));

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scaffold supervisor can create and view assignments" ON public.assignments FOR SELECT TO public
  USING (has_role(auth.uid(), 'scaffold_supervisor'::app_role));

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scaffold supervisor can create assignments" ON public.assignments FOR INSERT TO public
  WITH CHECK (has_role(auth.uid(), 'scaffold_supervisor'::app_role));

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scaffold supervisor can update assignments they created" ON public.assignments FOR UPDATE TO public
  USING ((has_role(auth.uid(), 'scaffold_supervisor'::app_role) AND (auth.uid() = assigned_by_user_id)));

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can update their assignments" ON public.assignments FOR UPDATE TO public
  USING ((auth.uid() = assignee_user_id));

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their assignments" ON public.assignments FOR SELECT TO public
  USING ((auth.uid() = assignee_user_id));

ALTER TABLE public.assistant_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create their own chat messages" ON public.assistant_chat_messages FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.assistant_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can delete their own chat messages" ON public.assistant_chat_messages FOR DELETE TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.assistant_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own chat messages" ON public.assistant_chat_messages FOR SELECT TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all audit logs" ON public.audit_log FOR SELECT TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block user deletes from audit logs" ON public.audit_log FOR DELETE TO public
  USING (false);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block user inserts on audit log" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (false);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block user modifications to audit logs" ON public.audit_log FOR INSERT TO public
  WITH CHECK (false);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block user updates to audit logs" ON public.audit_log FOR UPDATE TO public
  USING (false)
  WITH CHECK (false);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GM select audit log" ON public.audit_log FOR SELECT TO public
  USING (has_role(auth.uid(), 'general_manager'::app_role));

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prevent all deletes on audit log" ON public.audit_log FOR DELETE TO authenticated
  USING (false);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prevent all updates on audit log" ON public.audit_log FOR UPDATE TO authenticated
  USING (false);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own audit logs" ON public.audit_log FOR SELECT TO public
  USING ((actor_user_id = auth.uid()));

ALTER TABLE public.bank_card_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can insert transactions" ON public.bank_card_transactions FOR INSERT TO public
  WITH CHECK ((auth.uid() IS NOT NULL));

ALTER TABLE public.bank_card_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEO can delete bank card transactions" ON public.bank_card_transactions FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'ceo'::app_role)))));

ALTER TABLE public.bank_card_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEO can view all transactions" ON public.bank_card_transactions FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'ceo'::app_role)))));

ALTER TABLE public.bank_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEO can delete bank cards" ON public.bank_cards FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'ceo'::app_role)))));

ALTER TABLE public.bank_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEO can insert bank cards" ON public.bank_cards FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'ceo'::app_role)))));

ALTER TABLE public.bank_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEO can update bank cards" ON public.bank_cards FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'ceo'::app_role)))));

ALTER TABLE public.bank_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEO can view all bank cards" ON public.bank_cards FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'ceo'::app_role)))));

ALTER TABLE public.bank_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Daily report users can update bank card balances" ON public.bank_cards FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM module_assignments
  WHERE ((module_assignments.assigned_user_id = auth.uid()) AND (module_assignments.module_key = 'daily_report'::text) AND (module_assignments.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM module_assignments
  WHERE ((module_assignments.assigned_user_id = auth.uid()) AND (module_assignments.module_key = 'daily_report'::text) AND (module_assignments.is_active = true)))));

ALTER TABLE public.bank_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users with daily_report or CEO can view bank cards" ON public.bank_cards FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'ceo'::app_role)))) OR (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role)))) OR (EXISTS ( SELECT 1
   FROM module_assignments
  WHERE ((module_assignments.assigned_user_id = auth.uid()) AND (module_assignments.module_key = 'daily_report'::text) AND (module_assignments.is_active = true))))));

ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view all call logs" ON public.call_logs FOR SELECT TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role)));

ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create call logs" ON public.call_logs FOR INSERT TO public
  WITH CHECK ((auth.uid() = caller_id));

ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can update call logs" ON public.call_logs FOR UPDATE TO public
  USING (((auth.uid() = caller_id) OR (auth.uid() = receiver_id)));

ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view call logs for own orders" ON public.call_logs FOR SELECT TO public
  USING (((auth.uid() = caller_id) OR (auth.uid() = receiver_id) OR (EXISTS ( SELECT 1
   FROM (projects_v3 p
     JOIN customers c ON ((c.id = p.customer_id)))
  WHERE ((p.id = call_logs.order_id) AND (c.user_id = auth.uid()))))));

ALTER TABLE public.collection_request_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can send messages" ON public.collection_request_messages FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.collection_request_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view messages for their requests" ON public.collection_request_messages FOR SELECT TO public
  USING (((collection_request_id IN ( SELECT collection_requests.id
   FROM collection_requests
  WHERE (collection_requests.customer_id IN ( SELECT customers.id
           FROM customers
          WHERE (customers.user_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::app_role, 'ceo'::app_role, 'general_manager'::app_role, 'sales_manager'::app_role, 'scaffold_executive_manager'::app_role, 'executive_manager_scaffold_execution_with_materials'::app_role, 'finance_manager'::app_role])))))));

ALTER TABLE public.collection_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can create collection requests" ON public.collection_requests FOR INSERT TO public
  WITH CHECK ((customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.user_id = auth.uid()))));

ALTER TABLE public.collection_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can update their own pending requests" ON public.collection_requests FOR UPDATE TO public
  USING (((customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.user_id = auth.uid()))) AND (status = 'pending'::text)));

ALTER TABLE public.collection_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can view their own collection requests" ON public.collection_requests FOR SELECT TO public
  USING ((customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.user_id = auth.uid()))));

ALTER TABLE public.collection_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can create collection requests" ON public.collection_requests FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::app_role, 'ceo'::app_role, 'general_manager'::app_role, 'scaffold_executive_manager'::app_role, 'executive_manager_scaffold_execution_with_materials'::app_role, 'rental_executive_manager'::app_role]))))));

ALTER TABLE public.collection_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can update collection requests" ON public.collection_requests FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::app_role, 'ceo'::app_role, 'general_manager'::app_role, 'scaffold_executive_manager'::app_role, 'executive_manager_scaffold_execution_with_materials'::app_role, 'rental_executive_manager'::app_role]))))));

ALTER TABLE public.collection_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can view all collection requests" ON public.collection_requests FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::app_role, 'ceo'::app_role, 'general_manager'::app_role, 'sales_manager'::app_role, 'scaffold_executive_manager'::app_role, 'executive_manager_scaffold_execution_with_materials'::app_role, 'rental_executive_manager'::app_role, 'finance_manager'::app_role]))))));

ALTER TABLE public.contractor_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage contractor profiles" ON public.contractor_profiles FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.contractor_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all contractor profiles" ON public.contractor_profiles FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.contractor_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create own contractor profile" ON public.contractor_profiles FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.contractor_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own contractor profile" ON public.contractor_profiles FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

ALTER TABLE public.contractor_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all services" ON public.contractor_services FOR SELECT TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.contractor_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view services of approved contractors" ON public.contractor_services FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM contractors
  WHERE ((contractors.id = contractor_services.contractor_id) AND (contractors.is_approved = true) AND (contractors.is_active = true)))));

ALTER TABLE public.contractor_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block anonymous access to contractor services" ON public.contractor_services FOR SELECT TO anon
  USING (false);

ALTER TABLE public.contractor_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contractors can manage their own services" ON public.contractor_services FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM contractors
  WHERE ((contractors.id = contractor_services.contractor_id) AND (contractors.user_id = auth.uid())))));

ALTER TABLE public.contractor_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contractors can view their own services" ON public.contractor_services FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM contractors
  WHERE ((contractors.id = contractor_services.contractor_id) AND (contractors.user_id = auth.uid())))));

ALTER TABLE public.contractor_verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEO can manage all requests" ON public.contractor_verification_requests FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)))
  WITH CHECK ((has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.contractor_verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create own request" ON public.contractor_verification_requests FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.contractor_verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own request" ON public.contractor_verification_requests FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can update all contractors" ON public.contractors FOR UPDATE TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all contractors" ON public.contractors FOR SELECT TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert contractor profile" ON public.contractors FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block anonymous access to contractors" ON public.contractors FOR SELECT TO anon
  USING (false);

ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contractors can delete their own profile" ON public.contractors FOR DELETE TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contractors can update their own profile" ON public.contractors FOR UPDATE TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contractors can view their own profile" ON public.contractors FOR SELECT TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all customers" ON public.customers FOR SELECT TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view customers for orders" ON public.customers FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['scaffold_executive_manager'::app_role, 'executive_manager_scaffold_execution_with_materials'::app_role, 'general_manager'::app_role, 'sales_manager'::app_role, 'ceo'::app_role, 'admin'::app_role]))))));

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own customer record" ON public.customers FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own customer record" ON public.customers FOR SELECT TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.daily_report_date_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can create date locks" ON public.daily_report_date_locks FOR INSERT TO public
  WITH CHECK ((auth.uid() = locked_by));

ALTER TABLE public.daily_report_date_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view date locks" ON public.daily_report_date_locks FOR SELECT TO public
  USING ((auth.uid() IS NOT NULL));

ALTER TABLE public.daily_report_date_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lock owner can delete date locks" ON public.daily_report_date_locks FOR DELETE TO public
  USING ((auth.uid() = locked_by));

ALTER TABLE public.daily_report_order_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view report media" ON public.daily_report_order_media FOR SELECT TO public
  USING ((auth.uid() IS NOT NULL));

ALTER TABLE public.daily_report_order_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can insert report media" ON public.daily_report_order_media FOR INSERT TO public
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role)));

ALTER TABLE public.daily_report_order_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can delete their own report media" ON public.daily_report_order_media FOR DELETE TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.daily_report_order_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own report media" ON public.daily_report_order_media FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.daily_report_order_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can update their own report media" ON public.daily_report_order_media FOR UPDATE TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.daily_report_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can delete any daily report order" ON public.daily_report_orders FOR DELETE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)));

ALTER TABLE public.daily_report_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can insert order reports" ON public.daily_report_orders FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM daily_reports dr
  WHERE ((dr.id = daily_report_orders.daily_report_id) AND ((dr.created_by = auth.uid()) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role))))));

ALTER TABLE public.daily_report_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can update order reports" ON public.daily_report_orders FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM daily_reports dr
  WHERE ((dr.id = daily_report_orders.daily_report_id) AND ((dr.created_by = auth.uid()) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role))))));

ALTER TABLE public.daily_report_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Module assigned users can delete daily report orders" ON public.daily_report_orders FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM daily_reports dr
  WHERE ((dr.id = daily_report_orders.daily_report_id) AND (dr.module_key IS NOT NULL) AND is_assigned_to_module(auth.uid(), (dr.module_key)::text)))));

ALTER TABLE public.daily_report_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Module assigned users can insert daily report orders" ON public.daily_report_orders FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM daily_reports dr
  WHERE ((dr.id = daily_report_orders.daily_report_id) AND (dr.module_key IS NOT NULL) AND is_assigned_to_module(auth.uid(), (dr.module_key)::text)))));

ALTER TABLE public.daily_report_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Module assigned users can update daily report orders" ON public.daily_report_orders FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM daily_reports dr
  WHERE ((dr.id = daily_report_orders.daily_report_id) AND (dr.module_key IS NOT NULL) AND is_assigned_to_module(auth.uid(), (dr.module_key)::text)))));

ALTER TABLE public.daily_report_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Module assigned users can view daily report orders" ON public.daily_report_orders FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM daily_reports dr
  WHERE ((dr.id = daily_report_orders.daily_report_id) AND (dr.module_key IS NOT NULL) AND is_assigned_to_module(auth.uid(), (dr.module_key)::text)))));

ALTER TABLE public.daily_report_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view order reports they have access to" ON public.daily_report_orders FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM daily_reports dr
  WHERE (dr.id = daily_report_orders.daily_report_id))));

ALTER TABLE public.daily_report_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can delete any daily report staff" ON public.daily_report_staff FOR DELETE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)));

ALTER TABLE public.daily_report_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can insert staff reports" ON public.daily_report_staff FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM daily_reports dr
  WHERE ((dr.id = daily_report_staff.daily_report_id) AND ((dr.created_by = auth.uid()) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role))))));

ALTER TABLE public.daily_report_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can select staff reports" ON public.daily_report_staff FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM daily_reports dr
  WHERE ((dr.id = daily_report_staff.daily_report_id) AND ((dr.created_by = auth.uid()) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role))))));

ALTER TABLE public.daily_report_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can update staff reports" ON public.daily_report_staff FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM daily_reports dr
  WHERE ((dr.id = daily_report_staff.daily_report_id) AND ((dr.created_by = auth.uid()) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role))))));

ALTER TABLE public.daily_report_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Module assigned users can delete daily report staff" ON public.daily_report_staff FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM daily_reports dr
  WHERE ((dr.id = daily_report_staff.daily_report_id) AND (dr.module_key IS NOT NULL) AND is_assigned_to_module(auth.uid(), (dr.module_key)::text)))));

ALTER TABLE public.daily_report_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Module assigned users can insert daily report staff" ON public.daily_report_staff FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM daily_reports dr
  WHERE ((dr.id = daily_report_staff.daily_report_id) AND (dr.module_key IS NOT NULL) AND is_assigned_to_module(auth.uid(), (dr.module_key)::text)))));

ALTER TABLE public.daily_report_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Module assigned users can update daily report staff" ON public.daily_report_staff FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM daily_reports dr
  WHERE ((dr.id = daily_report_staff.daily_report_id) AND (dr.module_key IS NOT NULL) AND is_assigned_to_module(auth.uid(), (dr.module_key)::text)))));

ALTER TABLE public.daily_report_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Module assigned users can view daily report staff" ON public.daily_report_staff FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM daily_reports dr
  WHERE ((dr.id = daily_report_staff.daily_report_id) AND (dr.module_key IS NOT NULL) AND is_assigned_to_module(auth.uid(), (dr.module_key)::text)))));

ALTER TABLE public.daily_report_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view own staff reports" ON public.daily_report_staff FOR SELECT TO public
  USING ((staff_user_id = auth.uid()));

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEO and managers can create daily reports" ON public.daily_reports FOR INSERT TO public
  WITH CHECK (((auth.uid() = created_by) AND (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role))));

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEO and managers can update own daily reports" ON public.daily_reports FOR UPDATE TO public
  USING (((created_by = auth.uid()) AND (has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role))));

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEO and managers can view all daily reports" ON public.daily_reports FOR SELECT TO public
  USING ((has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)));

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can delete any daily report" ON public.daily_reports FOR DELETE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR (created_by = auth.uid())));

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Module assigned users can create daily reports" ON public.daily_reports FOR INSERT TO authenticated
  WITH CHECK (((auth.uid() = created_by) AND (module_key IS NOT NULL) AND is_assigned_to_module(auth.uid(), (module_key)::text)));

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Module assigned users can delete daily reports" ON public.daily_reports FOR DELETE TO authenticated
  USING (((module_key IS NOT NULL) AND is_assigned_to_module(auth.uid(), (module_key)::text)));

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Module assigned users can update daily reports" ON public.daily_reports FOR UPDATE TO authenticated
  USING (((module_key IS NOT NULL) AND is_assigned_to_module(auth.uid(), (module_key)::text)));

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Module assigned users can view daily reports" ON public.daily_reports FOR SELECT TO authenticated
  USING (((module_key IS NOT NULL) AND is_assigned_to_module(auth.uid(), (module_key)::text)));

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view reports containing their records" ON public.daily_reports FOR SELECT TO authenticated
  USING (daily_report_contains_staff(id, auth.uid()));

ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view districts" ON public.districts FOR SELECT TO public
  USING ((auth.uid() IS NOT NULL));

ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can delete districts" ON public.districts FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can insert districts" ON public.districts FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can update districts" ON public.districts FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages email codes" ON public.email_verification_codes FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.expert_pricing_request_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can delete own media" ON public.expert_pricing_request_media FOR DELETE TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.expert_pricing_request_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own media" ON public.expert_pricing_request_media FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.expert_pricing_request_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view media for own requests" ON public.expert_pricing_request_media FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM (expert_pricing_requests epr
     JOIN customers c ON ((c.id = epr.customer_id)))
  WHERE ((epr.id = expert_pricing_request_media.request_id) AND (c.user_id = auth.uid())))) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR has_role(auth.uid(), 'rental_executive_manager'::app_role)));

ALTER TABLE public.expert_pricing_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can create own pricing requests" ON public.expert_pricing_requests FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = expert_pricing_requests.customer_id) AND (c.user_id = auth.uid())))));

ALTER TABLE public.expert_pricing_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can update own pending pricing requests" ON public.expert_pricing_requests FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = expert_pricing_requests.customer_id) AND (c.user_id = auth.uid())))) AND (status = 'pending'::text)));

ALTER TABLE public.expert_pricing_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can view own pricing requests" ON public.expert_pricing_requests FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = expert_pricing_requests.customer_id) AND (c.user_id = auth.uid())))));

ALTER TABLE public.expert_pricing_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can update pricing requests" ON public.expert_pricing_requests FOR UPDATE TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR has_role(auth.uid(), 'rental_executive_manager'::app_role)));

ALTER TABLE public.expert_pricing_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can view all pricing requests" ON public.expert_pricing_requests FOR SELECT TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR has_role(auth.uid(), 'rental_executive_manager'::app_role)));

ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEO and GM can manage HR employees" ON public.hr_employees FOR ALL TO public
  USING ((has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)))
  WITH CHECK ((has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR employees readable by module users" ON public.hr_employees FOR SELECT TO public
  USING ((has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR (EXISTS ( SELECT 1
   FROM module_assignments
  WHERE ((module_assignments.module_key = 'hr_management'::text) AND (module_assignments.is_active = true) AND (module_assignments.assigned_user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM module_assignments
  WHERE ((module_assignments.module_key = 'daily_report'::text) AND (module_assignments.is_active = true) AND (module_assignments.assigned_user_id = auth.uid())))) OR (auth.uid() = user_id)));

ALTER TABLE public.internal_staff_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage staff profiles" ON public.internal_staff_profiles FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.internal_staff_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all staff profiles" ON public.internal_staff_profiles FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.internal_staff_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create own staff profile" ON public.internal_staff_profiles FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.internal_staff_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own staff profile" ON public.internal_staff_profiles FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage inventory" ON public.inventory_items FOR ALL TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'warehouse_manager'::app_role)));

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view inventory" ON public.inventory_items FOR SELECT TO public
  USING (has_role(auth.uid(), 'operations_manager'::app_role));

ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contractors can view reservations for their services" ON public.inventory_reservations FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (services s
     JOIN contractors c ON ((c.id = s.contractor_id)))
  WHERE ((s.id = inventory_reservations.service_id) AND (c.user_id = auth.uid())))));

ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operations managers can view all reservations" ON public.inventory_reservations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'operations_manager'::app_role));

ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Warehouse managers have full access to reservations" ON public.inventory_reservations FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'warehouse_manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'warehouse_manager'::app_role));

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage invoices" ON public.invoices FOR ALL TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role)));

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own invoices" ON public.invoices FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM (services s
     JOIN projects_v2 p ON ((p.id = s.project_id)))
  WHERE ((s.id = invoices.service_id) AND (p.customer_id = auth.uid())))));

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view all locations" ON public.locations FOR SELECT TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create own locations" ON public.locations FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can delete own locations" ON public.locations FOR DELETE TO public
  USING (((auth.uid() = user_id) AND (NOT (EXISTS ( SELECT 1
   FROM projects_hierarchy
  WHERE (projects_hierarchy.location_id = locations.id))))));

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can update own locations" ON public.locations FOR UPDATE TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own or customer locations" ON public.locations FOR SELECT TO public
  USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM ((projects_hierarchy ph
     JOIN projects_v3 pv ON ((pv.hierarchy_project_id = ph.id)))
     JOIN customers c ON ((pv.customer_id = c.id)))
  WHERE ((ph.location_id = locations.id) AND (c.user_id = auth.uid()))))));

ALTER TABLE public.module_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEOs can delete module assignments" ON public.module_assignments FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'ceo'::app_role));

ALTER TABLE public.module_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEOs can insert module assignments" ON public.module_assignments FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'ceo'::app_role));

ALTER TABLE public.module_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEOs can update module assignments" ON public.module_assignments FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'ceo'::app_role));

ALTER TABLE public.module_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEOs can view all module assignments" ON public.module_assignments FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'ceo'::app_role));

ALTER TABLE public.module_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own module assignments by phone" ON public.module_assignments FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.phone_number = module_assignments.assigned_phone_number)))));

ALTER TABLE public.module_edit_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can acquire locks" ON public.module_edit_locks FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = locked_by));

ALTER TABLE public.module_edit_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view locks" ON public.module_edit_locks FOR SELECT TO authenticated
  USING (true);

ALTER TABLE public.module_edit_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can release own locks" ON public.module_edit_locks FOR DELETE TO authenticated
  USING ((auth.uid() = locked_by));

ALTER TABLE public.module_edit_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can update own locks or take expired" ON public.module_edit_locks FOR UPDATE TO authenticated
  USING (((auth.uid() = locked_by) OR (expires_at < now())));

ALTER TABLE public.module_hierarchy_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can delete their own module hierarchy" ON public.module_hierarchy_states FOR DELETE TO public
  USING ((auth.uid() = owner_user_id));

ALTER TABLE public.module_hierarchy_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own module hierarchy" ON public.module_hierarchy_states FOR INSERT TO public
  WITH CHECK ((auth.uid() = owner_user_id));

ALTER TABLE public.module_hierarchy_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own module hierarchy" ON public.module_hierarchy_states FOR SELECT TO public
  USING ((auth.uid() = owner_user_id));

ALTER TABLE public.module_hierarchy_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can update their own module hierarchy" ON public.module_hierarchy_states FOR UPDATE TO public
  USING ((auth.uid() = owner_user_id));

ALTER TABLE public.module_shortcuts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create own shortcuts" ON public.module_shortcuts FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.module_shortcuts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can delete own shortcuts" ON public.module_shortcuts FOR DELETE TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.module_shortcuts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can update own shortcuts" ON public.module_shortcuts FOR UPDATE TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.module_shortcuts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own shortcuts" ON public.module_shortcuts FOR SELECT TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.module_version_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can save versions" ON public.module_version_history FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = saved_by));

ALTER TABLE public.module_version_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view history" ON public.module_version_history FOR SELECT TO authenticated
  USING (true);

ALTER TABLE public.module_version_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System can delete old versions" ON public.module_version_history FOR DELETE TO authenticated
  USING (true);

ALTER TABLE public.najva_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can read all subscriptions" ON public.najva_subscriptions FOR SELECT TO service_role
  USING (true);

ALTER TABLE public.najva_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can delete their own subscriptions" ON public.najva_subscriptions FOR DELETE TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.najva_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own subscriptions" ON public.najva_subscriptions FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.najva_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can update their own subscriptions" ON public.najva_subscriptions FOR UPDATE TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.najva_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own subscriptions" ON public.najva_subscriptions FOR SELECT TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block user inserts on notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (false);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User select own notifications" ON public.notifications FOR SELECT TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User update own notifications" ON public.notifications FOR UPDATE TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.order_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEO can manage all approvals" ON public.order_approvals FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'ceo'::app_role))
  WITH CHECK (has_role(auth.uid(), 'ceo'::app_role));

ALTER TABLE public.order_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Executive managers can manage own approvals" ON public.order_approvals FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'scaffold_executive_manager'::app_role) AND (approver_role = 'scaffold_executive_manager'::text)))
  WITH CHECK ((has_role(auth.uid(), 'scaffold_executive_manager'::app_role) AND (approver_role = 'scaffold_executive_manager'::text)));

ALTER TABLE public.order_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can insert approvals" ON public.order_approvals FOR INSERT TO public
  WITH CHECK ((has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role)));

ALTER TABLE public.order_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can update their approvals" ON public.order_approvals FOR UPDATE TO public
  USING ((((approver_role = 'ceo'::text) AND has_role(auth.uid(), 'ceo'::app_role)) OR ((approver_role = ANY (ARRAY['scaffold_executive_manager'::text, 'executive_manager_scaffold_execution_with_materials'::text])) AND has_role(auth.uid(), 'scaffold_executive_manager'::app_role)) OR ((approver_role = ANY (ARRAY['sales_manager'::text, 'sales_manager_scaffold_execution_with_materials'::text])) AND has_role(auth.uid(), 'sales_manager'::app_role)) OR ((approver_role = 'general_manager_scaffold_execution_with_materials'::text) AND has_role(auth.uid(), 'general_manager'::app_role)) OR ((approver_role = 'finance_manager'::text) AND has_role(auth.uid(), 'finance_manager'::app_role))))
  WITH CHECK ((((approver_role = 'ceo'::text) AND has_role(auth.uid(), 'ceo'::app_role)) OR ((approver_role = ANY (ARRAY['scaffold_executive_manager'::text, 'executive_manager_scaffold_execution_with_materials'::text])) AND has_role(auth.uid(), 'scaffold_executive_manager'::app_role)) OR ((approver_role = ANY (ARRAY['sales_manager'::text, 'sales_manager_scaffold_execution_with_materials'::text])) AND has_role(auth.uid(), 'sales_manager'::app_role)) OR ((approver_role = 'general_manager_scaffold_execution_with_materials'::text) AND has_role(auth.uid(), 'general_manager'::app_role)) OR ((approver_role = 'finance_manager'::text) AND has_role(auth.uid(), 'finance_manager'::app_role))));

ALTER TABLE public.order_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can view approvals" ON public.order_approvals FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.order_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales managers can manage own approvals" ON public.order_approvals FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'sales_manager'::app_role) AND (approver_role = 'sales_manager'::text)))
  WITH CHECK ((has_role(auth.uid(), 'sales_manager'::app_role) AND (approver_role = 'sales_manager'::text)));

ALTER TABLE public.order_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Invitee can respond to invitation" ON public.order_collaborators FOR UPDATE TO public
  USING ((invitee_user_id = auth.uid()));

ALTER TABLE public.order_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Invitee can view own invitations" ON public.order_collaborators FOR SELECT TO public
  USING ((invitee_user_id = auth.uid()));

ALTER TABLE public.order_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Inviter can delete own invitations" ON public.order_collaborators FOR DELETE TO public
  USING ((inviter_user_id = auth.uid()));

ALTER TABLE public.order_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Inviter can view own invitations" ON public.order_collaborators FOR SELECT TO public
  USING ((inviter_user_id = auth.uid()));

ALTER TABLE public.order_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can view collaborators" ON public.order_collaborators FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::app_role, 'ceo'::app_role, 'general_manager'::app_role, 'sales_manager'::app_role, 'scaffold_executive_manager'::app_role]))))));

ALTER TABLE public.order_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create collaborator invitations" ON public.order_collaborators FOR INSERT TO public
  WITH CHECK ((inviter_user_id = auth.uid()));

ALTER TABLE public.order_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create collaborator invites for own orders" ON public.order_collaborators FOR INSERT TO public
  WITH CHECK (((auth.uid() = inviter_user_id) AND (check_order_ownership(order_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role))));

ALTER TABLE public.order_daily_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can insert order daily logs" ON public.order_daily_logs FOR INSERT TO public
  WITH CHECK ((auth.uid() IS NOT NULL));

ALTER TABLE public.order_daily_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can update order daily logs" ON public.order_daily_logs FOR UPDATE TO public
  USING ((auth.uid() IS NOT NULL));

ALTER TABLE public.order_daily_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view order daily logs" ON public.order_daily_logs FOR SELECT TO public
  USING (true);

ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rental executive managers can insert rental order messages" ON public.order_messages FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'rental_executive_manager'::app_role) AND (EXISTS ( SELECT 1
   FROM (projects_v3 p
     JOIN subcategories s ON ((s.id = p.subcategory_id)))
  WHERE ((p.id = order_messages.order_id) AND (s.code = '30'::text))))));

ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rental executive managers can view rental order messages" ON public.order_messages FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'rental_executive_manager'::app_role) AND (EXISTS ( SELECT 1
   FROM (projects_v3 p
     JOIN subcategories s ON ((s.id = p.subcategory_id)))
  WHERE ((p.id = order_messages.order_id) AND (s.code = '30'::text))))));

ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can send messages" ON public.order_messages FOR INSERT TO public
  WITH CHECK (((auth.uid() = user_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role))));

ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view all messages" ON public.order_messages FOR SELECT TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role)));

ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can send messages for own orders" ON public.order_messages FOR INSERT TO public
  WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM (projects_v3 p
     JOIN customers c ON ((c.id = p.customer_id)))
  WHERE ((p.id = order_messages.order_id) AND (c.user_id = auth.uid()))))));

ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own order messages" ON public.order_messages FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM (projects_v3 p
     JOIN customers c ON ((c.id = p.customer_id)))
  WHERE ((p.id = order_messages.order_id) AND (c.user_id = auth.uid())))));

ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can view their order payments" ON public.order_payments FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (projects_v3 p
     JOIN customers c ON ((p.customer_id = c.id)))
  WHERE ((p.id = order_payments.order_id) AND (c.user_id = auth.uid())))));

ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and managers can delete order payments" ON public.order_payments FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM internal_staff_profiles isp
  WHERE ((isp.user_id = auth.uid()) AND (isp.status = 'approved'::text)))) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR has_role(auth.uid(), 'rental_executive_manager'::app_role)));

ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and managers can insert order payments" ON public.order_payments FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM internal_staff_profiles isp
  WHERE ((isp.user_id = auth.uid()) AND (isp.status = 'approved'::text)))) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR has_role(auth.uid(), 'rental_executive_manager'::app_role)));

ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and managers can update order payments" ON public.order_payments FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM internal_staff_profiles isp
  WHERE ((isp.user_id = auth.uid()) AND (isp.status = 'approved'::text)))) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR has_role(auth.uid(), 'rental_executive_manager'::app_role)));

ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and managers can view all order payments" ON public.order_payments FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM internal_staff_profiles isp
  WHERE ((isp.user_id = auth.uid()) AND (isp.status = 'approved'::text)))) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR has_role(auth.uid(), 'rental_executive_manager'::app_role)));

ALTER TABLE public.order_renewals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can create renewal requests" ON public.order_renewals FOR INSERT TO public
  WITH CHECK ((customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.user_id = auth.uid()))));

ALTER TABLE public.order_renewals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can view their own renewals" ON public.order_renewals FOR SELECT TO public
  USING ((customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.user_id = auth.uid()))));

ALTER TABLE public.order_renewals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can create renewals" ON public.order_renewals FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM module_assignments
  WHERE ((module_assignments.assigned_user_id = auth.uid()) AND (module_assignments.is_active = true)))));

ALTER TABLE public.order_renewals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can delete renewals" ON public.order_renewals FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM module_assignments
  WHERE ((module_assignments.assigned_user_id = auth.uid()) AND (module_assignments.is_active = true)))));

ALTER TABLE public.order_renewals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can update renewals" ON public.order_renewals FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM module_assignments
  WHERE ((module_assignments.assigned_user_id = auth.uid()) AND (module_assignments.is_active = true)))));

ALTER TABLE public.order_renewals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view all renewals" ON public.order_renewals FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM module_assignments
  WHERE ((module_assignments.assigned_user_id = auth.uid()) AND (module_assignments.is_active = true)))));

ALTER TABLE public.order_transfer_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can update transfer requests" ON public.order_transfer_requests FOR UPDATE TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role) OR (auth.uid() = to_user_id) OR (auth.uid() = from_user_id)));

ALTER TABLE public.order_transfer_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can cancel own pending transfer requests" ON public.order_transfer_requests FOR DELETE TO public
  USING (((auth.uid() = from_user_id) AND (status = 'pending_manager'::text)));

ALTER TABLE public.order_transfer_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create transfer requests for own orders" ON public.order_transfer_requests FOR INSERT TO public
  WITH CHECK ((auth.uid() = from_user_id));

ALTER TABLE public.order_transfer_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transfer requests" ON public.order_transfer_requests FOR SELECT TO public
  USING (((auth.uid() = from_user_id) OR (auth.uid() = to_user_id) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role)));

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage all orders" ON public.orders FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view all orders" ON public.orders FOR SELECT TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create own orders" ON public.orders FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can update own orders" ON public.orders FOR UPDATE TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.organizational_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active organizational positions" ON public.organizational_positions FOR SELECT TO public
  USING ((is_active = true));

ALTER TABLE public.organizational_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active positions" ON public.organizational_positions FOR SELECT TO authenticated
  USING ((is_active = true));

ALTER TABLE public.organizational_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can delete organizational positions" ON public.organizational_positions FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.organizational_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can insert organizational positions" ON public.organizational_positions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.organizational_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can manage positions" ON public.organizational_positions FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.organizational_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can update organizational positions" ON public.organizational_positions FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block user updates on OTP" ON public.otp_codes FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all public SELECT on otp_codes" ON public.otp_codes FOR SELECT TO anon, authenticated
  USING (false);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny public inserts on otp_codes" ON public.otp_codes FOR INSERT TO anon, authenticated
  WITH CHECK (false);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can delete expired OTPs" ON public.otp_codes FOR DELETE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) AND (expires_at < now())));

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage payments" ON public.payments FOR ALL TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role)));

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM ((invoices i
     JOIN services s ON ((s.id = i.service_id)))
     JOIN projects_v2 p ON ((p.id = s.project_id)))
  WHERE ((i.id = payments.invoice_id) AND (p.customer_id = auth.uid())))));

ALTER TABLE public.phone_whitelist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can view phone whitelist" ON public.phone_whitelist FOR SELECT TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role)));

ALTER TABLE public.phone_whitelist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only CEO can manage whitelist" ON public.phone_whitelist FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'ceo'::app_role))
  WITH CHECK (has_role(auth.uid(), 'ceo'::app_role));

ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view profile photos" ON public.profile_photos FOR SELECT TO public
  USING (true);

ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can delete their own photos" ON public.profile_photos FOR DELETE TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own photos" ON public.profile_photos FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can update their own photos" ON public.profile_photos FOR UPDATE TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own photos" ON public.profile_photos FOR SELECT TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block anonymous access to profiles" ON public.profiles FOR SELECT TO anon
  USING (false);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block anonymous inserts on profiles" ON public.profiles FOR INSERT TO anon
  WITH CHECK (false);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block anonymous profile access" ON public.profiles FOR SELECT TO anon
  USING (false);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block anonymous updates on profiles" ON public.profiles FOR UPDATE TO anon
  USING (false);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEO and admins can view all profiles" ON public.profiles FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR (auth.uid() = user_id)));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Executive managers can view profiles" ON public.profiles FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['scaffold_executive_manager'::app_role, 'executive_manager_scaffold_execution_with_materials'::app_role, 'sales_manager'::app_role]))))));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role OTP verification" ON public.profiles FOR SELECT TO service_role
  USING (true);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all assignments" ON public.project_assignments FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contractors can update their assignments" ON public.project_assignments FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM contractors
  WHERE ((contractors.id = project_assignments.contractor_id) AND (contractors.user_id = auth.uid())))));

ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contractors can view their assignments" ON public.project_assignments FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM contractors
  WHERE ((contractors.id = project_assignments.contractor_id) AND (contractors.user_id = auth.uid())))));

ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can view their project assignments" ON public.project_assignments FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM service_requests
  WHERE ((service_requests.id = project_assignments.service_request_id) AND (service_requests.user_id = auth.uid())))));

ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Invitees can respond to invitations" ON public.project_collaborators FOR UPDATE TO public
  USING (((auth.uid() = invitee_user_id) OR (invitee_phone_number IN ( SELECT profiles.phone_number
   FROM profiles
  WHERE (profiles.user_id = auth.uid())))))
  WITH CHECK (((auth.uid() = invitee_user_id) OR (invitee_phone_number IN ( SELECT profiles.phone_number
   FROM profiles
  WHERE (profiles.user_id = auth.uid())))));

ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Inviters can delete invitations" ON public.project_collaborators FOR DELETE TO public
  USING ((auth.uid() = inviter_user_id));

ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can view all project collaborations" ON public.project_collaborators FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::app_role, 'ceo'::app_role, 'general_manager'::app_role, 'sales_manager'::app_role, 'scaffold_executive_manager'::app_role]))))));

ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can invite to own projects" ON public.project_collaborators FOR INSERT TO public
  WITH CHECK (((auth.uid() = inviter_user_id) AND (EXISTS ( SELECT 1
   FROM projects_hierarchy
  WHERE ((projects_hierarchy.id = project_collaborators.project_id) AND (projects_hierarchy.user_id = auth.uid()))))));

ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own project collaborations" ON public.project_collaborators FOR SELECT TO public
  USING (((auth.uid() = inviter_user_id) OR (auth.uid() = invitee_user_id) OR (invitee_phone_number IN ( SELECT profiles.phone_number
   FROM profiles
  WHERE (profiles.user_id = auth.uid())))));

ALTER TABLE public.project_hierarchy_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ph_media_delete_own" ON public.project_hierarchy_media FOR DELETE TO public
  USING ((user_id = auth.uid()));

ALTER TABLE public.project_hierarchy_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ph_media_insert_own" ON public.project_hierarchy_media FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));

ALTER TABLE public.project_hierarchy_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ph_media_select_own_or_owner" ON public.project_hierarchy_media FOR SELECT TO public
  USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM projects_hierarchy ph
  WHERE ((ph.id = project_hierarchy_media.hierarchy_project_id) AND (ph.user_id = auth.uid()))))));

ALTER TABLE public.project_hierarchy_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ph_media_update_own" ON public.project_hierarchy_media FOR UPDATE TO public
  USING ((user_id = auth.uid()));

ALTER TABLE public.project_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rental executive managers can delete rental order media" ON public.project_media FOR DELETE TO authenticated
  USING ((has_role(auth.uid(), 'rental_executive_manager'::app_role) AND (EXISTS ( SELECT 1
   FROM (projects_v3 p
     JOIN subcategories s ON ((s.id = p.subcategory_id)))
  WHERE ((p.id = project_media.project_id) AND (s.code = '30'::text))))));

ALTER TABLE public.project_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rental executive managers can insert rental order media" ON public.project_media FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'rental_executive_manager'::app_role) AND (EXISTS ( SELECT 1
   FROM (projects_v3 p
     JOIN subcategories s ON ((s.id = p.subcategory_id)))
  WHERE ((p.id = project_media.project_id) AND (s.code = '30'::text))))));

ALTER TABLE public.project_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rental executive managers can view rental order media" ON public.project_media FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'rental_executive_manager'::app_role) AND (EXISTS ( SELECT 1
   FROM (projects_v3 p
     JOIN subcategories s ON ((s.id = p.subcategory_id)))
  WHERE ((p.id = project_media.project_id) AND (s.code = '30'::text))))));

ALTER TABLE public.project_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users and managers can delete project media" ON public.project_media FOR DELETE TO public
  USING ((((auth.uid() = user_id) AND check_order_ownership(project_id, auth.uid()) AND (EXISTS ( SELECT 1
   FROM projects_v3
  WHERE ((projects_v3.id = project_media.project_id) AND (projects_v3.approved_at IS NULL))))) OR (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role))));

ALTER TABLE public.project_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users and managers can upload project media" ON public.project_media FOR INSERT TO public
  WITH CHECK ((((auth.uid() = user_id) AND check_order_ownership(project_id, auth.uid())) OR (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role))));

ALTER TABLE public.project_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users and managers can view project media" ON public.project_media FOR SELECT TO public
  USING ((check_order_ownership(project_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role)));

ALTER TABLE public.project_progress_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all progress media" ON public.project_progress_media FOR SELECT TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.project_progress_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can view their project progress media" ON public.project_progress_media FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM (projects_v3 p
     JOIN customers c ON ((c.id = p.customer_id)))
  WHERE ((p.id = project_progress_media.project_id) AND (c.user_id = auth.uid())))));

ALTER TABLE public.project_progress_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exec-with-materials DELETE progress media" ON public.project_progress_media FOR DELETE TO public
  USING (((has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)) AND (auth.uid() = uploaded_by)));

ALTER TABLE public.project_progress_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exec-with-materials INSERT progress media" ON public.project_progress_media FOR INSERT TO public
  WITH CHECK (((has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)) AND (auth.uid() = uploaded_by)));

ALTER TABLE public.project_progress_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exec-with-materials SELECT progress media" ON public.project_progress_media FOR SELECT TO public
  USING (((has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)) AND (auth.uid() = uploaded_by)));

ALTER TABLE public.project_progress_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Executive managers can delete their progress media" ON public.project_progress_media FOR DELETE TO public
  USING ((has_role(auth.uid(), 'scaffold_executive_manager'::app_role) AND (auth.uid() = uploaded_by)));

ALTER TABLE public.project_progress_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Executive managers can insert progress media" ON public.project_progress_media FOR INSERT TO public
  WITH CHECK ((has_role(auth.uid(), 'scaffold_executive_manager'::app_role) AND (auth.uid() = uploaded_by)));

ALTER TABLE public.project_progress_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Executive managers can view their progress media" ON public.project_progress_media FOR SELECT TO public
  USING ((has_role(auth.uid(), 'scaffold_executive_manager'::app_role) AND (auth.uid() = uploaded_by)));

ALTER TABLE public.project_progress_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all stages" ON public.project_progress_stages FOR ALL TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.project_progress_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operations manager can manage stages" ON public.project_progress_stages FOR ALL TO public
  USING (has_role(auth.uid(), 'operations_manager'::app_role));

ALTER TABLE public.project_progress_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operations manager can view all stages" ON public.project_progress_stages FOR SELECT TO public
  USING (has_role(auth.uid(), 'operations_manager'::app_role));

ALTER TABLE public.project_progress_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project owners can update stages" ON public.project_progress_stages FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM projects
  WHERE ((projects.id = project_progress_stages.project_id) AND (projects.user_id = auth.uid())))));

ALTER TABLE public.project_progress_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scaffold supervisor can view and update stages" ON public.project_progress_stages FOR ALL TO public
  USING (has_role(auth.uid(), 'scaffold_supervisor'::app_role));

ALTER TABLE public.project_progress_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view stages of their projects" ON public.project_progress_stages FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM projects
  WHERE ((projects.id = project_progress_stages.project_id) AND (projects.user_id = auth.uid())))));

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all projects" ON public.projects FOR SELECT TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create their own projects" ON public.projects FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can update their own projects" ON public.projects FOR UPDATE TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own projects" ON public.projects FOR SELECT TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.projects_hierarchy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view all projects" ON public.projects_hierarchy FOR SELECT TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.projects_hierarchy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create own projects" ON public.projects_hierarchy FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.projects_hierarchy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can delete own projects without orders" ON public.projects_hierarchy FOR DELETE TO public
  USING (((auth.uid() = user_id) AND (NOT (EXISTS ( SELECT 1
   FROM projects_v3
  WHERE (projects_v3.hierarchy_project_id = projects_hierarchy.id))))));

ALTER TABLE public.projects_hierarchy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can update own projects" ON public.projects_hierarchy FOR UPDATE TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.projects_hierarchy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own or customer projects" ON public.projects_hierarchy FOR SELECT TO public
  USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM (projects_v3 pv
     JOIN customers c ON ((pv.customer_id = c.id)))
  WHERE ((pv.hierarchy_project_id = projects_hierarchy.id) AND (c.user_id = auth.uid()))))));

ALTER TABLE public.projects_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage projects" ON public.projects_v2 FOR ALL TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations_manager'::app_role)));

ALTER TABLE public.projects_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view all projects" ON public.projects_v2 FOR SELECT TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations_manager'::app_role)));

ALTER TABLE public.projects_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own projects" ON public.projects_v2 FOR SELECT TO public
  USING ((auth.uid() = customer_id));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and GMs can update all projects" ON public.projects_v3 FOR UPDATE TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and GMs can view all projects" ON public.projects_v3 FOR SELECT TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEO can delete deep archived orders" ON public.projects_v3 FOR DELETE TO public
  USING (((is_deep_archived = true) AND has_role(auth.uid(), 'ceo'::app_role)));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEO can edit and approve pending orders" ON public.projects_v3 FOR UPDATE TO public
  USING ((has_role(auth.uid(), 'ceo'::app_role) AND (status = 'pending'::project_status_v3)))
  WITH CHECK ((has_role(auth.uid(), 'ceo'::app_role) AND (((status = ANY (ARRAY['approved'::project_status_v3, 'rejected'::project_status_v3])) AND (approved_by = auth.uid())) OR (status = 'pending'::project_status_v3))));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEO can view all orders" ON public.projects_v3 FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'ceo'::app_role));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Collaborators can view orders they're accepted on" ON public.projects_v3 FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM order_collaborators oc
  WHERE ((oc.order_id = projects_v3.id) AND (oc.invitee_user_id = auth.uid()) AND (oc.status = ANY (ARRAY['accepted'::text, 'approved'::text]))))));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contractors can view assigned projects" ON public.projects_v3 FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM contractors c
  WHERE ((c.id = projects_v3.contractor_id) AND (c.user_id = auth.uid())))));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can create own projects" ON public.projects_v3 FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = projects_v3.customer_id) AND (c.user_id = auth.uid())))));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can update own draft and pending projects" ON public.projects_v3 FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = projects_v3.customer_id) AND (c.user_id = auth.uid())))) AND (status = ANY (ARRAY['draft'::project_status_v3, 'pending'::project_status_v3]))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = projects_v3.customer_id) AND (c.user_id = auth.uid())))) AND (status = ANY (ARRAY['draft'::project_status_v3, 'pending'::project_status_v3]))));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can view own projects" ON public.projects_v3 FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = projects_v3.customer_id) AND (c.user_id = auth.uid())))));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Executive managers can edit pending orders" ON public.projects_v3 FOR UPDATE TO public
  USING (((has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)) AND (status = 'pending'::project_status_v3)))
  WITH CHECK (((has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)) AND (status = ANY (ARRAY['pending'::project_status_v3, 'approved'::project_status_v3, 'pending_execution'::project_status_v3, 'scheduled'::project_status_v3, 'in_progress'::project_status_v3, 'completed'::project_status_v3, 'closed'::project_status_v3]))));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Executive managers can update execution details" ON public.projects_v3 FOR UPDATE TO public
  USING (((has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)) AND (status = ANY (ARRAY['approved'::project_status_v3, 'pending_execution'::project_status_v3, 'scheduled'::project_status_v3, 'in_progress'::project_status_v3, 'completed'::project_status_v3, 'closed'::project_status_v3]))))
  WITH CHECK (((has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)) AND (status = ANY (ARRAY['approved'::project_status_v3, 'pending_execution'::project_status_v3, 'scheduled'::project_status_v3, 'in_progress'::project_status_v3, 'completed'::project_status_v3, 'closed'::project_status_v3]))));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Executive managers can view approved and in-progress orders" ON public.projects_v3 FOR SELECT TO public
  USING (((has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)) AND (status = ANY (ARRAY['approved'::project_status_v3, 'pending_execution'::project_status_v3, 'scheduled'::project_status_v3, 'in_progress'::project_status_v3, 'completed'::project_status_v3]))));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Executive managers can view paid and closed" ON public.projects_v3 FOR SELECT TO public
  USING (((has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)) AND (status = ANY (ARRAY['paid'::project_status_v3, 'closed'::project_status_v3]))));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Executive managers can view pending awaiting their approval" ON public.projects_v3 FOR SELECT TO public
  USING (((has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)) AND (EXISTS ( SELECT 1
   FROM order_approvals oa
  WHERE ((oa.order_id = projects_v3.id) AND (oa.approved_at IS NULL) AND ((oa.approver_role = 'scaffold_executive_manager'::text) OR (oa.approver_role = 'executive_manager_scaffold_execution_with_materials'::text)))))));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Executive managers can view pending they approved" ON public.projects_v3 FOR SELECT TO public
  USING (((has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)) AND (status = 'pending'::project_status_v3) AND (EXISTS ( SELECT 1
   FROM order_approvals oa
  WHERE ((oa.order_id = projects_v3.id) AND (oa.approver_user_id = auth.uid()) AND (oa.approved_at IS NOT NULL) AND (oa.approver_role = ANY (ARRAY['scaffold_executive_manager'::text, 'executive_manager_scaffold_execution_with_materials'::text])))))));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance managers can close orders" ON public.projects_v3 FOR UPDATE TO public
  USING ((has_role(auth.uid(), 'finance_manager'::app_role) AND (status = 'paid'::project_status_v3)))
  WITH CHECK (has_role(auth.uid(), 'finance_manager'::app_role));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance managers can view paid orders" ON public.projects_v3 FOR SELECT TO public
  USING ((has_role(auth.uid(), 'finance_manager'::app_role) AND (status = ANY (ARRAY['paid'::project_status_v3, 'closed'::project_status_v3]))));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rental executive managers can update rental orders" ON public.projects_v3 FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'rental_executive_manager'::app_role) AND (EXISTS ( SELECT 1
   FROM subcategories s
  WHERE ((s.id = projects_v3.subcategory_id) AND (s.code = '30'::text))))))
  WITH CHECK ((has_role(auth.uid(), 'rental_executive_manager'::app_role) AND (EXISTS ( SELECT 1
   FROM subcategories s
  WHERE ((s.id = projects_v3.subcategory_id) AND (s.code = '30'::text))))));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rental executive managers can view rental orders" ON public.projects_v3 FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'rental_executive_manager'::app_role) AND (EXISTS ( SELECT 1
   FROM subcategories s
  WHERE ((s.id = projects_v3.subcategory_id) AND (s.code = '30'::text))))));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales can view pending awaiting their approval" ON public.projects_v3 FOR SELECT TO public
  USING ((has_role(auth.uid(), 'sales_manager'::app_role) AND (EXISTS ( SELECT 1
   FROM order_approvals oa
  WHERE ((oa.order_id = projects_v3.id) AND (oa.approved_at IS NULL) AND (oa.approver_role = 'sales_manager'::text))))));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales managers can edit pending orders" ON public.projects_v3 FOR UPDATE TO public
  USING ((has_role(auth.uid(), 'sales_manager'::app_role) AND (status = 'pending'::project_status_v3)))
  WITH CHECK ((has_role(auth.uid(), 'sales_manager'::app_role) AND (status = ANY (ARRAY['pending'::project_status_v3, 'in_progress'::project_status_v3]))));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales managers can update payment details" ON public.projects_v3 FOR UPDATE TO public
  USING ((has_role(auth.uid(), 'sales_manager'::app_role) AND (status = 'completed'::project_status_v3)))
  WITH CHECK (has_role(auth.uid(), 'sales_manager'::app_role));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales managers can view completed orders" ON public.projects_v3 FOR SELECT TO public
  USING ((has_role(auth.uid(), 'sales_manager'::app_role) AND (status = ANY (ARRAY['completed'::project_status_v3, 'paid'::project_status_v3, 'closed'::project_status_v3]))));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view non-draft projects" ON public.projects_v3 FOR SELECT TO public
  USING (((status <> 'draft'::project_status_v3) AND (EXISTS ( SELECT 1
   FROM staff_roles
  WHERE ((staff_roles.user_id = auth.uid()) AND (staff_roles.active = true))))));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Transfer recipients can update order during acceptance" ON public.projects_v3 FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM order_transfer_requests otr
  WHERE ((otr.order_id = projects_v3.id) AND (otr.to_user_id = auth.uid()) AND (otr.status = 'pending_recipient'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM order_transfer_requests otr
  WHERE ((otr.order_id = projects_v3.id) AND (otr.to_user_id = auth.uid()) AND (otr.status = 'pending_recipient'::text)))));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Transfer recipients can view orders pending acceptance" ON public.projects_v3 FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM order_transfer_requests otr
  WHERE ((otr.order_id = projects_v3.id) AND (otr.to_user_id = auth.uid()) AND (otr.status = 'pending_recipient'::text)))));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can cancel their own pending orders" ON public.projects_v3 FOR UPDATE TO authenticated
  USING (((customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.user_id = auth.uid()))) AND (status = 'pending'::project_status_v3)))
  WITH CHECK (((customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.user_id = auth.uid()))) AND (status = 'rejected'::project_status_v3) AND (rejection_reason IS NOT NULL)));

ALTER TABLE public.projects_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can delete their unapproved or rejected orders" ON public.projects_v3 FOR DELETE TO authenticated
  USING (((customer_id IN ( SELECT c.id
   FROM customers c
  WHERE (c.user_id = auth.uid()))) AND ((approved_at IS NULL) OR (status = 'rejected'::project_status_v3))));

ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active provinces" ON public.provinces FOR SELECT TO public
  USING ((is_active = true));

ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can delete provinces" ON public.provinces FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can insert provinces" ON public.provinces FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can update provinces" ON public.provinces FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can delete their own subscriptions" ON public.push_subscriptions FOR DELETE TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own subscriptions" ON public.push_subscriptions FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own subscriptions" ON public.push_subscriptions FOR SELECT TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.rating_criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage criteria" ON public.rating_criteria FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.rating_criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active criteria" ON public.rating_criteria FOR SELECT TO public
  USING ((is_active = true));

ALTER TABLE public.rating_helpful_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view vote counts" ON public.rating_helpful_votes FOR SELECT TO public
  USING ((auth.uid() IS NOT NULL));

ALTER TABLE public.rating_helpful_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can vote" ON public.rating_helpful_votes FOR INSERT TO public
  WITH CHECK ((auth.uid() = voter_id));

ALTER TABLE public.rating_helpful_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can update their votes" ON public.rating_helpful_votes FOR UPDATE TO public
  USING ((auth.uid() = voter_id));

ALTER TABLE public.rating_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view responses" ON public.rating_responses FOR SELECT TO public
  USING ((auth.uid() IS NOT NULL));

ALTER TABLE public.rating_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rated users can respond to their ratings" ON public.rating_responses FOR INSERT TO public
  WITH CHECK (((auth.uid() = responder_id) AND (EXISTS ( SELECT 1
   FROM ratings
  WHERE ((ratings.id = rating_responses.rating_id) AND (ratings.rated_id = auth.uid()))))));

ALTER TABLE public.rating_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can update their own responses" ON public.rating_responses FOR UPDATE TO public
  USING ((auth.uid() = responder_id));

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all ratings" ON public.ratings FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create ratings for their orders" ON public.ratings FOR INSERT TO public
  WITH CHECK (((auth.uid() = rater_id) AND (EXISTS ( SELECT 1
   FROM (projects_v3 p
     JOIN customers c ON ((c.id = p.customer_id)))
  WHERE ((p.id = ratings.project_id) AND ((c.user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM order_collaborators oc
          WHERE ((oc.order_id = p.id) AND (oc.invitee_user_id = auth.uid()) AND (oc.status = 'accepted'::text)))) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR has_role(auth.uid(), 'contractor'::app_role)))))));

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can update their own ratings within 7 days" ON public.ratings FOR UPDATE TO public
  USING (((auth.uid() = rater_id) AND (created_at > (now() - '7 days'::interval))));

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view public ratings of others" ON public.ratings FOR SELECT TO public
  USING (((is_anonymous = false) AND (is_verified = true)));

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view ratings for themselves" ON public.ratings FOR SELECT TO public
  USING (((auth.uid() = rated_id) OR (auth.uid() = rater_id)));

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active regions" ON public.regions FOR SELECT TO authenticated
  USING ((is_active = true));

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can manage regions" ON public.regions FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.repair_request_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can delete their own repair request media" ON public.repair_request_media FOR DELETE TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.repair_request_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert repair request media" ON public.repair_request_media FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.repair_request_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view repair request media" ON public.repair_request_media FOR SELECT TO public
  USING (((repair_request_id IN ( SELECT repair_requests.id
   FROM repair_requests
  WHERE (repair_requests.customer_id IN ( SELECT customers.id
           FROM customers
          WHERE (customers.user_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::app_role, 'ceo'::app_role, 'general_manager'::app_role, 'sales_manager'::app_role, 'scaffold_executive_manager'::app_role, 'executive_manager_scaffold_execution_with_materials'::app_role, 'finance_manager'::app_role])))))));

ALTER TABLE public.repair_request_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert repair request messages" ON public.repair_request_messages FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.repair_request_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view repair request messages" ON public.repair_request_messages FOR SELECT TO public
  USING (((repair_request_id IN ( SELECT repair_requests.id
   FROM repair_requests
  WHERE (repair_requests.customer_id IN ( SELECT customers.id
           FROM customers
          WHERE (customers.user_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::app_role, 'ceo'::app_role, 'general_manager'::app_role, 'sales_manager'::app_role, 'scaffold_executive_manager'::app_role, 'executive_manager_scaffold_execution_with_materials'::app_role, 'finance_manager'::app_role])))))));

ALTER TABLE public.repair_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can create repair requests" ON public.repair_requests FOR INSERT TO public
  WITH CHECK ((customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.user_id = auth.uid()))));

ALTER TABLE public.repair_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can update their pending repair requests" ON public.repair_requests FOR UPDATE TO public
  USING (((customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.user_id = auth.uid()))) AND (status = 'pending'::text)));

ALTER TABLE public.repair_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can view their own repair requests" ON public.repair_requests FOR SELECT TO public
  USING ((customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.user_id = auth.uid()))));

ALTER TABLE public.repair_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can update repair requests" ON public.repair_requests FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::app_role, 'ceo'::app_role, 'general_manager'::app_role, 'sales_manager'::app_role, 'scaffold_executive_manager'::app_role, 'executive_manager_scaffold_execution_with_materials'::app_role, 'finance_manager'::app_role]))))));

ALTER TABLE public.repair_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can view all repair requests" ON public.repair_requests FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::app_role, 'ceo'::app_role, 'general_manager'::app_role, 'sales_manager'::app_role, 'scaffold_executive_manager'::app_role, 'executive_manager_scaffold_execution_with_materials'::app_role, 'finance_manager'::app_role]))))));

ALTER TABLE public.reputation_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view reputation scores" ON public.reputation_scores FOR SELECT TO public
  USING ((auth.uid() IS NOT NULL));

ALTER TABLE public.reputation_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System can manage reputation scores" ON public.reputation_scores FOR ALL TO public
  USING (true);

ALTER TABLE public.scaffolding_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own requests" ON public.scaffolding_requests FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.scaffolding_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can update own requests" ON public.scaffolding_requests FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.scaffolding_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own requests" ON public.scaffolding_requests FOR SELECT TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.scaffolding_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users cannot delete requests" ON public.scaffolding_requests FOR DELETE TO public
  USING (false);

ALTER TABLE public.service_activity_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active activity types" ON public.service_activity_types FOR SELECT TO authenticated
  USING ((is_active = true));

ALTER TABLE public.service_activity_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can manage activity types" ON public.service_activity_types FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active service categories" ON public.service_categories FOR SELECT TO authenticated
  USING ((is_active = true));

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can manage service categories" ON public.service_categories FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.service_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contractors can view line items for their services" ON public.service_line_items FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (services s
     JOIN contractors c ON ((c.id = s.contractor_id)))
  WHERE ((s.id = service_line_items.service_id) AND (c.user_id = auth.uid())))));

ALTER TABLE public.service_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage line items" ON public.service_line_items FOR ALL TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations_manager'::app_role)));

ALTER TABLE public.service_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own line items" ON public.service_line_items FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM (services s
     JOIN projects_v2 p ON ((p.id = s.project_id)))
  WHERE ((s.id = service_line_items.service_id) AND (p.customer_id = auth.uid())))));

ALTER TABLE public.service_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contractors can upload media" ON public.service_media FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (services s
     JOIN contractors c ON ((c.id = s.contractor_id)))
  WHERE ((s.id = service_media.service_id) AND (c.user_id = auth.uid())))));

ALTER TABLE public.service_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contractors can view media for their services" ON public.service_media FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (services s
     JOIN contractors c ON ((c.id = s.contractor_id)))
  WHERE ((s.id = service_media.service_id) AND (c.user_id = auth.uid())))));

ALTER TABLE public.service_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage all media" ON public.service_media FOR ALL TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations_manager'::app_role)));

ALTER TABLE public.service_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view media for own services" ON public.service_media FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM (services s
     JOIN projects_v2 p ON ((p.id = s.project_id)))
  WHERE ((s.id = service_media.service_id) AND (p.customer_id = auth.uid())))));

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all requests" ON public.service_requests FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create their own requests" ON public.service_requests FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can update their own requests" ON public.service_requests FOR UPDATE TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own requests" ON public.service_requests FOR SELECT TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.service_requests_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view all requests" ON public.service_requests_v2 FOR SELECT TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations_manager'::app_role)));

ALTER TABLE public.service_requests_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create own requests" ON public.service_requests_v2 FOR INSERT TO public
  WITH CHECK ((auth.uid() = customer_id));

ALTER TABLE public.service_requests_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own requests" ON public.service_requests_v2 FOR SELECT TO public
  USING ((auth.uid() = customer_id));

ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage service types" ON public.service_types FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active service types" ON public.service_types FOR SELECT TO public
  USING ((is_active = true));

ALTER TABLE public.service_types_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active service types" ON public.service_types_v3 FOR SELECT TO public
  USING ((is_active = true));

ALTER TABLE public.service_types_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can delete service types v3" ON public.service_types_v3 FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.service_types_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can insert service types v3" ON public.service_types_v3 FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.service_types_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can update service types v3" ON public.service_types_v3 FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contractors can view assigned services" ON public.services FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM contractors c
  WHERE ((c.id = services.contractor_id) AND (c.user_id = auth.uid())))));

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage all services" ON public.services FOR ALL TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations_manager'::app_role)));

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own services" ON public.services FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM projects_v2 p
  WHERE ((p.id = services.project_id) AND (p.customer_id = auth.uid())))));

ALTER TABLE public.services_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and managers can manage all services" ON public.services_v3 FOR ALL TO public
  USING ((has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.services_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can insert services for own projects" ON public.services_v3 FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (projects_v3 p
     JOIN customers c ON ((c.id = p.customer_id)))
  WHERE ((p.id = services_v3.project_id) AND (c.user_id = auth.uid())))));

ALTER TABLE public.services_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can update own project services" ON public.services_v3 FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM (projects_v3 p
     JOIN customers c ON ((c.id = p.customer_id)))
  WHERE ((p.id = services_v3.project_id) AND (c.user_id = auth.uid())))));

ALTER TABLE public.services_v3 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can view own project services" ON public.services_v3 FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM (projects_v3 p
     JOIN customers c ON ((c.id = p.customer_id)))
  WHERE ((p.id = services_v3.project_id) AND (c.user_id = auth.uid())))));

ALTER TABLE public.site_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert site_analytics" ON public.site_analytics FOR INSERT TO public
  WITH CHECK (true);

ALTER TABLE public.site_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEOs and managers can view all site_analytics" ON public.site_analytics FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM (phone_whitelist pw
     JOIN profiles p ON ((p.phone_number = pw.phone_number)))
  WHERE ((p.user_id = auth.uid()) AND (('ceo'::text = ANY (pw.allowed_roles)) OR ('general_manager'::text = ANY (pw.allowed_roles)))))) OR (EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::app_role, 'general_manager'::app_role, 'admin'::app_role])))))));

ALTER TABLE public.site_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert sessions" ON public.site_sessions FOR INSERT TO public
  WITH CHECK (true);

ALTER TABLE public.site_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert site_sessions" ON public.site_sessions FOR INSERT TO public
  WITH CHECK (true);

ALTER TABLE public.site_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can update site_sessions" ON public.site_sessions FOR UPDATE TO public
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.site_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEOs and managers can view all site_sessions" ON public.site_sessions FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM (phone_whitelist pw
     JOIN profiles p ON ((p.phone_number = pw.phone_number)))
  WHERE ((p.user_id = auth.uid()) AND (('ceo'::text = ANY (pw.allowed_roles)) OR ('general_manager'::text = ANY (pw.allowed_roles)))))) OR (EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['ceo'::app_role, 'general_manager'::app_role, 'admin'::app_role])))))));

ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GM select all staff profiles" ON public.staff_profiles FOR SELECT TO public
  USING (has_role(auth.uid(), 'general_manager'::app_role));

ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GM update staff profiles" ON public.staff_profiles FOR UPDATE TO public
  USING (has_role(auth.uid(), 'general_manager'::app_role));

ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User insert staff profile" ON public.staff_profiles FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User select own staff profile" ON public.staff_profiles FOR SELECT TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and managers can manage staff roles" ON public.staff_roles FOR ALL TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and managers can view all staff roles" ON public.staff_roles FOR SELECT TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own staff roles" ON public.staff_roles FOR SELECT TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.staff_salary_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can delete salary settings" ON public.staff_salary_settings FOR DELETE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR has_role(auth.uid(), 'rental_executive_manager'::app_role)));

ALTER TABLE public.staff_salary_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can insert salary settings" ON public.staff_salary_settings FOR INSERT TO authenticated
  WITH CHECK (((created_by = auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR has_role(auth.uid(), 'rental_executive_manager'::app_role))));

ALTER TABLE public.staff_salary_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can update salary settings" ON public.staff_salary_settings FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR has_role(auth.uid(), 'rental_executive_manager'::app_role)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR has_role(auth.uid(), 'rental_executive_manager'::app_role)));

ALTER TABLE public.staff_salary_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can view salary settings" ON public.staff_salary_settings FOR SELECT TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role) OR has_role(auth.uid(), 'sales_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role) OR has_role(auth.uid(), 'rental_executive_manager'::app_role) OR (EXISTS ( SELECT 1
   FROM module_assignments
  WHERE ((module_assignments.module_key = 'daily_report'::text) AND (module_assignments.is_active = true) AND (module_assignments.assigned_user_id = auth.uid()))))));

ALTER TABLE public.staff_salary_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view own salary settings" ON public.staff_salary_settings FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND ((p.phone_number = staff_salary_settings.staff_code) OR (staff_salary_settings.staff_code = SUBSTRING(p.phone_number FROM 2)) OR (p.phone_number = concat('0', staff_salary_settings.staff_code)))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.full_name = staff_salary_settings.staff_name)))) OR (EXISTS ( SELECT 1
   FROM hr_employees h
  WHERE ((h.user_id = auth.uid()) AND ((h.phone_number = staff_salary_settings.staff_code) OR (h.full_name = staff_salary_settings.staff_name)))))));

ALTER TABLE public.staff_verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEO can manage all staff requests" ON public.staff_verification_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'ceo'::app_role))
  WITH CHECK (has_role(auth.uid(), 'ceo'::app_role));

ALTER TABLE public.staff_verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create own staff request" ON public.staff_verification_requests FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.staff_verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own staff request" ON public.staff_verification_requests FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

ALTER TABLE public.staff_whitelist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GM delete whitelist" ON public.staff_whitelist FOR DELETE TO public
  USING (has_role(auth.uid(), 'general_manager'::app_role));

ALTER TABLE public.staff_whitelist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GM insert whitelist" ON public.staff_whitelist FOR INSERT TO public
  WITH CHECK (has_role(auth.uid(), 'general_manager'::app_role));

ALTER TABLE public.staff_whitelist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GM select whitelist" ON public.staff_whitelist FOR SELECT TO public
  USING (has_role(auth.uid(), 'general_manager'::app_role));

ALTER TABLE public.staff_whitelist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GM update whitelist" ON public.staff_whitelist FOR UPDATE TO public
  USING (has_role(auth.uid(), 'general_manager'::app_role));

ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active subcategories" ON public.subcategories FOR SELECT TO public
  USING ((is_active = true));

ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view subcategories" ON public.subcategories FOR SELECT TO authenticated
  USING ((is_active = true));

ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can delete subcategories" ON public.subcategories FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can insert subcategories" ON public.subcategories FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can update subcategories" ON public.subcategories FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all attachments" ON public.ticket_attachments FOR SELECT TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create attachments for their tickets" ON public.ticket_attachments FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM tickets
  WHERE ((tickets.id = ticket_attachments.ticket_id) AND (tickets.user_id = auth.uid())))));

ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view attachments of their tickets" ON public.ticket_attachments FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM tickets
  WHERE ((tickets.id = ticket_attachments.ticket_id) AND (tickets.user_id = auth.uid())))));

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can send messages" ON public.ticket_messages FOR INSERT TO public
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) AND (is_admin = true)));

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all messages" ON public.ticket_messages FOR SELECT TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can send messages to their tickets" ON public.ticket_messages FOR INSERT TO public
  WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM tickets
  WHERE ((tickets.id = ticket_messages.ticket_id) AND (tickets.user_id = auth.uid())))) AND (is_admin = false)));

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view messages of their tickets" ON public.ticket_messages FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM tickets
  WHERE ((tickets.id = ticket_messages.ticket_id) AND (tickets.user_id = auth.uid())))));

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can update all tickets" ON public.tickets FOR UPDATE TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all tickets" ON public.tickets FOR SELECT TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create their own tickets" ON public.tickets FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own tickets" ON public.tickets FOR SELECT TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and GMs can view all roles" ON public.user_roles FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read roles for authorization" ON public.user_roles FOR SELECT TO authenticated
  USING (true);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block direct role inserts" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (false);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins and GMs can delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins and GMs can manage roles" ON public.user_roles FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can manage roles" ON public.user_roles FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'ceo'::app_role)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'ceo'::app_role)));

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

ALTER TABLE public.voice_call_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create call signals" ON public.voice_call_signals FOR INSERT TO public
  WITH CHECK ((auth.uid() = caller_id));

ALTER TABLE public.voice_call_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can delete their call signals" ON public.voice_call_signals FOR DELETE TO public
  USING (((auth.uid() = caller_id) OR (auth.uid() = receiver_id)));

ALTER TABLE public.voice_call_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their call signals" ON public.voice_call_signals FOR SELECT TO public
  USING (((auth.uid() = caller_id) OR (auth.uid() = receiver_id)));

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can insert wallet transactions" ON public.wallet_transactions FOR INSERT TO public
  WITH CHECK ((has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role) OR has_role(auth.uid(), 'scaffold_executive_manager'::app_role) OR has_role(auth.uid(), 'executive_manager_scaffold_execution_with_materials'::app_role)));

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can view all wallet transactions" ON public.wallet_transactions FOR SELECT TO public
  USING ((has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own wallet transactions" ON public.wallet_transactions FOR SELECT TO public
  USING ((auth.uid() = user_id));

ALTER TABLE public.workflow_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contractors can view tasks for their assigned services" ON public.workflow_tasks FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (services s
     JOIN contractors c ON ((c.id = s.contractor_id)))
  WHERE ((s.id = workflow_tasks.service_id) AND (c.user_id = auth.uid())))));

ALTER TABLE public.workflow_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance managers can view and manage finance tasks" ON public.workflow_tasks FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'finance_manager'::app_role) AND (type = 'finance'::task_type)))
  WITH CHECK ((has_role(auth.uid(), 'finance_manager'::app_role) AND (type = 'finance'::task_type)));

ALTER TABLE public.workflow_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage tasks" ON public.workflow_tasks FOR ALL TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations_manager'::app_role)));

ALTER TABLE public.workflow_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Warehouse managers can view and manage warehouse tasks" ON public.workflow_tasks FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'warehouse_manager'::app_role) AND (type = 'warehouse_pick'::task_type)))
  WITH CHECK ((has_role(auth.uid(), 'warehouse_manager'::app_role) AND (type = 'warehouse_pick'::task_type)));
