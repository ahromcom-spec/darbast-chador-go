-- ============================================
-- IMPORT DATA INTO SELF-HOSTED SUPABASE
-- Run AFTER schema setup (01-enums, 00-full-schema, 10-functions, 11-triggers, 12-indexes, 13-rls-policies)
-- Usage: cd migration-data && psql -h <HOST> -U postgres -d postgres -f import-psql.sql
-- ============================================

-- Helper function
CREATE OR REPLACE FUNCTION import_json_array(p_table text, p_json jsonb)
RETURNS integer AS $$
DECLARE
  _count integer;
BEGIN
  EXECUTE format(
    'INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(null::public.%I, $1) ON CONFLICT DO NOTHING',
    p_table, p_table
  ) USING p_json;
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$ LANGUAGE plpgsql;

-- Import order matters for foreign key dependencies

\echo 'Importing provinces...'
\set content `cat data/provinces.json`
SELECT import_json_array('provinces', :'content'::jsonb);

\echo 'Importing districts...'
\set content `cat data/districts.json`
SELECT import_json_array('districts', :'content'::jsonb);

\echo 'Importing regions...'
\set content `cat data/regions.json`
SELECT import_json_array('regions', :'content'::jsonb);

\echo 'Importing service_categories...'
\set content `cat data/service_categories.json`
SELECT import_json_array('service_categories', :'content'::jsonb);

\echo 'Importing service_types...'
\set content `cat data/service_types.json`
SELECT import_json_array('service_types', :'content'::jsonb);

\echo 'Importing service_types_v3...'
\set content `cat data/service_types_v3.json`
SELECT import_json_array('service_types_v3', :'content'::jsonb);

\echo 'Importing subcategories...'
\set content `cat data/subcategories.json`
SELECT import_json_array('subcategories', :'content'::jsonb);

\echo 'Importing service_activity_types...'
\set content `cat data/service_activity_types.json`
SELECT import_json_array('service_activity_types', :'content'::jsonb);

\echo 'Importing organizational_positions...'
\set content `cat data/organizational_positions.json`
SELECT import_json_array('organizational_positions', :'content'::jsonb);

\echo 'Importing activity_types...'
\set content `cat data/activity_types.json`
SELECT import_json_array('activity_types', :'content'::jsonb);

\echo 'Importing profiles...'
\set content `cat data/profiles.json`
SELECT import_json_array('profiles', :'content'::jsonb);

\echo 'Importing phone_whitelist...'
\set content `cat data/phone_whitelist.json`
SELECT import_json_array('phone_whitelist', :'content'::jsonb);

\echo 'Importing user_roles...'
\set content `cat data/user_roles.json`
SELECT import_json_array('user_roles', :'content'::jsonb);

\echo 'Importing customers...'
\set content `cat data/customers.json`
SELECT import_json_array('customers', :'content'::jsonb);

\echo 'Importing locations...'
\set content `cat data/locations.json`
SELECT import_json_array('locations', :'content'::jsonb);

\echo 'Importing addresses...'
\set content `cat data/addresses.json`
SELECT import_json_array('addresses', :'content'::jsonb);

\echo 'Importing contractors...'
\set content `cat data/contractors.json`
SELECT import_json_array('contractors', :'content'::jsonb);

\echo 'Importing contractor_profiles...'
\set content `cat data/contractor_profiles.json`
SELECT import_json_array('contractor_profiles', :'content'::jsonb);

\echo 'Importing contractor_services...'
\set content `cat data/contractor_services.json`
SELECT import_json_array('contractor_services', :'content'::jsonb);

\echo 'Importing contractor_verification_requests...'
\set content `cat data/contractor_verification_requests.json`
SELECT import_json_array('contractor_verification_requests', :'content'::jsonb);

\echo 'Importing internal_staff_profiles...'
\set content `cat data/internal_staff_profiles.json`
SELECT import_json_array('internal_staff_profiles', :'content'::jsonb);

\echo 'Importing staff_profiles...'
\set content `cat data/staff_profiles.json`
SELECT import_json_array('staff_profiles', :'content'::jsonb);

\echo 'Importing staff_verification_requests...'
\set content `cat data/staff_verification_requests.json`
SELECT import_json_array('staff_verification_requests', :'content'::jsonb);

\echo 'Importing hr_employees...'
\set content `cat data/hr_employees.json`
SELECT import_json_array('hr_employees', :'content'::jsonb);

\echo 'Importing staff_salary_settings...'
\set content `cat data/staff_salary_settings.json`
SELECT import_json_array('staff_salary_settings', :'content'::jsonb);

\echo 'Importing projects_hierarchy...'
\set content `cat data/projects_hierarchy.json`
SELECT import_json_array('projects_hierarchy', :'content'::jsonb);

\echo 'Importing projects_v3...'
\set content `cat data/projects_v3.json`
SELECT import_json_array('projects_v3', :'content'::jsonb);

\echo 'Importing bank_cards...'
\set content `cat data/bank_cards.json`
SELECT import_json_array('bank_cards', :'content'::jsonb);

\echo 'Importing order_approvals...'
\set content `cat data/order_approvals.json`
SELECT import_json_array('order_approvals', :'content'::jsonb);

\echo 'Importing order_messages...'
\set content `cat data/order_messages.json`
SELECT import_json_array('order_messages', :'content'::jsonb);

\echo 'Importing order_payments...'
\set content `cat data/order_payments.json`
SELECT import_json_array('order_payments', :'content'::jsonb);

\echo 'Importing order_daily_logs...'
\set content `cat data/order_daily_logs.json`
SELECT import_json_array('order_daily_logs', :'content'::jsonb);

\echo 'Importing order_collaborators...'
\set content `cat data/order_collaborators.json`
SELECT import_json_array('order_collaborators', :'content'::jsonb);

\echo 'Importing order_transfer_requests...'
\set content `cat data/order_transfer_requests.json`
SELECT import_json_array('order_transfer_requests', :'content'::jsonb);

\echo 'Importing order_renewals...'
\set content `cat data/order_renewals.json`
SELECT import_json_array('order_renewals', :'content'::jsonb);

\echo 'Importing collection_requests...'
\set content `cat data/collection_requests.json`
SELECT import_json_array('collection_requests', :'content'::jsonb);

\echo 'Importing collection_request_messages...'
\set content `cat data/collection_request_messages.json`
SELECT import_json_array('collection_request_messages', :'content'::jsonb);

\echo 'Importing daily_reports...'
\set content `cat data/daily_reports.json`
SELECT import_json_array('daily_reports', :'content'::jsonb);

\echo 'Importing daily_report_orders...'
\set content `cat data/daily_report_orders.json`
SELECT import_json_array('daily_report_orders', :'content'::jsonb);

\echo 'Importing daily_report_staff...'
\set content `cat data/daily_report_staff.json`
SELECT import_json_array('daily_report_staff', :'content'::jsonb);

\echo 'Importing daily_report_date_locks...'
\set content `cat data/daily_report_date_locks.json`
SELECT import_json_array('daily_report_date_locks', :'content'::jsonb);

\echo 'Importing daily_report_order_media...'
\set content `cat data/daily_report_order_media.json`
SELECT import_json_array('daily_report_order_media', :'content'::jsonb);

\echo 'Importing bank_card_transactions...'
\set content `cat data/bank_card_transactions.json`
SELECT import_json_array('bank_card_transactions', :'content'::jsonb);

\echo 'Importing wallet_transactions...'
\set content `cat data/wallet_transactions.json`
SELECT import_json_array('wallet_transactions', :'content'::jsonb);

\echo 'Importing project_media...'
\set content `cat data/project_media.json`
SELECT import_json_array('project_media', :'content'::jsonb);

\echo 'Importing project_hierarchy_media...'
\set content `cat data/project_hierarchy_media.json`
SELECT import_json_array('project_hierarchy_media', :'content'::jsonb);

\echo 'Importing approved_media...'
\set content `cat data/approved_media.json`
SELECT import_json_array('approved_media', :'content'::jsonb);

\echo 'Importing expert_pricing_requests...'
\set content `cat data/expert_pricing_requests.json`
SELECT import_json_array('expert_pricing_requests', :'content'::jsonb);

\echo 'Importing expert_pricing_request_media...'
\set content `cat data/expert_pricing_request_media.json`
SELECT import_json_array('expert_pricing_request_media', :'content'::jsonb);

\echo 'Importing repair_requests...'
\set content `cat data/repair_requests.json`
SELECT import_json_array('repair_requests', :'content'::jsonb);

\echo 'Importing repair_request_messages...'
\set content `cat data/repair_request_messages.json`
SELECT import_json_array('repair_request_messages', :'content'::jsonb);

\echo 'Importing repair_request_media...'
\set content `cat data/repair_request_media.json`
SELECT import_json_array('repair_request_media', :'content'::jsonb);

\echo 'Importing notifications...'
\set content `cat data/notifications.json`
SELECT import_json_array('notifications', :'content'::jsonb);

\echo 'Importing audit_log...'
\set content `cat data/audit_log.json`
SELECT import_json_array('audit_log', :'content'::jsonb);

\echo 'Importing module_assignments...'
\set content `cat data/module_assignments.json`
SELECT import_json_array('module_assignments', :'content'::jsonb);

\echo 'Importing module_shortcuts...'
\set content `cat data/module_shortcuts.json`
SELECT import_json_array('module_shortcuts', :'content'::jsonb);

\echo 'Importing module_edit_locks...'
\set content `cat data/module_edit_locks.json`
SELECT import_json_array('module_edit_locks', :'content'::jsonb);

\echo 'Importing module_hierarchy_states...'
\set content `cat data/module_hierarchy_states.json`
SELECT import_json_array('module_hierarchy_states', :'content'::jsonb);

\echo 'Importing module_version_history...'
\set content `cat data/module_version_history.json`
SELECT import_json_array('module_version_history', :'content'::jsonb);

\echo 'Importing profile_photos...'
\set content `cat data/profile_photos.json`
SELECT import_json_array('profile_photos', :'content'::jsonb);

\echo 'Importing assistant_chat_messages...'
\set content `cat data/assistant_chat_messages.json`
SELECT import_json_array('assistant_chat_messages', :'content'::jsonb);

\echo 'Importing otp_codes...'
\set content `cat data/otp_codes.json`
SELECT import_json_array('otp_codes', :'content'::jsonb);

\echo 'Importing email_verification_codes...'
\set content `cat data/email_verification_codes.json`
SELECT import_json_array('email_verification_codes', :'content'::jsonb);

\echo 'Importing push_subscriptions...'
\set content `cat data/push_subscriptions.json`
SELECT import_json_array('push_subscriptions', :'content'::jsonb);

\echo 'Importing rating_criteria...'
\set content `cat data/rating_criteria.json`
SELECT import_json_array('rating_criteria', :'content'::jsonb);

\echo 'Importing scaffolding_requests...'
\set content `cat data/scaffolding_requests.json`
SELECT import_json_array('scaffolding_requests', :'content'::jsonb);

\echo 'Importing service_requests...'
\set content `cat data/service_requests.json`
SELECT import_json_array('service_requests', :'content'::jsonb);

\echo 'Importing tickets...'
\set content `cat data/tickets.json`
SELECT import_json_array('tickets', :'content'::jsonb);

\echo 'Importing site_sessions...'
\set content `cat data/site_sessions.json`
SELECT import_json_array('site_sessions', :'content'::jsonb);

\echo 'Importing site_analytics...'
\set content `cat data/site_analytics.json`
SELECT import_json_array('site_analytics', :'content'::jsonb);

\echo '✅ Import complete!'

-- Cleanup
DROP FUNCTION IF EXISTS import_json_array(text, jsonb);
