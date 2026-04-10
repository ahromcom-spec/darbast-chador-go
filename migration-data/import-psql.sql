-- ============================================
-- IMPORT-PSQL.SQL - ایمپورت داده‌ها با psql
-- اجرا: cat import-psql.sql | docker exec -i supabase-db psql -U postgres
-- ============================================

-- Helper function for JSON import
CREATE OR REPLACE FUNCTION import_json_array(p_table text, p_json jsonb)
RETURNS integer AS $$
DECLARE
  row_count integer;
BEGIN
  EXECUTE format('INSERT INTO %I SELECT * FROM jsonb_populate_recordset(null::%I, $1) ON CONFLICT DO NOTHING', p_table, p_table)
  USING p_json;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RETURN row_count;
END;
$$ LANGUAGE plpgsql;

\echo '=== Starting Data Import ==='

-- 1. Base tables
\echo 'Importing provinces...'
\set provinces `cat data/01-provinces.json`
SELECT import_json_array('provinces', :'provinces'::jsonb);

\echo 'Importing districts...'
\set districts `cat data/02-districts.json`
SELECT import_json_array('districts', :'districts'::jsonb);

\echo 'Importing regions...'
\set regions `cat data/11-regions.json`
SELECT import_json_array('regions', :'regions'::jsonb);

\echo 'Importing service_categories...'
\set sc `cat data/03-service-categories.json`
SELECT import_json_array('service_categories', :'sc'::jsonb);

\echo 'Importing service_types_v3...'
\set st `cat data/04-service-types.json`
SELECT import_json_array('service_types_v3', :'st'::jsonb);

\echo 'Importing subcategories...'
\set sub `cat data/05-subcategories.json`
SELECT import_json_array('subcategories', :'sub'::jsonb);

\echo 'Importing service_activity_types...'
\set sat `cat data/12-service-activity-types.json`
SELECT import_json_array('service_activity_types', :'sat'::jsonb);

\echo 'Importing organizational_positions...'
\set op `cat data/13-organizational-positions.json`
SELECT import_json_array('organizational_positions', :'op'::jsonb);

\echo 'Importing activity_types...'
\set at `cat data/14-activity-types.json`
SELECT import_json_array('activity_types', :'at'::jsonb);

-- 2. Phone whitelist
\echo 'Importing phone_whitelist...'
\set pw `cat data/06-phone-whitelist.json`
SELECT import_json_array('phone_whitelist', :'pw'::jsonb);

-- 3. Profiles & Customers (requires auth.users first!)
\echo 'Importing profiles...'
\set profiles `cat data/15-profiles.json`
SELECT import_json_array('profiles', :'profiles'::jsonb);

\echo 'Importing customers...'
\set customers `cat data/16-customers.json`
SELECT import_json_array('customers', :'customers'::jsonb);

-- 4. User roles
\echo 'Importing user_roles...'
\set ur `cat data/07-user-roles.json`
SELECT import_json_array('user_roles', :'ur'::jsonb);

-- 5. HR
\echo 'Importing hr_employees...'
\set hr `cat data/08-hr-employees.json`
SELECT import_json_array('hr_employees', :'hr'::jsonb);

-- 6. Module assignments
\echo 'Importing module_assignments...'
\set ma `cat data/09-module-assignments.json`
SELECT import_json_array('module_assignments', :'ma'::jsonb);

-- 7. Locations & Projects
\echo 'Importing locations...'
\set loc `cat data/17-locations.json`
SELECT import_json_array('locations', :'loc'::jsonb);

\echo 'Importing projects_hierarchy...'
\set ph `cat data/18-projects-hierarchy.json`
SELECT import_json_array('projects_hierarchy', :'ph'::jsonb);

\echo 'Importing projects_v3...'
\set pv3 `cat data/19-projects-v3.json`
SELECT import_json_array('projects_v3', :'pv3'::jsonb);

-- 8. Bank cards
\echo 'Importing bank_cards...'
\set bc `cat data/20-bank-cards.json`
SELECT import_json_array('bank_cards', :'bc'::jsonb);

\echo 'Importing staff_salary_settings...'
\set ss `cat data/21-staff-salary-settings.json`
SELECT import_json_array('staff_salary_settings', :'ss'::jsonb);

-- 9. Order related
\echo 'Importing order_approvals...'
\set oa `cat data/22-order-approvals.json`
SELECT import_json_array('order_approvals', :'oa'::jsonb);

\echo 'Importing order_messages...'
\set om `cat data/23-order-messages.json`
SELECT import_json_array('order_messages', :'om'::jsonb);

\echo 'Importing order_payments...'
\set op2 `cat data/10-order-payments.json`
SELECT import_json_array('order_payments', :'op2'::jsonb);

\echo 'Importing order_renewals...'
\set orn `cat data/24-order-renewals.json`
SELECT import_json_array('order_renewals', :'orn'::jsonb);

\echo 'Importing order_transfer_requests...'
\set otr `cat data/25-order-transfer-requests.json`
SELECT import_json_array('order_transfer_requests', :'otr'::jsonb);

\echo 'Importing collection_requests...'
\set cr `cat data/26-collection-requests.json`
SELECT import_json_array('collection_requests', :'cr'::jsonb);

-- 10. Daily reports
\echo 'Importing daily_reports...'
\set dr `cat data/27-daily-reports.json`
SELECT import_json_array('daily_reports', :'dr'::jsonb);

\echo 'Importing daily_report_orders...'
\set dro `cat data/28-daily-report-orders.json`
SELECT import_json_array('daily_report_orders', :'dro'::jsonb);

\echo 'Importing daily_report_staff...'
\set drs `cat data/29-daily-report-staff.json`
SELECT import_json_array('daily_report_staff', :'drs'::jsonb);

\echo 'Importing daily_report_date_locks...'
\set drl `cat data/30-daily-report-date-locks.json`
SELECT import_json_array('daily_report_date_locks', :'drl'::jsonb);

-- 11. Bank card transactions
\echo 'Importing bank_card_transactions...'
\set bct `cat data/31-bank-card-transactions.json`
SELECT import_json_array('bank_card_transactions', :'bct'::jsonb);

-- 12. Wallet & Notifications
\echo 'Importing wallet_transactions...'
\set wt `cat data/32-wallet-transactions.json`
SELECT import_json_array('wallet_transactions', :'wt'::jsonb);

\echo 'Importing notifications...'
\set notif `cat data/39-notifications.json`
SELECT import_json_array('notifications', :'notif'::jsonb);

-- 13. Media references
\echo 'Importing project_media...'
\set pm `cat data/33-project-media.json`
SELECT import_json_array('project_media', :'pm'::jsonb);

\echo 'Importing daily_report_order_media...'
\set drom `cat data/34-daily-report-order-media.json`
SELECT import_json_array('daily_report_order_media', :'drom'::jsonb);

-- 14. Misc
\echo 'Importing expert_pricing_requests...'
\set epr `cat data/35-expert-pricing-requests.json`
SELECT import_json_array('expert_pricing_requests', :'epr'::jsonb);

\echo 'Importing audit_log...'
\set al `cat data/38-audit-log.json`
SELECT import_json_array('audit_log', :'al'::jsonb);

\echo 'Importing approved_media...'
\set am `cat data/48-approved-media.json`
SELECT import_json_array('approved_media', :'am'::jsonb);

\echo 'Importing module_shortcuts...'
\set ms `cat data/43-module-shortcuts.json`
SELECT import_json_array('module_shortcuts', :'ms'::jsonb);

\echo 'Importing profile_photos...'
\set pp `cat data/44-profile-photos.json`
SELECT import_json_array('profile_photos', :'pp'::jsonb);

\echo '=== Import Complete ==='

-- Cleanup
DROP FUNCTION import_json_array(text, jsonb);
