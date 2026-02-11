-- Add module_href and module_description to module_assignments for custom modules
ALTER TABLE public.module_assignments 
  ADD COLUMN IF NOT EXISTS module_href TEXT,
  ADD COLUMN IF NOT EXISTS module_description TEXT;

-- Backfill existing assignments with known hrefs
UPDATE public.module_assignments SET module_href = '/executive' WHERE module_key = 'scaffold_execution_with_materials' AND module_href IS NULL;
UPDATE public.module_assignments SET module_href = '/daily-report' WHERE module_key = 'daily_report' AND module_href IS NULL;
UPDATE public.module_assignments SET module_href = '/hr-management' WHERE module_key = 'hr_management' AND module_href IS NULL;
UPDATE public.module_assignments SET module_href = '/personnel-accounting' WHERE module_key = 'personnel_accounting' AND module_href IS NULL;
UPDATE public.module_assignments SET module_href = '/site-registration' WHERE module_key = 'site_registration' AND module_href IS NULL;
UPDATE public.module_assignments SET module_href = '/comprehensive-accounting' WHERE module_key = 'comprehensive_accounting' AND module_href IS NULL;
UPDATE public.module_assignments SET module_href = '/customer-comprehensive-invoice' WHERE module_key = 'customer_comprehensive_invoice' AND module_href IS NULL;
UPDATE public.module_assignments SET module_href = '/my-invoice' WHERE module_key = 'my_invoice' AND module_href IS NULL;
UPDATE public.module_assignments SET module_href = '/site-analytics' WHERE module_key = 'site_analytics' AND module_href IS NULL;
UPDATE public.module_assignments SET module_href = '/media-approval' WHERE module_key = 'media_approval' AND module_href IS NULL;
UPDATE public.module_assignments SET module_href = '/bank-cards' WHERE module_key = 'bank_cards' AND module_href IS NULL;

-- Backfill custom modules by name heuristics
UPDATE public.module_assignments SET module_href = '/executive' WHERE module_key LIKE 'custom-%' AND module_href IS NULL AND (module_name LIKE '%داربست%' OR module_name LIKE '%اجرایی%' OR module_name LIKE '%سفارشات%');
UPDATE public.module_assignments SET module_href = '/daily-report' WHERE module_key LIKE 'custom-%' AND module_href IS NULL AND module_name LIKE '%گزارش روزانه%';
UPDATE public.module_assignments SET module_href = '/hr-management' WHERE module_key LIKE 'custom-%' AND module_href IS NULL AND module_name LIKE '%منابع انسانی%';
UPDATE public.module_assignments SET module_href = '/all-company-orders' WHERE module_key LIKE 'custom-%' AND module_href IS NULL AND module_name LIKE '%کل سفارشات%';